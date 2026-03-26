import { EventoAlerta, TipoNotificacion, PrioridadNotificacion } from '@prisma/client';
import prisma from '../lib/prisma';
import logger from '../utils/logger';
import { emailService } from '../services/email.service';
import { notificationService } from '../controllers/notification.controller';
import { DomainEvent } from '../services/domainEvent.service';

/** Mapeo DomainEvent.type → EventoAlerta (para búsqueda de ReglaAlerta) */
const EVENTO_ALERTA_MAP: Partial<Record<DomainEvent['type'], EventoAlerta>> = {
  MANIFIESTO_ESTADO_CAMBIADO: 'CAMBIO_ESTADO',
  INCIDENTE_REGISTRADO:       'INCIDENTE',
  RECHAZO_CARGA:              'RECHAZO_CARGA',
  DIFERENCIA_PESO:            'DIFERENCIA_PESO',
  ANOMALIA_GPS:               'ANOMALIA_GPS',
  TIEMPO_EXCESIVO:            'TIEMPO_EXCESIVO',
  DESVIO_RUTA:                'DESVIO_RUTA',
  VENCIMIENTO_PROXIMO:        'VENCIMIENTO',
};

async function notificarAdmins(
  tipo: TipoNotificacion,
  titulo: string,
  mensaje: string,
  manifiestoId: string | undefined,
  prioridad: PrioridadNotificacion,
  excluirId?: string,
): Promise<void> {
  const admins = await prisma.usuario.findMany({
    where: { rol: 'ADMIN', activo: true },
    select: { id: true },
  });
  const ids = admins.map(a => a.id).filter(id => id !== excluirId);
  for (const usuarioId of ids) {
    await notificationService.crearNotificacion({ usuarioId, tipo, titulo, mensaje, manifiestoId, prioridad });
  }
}

async function dispararReglasAlerta(
  eventoAlerta: EventoAlerta,
  manifiestoId: string | undefined,
  datos: Record<string, any>,
): Promise<void> {
  const reglas = await prisma.reglaAlerta.findMany({
    where: { evento: eventoAlerta, activa: true },
  });

  for (const regla of reglas) {
    await prisma.alertaGenerada.create({
      data: {
        reglaId: regla.id,
        manifiestoId: manifiestoId ?? null,
        datos: JSON.stringify(datos),
        estado: 'PENDIENTE',
      },
    });

    let destList: string[] = [];
    try {
      const parsed = JSON.parse(regla.destinatarios || '[]');
      // Acepta formato plano ["ADMIN"] o formato legado {roles:["ADMIN"]}
      destList = Array.isArray(parsed) ? parsed : (parsed?.roles ?? []);
    } catch { /* malformed JSON, skip */ }

    const roles = destList.filter((d: string) => !d.startsWith('email:'));
    const emails = destList
      .filter((d: string) => d.startsWith('email:'))
      .map((d: string) => d.replace('email:', ''));

    for (const rol of roles) {
      await notificationService.notificarPorRol(rol, {
        tipo: 'ALERTA_SISTEMA' as TipoNotificacion,
        titulo: regla.nombre,
        mensaje: `Regla activada: ${regla.nombre}`,
        manifiestoId,
        prioridad: 'ALTA' as PrioridadNotificacion,
      });
    }

    if (emails.length > 0) {
      await emailService.sendAlertEmail(emails, regla, manifiestoId ?? '', datos);
    }
  }
}

