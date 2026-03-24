import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

// ============== PAGOS TEF (OPERADOR) ==============

export const getPagosTEFOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const pagos = await prisma.pagoTEF.findMany({
            where: { operadorId: id },
            orderBy: { anio: 'desc' }
        });
        res.json({ success: true, data: { pagos } });
    } catch (error) {
        next(error);
    }
};

export const createPagoTEFOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { anio, montoTEF, resolucion, notificado, fechaNotificado, fechaPago, pagoFueraTermino, habilitado, gedoNotificacion, gedoResolucion } = req.body;

        if (!anio) throw new AppError('El ano es obligatorio', 400);

        const operador = await prisma.operador.findUnique({ where: { id } });
        if (!operador) throw new AppError('Operador no encontrado', 404);

        const pago = await prisma.pagoTEF.create({
            data: {
                operadorId: id,
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
            return next(new AppError('Ya existe un pago TEF para ese ano', 400));
        }
        next(error);
    }
};

export const updatePagoTEFOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

export const deletePagoTEFOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { pagoId } = req.params;
        await prisma.pagoTEF.delete({ where: { id: pagoId } });
        res.json({ success: true, message: 'Pago eliminado' });
    } catch (error) {
        next(error);
    }
};

// ============== DECLARACIONES JURADAS (OPERADOR) ==============

export const getDDJJOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const ddjj = await prisma.declaracionJurada.findMany({
            where: { operadorId: id },
            orderBy: { anio: 'desc' }
        });
        res.json({ success: true, data: { ddjj } });
    } catch (error) {
        next(error);
    }
};

export const createDDJJOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { anio, numeroGDE, presentada, fechaPresentacion, ticketPago, observaciones } = req.body;

        if (!anio) throw new AppError('El ano es obligatorio', 400);

        const operador = await prisma.operador.findUnique({ where: { id } });
        if (!operador) throw new AppError('Operador no encontrado', 404);

        const ddjj = await prisma.declaracionJurada.create({
            data: {
                operadorId: id,
                anio: Number(anio),
                numeroGDE,
                presentada: presentada ?? false,
                fechaPresentacion: fechaPresentacion ? new Date(fechaPresentacion) : undefined,
                ticketPago,
                observaciones
            }
        });
        res.status(201).json({ success: true, data: { ddjj } });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return next(new AppError('Ya existe una DDJJ para ese ano', 400));
        }
        next(error);
    }
};

export const updateDDJJOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { ddjjId } = req.params;
        const { numeroGDE, presentada, fechaPresentacion, ticketPago, observaciones } = req.body;

        const ddjj = await prisma.declaracionJurada.update({
            where: { id: ddjjId },
            data: {
                numeroGDE, presentada, ticketPago, observaciones,
                fechaPresentacion: fechaPresentacion ? new Date(fechaPresentacion) : fechaPresentacion
            }
        });
        res.json({ success: true, data: { ddjj } });
    } catch (error) {
        next(error);
    }
};

export const deleteDDJJOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { ddjjId } = req.params;
        await prisma.declaracionJurada.delete({ where: { id: ddjjId } });
        res.json({ success: true, message: 'DDJJ eliminada' });
    } catch (error) {
        next(error);
    }
};
