import { withApplicationNoticeContext } from '../services/applicationNotice.service';
import { Request, Response, NextFunction } from 'express';
import { EventoAlerta, EstadoAlerta, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { domainEvents } from '../services/domainEvent.service';
import { detectGpsReceptionObservations } from '../services/gpsReceptionObservations.service';
import { AppError } from '../middlewares/errorHandler';
import { normalizeAlertCondition } from '../services/alertRuleCondition.service';
import { validateFollowupRule, alertResolution, FOLLOWUP_RULE_ID, followupDays } from '../services/alertFollowupPolicy.service';
import { ejecutarSeguimientoCierre, simularSeguimientoCierre } from '../jobs/seguimientoCierre.job';
import { catalogueCondition, validateCatalogueRule, CATALOGUE_MARKER } from '../services/alertCataloguePolicy.service';
import { ejecutarCatalogo, simularCatalogo } from '../jobs/alertCatalogue.job';
import { withCompanyNoticeContext } from '../services/companyNotice.service';
import { maskFiscalCompanyNotice, withFiscalCompanyNoticeContext } from '../services/fiscalCompanyNotice.service';
import { maskManifestRuleCompanyNotice, withManifestRuleCompanyNoticeContext } from '../services/manifestRuleCompanyNotice.service';
import { assertCanAccessManifiesto } from '../utils/roleFilter';
import { createHash } from 'node:crypto';
import { transitRuleNeedsThreshold } from '../services/transitDurationPolicy.service';
import { recordGpsAnomaly } from '../services/gpsAnomalyRecorder.service';
import { notificationService } from '../services/notification-dispatcher.service';

const ALERT_RECIPIENT_ROLES = new Set(['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'INSPECCIONADO', 'INSPECTOR_ASIGNADO']);
function normalizeAlertRecipients(raw: unknown): string {
    let parsed = raw;
    if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch { throw new AppError('Los destinatarios no contienen JSON válido', 400); }
    }
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 30) throw new AppError('Seleccione al menos un destinatario válido', 400);
    const recipients = Array.from(new Set(parsed.map(String)));
    for (const recipient of recipients) {
        if (ALERT_RECIPIENT_ROLES.has(recipient)) continue;
        if (recipient.startsWith('email:') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.slice(6))) continue;
        throw new AppError(`Destinatario no permitido: ${recipient}`, 400);
    }
    return JSON.stringify(recipients);
}

// Re-export notificationService so existing imports continue to work
export { notificationService } from '../services/notification-dispatcher.service';

// ============ CONTROLADOR DE NOTIFICACIONES ============

/** Historical own-account notices did not carry their activity. Enrich the read
 * in one bounded query, without rewriting the original notification/audit row. */
async function withInspectionActivity<T extends { datos: string | null }>(notices: T[]): Promise<T[]> {
    const references = notices.map(notice => {
        try {
            const data = JSON.parse(notice.datos || 'null');
            return data?.version === 1 && ['intercambio_inspeccion', 'agenda_inspeccion'].includes(data.tipo)
                && data.destino === 'participacion' && !data.tipoActor && typeof data.inspeccionId === 'string' ? data : null;
        } catch { return null; }
    });
    const ids = [...new Set(references.filter(Boolean).map(data => data.inspeccionId as string))];
    if (!ids.length) return notices;
    const cases = await prisma.inspeccion.findMany({ where: { id: { in: ids } }, select: { id: true, tipoActor: true } });
    const roles = new Map(cases.map(item => [item.id, item.tipoActor]));
    return notices.map((notice, index) => references[index] && roles.get(references[index].inspeccionId)
        ? { ...notice, datos: JSON.stringify({ ...references[index], tipoActor: roles.get(references[index].inspeccionId) }) } : notice);
}

