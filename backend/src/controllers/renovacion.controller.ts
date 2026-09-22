import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
    canReviewRenovacion,
    canSubmitRenovacion,
    createRenovacionSchema,
    reviewerActorFilter,
    sanitizeActorChanges,
    tipoActorRenovacionSchema,
} from '../domain/renovacionPolicy';

export const getRenovaciones = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { anio, estado, page = 1, limit = 20 } = req.query;
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const pageNum = Math.max(1, Number(page) || 1);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};
        if (anio) where.anio = Number(anio);
        const requestedType = tipoActorRenovacionSchema.safeParse(req.query.tipoActor);
        const scopedType = reviewerActorFilter(req.user.rol);
        if (scopedType) where.tipoActor = scopedType;
        else if (requestedType.success) where.tipoActor = requestedType.data;
        if (estado) where.estado = estado;

        const [renovaciones, total] = await Promise.all([
            prisma.renovacion.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    generador: { select: { razonSocial: true, cuit: true } },
                    operador: { select: { razonSocial: true, cuit: true } },
                },
            }),
            prisma.renovacion.count({ where }),
        ]);

        res.json({
            success: true,
            data: {
                renovaciones,
                pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getRenovacionById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const renovacion = await prisma.renovacion.findUnique({
            where: { id },
            include: {
                generador: { select: { razonSocial: true, cuit: true } },
                operador: { select: { razonSocial: true, cuit: true } },
            },
        });
        if (!renovacion) throw new AppError('Renovacion no encontrada', 404);
        const tipoActor = tipoActorRenovacionSchema.parse(renovacion.tipoActor);
        if (!canReviewRenovacion(req.user.rol, tipoActor)) throw new AppError('No autorizado para revisar esta renovacion', 403);
        res.json({ success: true, data: { renovacion } });
    } catch (error) {
        next(error);
    }
};

export const createRenovacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const parsed = createRenovacionSchema.safeParse(req.body);
        if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
        const { anio, tipoActor, generadorId, operadorId, modalidad, datosNuevos, tefAnterior, tefNuevo, observaciones } = parsed.data;
        const actorId = tipoActor === 'GENERADOR' ? generadorId! : operadorId!;
        if (!canSubmitRenovacion(req.user, tipoActor, actorId)) {
            throw new AppError('Solo puede solicitar cambios para su propio establecimiento', 403);
        }
        const sanitizedChanges = datosNuevos ? sanitizeActorChanges(tipoActor, datosNuevos) : {};
        if (modalidad === 'CON_CAMBIOS' && Object.keys(sanitizedChanges).length === 0) {
            throw new AppError('Ninguno de los cambios propuestos corresponde a un campo editable', 400);
        }
        const camposModificados = Object.keys(sanitizedChanges);

        // Snapshot current data
        let datosActuales: any = null;
        if (tipoActor === 'GENERADOR' && generadorId) {
            const gen = await prisma.generador.findUnique({ where: { id: generadorId } });
            if (!gen) throw new AppError('Generador no encontrado', 404);
            datosActuales = gen;
        } else if (tipoActor === 'OPERADOR' && operadorId) {
            const op = await prisma.operador.findUnique({ where: { id: operadorId } });
            if (!op) throw new AppError('Operador no encontrado', 404);
            datosActuales = op;
        } else {
            throw new AppError('generadorId o operadorId requerido segun tipoActor', 400);
        }

        const renovacion = await prisma.renovacion.create({
            data: {
                anio: Number(anio),
                tipoActor,
                generadorId: tipoActor === 'GENERADOR' ? generadorId : undefined,
                operadorId: tipoActor === 'OPERADOR' ? operadorId : undefined,
                modalidad,
                estado: 'PENDIENTE',
                datosActuales: JSON.stringify(datosActuales),
                datosNuevos: datosNuevos ? JSON.stringify(sanitizedChanges) : undefined,
                camposModificados: camposModificados ? JSON.stringify(camposModificados) : undefined,
                tefAnterior: tefAnterior !== undefined ? Number(tefAnterior) : undefined,
                tefNuevo: tefNuevo !== undefined ? Number(tefNuevo) : undefined,
                observaciones,
            },
        });

        res.status(201).json({ success: true, data: { renovacion } });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return next(new AppError('Ya existe una renovacion para este actor en ese ano', 400));
        }
        next(error);
    }
};

