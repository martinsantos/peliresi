import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { summarizeQuantities, summaryByUnit } from '../utils/quantities';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { auditarActor } from '../utils/auditoria';
import { parsePagination } from '../utils/pagination';
import { buildActorWhere } from '../utils/authorization';
import { normalizeDni, normalizePlate } from '../utils/documentNormalization';
import { calculateFinalTef, sanitizeTefInputs } from '../utils/tef';
import { assertActorDocumentationReady } from './certificate.controller';

// ============== GENERADORES (CU-A06) ==============

export const getGeneradores = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { search, activo, page, limit, sortBy, sortOrder } = req.query;
        const { skip, take: limitNum, page: pageNum } = parsePagination(
            { page: page as string, limit: limit as string },
            { limit: 10, maxLimit: 5000 }
        );
        const order: 'asc' | 'desc' = sortOrder === 'desc' ? 'desc' : 'asc';
        const GEN_SORT: Record<string, any> = {
            razonSocial: { razonSocial: order },
            categoria: { categoria: order },
            activo: { activo: order },
        };
        const orderBy = GEN_SORT[sortBy as string] ?? { razonSocial: 'asc' };

        const where: any = { ...buildActorWhere(req.user, 'generador') };
        if (search) {
            where.OR = [
                { razonSocial: { contains: search as string, mode: 'insensitive' } },
                { cuit: { contains: search as string } }
            ];
        }
        if (activo !== undefined) {
            where.activo = activo === 'true';
        }

        const [generadores, total] = await Promise.all([
            prisma.generador.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    usuario: { select: { email: true, nombre: true, apellido: true } },
                    _count: { select: { manifiestos: true } },
                    pagos: { where: { anio: { gte: new Date().getFullYear() - 1 } }, select: { anio: true, fechaPago: true, habilitado: true }, orderBy: { anio: 'desc' } },
                    ddjj: { where: { anio: { gte: new Date().getFullYear() - 1 } }, select: { anio: true, presentada: true }, orderBy: { anio: 'desc' } },
                    manifiestos: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
                },
                orderBy
            }),
            prisma.generador.count({ where })
        ]);

        // Map ultimaActividad from most recent manifiesto
        let mapped = generadores.map((g: any) => ({
            ...g,
            ultimaActividad: g.manifiestos?.[0]?.createdAt || null,
        }));

        // Sort by ultimaActividad if requested (client-side since it's a derived field)
        if (sortBy === 'ultimaActividad') {
            mapped.sort((a: any, b: any) => {
                const da = a.ultimaActividad ? new Date(a.ultimaActividad).getTime() : 0;
                const db = b.ultimaActividad ? new Date(b.ultimaActividad).getTime() : 0;
                return order === 'desc' ? db - da : da - db;
            });
        }

        res.json({
            success: true,
            data: {
                generadores: mapped,
                pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
            }
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
            certificacionISO, resolucionInscripcion, categoriaIndividual, libroOperatoria,
            latitud, longitud, tefInputs, alcanceTratamiento,
        } = req.body;

        if (alcanceTratamiento !== undefined && !['NACIONAL', 'INTERNACIONAL'].includes(alcanceTratamiento)) {
            throw new AppError('Alcance de tratamiento inválido', 400);
        }

        if (!razonSocial || !cuit || !email || !domicilio || !telefono || !numeroInscripcion || !categoria) {
            throw new AppError('Complete razon social, CUIT, email, domicilio, telefono, inscripcion y categoria', 400);
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

        const rawPassword = password || crypto.randomBytes(18).toString('base64url');
        const passwordHash = await bcrypt.hash(rawPassword, 10);

        // Nested creation makes user + actor atomic (including fleet below).
        // Never reserve an email if the actor insert fails.
        const usuarioData = {
                email,
                password: passwordHash,
                nombre: nombre || razonSocial,
                cuit,
                rol: 'GENERADOR' as const,
                activo: true,
                emailVerified: true,
                forcePasswordChange: true,
        };

        // Crear generador
        const authoritativeTefInputs = sanitizeTefInputs(tefInputs);
        const authoritativeTef = authoritativeTefInputs ? calculateFinalTef(authoritativeTefInputs, corrientesControl) : null;
        const generador = await prisma.generador.create({
            data: {
                activo: false,
                usuario: { create: usuarioData },
                razonSocial, cuit, domicilio, telefono, email, numeroInscripcion, categoria, actividad, rubro, corrientesControl,
                expedienteInscripcion, domicilioLegalCalle, domicilioLegalLocalidad, domicilioLegalDepto,
                domicilioRealCalle, domicilioRealLocalidad, domicilioRealDepto,
                certificacionISO: certificacionISO ? new Date(certificacionISO) : undefined,
                resolucionInscripcion,
                factorR: authoritativeTef?.R,
                montoMxR: authoritativeTef?.MxR,
                categoriaIndividual, libroOperatoria,
                ...(alcanceTratamiento && { alcanceTratamiento }),
                ...(latitud !== undefined && { latitud: Number(latitud) }),
                ...(longitud !== undefined && { longitud: Number(longitud) }),
                ...(authoritativeTefInputs && { tefInputs: authoritativeTefInputs as any }),
            },
            include: {
                usuario: { select: { email: true, nombre: true } }
            }
        });

        await auditarActor({ accion: 'CREATE', modulo: 'GENERADOR', datosDespues: generador, usuarioId: req.user!.id, generadorId: generador.id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.status(201).json({
            success: true,
            data: { generador },
            message: password
                ? 'Generador creado. Debe cambiar la contraseña en el primer acceso.'
                : 'Generador creado. Se generó una contraseña temporal privada; enviar invitación o reset de contraseña.'
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
            certificacionISO, resolucionInscripcion, categoriaIndividual, libroOperatoria,
            latitud, longitud, tefInputs, alcanceTratamiento,
        } = req.body;

        if (alcanceTratamiento !== undefined && !['NACIONAL', 'INTERNACIONAL'].includes(alcanceTratamiento)) {
            throw new AppError('Alcance de tratamiento inválido', 400);
        }

        const antes = await prisma.generador.findUnique({ where: { id } });
        if (!antes) throw new AppError('Generador no encontrado', 404);
        if (activo === true && !antes.activo) await assertActorDocumentationReady('generador', id);
        const authoritativeTefInputs = tefInputs === undefined ? sanitizeTefInputs(antes.tefInputs) : sanitizeTefInputs(tefInputs);
        const authoritativeTef = authoritativeTefInputs
            ? calculateFinalTef(authoritativeTefInputs, corrientesControl === undefined ? antes.corrientesControl : corrientesControl)
            : null;

        const generador = await prisma.generador.update({
            where: { id },
            data: {
                razonSocial, domicilio, telefono, email, numeroInscripcion, categoria, activo, actividad, rubro, corrientesControl,
                expedienteInscripcion, domicilioLegalCalle, domicilioLegalLocalidad, domicilioLegalDepto,
                domicilioRealCalle, domicilioRealLocalidad, domicilioRealDepto,
                certificacionISO: certificacionISO ? new Date(certificacionISO) : certificacionISO,
                resolucionInscripcion,
                ...(authoritativeTef ? { factorR: authoritativeTef.R, montoMxR: authoritativeTef.MxR } : {}),
                categoriaIndividual, libroOperatoria,
                ...(alcanceTratamiento && { alcanceTratamiento }),
                ...(latitud !== undefined && { latitud: Number(latitud) }),
                ...(longitud !== undefined && { longitud: Number(longitud) }),
                ...(tefInputs !== undefined && { tefInputs: authoritativeTefInputs as any }),
            }
        });

        await auditarActor({ accion: 'UPDATE', modulo: 'GENERADOR', datosAntes: antes, datosDespues: generador, usuarioId: req.user!.id, generadorId: id, ip: req.ip, userAgent: req.headers['user-agent'] });

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
        await prisma.generador.delete({ where: { id } });
        await prisma.usuario.delete({ where: { id: generador.usuarioId } });

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

        const where: any = { ...buildActorWhere(req.user, 'transportista') };
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
            razonSocial, cuit, domicilio, numeroHabilitacion, telefono, email, vehiculos, choferes,
            // Campos regulatorios DPA
            localidad, vencimientoHabilitacion, corrientesAutorizadas,
            expedienteDPA, resolucionDPA, resolucionSSP, actaInspeccion, actaInspeccion2,
            latitud, longitud,
        } = req.body;

        if (!razonSocial || !cuit || !email || !domicilio || !telefono || !numeroHabilitacion) {
            throw new AppError('Complete razon social, CUIT, email, domicilio, telefono y habilitacion', 400);
        }
        const existente = await prisma.transportista.findFirst({ where: { cuit } });
        if (existente) {
            throw new AppError('Ya existe un transportista con ese CUIT', 400);
        }

        const rawPassword = crypto.randomBytes(18).toString('base64url');
        const passwordHash = await bcrypt.hash(rawPassword, 10);
        const usuarioData = {
                email,
                password: passwordHash,
                nombre: razonSocial,
                apellido: '',
                rol: 'TRANSPORTISTA' as const,
                activo: true,
                emailVerified: true,
                forcePasswordChange: true,
        };

        const transportista = await prisma.transportista.create({
            data: {
                activo: false,
                usuario: { create: usuarioData },
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
                ...(latitud !== undefined && { latitud: Number(latitud) }),
                ...(longitud !== undefined && { longitud: Number(longitud) }),
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

        await auditarActor({ accion: 'CREATE', modulo: 'TRANSPORTISTA', datosDespues: transportista, usuarioId: req.user!.id, transportistaId: transportista.id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.status(201).json({
            success: true,
            data: { transportista },
            message: 'Transportista creado. Se generó una contraseña temporal privada; enviar invitación o reset de contraseña.'
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

        const antes = await prisma.transportista.findUnique({ where: { id } });
        if (!antes) throw new AppError('Transportista no encontrado', 404);
        if (activo === true && !antes.activo) await assertActorDocumentationReady('transportista', id);

        const transportista = await prisma.transportista.update({
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
                ...(latitud !== undefined && { latitud: Number(latitud) }),
                ...(longitud !== undefined && { longitud: Number(longitud) }),
            }
        });

        await auditarActor({ accion: 'UPDATE', modulo: 'TRANSPORTISTA', datosAntes: antes, datosDespues: transportista, usuarioId: req.user!.id, transportistaId: id, ip: req.ip, userAgent: req.headers['user-agent'] });

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
        await prisma.vehiculo.deleteMany({ where: { transportistaId: id } });
        await prisma.chofer.deleteMany({ where: { transportistaId: id } });
        await prisma.transportista.delete({ where: { id } });
        await prisma.usuario.delete({ where: { id: transportista.usuarioId } });

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
        const normalizedPlate = normalizePlate(patente);
        if (!normalizedPlate || !String(marca || '').trim() || !String(modelo || '').trim() || !vencimiento) throw new AppError('Patente, marca, modelo y vencimiento son obligatorios', 400);
        if (Number.isNaN(new Date(vencimiento).getTime())) throw new AppError('Vencimiento invalido', 400);

        const vehiculo = await prisma.vehiculo.create({
            data: {
                transportistaId: id,
                patente: normalizedPlate,
                marca: String(marca).trim(),
                modelo: String(modelo).trim(),
                anio: Number(anio),
                capacidad: Number(capacidad),
                numeroHabilitacion: String(numeroHabilitacion || ''),
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

        const updated = await prisma.vehiculo.update({
            where: { id: vehiculoId },
            data: {
                ...(patente !== undefined && { patente: normalizePlate(patente) }),
                ...(marca !== undefined && { marca: String(marca).trim() }),
                ...(modelo !== undefined && { modelo: String(modelo).trim() }),
                ...(anio !== undefined && { anio: Number(anio) }),
                ...(capacidad !== undefined && { capacidad: Number(capacidad) }),
                ...(numeroHabilitacion !== undefined && { numeroHabilitacion: String(numeroHabilitacion) }),
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
        const normalizedDni = normalizeDni(dni);
        if (!String(nombre || '').trim() || normalizedDni.length < 7 || !String(licencia || '').trim() || !vencimiento) throw new AppError('Nombre, DNI, licencia y vencimiento son obligatorios', 400);
        if (Number.isNaN(new Date(vencimiento).getTime())) throw new AppError('Vencimiento invalido', 400);

        const chofer = await prisma.chofer.create({
            data: {
                transportistaId: id,
                nombre: String(nombre).trim(),
                apellido: String(apellido || '').trim(),
                dni: normalizedDni,
                licencia: String(licencia).trim(),
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
                ...(nombre !== undefined && { nombre: String(nombre).trim() }),
                ...(apellido !== undefined && { apellido: String(apellido).trim() }),
                ...(dni !== undefined && { dni: normalizeDni(dni) }),
                ...(licencia !== undefined && { licencia: String(licencia).trim() }),
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

        const where: any = { ...buildActorWhere(req.user, 'operador') };
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
        const ultimosManifiestosUI = ultimosManifiestos.map(m => {
            const summary = summarizeQuantities(m.residuos);
            return {
                id: m.id,
                numero: m.numero,
                fecha: m.createdAt,
                estado: m.estado,
                peso: summary.massKg,
                cantidadesPorUnidad: summaryByUnit(summary),
                generador: m.generador?.razonSocial || '-'
            };
        });

        // Mapear historial de tratamientos (manifiestos procesados)
        const tratamientos = historialTratados.map(m => {
            const quantities = m.residuos.map(r => ({
                cantidad: r.cantidadRecibida ?? r.cantidad,
                unidad: r.unidad,
            }));
            const summary = summarizeQuantities(quantities);
            return {
                id: m.id,
                fecha: m.fechaCierre || m.fechaRecepcion || m.updatedAt,
                manifiesto: m.numero,
                metodo: metodosAutorizados[0] || 'Tratamiento estándar',
                peso: summary.massKg,
                cantidadesPorUnidad: summaryByUnit(summary),
                certificado: operador.numeroHabilitacion || '-'
            };
        });

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

        if (!razonSocial || !cuit || !email || !domicilio || !telefono || !numeroHabilitacion || !categoria) {
            throw new AppError('Complete razon social, CUIT, email, domicilio, telefono, habilitacion y categoria', 400);
        }

        const existente = await prisma.operador.findFirst({ where: { cuit } });
        if (existente) {
            throw new AppError('Ya existe un operador con ese CUIT', 400);
        }

        const existeEmail = await prisma.usuario.findUnique({ where: { email } });
        if (existeEmail) {
            throw new AppError('Ya existe un usuario con ese email', 400);
        }

        const rawPassword = password || crypto.randomBytes(18).toString('base64url');
        const passwordHash = await bcrypt.hash(rawPassword, 10);
        const usuarioData = {
                email,
                password: passwordHash,
                nombre: nombre || razonSocial,
                cuit,
                rol: 'OPERADOR' as const,
                activo: true,
                emailVerified: true,
                forcePasswordChange: true,
        };

        const operador = await prisma.operador.create({
            data: {
                activo: false,
                usuario: { create: usuarioData },
                razonSocial, cuit, numeroHabilitacion, domicilio, telefono, email, categoria, tipoOperador, tecnologia, corrientesY,
                expedienteInscripcion, certificadoNumero,
                domicilioLegalCalle, domicilioLegalLocalidad, domicilioLegalDepto,
                domicilioRealCalle, domicilioRealLocalidad, domicilioRealDepto,
                representanteLegalNombre, representanteLegalDNI, representanteLegalTelefono,
                representanteTecnicoNombre, representanteTecnicoMatricula, representanteTecnicoTelefono,
                vencimientoHabilitacion: vencimientoHabilitacion ? new Date(vencimientoHabilitacion) : undefined,
                resolucionDPA,
                latitud: latitud !== undefined ? Number(latitud) : undefined,
                longitud: longitud !== undefined ? Number(longitud) : undefined,
                ...(tefInputs !== undefined && { tefInputs }),
            },
            include: { usuario: { select: { email: true, nombre: true } } }
        });

        await auditarActor({ accion: 'CREATE', modulo: 'OPERADOR', datosDespues: operador, usuarioId: req.user!.id, operadorId: operador.id, ip: req.ip, userAgent: req.headers['user-agent'] });

        res.status(201).json({
            success: true,
            data: { operador },
            message: password
                ? 'Operador creado. Debe cambiar la contraseña en el primer acceso.'
                : 'Operador creado. Se generó una contraseña temporal privada; enviar invitación o reset de contraseña.'
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

        const antes = await prisma.operador.findUnique({ where: { id } });
        if (!antes) throw new AppError('Operador no encontrado', 404);
        if (activo === true && !antes.activo) await assertActorDocumentationReady('operador', id);

        const operador = await prisma.operador.update({
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
                ...(latitud !== undefined && { latitud: Number(latitud) }),
                ...(longitud !== undefined && { longitud: Number(longitud) }),
                ...(tefInputs !== undefined && { tefInputs }),
            }
        });

        await auditarActor({ accion: 'UPDATE', modulo: 'OPERADOR', datosAntes: antes, datosDespues: operador, usuarioId: req.user!.id, operadorId: id, ip: req.ip, userAgent: req.headers['user-agent'] });

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

        await prisma.operador.delete({ where: { id } });
        await prisma.usuario.delete({ where: { id: operador.usuarioId } });

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