// Obtener notificaciones del usuario actual
export const getNotificaciones = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usuarioId = (req as AuthRequest).user!.id;
        const { leida, limit = 20, offset = 0 } = req.query;
        const limitNum = Math.min(500, Math.max(1, parseInt(limit as string)));

        const where: any = { usuarioId };
        if (leida === 'false') where.leida = false;
        if (leida === 'true') where.leida = true;

        const [notificaciones, total, noLeidas] = await Promise.all([
            prisma.notificacion.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limitNum,
                skip: parseInt(offset as string),
                include: {
                    manifiesto: {
                        select: { numero: true, estado: true }
                    }
                }
            }),
            prisma.notificacion.count({ where }),
            prisma.notificacion.count({ where: { usuarioId, leida: false } })
        ]);
        const linked = notificaciones.flatMap<{ id: string; manifiestoId: string | null; noticeId: string }>(notice => {
            try {
                const data = JSON.parse(notice.datos || 'null');
                if (data?.familia === 'catalogo_verificable' && data.version === 1 && typeof data.casoId === 'string') {
                    return [{ id: data.casoId as string, manifiestoId: null, noticeId: notice.id }];
                }
                return data?.tipo === 'seguimiento_cierre' && data.version === 1 && typeof data.casoId === 'string' && notice.manifiestoId
                    ? [{ id: data.casoId as string, manifiestoId: notice.manifiestoId, noticeId: notice.id }] : [];
            } catch { return []; }
        });
        // Only linked cases for manifests already in this user's own notice page.
        // One bounded batch; never expose the administrative case list to actors.
        const cases = linked.length ? await prisma.alertaGenerada.findMany({
            where: { OR: linked.map(({ id, manifiestoId }) => ({ id, manifiestoId })) }, select: { id: true, estado: true },
        }) : [];
        const stateByCase = new Map(cases.map(item => [item.id, item.estado]));
        const caseByNotice = new Map(linked.map(item => [item.noticeId, item.id]));

        const contextualNotices = await withManifestRuleCompanyNoticeContext(prisma, await withFiscalCompanyNoticeContext(prisma, await withApplicationNoticeContext(prisma, await withCompanyNoticeContext(prisma, await withInspectionActivity(notificaciones)))));
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({
            success: true,
            data: {
                notificaciones: contextualNotices.map(notice => ({ ...notice,
                    seguimientoEstado: stateByCase.get(caseByNotice.get(notice.id) || '') ?? null })),
                total,
                noLeidas,
                pagina: Math.floor(parseInt(offset as string) / limitNum) + 1,
                totalPaginas: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        next(error);
    }
};

// Stable, read-only permalink: even administrators may only read their own notice.
export const getNotificacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as AuthRequest).user!;
        const notice = await prisma.notificacion.findFirst({ where: { id: req.params.id, usuarioId: user.id },
            include: { manifiesto: { select: { numero: true, estado: true } } } });
        if (!notice) throw new AppError('Aviso no disponible para esta cuenta', 404);
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({ success: true, data: (await withManifestRuleCompanyNoticeContext(prisma, await withFiscalCompanyNoticeContext(prisma, await withApplicationNoticeContext(prisma, await withCompanyNoticeContext(prisma, await withInspectionActivity([notice]))))))[0] });
    } catch (error) { next(error); }
};

// Marcar notificacion como leida
export const marcarLeida = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const usuarioId = (req as AuthRequest).user!.id;

        const notificacion = await prisma.notificacion.update({
            where: { id, usuarioId },
            data: { leida: true, fechaLeida: new Date() }
        });

        res.json({ success: true, data: maskManifestRuleCompanyNotice(maskFiscalCompanyNotice(notificacion)) });
    } catch (error) {
        next(error);
    }
};

// Marcar todas como leidas
export const marcarTodasLeidas = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usuarioId = (req as AuthRequest).user!.id;

        await prisma.notificacion.updateMany({
            where: { usuarioId, leida: false },
            data: { leida: true, fechaLeida: new Date() }
        });

        res.json({ success: true, message: 'Todas las notificaciones marcadas como leidas' });
    } catch (error) {
        next(error);
    }
};

// Eliminar notificacion
export const eliminarNotificacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const usuarioId = (req as AuthRequest).user!.id;

        await prisma.notificacion.delete({
            where: { id, usuarioId }
        });

        res.json({ success: true, message: 'Notificacion eliminada' });
    } catch (error) {
        next(error);
    }
};

