import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { enviarPushAlUsuario } from '../services/push.service';

export async function getVapidPublicKey(_req: Request, res: Response) {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    res.json({ success: true, data: { enabled: false, publicKey: null } });
    return;
  }
  res.json({ success: true, data: { enabled: true, publicKey: key } });
}

export async function subscribe(req: Request, res: Response) {
  const { endpoint, keys } = req.body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new AppError('Suscripción inválida', 400);
  }

  const user = (req as any).user;
  const usuarioId = user.id;
  // An administrator impersonating someone keeps their own device subscription.
  if (user.impersonatedBy) { res.json({ success: true }); return; }

  const esNuevo = !(await prisma.pushSubscripcion.findUnique({ where: { endpoint }, select: { id: true } }));

  await prisma.pushSubscripcion.upsert({
    where:  { endpoint },
    // A shared device belongs to whoever is signed in now, not to the previous person.
    update: { usuarioId, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers['user-agent'] ?? null },
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
  const user = (req as any).user;
  // Impersonation never changes device subscriptions, in either direction.
  if (user.impersonatedBy) { res.json({ success: true }); return; }

  await prisma.pushSubscripcion.deleteMany({ where: { endpoint, usuarioId: user.id } });
  res.json({ success: true });
}
