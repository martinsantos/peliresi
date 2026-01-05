import { TipoNotificacion, PrioridadNotificacion } from '@prisma/client';
import prisma from '../lib/prisma';
import { emailService } from './email.service';

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

    for (const usuarioId of destinatarios) {
      await this.crearNotificacion({
        usuarioId,
        ...info,
        manifiestoId,
        prioridad: nuevoEstado === 'RECHAZADO' ? 'ALTA' : 'NORMAL'
      });

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
}

export const notificationService = new NotificationService();