// ============ CONTROLADOR DE REGLAS DE ALERTA ============

// Obtener reglas de alerta
export const getReglasAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const reglas = await prisma.reglaAlerta.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                creadoPor: { select: { nombre: true, apellido: true } },
                _count: { select: { alertasGeneradas: true } }
            }
        });

        res.json({ success: true, data: reglas.map(regla => ({
            ...regla, requiereUmbralTransito: transitRuleNeedsThreshold(regla.evento, regla.condicion),
        })) });
    } catch (error) {
        next(error);
    }
};

// Crear regla de alerta
export const crearReglaAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usuarioId = (req as AuthRequest).user!.id;
        const { nombre, descripcion, evento, condicion, destinatarios, activa = true } = req.body;
        if (!Object.values(EventoAlerta).includes(evento) || typeof activa !== 'boolean' || typeof nombre !== 'string' || !nombre.trim()) throw new AppError('Nombre, evento y estado de regla inválidos', 400);

        let condicionStr: string;
        try { condicionStr = normalizeAlertCondition(condicion); }
        catch (error) { throw new AppError(error instanceof Error ? error.message : 'Condición inválida', 400); }
        const destinatariosStr = normalizeAlertRecipients(destinatarios);
        validateFollowupRule(evento, condicionStr, destinatariosStr);
        validateCatalogueRule(evento, condicionStr, destinatariosStr);
        if (activa && transitRuleNeedsThreshold(evento, condicionStr)) throw new AppError('Indicá un umbral mínimo de horas de tránsito para activar esta regla.', 400);

        const regla = await prisma.reglaAlerta.create({
            data: {
                nombre,
                descripcion,
                evento: evento as EventoAlerta,
                condicion: condicionStr,
                destinatarios: destinatariosStr,
                creadoPorId: usuarioId,
                activa
            }
        });

        res.status(201).json({ success: true, data: regla });
    } catch (error) {
        next(error);
    }
};

// Actualizar regla de alerta
export const actualizarReglaAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, evento, condicion, destinatarios, activa } = req.body;

        // Frontend already sends condicion and destinatarios as JSON strings — do NOT re-stringify
        let condicionStr: string | undefined;
        if (condicion !== undefined) {
            try { condicionStr = normalizeAlertCondition(condicion); }
            catch (error) { throw new AppError(error instanceof Error ? error.message : 'Condición inválida', 400); }
        }
        const destinatariosStr = destinatarios === undefined ? undefined : normalizeAlertRecipients(destinatarios);
        const current = await prisma.reglaAlerta.findUnique({ where: { id } });
        if (!current) throw new AppError('Regla no encontrada', 404);
        if (evento !== undefined && !Object.values(EventoAlerta).includes(evento)) throw new AppError('Evento inválido', 400);
        if (activa !== undefined && typeof activa !== 'boolean') throw new AppError('Estado de regla inválido', 400);
        validateFollowupRule(evento ?? current.evento, condicionStr ?? current.condicion, destinatariosStr ?? current.destinatarios);
        validateCatalogueRule(evento ?? current.evento, condicionStr ?? current.condicion, destinatariosStr ?? current.destinatarios);
        if ((activa ?? current.activa) && transitRuleNeedsThreshold(evento ?? current.evento, condicionStr ?? current.condicion)) {
            throw new AppError('Indicá un umbral mínimo de horas de tránsito para activar esta regla.', 400);
        }
        if (catalogueCondition(current.condicion)?.tipo !== catalogueCondition(condicionStr ?? current.condicion)?.tipo &&
            await prisma.alertaGenerada.count({ where: { reglaId: id } })) throw new AppError('Una regla con casos históricos no puede cambiar de familia; desactívela y cree otra', 409);
        if (id === FOLLOWUP_RULE_ID && followupDays(condicionStr ?? current.condicion) === null) throw new AppError('La regla de seguimiento existente sólo puede configurarse o desactivarse', 400);

        const regla = await prisma.reglaAlerta.update({
            where: { id },
            data: {
                nombre,
                descripcion,
                evento: evento as EventoAlerta,
                condicion: condicionStr,
                destinatarios: destinatariosStr,
                activa
            }
        });

        res.json({ success: true, data: regla });
    } catch (error) {
        next(error);
    }
};

