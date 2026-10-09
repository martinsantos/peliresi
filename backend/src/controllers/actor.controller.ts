import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { auditarActor } from '../utils/auditoria';
import { approvedOperatorModeChange, operatorModalitiesForType } from '../domain/operatorModalities';
import { actorCoordinates, actorNumber } from '../domain/actorNumbers';
import { parsePagination } from '../utils/pagination';
import { deleteAccountPreservingSupport } from '../services/supportAccountDeletion.service';
import {
    buildFiscalWhere,
    combineWhere,
    deriveSituacionFiscal,
    parseFiscalStatus,
    parseFiscalYear,
} from '../utils/generadorFiscal';

type DirectoryActorType = 'generador' | 'transportista' | 'operador';

function validateVehicleCapacity(capacidad: unknown): asserts capacidad is number {
    if (typeof capacidad !== 'number' || !Number.isFinite(capacidad) || capacidad <= 0) {
        throw new AppError('La capacidad del vehículo debe ser un número mayor que cero', 400);
    }
}

function validateInitialPassword(password: unknown, cuit: string): asserts password is string {
    if (typeof password !== 'string' || password.length < 8 || !password.trim()) {
        throw new AppError('La contraseña inicial es obligatoria y debe tener al menos 8 caracteres', 400);
    }
    if (password.replace(/\D/g, '') === String(cuit).replace(/\D/g, '') && /^[\d\s-]+$/.test(password)) {
        throw new AppError('La contraseña inicial no puede ser el CUIT', 400);
    }
}

function directoryActorIdScope(req: AuthRequest, type: DirectoryActorType) {
    if (['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'].includes(req.user?.rol) || req.user?.esInspector) return undefined;
    const ownId = req.user?.rol === type.toUpperCase() ? req.user[type]?.id : undefined;
    return ownId || { in: [] as string[] };
}

// ============== GENERADORES (CU-A06) ==============

