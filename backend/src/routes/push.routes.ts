import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import pushService from '../services/push.service';
import { AuthRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/push/vapid-key
 * Obtener la clave pública VAPID para el frontend
 */
router.get('/vapid-key', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      publicKey: pushService.getVapidPublicKey(),
    },
  });
});

/**
 * POST /api/push/subscribe
 * Registrar suscripción push para el usuario autenticado
 */
router.post('/subscribe', isAuthenticated, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({
        success: false,
        error: 'Datos de suscripción incompletos',
      });
    }

    await pushService.subscribe(req.user!.id, { endpoint, keys });

    res.json({
      success: true,
      message: 'Suscripción registrada correctamente',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/push/unsubscribe
 * Eliminar suscripción push
 */
router.delete('/unsubscribe', isAuthenticated, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint requerido',
      });
    }

    await pushService.unsubscribe(endpoint);

    res.json({
      success: true,
      message: 'Suscripción eliminada',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/push/test
 * Enviar notificación de prueba (solo para testing)
 */
router.post('/test', isAuthenticated, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const enviadas = await pushService.sendToUser(req.user!.id, {
      title: '🔔 Notificación de Prueba',
      body: 'Las notificaciones push están funcionando correctamente.',
      icon: '/icons/icon-192x192.png',
      tag: 'test',
    });

    res.json({
      success: true,
      message: `Notificación enviada a ${enviadas} dispositivo(s)`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/push/broadcast
 * Enviar notificación a todos (solo admin)
 */
router.post('/broadcast', isAuthenticated, hasRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, body, rol } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: 'Título y mensaje requeridos',
      });
    }

    let enviadas: number;
    if (rol) {
      enviadas = await pushService.sendToRole(rol, { title, body });
    } else {
      enviadas = await pushService.sendToAll({ title, body });
    }

    res.json({
      success: true,
      message: `Notificación enviada a ${enviadas} dispositivo(s)`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/push/subscriptions
 * Obtener suscripciones del usuario actual
 */
router.get('/subscriptions', isAuthenticated, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { usuarioId: req.user!.id },
      select: { id: true, endpoint: true, createdAt: true },
    });

    res.json({
      success: true,
      data: { subscriptions },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