// Eliminar regla de alerta
export const eliminarReglaAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (id === FOLLOWUP_RULE_ID) throw new AppError('Desactive el seguimiento para conservar su configuración e historial', 409);
        if (await prisma.alertaGenerada.count({ where: { reglaId: id } })) throw new AppError('Esta regla tiene casos históricos; desactívela para conservar la trazabilidad', 409);
        await prisma.reglaAlerta.delete({ where: { id } });

        res.json({ success: true, message: 'Regla eliminada' });
    } catch (error) {
        next(error);
    }
};

// ============ CONTROLADOR DE ALERTAS GENERADAS ============

// Obtener alertas generadas
export const getAlertasGeneradas = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { estado, evento, reglaId, fechaDesde, limit = 50, page = 1, offset } = req.query;
        const alertasLimit = Math.min(500, Math.max(1, Number(limit)));
        const skip = offset === undefined ? (Number(page) - 1) * alertasLimit : Number(offset);
        if (!Number.isInteger(alertasLimit) || !Number.isInteger(skip) || skip < 0) throw new AppError('Paginación inválida', 400);
        const where: Prisma.AlertaGeneradaWhereInput = {};
        const role = (req as AuthRequest).user?.rol;
        if (role?.startsWith('ADMIN_')) where.AND = [{ OR: [
            { NOT: { datos: { contains: CATALOGUE_MARKER } } },
            { datos: { contains: JSON.stringify({ tipoActor: role.slice(6) }).slice(1, -1) } },
        ] }];
        if (estado) {
            const states = String(estado).split(',');
            if (states.some(state => !Object.values(EstadoAlerta).includes(state as EstadoAlerta))) throw new AppError('Estado de caso inválido', 400);
            where.estado = { in: states as EstadoAlerta[] };
        }
        if (evento) {
            if (!Object.values(EventoAlerta).includes(evento as EventoAlerta)) throw new AppError('Evento inválido', 400);
            where.regla = { evento: evento as EventoAlerta };
        }
        if (reglaId) where.reglaId = String(reglaId);
        if (fechaDesde) {
            const date = new Date(String(fechaDesde));
            if (!Number.isFinite(date.getTime())) throw new AppError('Fecha inválida', 400);
            where.createdAt = { gte: date };
        }

        const [alertas, total] = await Promise.all([
            prisma.alertaGenerada.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: alertasLimit,
                skip,
                include: {
                    regla: { select: { nombre: true, evento: true } },
                    manifiesto: { select: { numero: true, estado: true } }
                }
            }),
            prisma.alertaGenerada.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                alertas,
                total,
                pagina: Math.floor(skip / alertasLimit) + 1,
                limit: alertasLimit,
                totalPaginas: Math.max(1, Math.ceil(total / alertasLimit))
            }
        });
    } catch (error) {
        next(error);
    }
};

// Resolver alerta
export const resolverAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { estado, notas } = req.body;
        const usuarioId = (req as AuthRequest).user!.id;

        const role = (req as AuthRequest).user!.rol;
        if (role?.startsWith('ADMIN_')) {
            const item = await prisma.alertaGenerada.findUnique({ where: { id } });
            if (!item) throw new AppError('Caso no encontrado', 404);
            if (item.datos.includes(CATALOGUE_MARKER) && JSON.parse(item.datos).tipoActor !== role.slice(6)) throw new AppError('Caso fuera de su ámbito', 403);
        }
        const alerta = await prisma.alertaGenerada.update({
            where: { id },
            data: alertResolution(estado, notas, usuarioId)
        });

        res.json({ success: true, data: alerta });
    } catch (error) {
        next(error);
    }
};

export const simularSeguimientoAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await simularSeguimientoCierre(req.body.diasRecepcion) }); }
    catch (error) { next(error); }
};