export const getGeneradores = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const {
            search,
            activo,
            categoria,
            rubro,
            fiscalStatus: fiscalStatusQuery,
            fiscalYear: fiscalYearQuery,
            page,
            limit,
            sortBy,
            sortOrder,
        } = req.query;
        const { skip, take: limitNum, page: pageNum } = parsePagination(
            { page: page as string, limit: limit as string },
            { limit: 10, maxLimit: 5000 }
        );
        const fiscalYear = parseFiscalYear(fiscalYearQuery);
        const fiscalStatus = parseFiscalStatus(fiscalStatusQuery);
        const order: 'asc' | 'desc' = sortOrder === 'desc' ? 'desc' : 'asc';
        const GEN_SORT: Record<string, any> = {
            razonSocial: { razonSocial: order },
            cuit: { cuit: order },
            categoria: { categoria: order },
            rubro: { rubro: order },
            activo: { activo: order },
        };
        const orderBy = GEN_SORT[sortBy as string] ?? { razonSocial: 'asc' };

        const baseWhere: any = {};
        if (search) {
            baseWhere.OR = [
                { razonSocial: { contains: search as string, mode: 'insensitive' } },
                { cuit: { contains: search as string } },
                { domicilio: { contains: search as string, mode: 'insensitive' } },
                { email: { contains: search as string, mode: 'insensitive' } },
                { numeroInscripcion: { contains: search as string, mode: 'insensitive' } },
            ];
        }
        if (activo !== undefined) {
            baseWhere.activo = activo === 'true';
        }
        if (categoria) {
            baseWhere.categoria = { contains: categoria as string, mode: 'insensitive' };
        }
        if (rubro) {
            baseWhere.rubro = { contains: rubro as string, mode: 'insensitive' };
        }

        const where: any = combineWhere(baseWhere, buildFiscalWhere(fiscalStatus, fiscalYear));
        const directoryId = directoryActorIdScope(req, 'generador');
        if (directoryId !== undefined) where.id = directoryId;
        const include = {
            usuario: { select: { email: true, nombre: true, apellido: true } },
            _count: { select: { manifiestos: true } },
            pagos: {
                where: { anio: fiscalYear },
                select: { anio: true, fechaPago: true, habilitado: true },
                orderBy: { anio: 'desc' as const },
            },
            ddjj: {
                where: { anio: fiscalYear },
                select: { anio: true, presentada: true },
                orderBy: { anio: 'desc' as const },
            },
            manifiestos: {
                orderBy: { createdAt: 'desc' as const },
                take: 1,
                select: { createdAt: true },
            },
        };

        const pageQuery = async () => {
            if (sortBy !== 'ultimaActividad') {
                return prisma.generador.findMany({
                    where,
                    skip,
                    take: limitNum,
                    include,
                    orderBy,
                });
            }

            // Prisma cannot order a parent by MAX(child.createdAt). Fetch only the
            // matching ids/latest timestamps, sort the complete filtered universe,
            // then hydrate the requested page. This keeps pagination globally correct.
            const activityRows = await prisma.generador.findMany({
                where,
                select: {
                    id: true,
                    razonSocial: true,
                    manifiestos: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { createdAt: true },
                    },
                },
            });
            activityRows.sort((a, b) => {
                const aTime = a.manifiestos[0]?.createdAt.getTime() ?? 0;
                const bTime = b.manifiestos[0]?.createdAt.getTime() ?? 0;
                const byActivity = order === 'desc' ? bTime - aTime : aTime - bTime;
                return byActivity || a.razonSocial.localeCompare(b.razonSocial, 'es');
            });
            const pageIds = activityRows.slice(skip, skip + limitNum).map((row) => row.id);
            if (pageIds.length === 0) return [];
            const hydrated = await prisma.generador.findMany({
                where: { id: { in: pageIds } },
                include,
            });
            const byId = new Map(hydrated.map((row) => [row.id, row]));
            return pageIds.flatMap((id) => {
                const row = byId.get(id);
                return row ? [row] : [];
            });
        };

        const [generadores, total, activos, alDia, tefSinPago, ddjjPendiente, sinDatos] = await Promise.all([
            pageQuery(),
            prisma.generador.count({ where }),
            prisma.generador.count({ where: combineWhere(where, { activo: true }) as any }),
            prisma.generador.count({ where: combineWhere(where, buildFiscalWhere('AL_DIA', fiscalYear)) as any }),
            prisma.generador.count({ where: combineWhere(where, buildFiscalWhere('TEF_SIN_PAGO', fiscalYear)) as any }),
            prisma.generador.count({ where: combineWhere(where, buildFiscalWhere('DDJJ_PENDIENTE', fiscalYear)) as any }),
            prisma.generador.count({ where: combineWhere(where, buildFiscalWhere('SIN_DATOS', fiscalYear)) as any }),
        ]);

        const mapped = generadores.map((g: any) => ({
            ...g,
            ultimaActividad: g.manifiestos?.[0]?.createdAt || null,
            situacionFiscal: deriveSituacionFiscal(g.pagos, g.ddjj, fiscalYear),
        }));

        res.json({
            success: true,
            data: {
                generadores: mapped,
                fiscalYear,
                stats: {
                    total,
                    activos,
                    alDia,
                    requierenRevision: Math.max(0, total - alDia - sinDatos),
                    tefSinPago,
                    ddjjPendiente,
                    sinDatos,
                },
                pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create reviewed, in-app fiscal reminders for an explicit generator segment.
 * The endpoint receives resolved ids rather than a filter expression so the
 * confirmation screen and the delivered audience cannot drift apart.
 */
export const crearRecordatoriosGeneradores = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const ids: string[] = Array.isArray(req.body?.ids)
            ? Array.from(new Set<string>((req.body.ids as unknown[]).filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)))
            : [];
        const fiscalYear = Number(req.body?.fiscalYear);
        const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';

        if (ids.length === 0) throw new AppError('Seleccione al menos un generador', 400);
        if (ids.length > 5000) throw new AppError('El segmento supera el limite de 5000 destinatarios', 400);
        if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
            throw new AppError('El ejercicio fiscal es invalido', 400);
        }
        if (motivo.length < 10 || motivo.length > 500) {
            throw new AppError('El motivo debe tener entre 10 y 500 caracteres', 400);
        }

        const recipients = await prisma.generador.findMany({
            where: { id: { in: ids }, usuario: { activo: true } },
            select: { id: true, usuarioId: true },
        });
        const campaignId = `${Date.now()}-${req.user!.id}`;
        if (recipients.length > 0) {
            await prisma.notificacion.createMany({
                data: recipients.map((recipient) => ({
                    usuarioId: recipient.usuarioId,
                    tipo: 'INFO_GENERAL',
                    titulo: `Recordatorio fiscal ${fiscalYear}`,
                    mensaje: motivo,
                    prioridad: 'ALTA',
                    datos: JSON.stringify({
                        tipo: 'recordatorio_fiscal',
                        fiscalYear,
                        generadorId: recipient.id,
                        campaignId,
                        url: '/perfil',
                    }),
                })),
            });
        }

        res.status(201).json({
            success: true,
            data: {
                requested: ids.length,
                delivered: recipients.length,
                skipped: ids.length - recipients.length,
                campaignId,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getGeneradorById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const generador = await prisma.generador.findUnique({
            where: { id },
            include: {
                usuario: { select: { email: true, nombre: true, apellido: true } },
                manifiestos: {
                    take: 20,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, numero: true, estado: true, createdAt: true }
                },
                pagos: { orderBy: { anio: 'desc' } },
                ddjj: { orderBy: { anio: 'desc' } },
                documentos: { orderBy: { createdAt: 'desc' } }
            }
        });

        if (!generador) {
            throw new AppError('Generador no encontrado', 404);
        }

        res.json({ success: true, data: { generador } });
    } catch (error) {
        next(error);
    }
};

export const createGenerador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const {
            razonSocial, cuit, domicilio, telefono, email, password, nombre, numeroInscripcion, categoria, actividad, rubro, corrientesControl,
            expedienteInscripcion, domicilioLegalCalle, domicilioLegalLocalidad, domicilioLegalDepto,
            domicilioRealCalle, domicilioRealLocalidad, domicilioRealDepto,
            certificacionISO, resolucionInscripcion, factorR, montoMxR, categoriaIndividual, libroOperatoria,
            latitud, longitud, tefInputs,
        } = req.body;
        const coordinates = actorCoordinates(latitud, longitud);
        const numericFactor = actorNumber(factorR, 'Factor R'), numericAmount = actorNumber(montoMxR, 'Monto M×R');

        if (!razonSocial || !cuit || !email) {
            throw new AppError('Razón social, CUIT y email son obligatorios', 400);
        }

        // Verificar CUIT único en generadores
        const existente = await prisma.generador.findFirst({ where: { cuit } });
        if (existente) {
            throw new AppError('Ya existe un generador con ese CUIT', 400);
        }

        // Verificar email único en usuarios
        const existeEmail = await prisma.usuario.findUnique({ where: { email } });
        if (existeEmail) {
            throw new AppError('Ya existe un usuario con ese email', 400);
        }

        validateInitialPassword(password, cuit);
        const passwordHash = await bcrypt.hash(password, 10);

        const generador = await prisma.$transaction(async tx => {
            // Crear usuario asociado (admin-created → emailVerified + activo)
            const usuario = await tx.usuario.create({
                data: {
                    email,
                    password: passwordHash,
                    nombre: nombre || razonSocial,
                    cuit,
                    rol: 'GENERADOR',
                    activo: true,
                    emailVerified: true,
                }
            });

            // Crear generador
            return tx.generador.create({
                data: {
                    usuarioId: usuario.id,
                    razonSocial, cuit, domicilio, telefono, email, numeroInscripcion, categoria, actividad, rubro, corrientesControl,
                    expedienteInscripcion, domicilioLegalCalle, domicilioLegalLocalidad, domicilioLegalDepto,
                    domicilioRealCalle, domicilioRealLocalidad, domicilioRealDepto,
                    certificacionISO: certificacionISO ? new Date(certificacionISO) : undefined,
                    resolucionInscripcion,
                    factorR: numericFactor,
                    montoMxR: numericAmount,
                    categoriaIndividual, libroOperatoria,
                    ...coordinates,
                    ...(tefInputs !== undefined && { tefInputs }),
                },
                include: {
                    usuario: { select: { email: true, nombre: true } }
                }
            });
        });

        await auditarActor({ accion: 'CREATE', modulo: 'GENERADOR', datosDespues: generador, usuarioId: req.user!.id, generadorId: generador.id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.status(201).json({
            success: true,
            data: { generador },
            message: 'Generador creado. Contraseña: la definida en el formulario'
        });
    } catch (error) {
        next(error);
    }
};

export const updateGenerador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const {
            razonSocial, domicilio, telefono, email, numeroInscripcion, categoria, activo, actividad, rubro, corrientesControl,
            expedienteInscripcion, domicilioLegalCalle, domicilioLegalLocalidad, domicilioLegalDepto,
            domicilioRealCalle, domicilioRealLocalidad, domicilioRealDepto,
            certificacionISO, resolucionInscripcion, factorR, montoMxR, categoriaIndividual, libroOperatoria,
            latitud, longitud, tefInputs,
        } = req.body;
        const coordinates = actorCoordinates(latitud, longitud);
        const numericFactor = actorNumber(factorR, 'Factor R'), numericAmount = actorNumber(montoMxR, 'Monto M×R');

        const generador = await prisma.$transaction(async transaction => {
            await transaction.$queryRaw`SELECT id FROM generadores WHERE id = ${id} FOR UPDATE`;
            const antes = await transaction.generador.findUnique({ where: { id } });
            if (!antes) throw new AppError('Generador no encontrado', 404);
            const actualizado = await transaction.generador.update({
            where: { id },
            data: {
                razonSocial, domicilio, telefono, email, numeroInscripcion, categoria, activo, actividad, rubro, corrientesControl,
                expedienteInscripcion, domicilioLegalCalle, domicilioLegalLocalidad, domicilioLegalDepto,
                domicilioRealCalle, domicilioRealLocalidad, domicilioRealDepto,
                certificacionISO: certificacionISO ? new Date(certificacionISO) : certificacionISO,
                resolucionInscripcion,
                factorR: numericFactor,
                montoMxR: numericAmount,
                categoriaIndividual, libroOperatoria,
                ...coordinates,
                ...(tefInputs !== undefined && { tefInputs }),
            }
        });

        await auditarActor({ accion: 'UPDATE', modulo: 'GENERADOR', datosAntes: antes, datosDespues: actualizado, usuarioId: req.user!.id, generadorId: id, ip: req.ip, userAgent: req.headers['user-agent'] }, transaction);
            return actualizado;
        });

        res.json({ success: true, data: { generador } });
    } catch (error) {
        next(error);
    }
};

