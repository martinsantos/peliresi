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
   */
  async sendToRole(rol: string, payload: PushPayload): Promise<number> {
    const usuarios = await prisma.usuario.findMany({
      where: { rol: rol as any, activo: true },
      select: { id: true },
    });

    let total = 0;
    for (const usuario of usuarios) {
      total += await this.sendToUser(usuario.id, payload);
    }
    return total;
  },

  /**
   * Enviar notificación push a todos los usuarios
   */
  async sendToAll(payload: PushPayload): Promise<number> {
    const subscriptions = await prisma.pushSubscription.findMany();

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
        if (error.statusCode === 404 || error.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
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
    const estadoTexto: Record<string, string> = {
      EN_TRANSITO: '🚛 En Tránsito',
      ENTREGADO: '📍 Entregado',
      RECIBIDO: '✅ Recibido',
      EN_TRATAMIENTO: '⚙️ En Tratamiento',
      TRATADO: '🎉 Tratamiento Completado',
    };

    await this.sendToUser(destinatarioId, {
      title: estadoTexto[nuevoEstado] || `Estado: ${nuevoEstado}`,
      body: `Manifiesto ${manifiestoNumero}`,
      icon: '/icons/icon-192x192.png',
      tag: `estado-${manifiestoNumero}`,
      data: { url: `/manifiestos` },
    });
  },
};

export default pushService;
