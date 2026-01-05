import { TipoNotificacion, PrioridadNotificacion } from '@prisma/client';
import prisma from '../lib/prisma';
import { emailService } from './email.service';
import { pushService } from './push.service';

export class NotificationService {
  /**
   * Crear notificación para un usuario
   */
  async crearNotificacion(data: {
    usuarioId: string;
    tipo: TipoNotificacion;
    titulo: string;
    mensaje: string;
    datos?: any;
    manifiestoId?: string;
    prioridad?: PrioridadNotificacion;
  }) {
    return prisma.notificacion.create({
      data: {
        usuarioId: data.usuarioId,
        tipo: data.tipo,
        titulo: data.titulo,
        mensaje: data.mensaje,
        datos: data.datos ? JSON.stringify(data.datos) : null,
        manifiestoId: data.manifiestoId,
        prioridad: data.prioridad || 'NORMAL'
      }
    });
  }

  /**
   * Notificar a usuarios por rol
   */
  async notificarPorRol(rol: string, data: {
    tipo: TipoNotificacion;
    titulo: string;
    mensaje: string;
    datos?: any;
    manifiestoId?: string;
    prioridad?: PrioridadNotificacion;
  }) {
    const usuarios = await prisma.usuario.findMany({
      where: { rol: rol as any, activo: true },
      select: { id: true }
    });

    const notificaciones = usuarios.map(u => ({
      usuarioId: u.id,
      tipo: data.tipo,
      titulo: data.titulo,
      mensaje: data.mensaje,
      datos: data.datos ? JSON.stringify(data.datos) : null,
      manifiestoId: data.manifiestoId,
      prioridad: data.prioridad || 'NORMAL'
    }));

    return prisma.notificacion.createMany({ data: notificaciones });
  }