export const deleteGenerador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        // Verificar que no tenga manifiestos
        const manifiestos = await prisma.manifiesto.count({ where: { generadorId: id } });
        if (manifiestos > 0) {
            throw new AppError('No se puede eliminar un generador con manifiestos asociados', 400);
        }

        const generador = await prisma.generador.findUnique({ where: { id } });
        if (!generador) {
            throw new AppError('Generador no encontrado', 404);
        }

        // Eliminar generador y su usuario
        await deleteAccountPreservingSupport(generador.usuarioId, async db => {
            await db.generador.delete({ where: { id } });
        });

        await auditarActor({ accion: 'DELETE', modulo: 'GENERADOR', datosAntes: generador, usuarioId: req.user!.id, generadorId: id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.json({ success: true, message: 'Generador eliminado' });
    } catch (error) {
        next(error);
    }
};

// ============== TRANSPORTISTAS (CU-A07) ==============

export const getTransportistas = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { search, activo, page, limit, sortBy, sortOrder } = req.query;
        const { skip, take: limitNum, page: pageNum } = parsePagination(
            { page: page as string, limit: limit as string },
            { limit: 10, maxLimit: 500 }
        );
        const order: 'asc' | 'desc' = sortOrder === 'desc' ? 'desc' : 'asc';
        const TRANS_SORT: Record<string, any> = {
            razonSocial: { razonSocial: order },
            localidad: { localidad: order },
            activo: { activo: order },
            vehiculosCount: { vehiculos: { _count: order } },
            choferesCount: { choferes: { _count: order } },
        };
        const orderBy = TRANS_SORT[sortBy as string] ?? { razonSocial: 'asc' };

        const where: any = {};
        const directoryId = directoryActorIdScope(req, 'transportista');
        if (directoryId !== undefined) where.id = directoryId;
        if (search) {
            where.OR = [
                { razonSocial: { contains: search as string, mode: 'insensitive' } },
                { cuit: { contains: search as string } }
            ];
        }
        if (activo !== undefined) {
            where.activo = activo === 'true';
        }

        const [transportistas, total] = await Promise.all([
            prisma.transportista.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    usuario: { select: { email: true, nombre: true, apellido: true } },
                    vehiculos: true,
                    choferes: true,
                    _count: { select: { manifiestos: true } },
                    manifiestos: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
                },
                orderBy
            }),
            prisma.transportista.count({ where })
        ]);

        // Map ultimaActividad from most recent manifiesto
        let mappedT = transportistas.map((t: any) => ({
            ...t,
            ultimaActividad: t.manifiestos?.[0]?.createdAt || null,
        }));

        // Sort by ultimaActividad if requested
        if (sortBy === 'ultimaActividad') {
            mappedT.sort((a: any, b: any) => {
                const da = a.ultimaActividad ? new Date(a.ultimaActividad).getTime() : 0;
                const db = b.ultimaActividad ? new Date(b.ultimaActividad).getTime() : 0;
                return order === 'desc' ? db - da : da - db;
            });
        }

        res.json({
            success: true,
            data: {
                transportistas: mappedT,
                pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getTransportistaById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const transportista = await prisma.transportista.findUnique({
            where: { id },
            include: {
                usuario: { select: { email: true, nombre: true, apellido: true } },
                vehiculos: true,
                choferes: true
            }
        });

        if (!transportista) {
            throw new AppError('Transportista no encontrado', 404);
        }

        res.json({ success: true, data: { transportista } });
    } catch (error) {
        next(error);
    }
};

export const createTransportista = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const {
            razonSocial, cuit, domicilio, numeroHabilitacion, telefono, email, password, vehiculos, choferes,
            // Campos regulatorios DPA
            localidad, vencimientoHabilitacion, corrientesAutorizadas,
            expedienteDPA, resolucionDPA, resolucionSSP, actaInspeccion, actaInspeccion2,
            latitud, longitud,
        } = req.body;
        const coordinates = actorCoordinates(latitud, longitud);

        if (!razonSocial || !cuit || !email) {
            throw new AppError('Razón social, CUIT y email son obligatorios', 400);
        }
        if (vehiculos !== undefined) {
            if (!Array.isArray(vehiculos)) throw new AppError('Los vehículos deben ser una lista', 400);
            for (const vehiculo of vehiculos) {
                validateVehicleCapacity(vehiculo?.capacidad);
                if (typeof vehiculo.patente !== 'string' || !vehiculo.patente.trim()
                    || !['marca', 'modelo', 'numeroHabilitacion'].every(key => typeof vehiculo[key] === 'string')
                    || !Number.isInteger(vehiculo.anio)
                    || typeof vehiculo.vencimiento !== 'string' || !vehiculo.vencimiento.trim()
                    || !Number.isFinite(Date.parse(vehiculo.vencimiento))) {
                    throw new AppError('Cada vehículo necesita patente, año entero y vencimiento válido; marca, modelo y habilitación deben ser texto', 400);
                }
            }
        }
        if (choferes !== undefined) {
            if (!Array.isArray(choferes)) throw new AppError('Los choferes deben ser una lista', 400);
            for (const chofer of choferes) {
                if (!chofer || typeof chofer.nombre !== 'string' || !chofer.nombre.trim()
                    || typeof chofer.dni !== 'string' || !chofer.dni.trim()
                    || typeof chofer.licencia !== 'string'
                    || typeof chofer.vencimiento !== 'string' || !chofer.vencimiento.trim()
                    || !Number.isFinite(Date.parse(chofer.vencimiento))) {
                    throw new AppError('Cada chofer necesita nombre, DNI, licencia en texto y vencimiento válido', 400);
                }
            }
        }

        const existente = await prisma.transportista.findFirst({ where: { cuit } });
        if (existente) {
            throw new AppError('Ya existe un transportista con ese CUIT', 400);
        }

        validateInitialPassword(password, cuit);
        const passwordHash = await bcrypt.hash(password, 10);
        const transportista = await prisma.$transaction(async tx => {
            const usuario = await tx.usuario.create({
                data: {
                    email,
                    password: passwordHash,
                    nombre: razonSocial,
                    apellido: '',
                    cuit,
                    rol: 'TRANSPORTISTA',
                    activo: true,
                    emailVerified: true,
                }
            });

            return tx.transportista.create({
                data: {
                    usuarioId: usuario.id,
                    razonSocial,
                    cuit,
                    domicilio,
                    numeroHabilitacion,
                    telefono,
                    email,
                    ...(localidad !== undefined && { localidad }),
                    ...(vencimientoHabilitacion !== undefined && { vencimientoHabilitacion: new Date(vencimientoHabilitacion) }),
                    ...(corrientesAutorizadas !== undefined && { corrientesAutorizadas }),
                    ...(expedienteDPA !== undefined && { expedienteDPA }),
                    ...(resolucionDPA !== undefined && { resolucionDPA }),
                    ...(resolucionSSP !== undefined && { resolucionSSP }),
                    ...(actaInspeccion !== undefined && { actaInspeccion }),
                    ...(actaInspeccion2 !== undefined && { actaInspeccion2 }),
                    ...coordinates,
                    vehiculos: vehiculos ? {
                        create: vehiculos.map((v: any) => ({
                            patente: v.patente,
                            marca: v.marca,
                            modelo: v.modelo,
                            anio: v.anio,
                            capacidad: v.capacidad,
                            numeroHabilitacion: v.numeroHabilitacion,
                            vencimiento: new Date(v.vencimiento)
                        }))
                    } : undefined,
                    choferes: choferes ? {
                        create: choferes.map((c: any) => ({
                            nombre: c.nombre,
                            apellido: c.apellido || '',
                            dni: c.dni,
                            licencia: c.licencia,
                            vencimiento: new Date(c.vencimiento),
                            telefono: c.telefono || ''
                        }))
                    } : undefined
                },
                include: { vehiculos: true, choferes: true }
            });
        });

        await auditarActor({ accion: 'CREATE', modulo: 'TRANSPORTISTA', datosDespues: transportista, usuarioId: req.user!.id, transportistaId: transportista.id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.status(201).json({
            success: true,
            data: { transportista },
            message: 'Transportista creado. Contraseña: la definida en el formulario'
        });
    } catch (error) {
        next(error);
    }
};

export const updateTransportista = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const {
            razonSocial, domicilio, numeroHabilitacion, telefono, email, activo,
            // Campos regulatorios DPA
            localidad, vencimientoHabilitacion, corrientesAutorizadas,
            expedienteDPA, resolucionDPA, resolucionSSP, actaInspeccion, actaInspeccion2,
            latitud, longitud,
        } = req.body;
        const coordinates = actorCoordinates(latitud, longitud);

        const transportista = await prisma.$transaction(async transaction => {
            await transaction.$queryRaw`SELECT id FROM transportistas WHERE id = ${id} FOR UPDATE`;
            const antes = await transaction.transportista.findUnique({ where: { id } });
            if (!antes) throw new AppError('Transportista no encontrado', 404);
            const actualizado = await transaction.transportista.update({
            where: { id },
            data: {
                razonSocial, domicilio, numeroHabilitacion, telefono, email, activo,
                ...(localidad !== undefined && { localidad }),
                ...(vencimientoHabilitacion !== undefined && {
                    vencimientoHabilitacion: vencimientoHabilitacion ? new Date(vencimientoHabilitacion) : null,
                }),
                ...(corrientesAutorizadas !== undefined && { corrientesAutorizadas }),
                ...(expedienteDPA !== undefined && { expedienteDPA }),
                ...(resolucionDPA !== undefined && { resolucionDPA }),
                ...(resolucionSSP !== undefined && { resolucionSSP }),
                ...(actaInspeccion !== undefined && { actaInspeccion }),
                ...(actaInspeccion2 !== undefined && { actaInspeccion2 }),
                ...coordinates,
            }
        });

        await auditarActor({ accion: 'UPDATE', modulo: 'TRANSPORTISTA', datosAntes: antes, datosDespues: actualizado, usuarioId: req.user!.id, transportistaId: id, ip: req.ip, userAgent: req.headers['user-agent'] }, transaction);
            return actualizado;
        });

        res.json({ success: true, data: { transportista } });
    } catch (error) {
        next(error);
    }
};

