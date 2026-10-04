import { Request, Response, NextFunction } from 'express';
import { EventoAlerta, EstadoAlerta, TipoAnomalia, SeveridadAnomalia, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { domainEvents } from '../services/domainEvent.service';
import { AppError } from '../middlewares/errorHandler';
import { normalizeAlertCondition } from '../services/alertRuleCondition.service';
import { validateFollowupRule, alertResolution, FOLLOWUP_RULE_ID, followupDays } from '../services/alertFollowupPolicy.service';
import { ejecutarSeguimientoCierre, simularSeguimientoCierre } from '../jobs/seguimientoCierre.job';
import { catalogueCondition, validateCatalogueRule, CATALOGUE_MARKER } from '../services/alertCataloguePolicy.service';
import { ejecutarCatalogo, simularCatalogo } from '../jobs/alertCatalogue.job';

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

        res.json({
            success: true,
            data: {
                notificaciones: notificaciones.map(notice => ({ ...notice,
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

// Marcar notificacion como leida
export const marcarLeida = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const usuarioId = (req as AuthRequest).user!.id;

        const notificacion = await prisma.notificacion.update({
            where: { id, usuarioId },
            data: { leida: true, fechaLeida: new Date() }
        });

        res.json({ success: true, data: notificacion });
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

        res.json({ success: true, data: reglas });
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

interface PuntoGPS {
    latitud: number;
    longitud: number;
    timestamp: Date;
    velocidad?: number;
}

class AnomaliaDetector {
    // Calcular distancia entre dos puntos en km (Haversine)
    private calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radio de la Tierra en km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    // Detectar anomalias en la ruta
    async detectarAnomalias(manifiestoId: string, userId?: string): Promise<any[]> {
        const anomaliasDetectadas: any[] = [];

        // Obtener tracking del manifiesto
        const tracking = await prisma.trackingGPS.findMany({
            where: { manifiestoId },
            orderBy: { timestamp: 'asc' }
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

        // Analizar puntos
        for (let i = 1; i < tracking.length; i++) {
            const puntoAnterior = tracking[i - 1];
            const puntoActual = tracking[i];

            // Calcular distancia y tiempo
            const distancia = this.calcularDistancia(
                puntoAnterior.latitud, puntoAnterior.longitud,
                puntoActual.latitud, puntoActual.longitud
            );
            const tiempoHoras = (puntoActual.timestamp.getTime() - puntoAnterior.timestamp.getTime()) / (1000 * 60 * 60);
            const velocidadCalculada = tiempoHoras > 0 ? distancia / tiempoHoras : 0;

            // 1. Detectar velocidad anormal (> 120 km/h)
            if (velocidadCalculada > 120) {
                anomaliasDetectadas.push({
                    tipo: 'VELOCIDAD_ANORMAL' as TipoAnomalia,
                    descripcion: `Velocidad anormalmente alta detectada: ${velocidadCalculada.toFixed(1)} km/h`,
                    latitud: puntoActual.latitud,
                    longitud: puntoActual.longitud,
                    valorDetectado: velocidadCalculada,
                    valorEsperado: 100,
                    severidad: 'ALTA' as SeveridadAnomalia
                });
            }

            // 2. Detectar parada prolongada (> 2 horas sin movimiento significativo)
            if (distancia < 0.1 && tiempoHoras > 2) {
                anomaliasDetectadas.push({
                    tipo: 'PARADA_PROLONGADA' as TipoAnomalia,
                    descripcion: `Parada prolongada de ${(tiempoHoras * 60).toFixed(0)} minutos`,
                    latitud: puntoActual.latitud,
                    longitud: puntoActual.longitud,
                    valorDetectado: tiempoHoras * 60,
                    valorEsperado: 60,
                    severidad: tiempoHoras > 4 ? 'ALTA' as SeveridadAnomalia : 'MEDIA' as SeveridadAnomalia
                });
            }

            // 3. Detectar perdida de GPS (gap > 30 min sin datos)
            if (tiempoHoras > 0.5 && distancia > 10) {
                anomaliasDetectadas.push({
                    tipo: 'GPS_PERDIDO' as TipoAnomalia,
                    descripcion: `Perdida de senal GPS por ${(tiempoHoras * 60).toFixed(0)} minutos`,
                    latitud: puntoActual.latitud,
                    longitud: puntoActual.longitud,
                    valorDetectado: tiempoHoras * 60,
                    valorEsperado: 5,
                    severidad: 'MEDIA' as SeveridadAnomalia
                });
            }
        }

        // Guardar anomalias detectadas
        for (const anomalia of anomaliasDetectadas) {
            await prisma.anomaliaTransporte.create({
                data: {
                    manifiestoId,
                    ...anomalia
                }
            });

            // Emitir evento de dominio para que el alertaSubscriber maneje notificaciones y alertas
            domainEvents.emit({
                type: 'ANOMALIA_GPS',
                manifiestoId,
                tipoAnomalia: anomalia.tipo,
                descripcion: anomalia.descripcion,
                severidad: anomalia.severidad,
                userId: userId ?? manifiestoId,
            });
        }

        return anomaliasDetectadas;
    }

    // Verificar tiempo excesivo de transito
    async verificarTiempoTransito(manifiestoId: string): Promise<boolean> {
        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id: manifiestoId }
        });

        if (!manifiesto || !manifiesto.fechaRetiro || manifiesto.estado !== 'EN_TRANSITO') {
            return false;
        }

        const horasTransito = (Date.now() - manifiesto.fechaRetiro.getTime()) / (1000 * 60 * 60);
        const LIMITE_HORAS = 24; // Maximo 24 horas de transito

        if (horasTransito > LIMITE_HORAS) {
            // Crear anomalia
            await prisma.anomaliaTransporte.create({
                data: {
                    manifiestoId,
                    tipo: 'TIEMPO_EXCESIVO',
                    descripcion: `Tiempo de transito excede ${LIMITE_HORAS} horas: ${horasTransito.toFixed(1)} horas`,
                    latitud: 0,
                    longitud: 0,
                    valorDetectado: horasTransito,
                    valorEsperado: LIMITE_HORAS,
                    severidad: 'ALTA'
                }
            });

            // Emitir evento de dominio
            domainEvents.emit({
                type: 'TIEMPO_EXCESIVO',
                manifiestoId,
                horasTransito,
                numero: manifiesto.numero,
                userId: manifiestoId, // userId no disponible en este contexto
            });

            return true;
        }

        return false;
    }
}

export const anomaliaDetector = new AnomaliaDetector();

// Endpoint para detectar anomalias
export const detectarAnomalias = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { manifiestoId } = req.params;
        const anomalias = await anomaliaDetector.detectarAnomalias(manifiestoId);
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