export const evaluarSeguimientoAlerta = async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: { avisosActualizados: await ejecutarSeguimientoCierre(), canal: 'interno' } }); }
    catch (error) { next(error); }
};

export const simularCatalogoAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let raw: string;
        try { raw = normalizeAlertCondition(req.body.condicion); if (!catalogueCondition(raw)) throw new AppError('Familia no admitida', 400); }
        catch (error) { throw new AppError(error instanceof Error ? error.message : 'Condición inválida', 400); }
        res.json({ success: true, data: await simularCatalogo(raw) });
    } catch (error) { next(error); }
};

export const evaluarCatalogoAlerta = async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: { avisosActualizados: await ejecutarCatalogo(), canal: 'interno' } }); }
    catch (error) { next(error); }
};

// ============ DETECCION DE ANOMALIAS GPS ============

class AnomaliaDetector {
    // Detectar anomalias en la ruta
    async detectarAnomalias(manifiestoId: string, userId?: string, options: { automatic?: boolean } = {}): Promise<any[]> {
        const anomaliasDetectadas: any[] = [];

        // Obtener tracking del manifiesto
        const tracking = await prisma.trackingGPS.findMany({
            where: { manifiestoId },
            orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
            select: { id: true, latitud: true, longitud: true, timestamp: true, tramoId: true, emisor: true,
                tramo: { select: { orden: true } } }
        });

        if (tracking.length < 2) return anomaliasDetectadas;

        // Obtener info del manifiesto
        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id: manifiestoId },
            include: {
                generador: true,
                operador: true
            }
        });

        if (!manifiesto) return anomaliasDetectadas;

        const observations = detectGpsReceptionObservations(tracking, { userId, automatic: options.automatic });

        // Guardar anomalias detectadas
        for (const { anomaly: anomalia, previousId, currentId, authorId } of observations) {
            anomaliasDetectadas.push(anomalia);
            // Pair and anomaly type identify the same observation across
            // repeated analyses and separate workers, without a schema change.
            const id = 'gpsan1_' + createHash('sha256')
                .update(JSON.stringify([manifiestoId, anomalia.tipo, previousId, currentId])).digest('hex');
            const event = {
                type: 'ANOMALIA_GPS' as const,
                manifiestoId,
                numero: manifiesto.numero,
                tipoAnomalia: anomalia.tipo,
                descripcion: anomalia.descripcion,
                severidad: anomalia.severidad,
                userId: authorId,
                avisosConfirmados: true,
            };
            const recorded = await recordGpsAnomaly(prisma, { id, manifiestoId, isDemoData: manifiesto.isDemoData, ...anomalia }, event);
            if (!recorded.created) continue;

            // The inbox is committed first. Channels and configurable rules
            // remain best-effort and must not run while locks are held.
            for (const notice of recorded.notices) notificationService.programarCanalesDeNotificacion(notice);
            domainEvents.emit(event);
        }

        return anomaliasDetectadas;
    }

}

export const anomaliaDetector = new AnomaliaDetector();

// Endpoint para detectar anomalias
export const detectarAnomalias = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { manifiestoId } = req.params;
        const anomalias = await anomaliaDetector.detectarAnomalias(manifiestoId, (req as AuthRequest).user.id);
        res.json({ success: true, data: anomalias });
    } catch (error) {
        next(error);
    }
};

// Obtener anomalias de un manifiesto
export const getAnomalias = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { manifiestoId } = req.params;
        const { resuelta } = req.query;
        const user = (req as AuthRequest).user;
        if (!user) throw new AppError('No autorizado', 401);
        await assertCanAccessManifiesto(prisma, user, manifiestoId);

        const where: any = { manifiestoId };
        if (resuelta !== undefined) where.resuelta = resuelta === 'true';

        const anomalias = await prisma.anomaliaTransporte.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, data: anomalias });
    } catch (error) {
        next(error);
    }
};

// Resolver anomalia
export const resolverAnomalia = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { notas } = req.body;
        const usuarioId = (req as AuthRequest).user!.id;

        const anomalia = await prisma.anomaliaTransporte.update({
            where: { id },
            data: {
                resuelta: true,
                resueltaPor: usuarioId,
                fechaResolucion: new Date(),
                notas
            }
        });

        res.json({ success: true, data: anomalia });
    } catch (error) {
        next(error);
    }
};