export const deleteTransportista = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const manifiestos = await prisma.manifiesto.count({ where: { transportistaId: id } });
        if (manifiestos > 0) {
            throw new AppError('No se puede eliminar un transportista con manifiestos asociados', 400);
        }

        const transportista = await prisma.transportista.findUnique({ where: { id } });
        if (!transportista) {
            throw new AppError('Transportista no encontrado', 404);
        }

        // Eliminar vehículos y choferes asociados, luego transportista, luego usuario
        await deleteAccountPreservingSupport(transportista.usuarioId, async db => {
            await db.vehiculo.deleteMany({ where: { transportistaId: id } });
            await db.chofer.deleteMany({ where: { transportistaId: id } });
            await db.transportista.delete({ where: { id } });
        });

        await auditarActor({ accion: 'DELETE', modulo: 'TRANSPORTISTA', datosAntes: transportista, usuarioId: req.user!.id, transportistaId: id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.json({ success: true, message: 'Transportista eliminado' });
    } catch (error) {
        next(error);
    }
};

// Gestionar vehículos
export const addVehiculo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { patente, marca, modelo, anio, capacidad, numeroHabilitacion, vencimiento } = req.body;

        validateVehicleCapacity(capacidad);

        const vehiculo = await prisma.vehiculo.create({
            data: {
                transportistaId: id,
                patente,
                marca,
                modelo,
                anio,
                capacidad,
                numeroHabilitacion,
                vencimiento: new Date(vencimiento)
            }
        });

        await auditarActor({ accion: 'CREATE', modulo: 'VEHICULO', datosDespues: vehiculo, usuarioId: req.user!.id, transportistaId: id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.status(201).json({ success: true, data: { vehiculo } });
    } catch (error) {
        next(error);
    }
};