export const aprobarRenovacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { observaciones } = req.body;

        const renovacion = await prisma.renovacion.findUnique({ where: { id } });
        if (!renovacion) throw new AppError('Renovacion no encontrada', 404);
        if (renovacion.estado !== 'PENDIENTE') throw new AppError('Solo se pueden aprobar renovaciones pendientes', 400);
        const tipoActor = tipoActorRenovacionSchema.parse(renovacion.tipoActor);
        if (!canReviewRenovacion(req.user.rol, tipoActor)) throw new AppError('No autorizado para aprobar esta renovacion', 403);

        const updated = await prisma.$transaction(async (tx) => {
            if (renovacion.modalidad === 'CON_CAMBIOS' && renovacion.datosNuevos) {
                let proposed: Record<string, unknown>;
                try {
                    proposed = JSON.parse(renovacion.datosNuevos);
                } catch {
                    throw new AppError('Los cambios propuestos no tienen un formato valido', 409);
                }
                const safeChanges = sanitizeActorChanges(tipoActor, proposed);
                if (Object.keys(safeChanges).length === 0) throw new AppError('La renovacion no contiene cambios aplicables', 409);
                if (tipoActor === 'GENERADOR' && renovacion.generadorId) {
                    await tx.generador.update({ where: { id: renovacion.generadorId }, data: safeChanges as Prisma.GeneradorUpdateInput });
                } else if (tipoActor === 'OPERADOR' && renovacion.operadorId) {
                    await tx.operador.update({ where: { id: renovacion.operadorId }, data: safeChanges as Prisma.OperadorUpdateInput });
                }
            }
            const status = await tx.renovacion.updateMany({
                where: { id, estado: 'PENDIENTE' },
                data: {
                    estado: 'APROBADA', revisadoPor: req.user.id, fechaRevision: new Date(),
                    observaciones: typeof observaciones === 'string' ? observaciones.slice(0, 5_000) : null,
                },
            });
            if (status.count !== 1) throw new AppError('La renovacion ya fue procesada por otro usuario', 409);
            return tx.renovacion.findUniqueOrThrow({ where: { id } });
        });

        res.json({ success: true, data: { renovacion: updated } });
    } catch (error) {
        next(error);
    }
};

export const rechazarRenovacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { motivoRechazo, observaciones } = req.body;

        const renovacion = await prisma.renovacion.findUnique({ where: { id } });
        if (!renovacion) throw new AppError('Renovacion no encontrada', 404);
        if (renovacion.estado !== 'PENDIENTE') throw new AppError('Solo se pueden rechazar renovaciones pendientes', 400);
        const tipoActor = tipoActorRenovacionSchema.parse(renovacion.tipoActor);
        if (!canReviewRenovacion(req.user.rol, tipoActor)) throw new AppError('No autorizado para rechazar esta renovacion', 403);
        if (typeof motivoRechazo !== 'string' || motivoRechazo.trim().length < 3) throw new AppError('Indique el motivo del rechazo', 400);

        const updated = await prisma.$transaction(async (tx) => {
            const status = await tx.renovacion.updateMany({
                where: { id, estado: 'PENDIENTE' },
                data: {
                    estado: 'RECHAZADA', revisadoPor: req.user.id, fechaRevision: new Date(),
                    motivoRechazo: motivoRechazo.trim().slice(0, 2_000),
                    observaciones: typeof observaciones === 'string' ? observaciones.slice(0, 5_000) : null,
                },
            });
            if (status.count !== 1) throw new AppError('La renovacion ya fue procesada por otro usuario', 409);
            return tx.renovacion.findUniqueOrThrow({ where: { id } });
        });

        res.json({ success: true, data: { renovacion: updated } });
    } catch (error) {
        next(error);
    }
};
