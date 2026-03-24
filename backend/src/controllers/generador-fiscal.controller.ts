import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

// ============== PAGOS TEF ==============

export const getPagosTEF = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const pagos = await prisma.pagoTEF.findMany({
            where: { generadorId: id },
            orderBy: { anio: 'desc' }
        });
        res.json({ success: true, data: { pagos } });
    } catch (error) {
        next(error);
    }
};

export const createPagoTEF = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { anio, montoTEF, resolucion, notificado, fechaNotificado, fechaPago, pagoFueraTermino, habilitado, gedoNotificacion, gedoResolucion } = req.body;

        if (!anio) throw new AppError('El año es obligatorio', 400);

        const generador = await prisma.generador.findUnique({ where: { id } });
        if (!generador) throw new AppError('Generador no encontrado', 404);

        const pago = await prisma.pagoTEF.create({
            data: {
                generadorId: id,
                anio: Number(anio),
                montoTEF: montoTEF !== undefined ? Number(montoTEF) : undefined,
                resolucion,
                notificado: notificado ?? false,
                fechaNotificado: fechaNotificado ? new Date(fechaNotificado) : undefined,
                fechaPago: fechaPago ? new Date(fechaPago) : undefined,
                pagoFueraTermino: pagoFueraTermino ?? false,
                habilitado,
                gedoNotificacion,
                gedoResolucion
            }
        });
        res.status(201).json({ success: true, data: { pago } });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return next(new AppError(`Ya existe un pago TEF para ese año`, 400));
        }
        next(error);
    }
};

export const updatePagoTEF = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { pagoId } = req.params;
        const { montoTEF, resolucion, notificado, fechaNotificado, fechaPago, pagoFueraTermino, habilitado, gedoNotificacion, gedoResolucion } = req.body;

        const pago = await prisma.pagoTEF.update({
            where: { id: pagoId },
            data: {
                montoTEF: montoTEF !== undefined ? Number(montoTEF) : undefined,
                resolucion, notificado, habilitado, pagoFueraTermino,
                fechaNotificado: fechaNotificado ? new Date(fechaNotificado) : fechaNotificado,
                fechaPago: fechaPago ? new Date(fechaPago) : fechaPago,
                gedoNotificacion, gedoResolucion
            }
        });
        res.json({ success: true, data: { pago } });
    } catch (error) {
        next(error);
    }
};

export const deletePagoTEF = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { pagoId } = req.params;
        await prisma.pagoTEF.delete({ where: { id: pagoId } });
        res.json({ success: true, message: 'Pago eliminado' });
    } catch (error) {
        next(error);
    }
};

// ============== DECLARACIONES JURADAS ==============

export const getDDJJ = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const ddjj = await prisma.declaracionJurada.findMany({
            where: { generadorId: id },
            orderBy: { anio: 'desc' }
        });
        res.json({ success: true, data: { ddjj } });
    } catch (error) {
        next(error);
    }
};

export const createDDJJ = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { anio, numeroGDE, presentada, fechaPresentacion, observaciones } = req.body;

        if (!anio) throw new AppError('El año es obligatorio', 400);

        const generador = await prisma.generador.findUnique({ where: { id } });
        if (!generador) throw new AppError('Generador no encontrado', 404);

        const ddjj = await prisma.declaracionJurada.create({
            data: {
                generadorId: id,
                anio: Number(anio),
                numeroGDE,
                presentada: presentada ?? false,
                fechaPresentacion: fechaPresentacion ? new Date(fechaPresentacion) : undefined,
                observaciones
            }
        });
        res.status(201).json({ success: true, data: { ddjj } });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return next(new AppError(`Ya existe una DDJJ para ese año`, 400));
        }
        next(error);
    }
};

export const updateDDJJ = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { ddjjId } = req.params;
        const { numeroGDE, presentada, fechaPresentacion, observaciones } = req.body;

        const ddjj = await prisma.declaracionJurada.update({
            where: { id: ddjjId },
            data: {
                numeroGDE, presentada, observaciones,
                fechaPresentacion: fechaPresentacion ? new Date(fechaPresentacion) : fechaPresentacion
            }
        });
        res.json({ success: true, data: { ddjj } });
    } catch (error) {
        next(error);
    }
};

export const deleteDDJJ = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { ddjjId } = req.params;
        await prisma.declaracionJurada.delete({ where: { id: ddjjId } });
        res.json({ success: true, message: 'DDJJ eliminada' });
    } catch (error) {
        next(error);
    }
};
