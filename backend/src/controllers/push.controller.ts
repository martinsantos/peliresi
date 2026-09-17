import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { enviarPushAlDispositivo, enviarPushAlUsuario } from '../services/push.service';
import logger from '../utils/logger';

interface WelcomePushFailureContext {
  usuarioId: string;
  subscriptionId: string;
}

export function logWelcomePushFailure(err: unknown, context: WelcomePushFailureContext): void {
  logger.error({ ...context, err }, 'Error enviando push de bienvenida');
}

export function getVapidPublicKey(_req: Request, res: Response) {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    res.status(503).json({ success: false, status: 503, message: 'Push no configurado' });
    return;
  }
  res.json({ success: true, data: { publicKey: key } });
}

export async function subscribe(req: Request, res: Response) {
  const { endpoint, keys } = req.body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new AppError('Suscripción inválida', 400);
  }

  const usuarioId = (req as any).user.id;

  const esNuevo = !(await prisma.pushSubscripcion.findUnique({ where: { endpoint }, select: { id: true } }));

  const savedSubscription = await prisma.pushSubscripcion.upsert({
    where:  { endpoint },
    // A browser subscription is a device credential. When the principal
    // changes (logout/impersonation), rebind it instead of delivering pushes
    // to the previous user.
    update: { usuarioId, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers['user-agent'] ?? null },
    create: { usuarioId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers['user-agent'] ?? null },
  });

  if (esNuevo) {
    enviarPushAlUsuario(usuarioId, {
      title: '¡Bienvenido a SITREP!',
      body: 'Las notificaciones push están activas. Te avisaremos cuando haya novedades en tus manifiestos.',
      url: '/dashboard',
      appUrl: '/app/dashboard',
      tag: 'bienvenida',
    }).catch((err) => logWelcomePushFailure(err, { usuarioId, subscriptionId: savedSubscription.id }));
  }

  res.json({ success: true });
}

export async function unsubscribe(req: Request, res: Response) {
  const { endpoint } = req.body ?? {};
  if (!endpoint) throw new AppError('endpoint requerido', 400);

  await prisma.pushSubscripcion.deleteMany({ where: { endpoint, usuarioId: (req as any).user.id } });
  res.json({ success: true });
}

export async function testPush(req: Request, res: Response) {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
  if (!endpoint || endpoint.length > 4096) throw new AppError('endpoint inválido', 400);

  const usuarioId = (req as any).user.id as string;
  const sent = await enviarPushAlDispositivo(usuarioId, endpoint, {
    title: 'Prueba de notificaciones SITREP',
    body: 'Este dispositivo está listo para recibir alertas aun con la aplicación en segundo plano.',
    url: '/configuracion?tab=notificaciones',
    appUrl: '/app/configuracion?tab=notificaciones',
    tag: `push-test-${usuarioId}`,
    prioridad: 'ALTA',
  });

  if (!sent) throw new AppError('La suscripción no existe o venció. Actívala nuevamente.', 404);
  res.json({ success: true, data: { delivered: true } });
}