// ============ CARGA MASIVA DE DATOS ============

export const cargaMasivaGeneradores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Archivo no proporcionado' });
        }

        const csv = req.file.buffer.toString('utf-8');
        const lineas = csv.split('\n').filter(l => l.trim());
        const cabecera = lineas[0].split(',').map(h => h.trim().toLowerCase());

        const resultados = {
            total: lineas.length - 1,
            exitosos: 0,
            errores: [] as { linea: number; error: string }[]
        };

        for (let i = 1; i < lineas.length; i++) {
            const valores = lineas[i].split(',').map(v => v.trim());
            const registro: any = {};
            cabecera.forEach((col, idx) => {
                registro[col] = valores[idx];
            });

            try {
                // Verificar si existe
                const existe = await prisma.generador.findUnique({
                    where: { cuit: registro.cuit }
                });

                if (existe) {
                    // Actualizar
                    await prisma.generador.update({
                        where: { cuit: registro.cuit },
                        data: {
                            razonSocial: registro.razonsocial || registro.razon_social,
                            domicilio: registro.domicilio,
                            telefono: registro.telefono,
                            email: registro.email,
                            numeroInscripcion: registro.numeroinscripcion || registro.numero_inscripcion,
                            categoria: registro.categoria
                        }
                    });
                } else {
                    // Crear usuario y generador
                    const password = await require('bcryptjs').hash('temporal123', 10);
                    const usuario = await prisma.usuario.create({
                        data: {
                            email: registro.email,
                            password,
                            rol: 'GENERADOR',
                            nombre: registro.razonsocial || registro.razon_social,
                            cuit: registro.cuit,
                            activo: true
                        }
                    });

                    await prisma.generador.create({
                        data: {
                            usuarioId: usuario.id,
                            razonSocial: registro.razonsocial || registro.razon_social,
                            cuit: registro.cuit,
                            domicilio: registro.domicilio,
                            telefono: registro.telefono,
                            email: registro.email,
                            numeroInscripcion: registro.numeroinscripcion || registro.numero_inscripcion || 'PENDIENTE',
                            categoria: registro.categoria || 'General'
                        }
                    });
                }

                resultados.exitosos++;
            } catch (error: any) {
                resultados.errores.push({
                    linea: i + 1,
                    error: error.message
                });
            }
        }

        res.json({ success: true, data: resultados });
    } catch (error) {
        next(error);
    }
};

export const cargaMasivaTransportistas = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Archivo no proporcionado' });
        }

        const csv = req.file.buffer.toString('utf-8');
        const lineas = csv.split('\n').filter(l => l.trim());
        const cabecera = lineas[0].split(',').map(h => h.trim().toLowerCase());

        const resultados = {
            total: lineas.length - 1,
            exitosos: 0,
            errores: [] as { linea: number; error: string }[]
        };

        for (let i = 1; i < lineas.length; i++) {
            const valores = lineas[i].split(',').map(v => v.trim());
            const registro: any = {};
            cabecera.forEach((col, idx) => {
                registro[col] = valores[idx];
            });

            try {
                const existe = await prisma.transportista.findUnique({
                    where: { cuit: registro.cuit }
                });

                if (existe) {
                    await prisma.transportista.update({
                        where: { cuit: registro.cuit },
                        data: {
                            razonSocial: registro.razonsocial || registro.razon_social,
                            domicilio: registro.domicilio,
                            telefono: registro.telefono,
                            email: registro.email,
                            numeroHabilitacion: registro.numerohabilitacion || registro.numero_habilitacion
                        }
                    });
                } else {
                    const password = await require('bcryptjs').hash('temporal123', 10);
                    const usuario = await prisma.usuario.create({
                        data: {
                            email: registro.email,
                            password,
                            rol: 'TRANSPORTISTA',
                            nombre: registro.razonsocial || registro.razon_social,
                            cuit: registro.cuit,
                            activo: true
                        }
                    });

                    await prisma.transportista.create({
                        data: {
                            usuarioId: usuario.id,
                            razonSocial: registro.razonsocial || registro.razon_social,
                            cuit: registro.cuit,
                            domicilio: registro.domicilio,
                            telefono: registro.telefono,
                            email: registro.email,
                            numeroHabilitacion: registro.numerohabilitacion || registro.numero_habilitacion || 'PENDIENTE'
                        }
                    });
                }

                resultados.exitosos++;
            } catch (error: any) {
                resultados.errores.push({
                    linea: i + 1,
                    error: error.message
                });
            }
        }

        res.json({ success: true, data: resultados });
    } catch (error) {
        next(error);
    }
};