// Actualizar vehículo
export const updateVehiculo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id, vehiculoId } = req.params;
        const { patente, marca, modelo, anio, capacidad, numeroHabilitacion, vencimiento, activo } = req.body;

        const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
        if (!vehiculo) {
            throw new AppError('Vehículo no encontrado', 404);
        }
        if (vehiculo.transportistaId !== id) {
            throw new AppError('El vehículo no pertenece a este transportista', 403);
        }

        if (capacidad !== undefined) validateVehicleCapacity(capacidad);

        const updated = await prisma.vehiculo.update({
            where: { id: vehiculoId },
            data: {
                ...(patente !== undefined && { patente }),
                ...(marca !== undefined && { marca }),
                ...(modelo !== undefined && { modelo }),
                ...(anio !== undefined && { anio }),
                ...(capacidad !== undefined && { capacidad }),
                ...(numeroHabilitacion !== undefined && { numeroHabilitacion }),
                ...(vencimiento !== undefined && { vencimiento: new Date(vencimiento) }),
                ...(activo !== undefined && { activo }),
            }
        });

        await auditarActor({ accion: 'UPDATE', modulo: 'VEHICULO', datosAntes: vehiculo, datosDespues: updated, usuarioId: req.user!.id, transportistaId: id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.json({ success: true, data: { vehiculo: updated } });
    } catch (error) {
        next(error);
    }
};

