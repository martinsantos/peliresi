import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// VAPID Keys para Web Push
// Generar nuevas: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls';

// Configurar VAPID
webpush.setVapidDetails(
  'mailto:soporte@sitrep.ultimamilla.com.ar',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

/**
 * Servicio de Push Notifications
 */
export const pushService = {
  /**
   * Obtener la clave pública VAPID (para el frontend)
   */
  getVapidPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  },

  /**
   * Guardar suscripción de un usuario
   */
  async subscribe(usuarioId: string, subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }): Promise<void> {
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        usuarioId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        usuarioId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  },

  /**
   * Eliminar suscripción
   */
  async unsubscribe(endpoint: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });
  },

  /**
   * Enviar notificación push a un usuario específico
   */
  async sendToUser(usuarioId: string, payload: PushPayload): Promise<number> {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { usuarioId },
    });

    let enviadas = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
        enviadas++;
      } catch (error: any) {
        // Si la suscripción expiró, eliminarla
        if (error.statusCode === 404 || error.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
        console.error(`Error enviando push a ${sub.endpoint}:`, error.message);
      }
    }
    return enviadas;
  },

  /**
   * Enviar notificación push a todos los usuarios de un rol
   * OPTIMIZADO: Batch query + Promise.all (evita N+1)
   */
  async sendToRole(rol: string, payload: PushPayload): Promise<number> {
    // Una sola query para obtener todas las suscripciones del rol
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        usuario: { rol: rol as any, activo: true }
      }
    });

    if (subscriptions.length === 0) return 0;

    // Enviar en paralelo con Promise.allSettled para no fallar si una falla
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload)
          );
          return true;
        } catch (error: any) {
          // Si la suscripción expiró, eliminarla
          if (error.statusCode === 404 || error.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
          return false;
        }
      })
    );

    return results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  },

  /**
   * Enviar notificación push a todos los usuarios
   * OPTIMIZADO: Promise.allSettled para envío paralelo
   */
  async sendToAll(payload: PushPayload): Promise<number> {
    const subscriptions = await prisma.pushSubscription.findMany();

    if (subscriptions.length === 0) return 0;

    // Enviar en paralelo con batches de 50 para evitar sobrecarga
    const BATCH_SIZE = 50;
    let enviadas = 0;

    for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              JSON.stringify(payload)
            );
            return true;
          } catch (error: any) {
            if (error.statusCode === 404 || error.statusCode === 410) {
              await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
            return false;
          }
        })
      );
      enviadas += results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    }

    return enviadas;
  },

  /**
   * Enviar notificación de nuevo manifiesto
   */
  async notificarNuevoManifiesto(manifiestoNumero: string, destinatarioId: string): Promise<void> {
    await this.sendToUser(destinatarioId, {
      title: '📦 Nuevo Manifiesto Asignado',
      body: `Se le ha asignado el manifiesto ${manifiestoNumero}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'nuevo-manifiesto',
      data: { url: '/manifiestos' },
    });
  },

  /**
   * Enviar notificación de cambio de estado
   */
  async notificarCambioEstado(manifiestoNumero: string, nuevoEstado: string, destinatarioId: string): Promise<void> {
    const estadoConfig: Record<string, { emoji: string; texto: string; body: string }> = {
      APROBADO: {
        emoji: '✍️',
        texto: 'Manifiesto Firmado',
        body: `El manifiesto ${manifiestoNumero} está listo para retiro`
      },
      EN_TRANSITO: {
        emoji: '🚛',
        texto: 'En Tránsito',
        body: `El manifiesto ${manifiestoNumero} está en camino`
      },
      ENTREGADO: {
        emoji: '📍',
        texto: 'Entregado',
        body: `El manifiesto ${manifiestoNumero} llegó a destino`
      },
      RECIBIDO: {
        emoji: '✅',
        texto: 'Recibido',
        body: `El operador confirmó recepción de ${manifiestoNumero}`
      },
      EN_TRATAMIENTO: {
        emoji: '⚙️',
        texto: 'En Tratamiento',
        body: `Se inició el tratamiento de ${manifiestoNumero}`
      },
      TRATADO: {
        emoji: '🎉',
        texto: 'Ciclo Completado',
        body: `El manifiesto ${manifiestoNumero} finalizó exitosamente`
      },
      RECHAZADO: {
        emoji: '⚠️',
        texto: 'Carga Rechazada',
        body: `La carga de ${manifiestoNumero} fue rechazada`
      },
    };

    const config = estadoConfig[nuevoEstado] || {
      emoji: '📋',
      texto: nuevoEstado,
      body: `Manifiesto ${manifiestoNumero}: ${nuevoEstado}`
    };

    await this.sendToUser(destinatarioId, {
      title: `${config.emoji} ${config.texto}`,
      body: config.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: `manifiesto-${manifiestoNumero}`,
      data: {
        url: `/manifiestos`,
        manifiestoNumero,
        estado: nuevoEstado
      },
      actions: nuevoEstado === 'APROBADO' ? [
        { action: 'ver', title: 'Ver Manifiesto' }
      ] : undefined
    });
  },
};

export default pushService;