export const cargaMasivaOperadores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Archivo no proporcionado' });
        }

        const csv = req.file.buffer.toString('utf-8');
        const lineas = csv.split('\n').filter(l => l.trim());
        const cabecera = lineas[0].split(',').map(h => h.trim().toLowerCase());

        const resultados = {
            total: lineas.length - 1,
            exitosos: 0,
            errores: [] as { linea: number; error: string }[]
        };

        for (let i = 1; i < lineas.length; i++) {
            const valores = lineas[i].split(',').map(v => v.trim());
            const registro: any = {};
            cabecera.forEach((col, idx) => {
                registro[col] = valores[idx];
            });

            try {
                const existe = await prisma.operador.findUnique({
                    where: { cuit: registro.cuit }
                });

                if (existe) {
                    await prisma.operador.update({
                        where: { cuit: registro.cuit },
                        data: {
                            razonSocial: registro.razonsocial || registro.razon_social,
                            domicilio: registro.domicilio,
                            telefono: registro.telefono,
                            email: registro.email,
                            numeroHabilitacion: registro.numerohabilitacion || registro.numero_habilitacion,
                            categoria: registro.categoria
                        }
                    });
                } else {
                    const password = await require('bcryptjs').hash('temporal123', 10);
                    const usuario = await prisma.usuario.create({
                        data: {
                            email: registro.email,
                            password,
                            rol: 'OPERADOR',
                            nombre: registro.razonsocial || registro.razon_social,
                            cuit: registro.cuit,
                            activo: true
                        }
                    });

                    await prisma.operador.create({
                        data: {
                            usuarioId: usuario.id,
                            razonSocial: registro.razonsocial || registro.razon_social,
                            cuit: registro.cuit,
                            domicilio: registro.domicilio,
                            telefono: registro.telefono,
                            email: registro.email,
                            numeroHabilitacion: registro.numerohabilitacion || registro.numero_habilitacion || 'PENDIENTE',
                            categoria: registro.categoria || 'General'
                        }
                    });
                }

                resultados.exitosos++;
            } catch (error: any) {
                resultados.errores.push({
                    linea: i + 1,
                    error: error.message
                });
            }
        }

        res.json({ success: true, data: resultados });
    } catch (error) {
        next(error);
    }
};

// Descargar plantilla CSV
export const descargarPlantilla = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tipo } = req.params;

        const plantillas: Record<string, string> = {
            generadores: 'cuit,razon_social,domicilio,telefono,email,numero_inscripcion,categoria\n30-12345678-9,Empresa Demo SA,Av. Ejemplo 1234,261-4567890,contacto@empresa.com,MDZ-001-2024,Industrial',
            transportistas: 'cuit,razon_social,domicilio,telefono,email,numero_habilitacion\n30-98765432-1,Transporte Demo SRL,Ruta 40 Km 5,261-9876543,info@transporte.com,HAB-T-001',
            operadores: 'cuit,razon_social,domicilio,telefono,email,numero_habilitacion,categoria\n30-55555555-5,Operador Demo SA,Parque Industrial 100,261-5555555,operador@demo.com,HAB-O-001,Disposicion Final'
        };

        if (!plantillas[tipo]) {
            return res.status(400).json({ success: false, error: 'Tipo de plantilla no valido' });
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=plantilla_${tipo}.csv`);
        res.send(plantillas[tipo]);
    } catch (error) {
        next(error);
    }
};