// Eliminar vehículo
export const deleteVehiculo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id, vehiculoId } = req.params;

        const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
        if (!vehiculo) {
            throw new AppError('Vehículo no encontrado', 404);
        }
        if (vehiculo.transportistaId !== id) {
            throw new AppError('El vehículo no pertenece a este transportista', 403);
        }

        await prisma.vehiculo.delete({ where: { id: vehiculoId } });

        await auditarActor({ accion: 'DELETE', modulo: 'VEHICULO', datosAntes: vehiculo, usuarioId: req.user!.id, transportistaId: id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.json({ success: true, message: 'Vehículo eliminado' });
    } catch (error) {
        next(error);
    }
};

// Gestionar choferes
export const addChofer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, dni, licencia, vencimiento, telefono } = req.body;

        const chofer = await prisma.chofer.create({
            data: {
                transportistaId: id,
                nombre,
                apellido: apellido || '',
                dni,
                licencia,
                vencimiento: new Date(vencimiento),
                telefono: telefono || ''
            }
        });

        await auditarActor({ accion: 'CREATE', modulo: 'CHOFER', datosDespues: chofer, usuarioId: req.user!.id, transportistaId: id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.status(201).json({ success: true, data: { chofer } });
    } catch (error) {
        next(error);
    }
};

// Actualizar chofer
export const updateChofer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id, choferId } = req.params;
        const { nombre, apellido, dni, licencia, vencimiento, telefono, activo } = req.body;

        const chofer = await prisma.chofer.findUnique({ where: { id: choferId } });
        if (!chofer) {
            throw new AppError('Chofer no encontrado', 404);
        }
        if (chofer.transportistaId !== id) {
            throw new AppError('El chofer no pertenece a este transportista', 403);
        }

        const updated = await prisma.chofer.update({
            where: { id: choferId },
            data: {
                ...(nombre !== undefined && { nombre }),
                ...(apellido !== undefined && { apellido }),
                ...(dni !== undefined && { dni }),
                ...(licencia !== undefined && { licencia }),
                ...(vencimiento !== undefined && { vencimiento: new Date(vencimiento) }),
                ...(telefono !== undefined && { telefono }),
                ...(activo !== undefined && { activo }),
            }
        });

        await auditarActor({ accion: 'UPDATE', modulo: 'CHOFER', datosAntes: chofer, datosDespues: updated, usuarioId: req.user!.id, transportistaId: id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.json({ success: true, data: { chofer: updated } });
    } catch (error) {
        next(error);
    }
};

// Eliminar chofer
export const deleteChofer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id, choferId } = req.params;

        const chofer = await prisma.chofer.findUnique({ where: { id: choferId } });
        if (!chofer) {
            throw new AppError('Chofer no encontrado', 404);
        }
        if (chofer.transportistaId !== id) {
            throw new AppError('El chofer no pertenece a este transportista', 403);
        }

        await prisma.chofer.delete({ where: { id: choferId } });

        await auditarActor({ accion: 'DELETE', modulo: 'CHOFER', datosAntes: chofer, usuarioId: req.user!.id, transportistaId: id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.json({ success: true, message: 'Chofer eliminado' });
    } catch (error) {
        next(error);
    }
};

// ============== OPERADORES (CU-A08) ==============