  /**
   * Notificar cambio de estado de manifiesto a todos los involucrados
   */
  async notificarCambioEstado(manifiestoId: string, nuevoEstado: string, actorId?: string) {
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id: manifiestoId },
      include: {
        generador: { include: { usuario: true } },
        transportista: { include: { usuario: true } },
        operador: { include: { usuario: true } }
      }
    });

    if (!manifiesto) return;

    const mensajes: Record<string, { titulo: string; mensaje: string; tipo: TipoNotificacion }> = {
      'APROBADO': {
        titulo: 'Manifiesto Firmado',
        mensaje: `El manifiesto ${manifiesto.numero} ha sido firmado y está listo para retiro`,
        tipo: 'MANIFIESTO_FIRMADO'
      },
      'EN_TRANSITO': {
        titulo: 'Transporte Iniciado',
        mensaje: `El manifiesto ${manifiesto.numero} está en camino`,
        tipo: 'MANIFIESTO_EN_TRANSITO'
      },
      'ENTREGADO': {
        titulo: 'Entrega Confirmada',
        mensaje: `El manifiesto ${manifiesto.numero} ha sido entregado en destino`,
        tipo: 'MANIFIESTO_ENTREGADO'
      },
      'RECIBIDO': {
        titulo: 'Recepción Confirmada',
        mensaje: `El operador ha confirmado la recepción del manifiesto ${manifiesto.numero}`,
        tipo: 'MANIFIESTO_RECIBIDO'
      },
      'TRATADO': {
        titulo: 'Tratamiento Completado',
        mensaje: `El manifiesto ${manifiesto.numero} ha sido tratado y cerrado`,
        tipo: 'MANIFIESTO_TRATADO'
      },
      'RECHAZADO': {
        titulo: '⚠️ Carga Rechazada',
        mensaje: `La carga del manifiesto ${manifiesto.numero} ha sido rechazada`,
        tipo: 'MANIFIESTO_RECHAZADO'
      }
    };

    const info = mensajes[nuevoEstado];
    if (!info) return;

    const destinatarios = [
      manifiesto.generador.usuario.id,
      manifiesto.transportista.usuario.id,
      manifiesto.operador.usuario.id
    ].filter(id => id !== actorId);

    // Notificar a admins
    const admins = await prisma.usuario.findMany({
      where: { rol: 'ADMIN', activo: true },
      select: { id: true }
    });
    admins.forEach(a => {
      if (!destinatarios.includes(a.id)) destinatarios.push(a.id);
    });

    // Push notification icons/emojis by state
    const pushIcons: Record<string, string> = {
      'APROBADO': '✍️',
      'EN_TRANSITO': '🚛',
      'ENTREGADO': '📍',
      'RECIBIDO': '✅',
      'TRATADO': '🎉',
      'RECHAZADO': '⚠️'
    };

    for (const usuarioId of destinatarios) {
      // 1. Create in-app notification
      await this.crearNotificacion({
        usuarioId,
        ...info,
        manifiestoId,
        prioridad: nuevoEstado === 'RECHAZADO' ? 'ALTA' : 'NORMAL'
      });

      // 2. Send push notification
      try {
        await pushService.sendToUser(usuarioId, {
          title: `${pushIcons[nuevoEstado] || '📋'} ${info.titulo}`,
          body: info.mensaje,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: `manifiesto-${manifiestoId}`,
          data: {
            url: `/manifiestos/${manifiestoId}`,
            manifiestoId,
            manifiestoNumero: manifiesto.numero,
            estado: nuevoEstado
          },
          actions: this.getPushActionsForState(nuevoEstado)
        });
      } catch (pushError) {
        console.warn(`Error enviando push a ${usuarioId}:`, pushError);
      }

      // 3. Send email notification
      const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { email: true }
      });

      if (usuario?.email) {
        await emailService.sendManifestNotification(
          usuario.email,
          manifiesto.numero,
          nuevoEstado,
          info.mensaje
        );
      }
    }
  }

  /**
   * Get push notification actions based on manifiesto state
   */
  private getPushActionsForState(estado: string): Array<{ action: string; title: string }> {
    switch (estado) {
      case 'APROBADO':
        return [
          { action: 'view', title: 'Ver manifiesto' },
          { action: 'start_trip', title: 'Iniciar retiro' }
        ];
      case 'EN_TRANSITO':
        return [
          { action: 'view', title: 'Ver ubicacion' },
          { action: 'track', title: 'Seguir envio' }
        ];
      case 'ENTREGADO':
        return [
          { action: 'view', title: 'Ver detalles' },
          { action: 'confirm', title: 'Confirmar recepcion' }
        ];
      case 'RECHAZADO':
        return [
          { action: 'view', title: 'Ver motivo' },
          { action: 'contact', title: 'Contactar' }
        ];
      default:
        return [{ action: 'view', title: 'Ver manifiesto' }];
    }
  }

  /**
   * Send alert notification (high priority)
   */
  async enviarAlerta(usuarioId: string, titulo: string, mensaje: string, datos?: any) {
    // In-app notification
    await this.crearNotificacion({
      usuarioId,
      tipo: 'ALERTA_SISTEMA',
      titulo,
      mensaje,
      datos,
      prioridad: 'ALTA'
    });

    // Push notification with high urgency
    try {
      await pushService.sendToUser(usuarioId, {
        title: `🚨 ${titulo}`,
        body: mensaje,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'alerta-critica',
        data: datos
      });
    } catch (error) {
      console.error('Error enviando alerta push:', error);
    }
  }

  /**
   * Notify about weight discrepancy
   */
  async notificarDiscrepanciaPeso(manifiestoId: string, diferenciaPorcentaje: number) {
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id: manifiestoId },
      include: {
        generador: { include: { usuario: true } }
      }
    });

    if (!manifiesto) return;

    const mensaje = `Discrepancia de ${diferenciaPorcentaje.toFixed(1)}% en el peso del manifiesto ${manifiesto.numero}`;

    // Notify generador and admins
    await this.enviarAlerta(
      manifiesto.generador.usuario.id,
      'Discrepancia de Peso Detectada',
      mensaje,
      { manifiestoId, diferenciaPorcentaje }
    );
  }
}

export const notificationService = new NotificationService();
