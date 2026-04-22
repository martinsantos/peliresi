import webpush from 'web-push';
import prisma from '../lib/prisma';
import logger from '../utils/logger';

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL   = process.env.VAPID_EMAIL || 'mailto:admin@sitrep.mendoza.gov.ar';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

export async function enviarPushAlUsuario(usuarioId: string, payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const subs = await prisma.pushSubscripcion.findMany({ where: { usuarioId } });
  if (subs.length === 0) return;

  const data = JSON.stringify({
    title: payload.title,
    body:  payload.body,
    icon:  payload.icon  ?? '/app/icon-192.png',
    badge: payload.badge ?? '/app/icon-192.png',
    url:   payload.url   ?? '/',
    tag:   payload.tag,
  });

  const stale: string[] = [];

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } } as webpush.PushSubscription,
        data,
        { TTL: 86400 }
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        stale.push(sub.id);
      } else {
        logger.warn({ err, endpoint: sub.endpoint }, 'push send error');
      }
    }
  }));

  if (stale.length > 0) {
    await prisma.pushSubscripcion.deleteMany({ where: { id: { in: stale } } });
  }
}