export const getOperadores = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { search, activo, page, limit, sortBy, sortOrder } = req.query;
        const { skip, take: limitNum, page: pageNum } = parsePagination(
            { page: page as string, limit: limit as string },
            { limit: 10, maxLimit: 5000 }
        );
        const order: 'asc' | 'desc' = sortOrder === 'desc' ? 'desc' : 'asc';
        const OPER_SORT: Record<string, any> = {
            razonSocial: { razonSocial: order },
            categoria: { categoria: order },
            activo: { activo: order },
        };
        const orderBy = OPER_SORT[sortBy as string] ?? { razonSocial: 'asc' };

        const where: any = {};
        const directoryId = directoryActorIdScope(req, 'operador');
        if (directoryId !== undefined) where.id = directoryId;
        if (search) {
            where.OR = [
                { razonSocial: { contains: search as string, mode: 'insensitive' } },
                { cuit: { contains: search as string } }
            ];
        }
        if (activo !== undefined) {
            where.activo = activo === 'true';
        }

        const [operadores, total] = await Promise.all([
            prisma.operador.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    usuario: { select: { email: true, nombre: true, apellido: true } },
                    tratamientos: { include: { tipoResiduo: true } },
                    _count: { select: { manifiestos: true } },
                    manifiestos: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
                },
                orderBy
            }),
            prisma.operador.count({ where })
        ]);

        // Map ultimaActividad from most recent manifiesto
        let mappedO = operadores.map((o: any) => ({
            ...o,
            ultimaActividad: o.manifiestos?.[0]?.createdAt || null,
        }));

        // Sort by ultimaActividad if requested
        if (sortBy === 'ultimaActividad') {
            mappedO.sort((a: any, b: any) => {
                const da = a.ultimaActividad ? new Date(a.ultimaActividad).getTime() : 0;
                const db = b.ultimaActividad ? new Date(b.ultimaActividad).getTime() : 0;
                return order === 'desc' ? db - da : da - db;
            });
        }

        res.json({
            success: true,
            data: {
                operadores: mappedO,
                pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getOperadorById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const operador = await prisma.operador.findUnique({
            where: { id },
            include: {
                usuario: { select: { email: true, nombre: true, apellido: true } },
                tratamientos: {
                    include: { tipoResiduo: true }
                },
                documentos: { orderBy: { createdAt: 'desc' } },
                pagos: { orderBy: { anio: 'desc' } },
                ddjj: { orderBy: { anio: 'desc' } },
            }
        });

        if (!operador) {
            throw new AppError('Operador no encontrado', 404);
        }

        // Estadísticas y datos enriquecidos
        const [manifiestoStats, ultimosManifiestos, historialTratados] = await Promise.all([
            // Contar manifiestos por estado
            prisma.manifiesto.groupBy({
                by: ['estado'],
                where: { operadorId: id },
                _count: true
            }),
            // Últimos 10 manifiestos
            prisma.manifiesto.findMany({
                where: { operadorId: id },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    generador: { select: { razonSocial: true } },
                    residuos: { select: { cantidad: true, cantidadRecibida: true, unidad: true } }
                }
            }),
            // Historial de tratamientos (manifiestos TRATADO/EN_TRATAMIENTO/RECIBIDO)
            prisma.manifiesto.findMany({
                where: {
                    operadorId: id,
                    estado: { in: ['TRATADO', 'EN_TRATAMIENTO', 'RECIBIDO'] }
                },
                orderBy: { updatedAt: 'desc' },
                take: 50,
                include: {
                    residuos: { select: { cantidad: true, cantidadRecibida: true, unidad: true } }
                }
            })
        ]);

        // Procesar métodos autorizados (únicos)
        const metodosAutorizados = [...new Set(operador.tratamientos.map(t => t.metodo))];

        // Procesar residuos aceptados (códigos únicos)
        const residuosAceptados = [...new Set(operador.tratamientos.map(t => t.tipoResiduo.codigo))];

        // Estadísticas de manifiestos
        const manifiestos = {
            recibidos: manifiestoStats.find(s => s.estado === 'RECIBIDO')?._count || 0,
            enTratamiento: manifiestoStats.find(s => s.estado === 'EN_TRATAMIENTO')?._count || 0,
            cerrados: manifiestoStats.find(s => s.estado === 'TRATADO')?._count || 0,
            rechazados: manifiestoStats.find(s => s.estado === 'RECHAZADO')?._count || 0,
        };

        // Mapear últimos manifiestos para UI
        const ultimosManifiestosUI = ultimosManifiestos.map(m => ({
            id: m.id,
            numero: m.numero,
            fecha: m.createdAt,
            estado: m.estado,
            peso: m.residuos.reduce((sum, r) => sum + (r.cantidad || 0), 0),
            generador: m.generador?.razonSocial || '-'
        }));

        // Mapear historial de tratamientos (manifiestos procesados)
        const tratamientos = historialTratados.map(m => ({
            id: m.id,
            fecha: m.fechaCierre || m.fechaRecepcion || m.updatedAt,
            manifiesto: m.numero,
            metodo: metodosAutorizados[0] || 'Tratamiento estándar',
            peso: m.residuos.reduce((sum, r) => sum + (r.cantidadRecibida || r.cantidad || 0), 0),
            certificado: operador.numeroHabilitacion || '-'
        }));

        // Mapear tratamientos autorizados para UI
        const tratamientosAutorizados = operador.tratamientos.map(t => ({
            id: t.id,
            tipoResiduo: t.tipoResiduo.codigo,
            tipoResiduoNombre: t.tipoResiduo.nombre,
            metodo: t.metodo,
            capacidad: t.capacidad,
            activo: t.activo
        }));

        res.json({
            success: true,
            data: {
                operador: {
                    ...operador,
                    metodosAutorizados,
                    residuosAceptados,
                    manifiestos,
                    ultimosManifiestos: ultimosManifiestosUI,
                    tratamientos,
                    tratamientosAutorizados
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const createOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const {
            razonSocial, cuit, numeroHabilitacion, domicilio, telefono, email, password, nombre, categoria, tipoOperador, tecnologia, corrientesY,
            expedienteInscripcion, certificadoNumero,
            domicilioLegalCalle, domicilioLegalLocalidad, domicilioLegalDepto,
            domicilioRealCalle, domicilioRealLocalidad, domicilioRealDepto,
            representanteLegalNombre, representanteLegalDNI, representanteLegalTelefono,
            representanteTecnicoNombre, representanteTecnicoMatricula, representanteTecnicoTelefono,
            vencimientoHabilitacion, resolucionDPA, latitud, longitud, tefInputs,
        } = req.body;
        const coordinates = actorCoordinates(latitud, longitud);

        if (!razonSocial || !cuit || !email) {
            throw new AppError('Razon social, CUIT y email son obligatorios', 400);
        }

        const existente = await prisma.operador.findFirst({ where: { cuit } });
        if (existente) {
            throw new AppError('Ya existe un operador con ese CUIT', 400);
        }

        const existeEmail = await prisma.usuario.findUnique({ where: { email } });
        if (existeEmail) {
            throw new AppError('Ya existe un usuario con ese email', 400);
        }

        validateInitialPassword(password, cuit);
        const passwordHash = await bcrypt.hash(password, 10);
        const modalidades = ['ADMIN', 'ADMIN_OPERADOR'].includes(req.user!.rol) ? operatorModalitiesForType(tipoOperador) : undefined;
        const operador = await prisma.$transaction(async tx => {
            const usuario = await tx.usuario.create({
                data: {
                    email,
                    password: passwordHash,
                    nombre: nombre || razonSocial,
                    cuit,
                    rol: 'OPERADOR',
                    activo: true,
                    emailVerified: true,
                }
            });

            return tx.operador.create({
                data: {
                    usuarioId: usuario.id,
                    razonSocial, cuit, numeroHabilitacion, domicilio, telefono, email, categoria, tipoOperador, tecnologia, corrientesY,
                    expedienteInscripcion, certificadoNumero,
                    domicilioLegalCalle, domicilioLegalLocalidad, domicilioLegalDepto,
                    domicilioRealCalle, domicilioRealLocalidad, domicilioRealDepto,
                    representanteLegalNombre, representanteLegalDNI, representanteLegalTelefono,
                    representanteTecnicoNombre, representanteTecnicoMatricula, representanteTecnicoTelefono,
                    vencimientoHabilitacion: vencimientoHabilitacion ? new Date(vencimientoHabilitacion) : undefined,
                    resolucionDPA,
                    ...coordinates,
                    ...(tefInputs !== undefined && { tefInputs }),
                    ...(modalidades ? { modalidades } : {}),
                },
                include: { usuario: { select: { email: true, nombre: true } } }
            });
        });

        await auditarActor({ accion: 'CREATE', modulo: 'OPERADOR', datosDespues: operador, usuarioId: req.user!.id, operadorId: operador.id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.status(201).json({
            success: true,
            data: { operador },
            message: 'Operador creado. Contraseña: la definida en el formulario'
        });
    } catch (error) {
        next(error);
    }
};

export const updateOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const {
            razonSocial, numeroHabilitacion, domicilio, telefono, email, categoria, activo, tipoOperador, tecnologia, corrientesY,
            expedienteInscripcion, certificadoNumero,
            domicilioLegalCalle, domicilioLegalLocalidad, domicilioLegalDepto,
            domicilioRealCalle, domicilioRealLocalidad, domicilioRealDepto,
            representanteLegalNombre, representanteLegalDNI, representanteLegalTelefono,
            representanteTecnicoNombre, representanteTecnicoMatricula, representanteTecnicoTelefono,
            vencimientoHabilitacion, resolucionDPA, latitud, longitud, tefInputs,
        } = req.body;
        const coordinates = actorCoordinates(latitud, longitud);

        const operador = await prisma.$transaction(async transaction => {
            await transaction.$queryRaw`SELECT id FROM operadores WHERE id = ${id} FOR UPDATE`;
            const antes = await transaction.operador.findUnique({ where: { id } });
            if (!antes) throw new AppError('Operador no encontrado', 404);
            const mode = approvedOperatorModeChange(antes, tipoOperador, ['ADMIN', 'ADMIN_OPERADOR'].includes(req.user!.rol));
            const actualizado = await transaction.operador.update({
            where: { id },
            data: {
                razonSocial, numeroHabilitacion, domicilio, telefono, email, categoria, activo, tipoOperador, tecnologia, corrientesY,
                expedienteInscripcion, certificadoNumero,
                domicilioLegalCalle, domicilioLegalLocalidad, domicilioLegalDepto,
                domicilioRealCalle, domicilioRealLocalidad, domicilioRealDepto,
                representanteLegalNombre, representanteLegalDNI, representanteLegalTelefono,
                representanteTecnicoNombre, representanteTecnicoMatricula, representanteTecnicoTelefono,
                ...(vencimientoHabilitacion !== undefined && { vencimientoHabilitacion: vencimientoHabilitacion ? new Date(vencimientoHabilitacion) : null }),
                ...(resolucionDPA !== undefined && { resolucionDPA }),
                ...coordinates,
                ...(tefInputs !== undefined && { tefInputs }),
                ...mode,
            }
        });

        await auditarActor({ accion: 'UPDATE', modulo: 'OPERADOR', datosAntes: antes, datosDespues: actualizado, usuarioId: req.user!.id, operadorId: id, ip: req.ip, userAgent: req.headers['user-agent'] }, transaction);
            return actualizado;
        });

        res.json({ success: true, data: { operador } });
    } catch (error) {
        next(error);
    }
};

export const deleteOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const manifiestos = await prisma.manifiesto.count({ where: { operadorId: id } });
        if (manifiestos > 0) {
            throw new AppError('No se puede eliminar un operador con manifiestos asociados', 400);
        }

        const operador = await prisma.operador.findUnique({ where: { id } });
        if (!operador) {
            throw new AppError('Operador no encontrado', 404);
        }

        await deleteAccountPreservingSupport(operador.usuarioId, async db => {
            await db.operador.delete({ where: { id } });
        });

        await auditarActor({ accion: 'DELETE', modulo: 'OPERADOR', datosAntes: operador, usuarioId: req.user!.id, operadorId: id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.json({ success: true, message: 'Operador eliminado' });
    } catch (error) {
        next(error);
    }
};

// ============== HISTORIAL DE CAMBIOS POR ACTOR ==============

export const getHistorialActor = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { tipo } = req.query; // GENERADOR | OPERADOR | TRANSPORTISTA
        const { anio, modulo: filtroModulo, page = 1, limit = 20 } = req.query;
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const skip = (Number(page) - 1) * limitNum;

        const where: any = {};
        if (tipo === 'GENERADOR') where.generadorId = id;
        else if (tipo === 'OPERADOR') where.operadorId = id;
        else if (tipo === 'TRANSPORTISTA') where.transportistaId = id;
        else throw new AppError('Tipo de actor invalido', 400);

        if (anio) {
            const year = Number(anio);
            where.createdAt = {
                gte: new Date(`${year}-01-01T00:00:00.000Z`),
                lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
            };
        }

        if (filtroModulo) {
            where.modulo = filtroModulo;
        }

        const [historial, total] = await Promise.all([
            prisma.auditoria.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    usuario: { select: { nombre: true, email: true, rol: true } },
                },
            }),
            prisma.auditoria.count({ where }),
        ]);

        res.json({
            success: true,
            data: {
                historial,
                pagination: { page: Number(page), limit: limitNum, total, pages: Math.ceil(total / limitNum) },
            },
        });
    } catch (error) {
        next(error);
    }
};
