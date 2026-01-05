import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { notificationService } from '../services/notification.service';

/**
 * Controller for User Notifications
 * Simplified by moving logic to notificationService
 */

// Obtener notificaciones del usuario actual
export const getNotificaciones = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usuarioId = (req as any).user.id;
        const { leidas, limit = 20, offset = 0 } = req.query;

        const where: any = { usuarioId };
        if (leidas === 'false') where.leida = false;
        if (leidas === 'true') where.leida = true;

        const [notificaciones, total, noLeidas] = await Promise.all([
            prisma.notificacion.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit as string),
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

        res.json({
            success: true,
            data: {
                notificaciones,
                total,
                noLeidas,
                pagina: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
                totalPaginas: Math.ceil(total / parseInt(limit as string))
            }
        });
    } catch (error) {
        next(error);
    }
};

// Marcar notificación como leída
export const marcarLeida = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const usuarioId = (req as any).user.id;

        const notificacion = await prisma.notificacion.update({
            where: { id, usuarioId },
            data: { leida: true, fechaLeida: new Date() }
        });

        res.json({ success: true, data: notificacion });
    } catch (error) {
        next(error);
    }
};

// Marcar todas como leídas
export const marcarTodasLeidas = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usuarioId = (req as any).user.id;

        await prisma.notificacion.updateMany({
            where: { usuarioId, leida: false },
            data: { leida: true, fechaLeida: new Date() }
        });

        res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
    } catch (error) {
        next(error);
    }
};

// Eliminar notificación
export const eliminarNotificacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const usuarioId = (req as any).user.id;

        await prisma.notificacion.delete({
            where: { id, usuarioId }
        });

        res.json({ success: true, message: 'Notificación eliminada' });
    } catch (error) {
        next(error);
    }
};
