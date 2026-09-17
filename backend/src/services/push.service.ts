import webpush from 'web-push';
import prisma from '../lib/prisma';
import logger from '../utils/logger';

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL   = process.env.VAPID_EMAIL || 'mailto:admin@sitrep.mendoza.gov.ar';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export type PushPrioridad = 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE' | 'CRITICA';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  appUrl?: string;
  tag?: string;
  prioridad?: PushPrioridad;
}

const urgencyMap: Record<PushPrioridad, webpush.Urgency> = {
  BAJA:    'low',
  NORMAL:  'normal',
  ALTA:    'high',
  URGENTE: 'high',
  CRITICA: 'high',
};

interface StoredPushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

type PushDeliveryResult = 'sent' | 'stale';

function serializePayload(payload: PushPayload): string {
  const prioridad: PushPrioridad = payload.prioridad ?? 'NORMAL';
  return JSON.stringify({
    title:    payload.title,
    body:     payload.body,
    icon:     payload.icon  ?? '/app/icon-192.png',
    badge:    payload.badge ?? '/app/icon-192.png',
    url:      payload.url   ?? '/',
    appUrl:   payload.appUrl ?? payload.url ?? '/app/',
    tag:      payload.tag,
    prioridad,
  });
}

async function sendToSubscription(
  sub: StoredPushSubscription,
  payload: PushPayload,
): Promise<PushDeliveryResult> {
  const prioridad: PushPrioridad = payload.prioridad ?? 'NORMAL';
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } } as webpush.PushSubscription,
      serializePayload(payload),
      { TTL: 86400, urgency: urgencyMap[prioridad] },
    );
    return 'sent';
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) return 'stale';
    throw err;
  }
}

export async function enviarPushAlUsuario(usuarioId: string, payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const subs = await prisma.pushSubscripcion.findMany({ where: { usuarioId } });
  if (subs.length === 0) return;

  const stale: string[] = [];

  await Promise.all(subs.map(async (sub) => {
    try {
      const result = await sendToSubscription(sub, payload);
      if (result === 'stale') stale.push(sub.id);
    } catch (err) {
      // The endpoint is a device credential: never include it in logs.
      logger.warn({ err, usuarioId, subscriptionId: sub.id }, 'push send error');
    }
  }));

  if (stale.length > 0) {
    await prisma.pushSubscripcion.deleteMany({ where: { id: { in: stale } } });
  }
}

export async function enviarPushAlDispositivo(
  usuarioId: string,
  endpoint: string,
  payload: PushPayload,
): Promise<boolean> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;

  const sub = await prisma.pushSubscripcion.findFirst({ where: { usuarioId, endpoint } });
  if (!sub) return false;

  try {
    const result = await sendToSubscription(sub, payload);
    if (result === 'stale') {
      await prisma.pushSubscripcion.deleteMany({ where: { id: sub.id, usuarioId } });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, usuarioId, subscriptionId: sub.id }, 'push device test error');
    throw err;
  }
}
