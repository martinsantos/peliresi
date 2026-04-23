import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { enviarPushAlUsuario } from '../services/push.service';

export async function getVapidPublicKey(_req: Request, res: Response) {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) throw new AppError('Push no configurado', 503);
  res.json({ success: true, data: { publicKey: key } });
}

export async function subscribe(req: Request, res: Response) {
  const { endpoint, keys } = req.body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new AppError('Suscripción inválida', 400);
  }

  const usuarioId = (req as any).user.id;

  const esNuevo = !(await prisma.pushSubscripcion.findUnique({ where: { endpoint }, select: { id: true } }));

  await prisma.pushSubscripcion.upsert({
    where:  { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers['user-agent'] ?? null },
    create: { usuarioId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers['user-agent'] ?? null },
  });

  if (esNuevo) {
    enviarPushAlUsuario(usuarioId, {
      title: '¡Bienvenido a SITREP!',
      body: 'Las notificaciones push están activas. Te avisaremos cuando haya novedades en tus manifiestos.',
      url: '/dashboard',
      tag: 'bienvenida',
    }).catch(() => {});
  }

  res.json({ success: true });
}

export async function unsubscribe(req: Request, res: Response) {
  const { endpoint } = req.body ?? {};
  if (!endpoint) throw new AppError('endpoint requerido', 400);

  await prisma.pushSubscripcion.deleteMany({ where: { endpoint } });
  res.json({ success: true });
}