export async function alertaSubscriber(event: DomainEvent): Promise<void> {
  const eventoAlerta = EVENTO_ALERTA_MAP[event.type];

  // 1. Notificaciones in-app por tipo de evento
  switch (event.type) {
    case 'MANIFIESTO_ESTADO_CAMBIADO':
      await notificationService.notificarCambioEstado(
        event.manifiestoId,
        event.estadoNuevo,
        event.userId,
      );
      break;

    case 'INCIDENTE_REGISTRADO': {
      const m = await prisma.manifiesto.findUnique({
        where: { id: event.manifiestoId },
        select: { numero: true, operador: { select: { usuario: { select: { id: true } } } } },
      });
      if (m) {
        const destinatarios: string[] = [];
        const opId = m.operador?.usuario?.id;
        if (opId && opId !== event.userId) destinatarios.push(opId);
        const admins = await prisma.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true } });
        admins.forEach(a => { if (!destinatarios.includes(a.id) && a.id !== event.userId) destinatarios.push(a.id); });
        for (const usuarioId of destinatarios) {
          await notificationService.crearNotificacion({
            usuarioId,
            tipo: 'INCIDENTE_REPORTADO',
            titulo: '⚠️ Incidente en Tránsito',
            mensaje: `Incidente reportado en manifiesto ${m.numero}${event.descripcion ? ': ' + event.descripcion : ''}`,
            manifiestoId: event.manifiestoId,
            prioridad: 'ALTA',
          });
        }
      }
      break;
    }

    case 'RECHAZO_CARGA': {
      const m = await prisma.manifiesto.findUnique({
        where: { id: event.manifiestoId },
        select: { numero: true, generador: { select: { usuario: { select: { id: true } } } } },
      });
      if (m) {
        const destinatarios: string[] = [];
        const genId = m.generador?.usuario?.id;
        if (genId && genId !== event.userId) destinatarios.push(genId);
        const admins = await prisma.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true } });
        admins.forEach(a => { if (!destinatarios.includes(a.id) && a.id !== event.userId) destinatarios.push(a.id); });
        for (const usuarioId of destinatarios) {
          await notificationService.crearNotificacion({
            usuarioId,
            tipo: 'MANIFIESTO_RECHAZADO',
            titulo: '❌ Carga Rechazada',
            mensaje: `La carga del manifiesto ${m.numero} fue rechazada`,
            manifiestoId: event.manifiestoId,
            prioridad: 'ALTA',
          });
        }
      }
      break;
    }

    case 'DIFERENCIA_PESO': {
      const m = await prisma.manifiesto.findUnique({
        where: { id: event.manifiestoId },
        select: { numero: true, generador: { select: { usuario: { select: { id: true } } } } },
      });
      if (m) {
        const destinatarios: string[] = [];
        const genId = m.generador?.usuario?.id;
        if (genId && genId !== event.userId) destinatarios.push(genId);
        const admins = await prisma.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true } });
        admins.forEach(a => { if (!destinatarios.includes(a.id) && a.id !== event.userId) destinatarios.push(a.id); });
        for (const usuarioId of destinatarios) {
          await notificationService.crearNotificacion({
            usuarioId,
            tipo: 'ALERTA_SISTEMA',
            titulo: '⚖️ Diferencia de Peso Detectada',
            mensaje: `El manifiesto ${m.numero} presenta diferencia de peso del ${event.delta}`,
            manifiestoId: event.manifiestoId,
            prioridad: 'ALTA',
          });
        }
      }
      break;
    }

    case 'ANOMALIA_GPS':
      await notificarAdmins(
        'ANOMALIA_DETECTADA',
        '⚠️ Anomalía GPS Detectada',
        event.descripcion,
        event.manifiestoId,
        event.severidad === 'ALTA' ? 'URGENTE' : 'ALTA',
        event.userId,
      );
      break;

    case 'TIEMPO_EXCESIVO':
      await notificarAdmins(
        'ANOMALIA_DETECTADA',
        '⏰ Tiempo de Tránsito Excesivo',
        `El manifiesto ${event.numero} lleva ${event.horasTransito.toFixed(1)} horas en tránsito`,
        event.manifiestoId,
        'URGENTE',
      );
      break;

    case 'DESVIO_RUTA':
      await notificarAdmins(
        'ANOMALIA_DETECTADA',
        '🗺️ Desvío de Ruta Detectado',
        `El manifiesto ${event.numero} está a ${event.distanciaKm.toFixed(1)} km fuera del corredor`,
        event.manifiestoId,
        'ALTA',
      );
      break;

    case 'VENCIMIENTO_PROXIMO': {
      const entidadLabel = event.entidad === 'TRANSPORTISTA' ? 'transportista'
        : event.entidad === 'VEHICULO' ? 'vehículo'
        : 'conductor';
      await notificarAdmins(
        'ALERTA_SISTEMA',
        `📋 Vencimiento Próximo — ${event.nombre}`,
        `El ${entidadLabel} "${event.nombre}" vence en ${event.diasRestantes} días (${event.vencimiento.toLocaleDateString('es-AR')})`,
        undefined,
        event.diasRestantes <= 7 ? 'URGENTE' : 'ALTA',
      );
      break;
    }
  }

  // 2. Disparar ReglaAlerta activas para este evento
  if (eventoAlerta) {
    const manifiestoId = 'manifiestoId' in event ? event.manifiestoId : undefined;
    const { type: _type, ...datos } = event;
    await dispararReglasAlerta(eventoAlerta, manifiestoId, datos);
  }

  logger.info({ eventType: event.type }, 'AlertaSubscriber processed event');
}
