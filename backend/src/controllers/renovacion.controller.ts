import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getRenovaciones = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { anio, tipoActor, estado, page = 1, limit = 20 } = req.query;
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const skip = (Number(page) - 1) * limitNum;

        const where: any = {};
        if (anio) where.anio = Number(anio);
        if (tipoActor) where.tipoActor = tipoActor;
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
                pagination: { page: Number(page), limit: limitNum, total, pages: Math.ceil(total / limitNum) },
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
        res.json({ success: true, data: { renovacion } });
    } catch (error) {
        next(error);
    }
};

export const createRenovacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { anio, tipoActor, generadorId, operadorId, modalidad, datosNuevos, camposModificados, tefAnterior, tefNuevo, observaciones } = req.body;

        if (!anio || !tipoActor || !modalidad) {
            throw new AppError('anio, tipoActor y modalidad son obligatorios', 400);
        }

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
                datosNuevos: datosNuevos ? JSON.stringify(datosNuevos) : undefined,
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

        const updated = await prisma.renovacion.update({
            where: { id },
            data: {
                estado: 'APROBADA',
                revisadoPor: req.user!.id,
                fechaRevision: new Date(),
                observaciones,
            },
        });

        // Apply changes to actor on approval
        if (renovacion.modalidad === 'CON_CAMBIOS' && renovacion.datosNuevos) {
            const parsed = JSON.parse(renovacion.datosNuevos);
            if (renovacion.tipoActor === 'GENERADOR' && renovacion.generadorId) {
                await prisma.generador.update({ where: { id: renovacion.generadorId }, data: parsed });
            } else if (renovacion.tipoActor === 'OPERADOR' && renovacion.operadorId) {
                await prisma.operador.update({ where: { id: renovacion.operadorId }, data: parsed });
            }
        }

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

        const updated = await prisma.renovacion.update({
            where: { id },
            data: {
                estado: 'RECHAZADA',
                revisadoPor: req.user!.id,
                fechaRevision: new Date(),
                motivoRechazo,
                observaciones,
            },
        });

        res.json({ success: true, data: { renovacion: updated } });
    } catch (error) {
        next(error);
    }
};
