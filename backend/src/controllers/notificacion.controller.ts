/**
 * NOTIFICACION CONTROLLER
 * Endpoints para gestionar notificaciones in-app
 */

import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

/**
 * GET /api/notificaciones
 * Obtener notificaciones del usuario actual
 */
export const getNotificaciones = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const notificaciones = await prisma.notificacion.findMany({
      where: { usuarioId: userId },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset)
    });

    const noLeidas = await prisma.notificacion.count({
      where: { usuarioId: userId, leida: false }
    });

    res.json({
      success: true,
      data: {
        notificaciones,
        noLeidas
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/notificaciones/:id/leer
 * Marcar notificación como leída
 */
export const marcarLeida = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notificacion = await prisma.notificacion.findUnique({ where: { id } });

    if (!notificacion) {
      throw new AppError('Notificación no encontrada', 404);
    }

    if (notificacion.usuarioId !== userId) {
      throw new AppError('No autorizado', 403);
    }

    const updated = await prisma.notificacion.update({
      where: { id },
      data: {
        leida: true,
        fechaLeida: new Date()
      }
    });

    res.json({ success: true, data: { notificacion: updated } });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/notificaciones/leer-todas
 * Marcar todas como leídas
 */
export const marcarTodasLeidas = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;

    await prisma.notificacion.updateMany({
      where: { usuarioId: userId, leida: false },
      data: {
        leida: true,
        fechaLeida: new Date()
      }
    });

    res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/notificaciones/:id
 * Eliminar notificación
 */
export const eliminarNotificacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notificacion = await prisma.notificacion.findUnique({ where: { id } });

    if (!notificacion) {
      throw new AppError('Notificación no encontrada', 404);
    }

    if (notificacion.usuarioId !== userId) {
      throw new AppError('No autorizado', 403);
    }

    await prisma.notificacion.delete({ where: { id } });

    res.json({ success: true, message: 'Notificación eliminada' });
  } catch (error) {
    next(error);
  }
};
