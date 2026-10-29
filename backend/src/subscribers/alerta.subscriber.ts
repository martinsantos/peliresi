import { EventoAlerta, TipoNotificacion, PrioridadNotificacion } from '@prisma/client';
import prisma from '../lib/prisma';
import logger from '../utils/logger';
import { emailService } from '../services/email.service';
import { externalAlertRecipientAllowed } from '../services/email-policy';
import { notificationService } from '../controllers/notification.controller';
import { DomainEvent } from '../services/domainEvent.service';
import { hasConfiguredTransitThreshold, matchesAlertCondition } from '../services/alertRuleCondition.service';
import { followupDays } from '../services/alertFollowupPolicy.service';
import { catalogueCondition } from '../services/alertCataloguePolicy.service';
import { randomUUID } from 'node:crypto';
import { manifestCompanyRecipients, type ManifestCompanyAccess } from '../services/manifestCompanyRecipients.service';

/** Mapeo DomainEvent.type → EventoAlerta (para búsqueda de ReglaAlerta) */
const EVENTO_ALERTA_MAP: Partial<Record<DomainEvent['type'], EventoAlerta>> = {
  MANIFIESTO_ESTADO_CAMBIADO: 'CAMBIO_ESTADO',
  INCIDENTE_REGISTRADO:       'INCIDENTE',
  RECHAZO_CARGA:              'RECHAZO_CARGA',
  DIFERENCIA_PESO:            'DIFERENCIA_PESO',
  ANOMALIA_GPS:               'ANOMALIA_GPS',
  TIEMPO_EXCESIVO:            'TIEMPO_EXCESIVO',
  DURACION_TRANSITO_OBSERVADA: 'TIEMPO_EXCESIVO',
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
  const existing = ids.length ? await prisma.notificacion.findMany({
    where: { usuarioId: { in: ids }, tipo, titulo, manifiestoId: manifiestoId ?? null, createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
    select: { usuarioId: true },
  }) : [];
  const alreadyNotified = new Set(existing.map((notification) => notification.usuarioId));
  for (const usuarioId of ids) {
    if (alreadyNotified.has(usuarioId)) continue;
    await notificationService.crearNotificacion({ usuarioId, tipo, titulo, mensaje, manifiestoId, prioridad });
  }
}

async function dispararReglasAlerta(
  eventoAlerta: EventoAlerta,
  manifiestoId: string | undefined,
  datos: Record<string, any>,
  transitDuration = false,
): Promise<void> {
  const reglas = await prisma.reglaAlerta.findMany({
    where: { evento: eventoAlerta, activa: true },
  });

  for (const regla of reglas) {
    let matches = false;
    try {
      if (followupDays(regla.condicion) !== null) continue;
      if (catalogueCondition(regla.condicion) !== null) continue;
      if (transitDuration && !hasConfiguredTransitThreshold(regla.condicion)) continue;
      matches = matchesAlertCondition(regla.condicion, datos);
    }
    catch (error) {
      logger.error({ reglaId: regla.id, error: error instanceof Error ? error.message : String(error) }, 'Invalid alert rule condition');
      continue;
    }
    if (!matches) continue;

    const duplicateSince = new Date(Date.now() - 30 * 60 * 1000);
    // Expirations have no manifest. Rule/null alone collapses different subjects.
    // Existing event snapshots are JSON.stringify output: include the complete
    // escaped key/value tokens, not an ID substring, and preserve the old window.
    const expiryIdentity = eventoAlerta === 'VENCIMIENTO' && !manifiestoId
      ? ['entidad', 'entidadId', 'vencimiento'].map(key => ({ datos: { contains: JSON.stringify({ [key]: datos[key] }).slice(1, -1) } }))
      : [];
    if (transitDuration) {
      if (!manifiestoId) continue;
      const manifestId = manifiestoId;
      let recipients: string[] = [];
      try {
        const parsed = JSON.parse(regla.destinatarios || '[]');
        const entries = Array.isArray(parsed) ? parsed : parsed?.roles;
        if (Array.isArray(entries)) recipients = entries.filter((entry): entry is string => typeof entry === 'string');
      } catch { /* A malformed historical recipient list cannot address anyone. */ }
      const roles = recipients.filter(recipient => !recipient.startsWith('email:'));
      const emails = recipients.filter(recipient => recipient.startsWith('email:')).map(recipient => recipient.slice(6));
      // Multiple GPS requests or API workers may cross a configured threshold
      // together. Serialize only this rule/manifest and use the DB clock.
      const verified = await prisma.$transaction(async tx => {
        // Delivery and rule edits can race with either the GPS event or the
        // periodic scan. Hold shared locks until the case is recorded and
        // calculate elapsed time from the current trip and database clock.
        const [trip] = await tx.$queryRaw<Array<{ estado: string; numero: string; fechaRetiro: Date | null }>>`
          SELECT estado, numero, "fechaRetiro" FROM manifiestos WHERE id = ${manifestId} FOR SHARE
        `;
        const [currentRule] = await tx.$queryRaw<Array<{ activa: boolean; evento: string; nombre: string; condicion: string; destinatarios: string }>>`
          SELECT activa, evento, nombre, condicion, destinatarios FROM reglas_alertas WHERE id = ${regla.id} FOR SHARE
        `;
        if (!trip || trip.estado !== 'EN_TRANSITO' || !trip.fechaRetiro || !currentRule?.activa
          || currentRule.evento !== regla.evento || currentRule.nombre !== regla.nombre
          || currentRule.condicion !== regla.condicion || currentRule.destinatarios !== regla.destinatarios) return null;
        const lockKey = JSON.stringify(['transit-duration-rule', regla.id, manifestId]);
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text`;
        const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS "now"`;
        const horasTransito = (now.getTime() - trip.fechaRetiro.getTime()) / 3_600_000;
        const currentData = { ...datos, numero: trip.numero, horasTransito };
        if (!Number.isFinite(horasTransito) || horasTransito < 0 || !matchesAlertCondition(regla.condicion, currentData)) return null;
        const duplicate = await tx.alertaGenerada.findFirst({
          where: { reglaId: regla.id, manifiestoId: manifestId, createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) } },
          select: { id: true },
        });
        if (duplicate) return null;
        const recipientIds = new Set<string>();
        const companyAccesses = new Map<string, ManifestCompanyAccess[]>();
        if (roles.some(role => ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(role))) {
          const manifest = await tx.manifiesto.findUnique({ where: { id: manifestId }, select: {
            generador: { select: { usuario: { select: { id: true } } } },
            transportista: { select: { usuario: { select: { id: true } } } },
            operador: { select: { usuario: { select: { id: true } } } },
          } });
          const partyByRole: Record<string, string | undefined> = {
            GENERADOR: manifest?.generador?.usuario?.id,
            TRANSPORTISTA: manifest?.transportista?.usuario?.id,
            OPERADOR: manifest?.operador?.usuario?.id,
          };
          // A GPS observation is automatic, not a decision by its sender: a
          // configured recipient must also see an alert for their own device.
          roles.forEach(role => { const id = partyByRole[role]; if (id) recipientIds.add(id); });
          for (const recipient of await manifestCompanyRecipients(tx, manifestId)) {
            const accesses = recipient.accesosEmpresa.filter(access => roles.includes(access.rol));
            if (accesses.length && !recipientIds.has(recipient.usuarioId)) {
              recipientIds.add(recipient.usuarioId); companyAccesses.set(recipient.usuarioId, accesses);
            }
          }
        }
        const administrativeRoles = roles.filter(role => role === 'ADMIN' || role.startsWith('ADMIN_'));
        if (administrativeRoles.length) {
          const admins = await tx.usuario.findMany({ where: { rol: { in: administrativeRoles as any }, activo: true }, select: { id: true } });
          admins.forEach(user => recipientIds.add(user.id));
        }
        const message = `Al evaluar, el manifiesto ${currentData.numero} llevaba aproximadamente ${horasTransito.toLocaleString('es-AR', { maximumFractionDigits: 1 })} horas en tránsito. Se alcanzó el umbral configurado por Ambiente.`;
        const notices = [...recipientIds].map(usuarioId => ({ id: randomUUID(), usuarioId,
          tipo: 'ALERTA_SISTEMA' as TipoNotificacion, titulo: regla.nombre, mensaje: message,
          manifiestoId: manifestId, prioridad: 'ALTA' as PrioridadNotificacion,
          datos: JSON.stringify({ evento: eventoAlerta, reglaId: regla.id, ...currentData,
            tipo: 'duracion_transito_configurada', version: 1,
            ...(companyAccesses.has(usuarioId) ? { destino: 'representante', accesosEmpresa: companyAccesses.get(usuarioId) } : {}) }) }));
        await tx.alertaGenerada.create({ data: { reglaId: regla.id, manifiestoId: manifestId, datos: JSON.stringify(currentData), estado: 'PENDIENTE', createdAt: now } });
        if (notices.length) await tx.notificacion.createMany({ data: notices });
        return { currentData, notices };
      }, { isolationLevel: 'ReadCommitted', maxWait: 10_000, timeout: 10_000 });
      if (!verified) continue;
      // The inbox records and case are committed before any best-effort channel.
      for (const notice of verified.notices) notificationService.programarCanalesDeNotificacion(notice);
      const authorizedEmails = [...new Set(emails.map(email => email.trim().toLowerCase()))].filter(email => externalAlertRecipientAllowed(email));
      if (authorizedEmails.length) await emailService.sendAlertEmail(authorizedEmails, regla, manifestId, verified.currentData);
      continue;
    } else {
      const duplicate = await prisma.alertaGenerada.findFirst({
        where: { reglaId: regla.id, manifiestoId: manifiestoId ?? null, createdAt: { gte: duplicateSince },
          ...(expiryIdentity.length ? { AND: expiryIdentity } : {}) },
        select: { id: true },
      });
      if (duplicate) continue;
      await prisma.alertaGenerada.create({
        data: { reglaId: regla.id, manifiestoId: manifiestoId ?? null, datos: JSON.stringify(datos), estado: 'PENDIENTE' },
      });
    }

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

    const recipientIds = new Set<string>();
    const companyAccesses = new Map<string, ManifestCompanyAccess[]>();
    // A GPS observation is generated by the system; its sender did not choose
    // the alert. A configured recipient must see it even when sending the point.
    const eventUserId = eventoAlerta !== 'ANOMALIA_GPS' && eventoAlerta !== 'DESVIO_RUTA' && typeof datos.userId === 'string'
      ? datos.userId : undefined;
    if (manifiestoId && roles.some((role) => ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(role))) {
      const manifiesto = await prisma.manifiesto.findUnique({
        where: { id: manifiestoId },
        select: {
          generador: { select: { usuario: { select: { id: true } } } },
          transportista: { select: { usuario: { select: { id: true } } } },
          operador: { select: { usuario: { select: { id: true } } } },
        },
      });
      const participantByRole: Record<string, string | undefined> = {
        GENERADOR: manifiesto?.generador?.usuario?.id,
        TRANSPORTISTA: manifiesto?.transportista?.usuario?.id,
        OPERADOR: manifiesto?.operador?.usuario?.id,
      };
      roles.forEach((role) => { const id = participantByRole[role]; if (id && id !== eventUserId) recipientIds.add(id); });
      for (const recipient of await manifestCompanyRecipients(prisma, manifiestoId)) {
        const accesses = recipient.accesosEmpresa.filter(access => roles.includes(access.rol));
        if (accesses.length && recipient.usuarioId !== eventUserId && !recipientIds.has(recipient.usuarioId)) {
          recipientIds.add(recipient.usuarioId); companyAccesses.set(recipient.usuarioId, accesses);
        }
      }
    }
    const administrativeRoles = roles.filter((role) => role === 'ADMIN' || role.startsWith('ADMIN_'));
    if (administrativeRoles.length > 0) {
      const users = await prisma.usuario.findMany({ where: { rol: { in: administrativeRoles as any }, activo: true }, select: { id: true } });
      users.forEach((user) => { if (user.id !== eventUserId) recipientIds.add(user.id); });
    }
    for (const usuarioId of recipientIds) {
      const mensaje = eventoAlerta === 'ANOMALIA_GPS' && typeof datos.descripcion === 'string' && datos.descripcion.trim()
          ? `${typeof datos.numero === 'string' && datos.numero.trim() ? `${datos.numero} · ` : ''}${datos.descripcion}`
        : `Regla activada: ${regla.nombre}`;
      await notificationService.crearNotificacion({
        usuarioId,
        tipo: 'ALERTA_SISTEMA' as TipoNotificacion,
        titulo: regla.nombre,
        mensaje,
        manifiestoId,
        prioridad: 'ALTA' as PrioridadNotificacion,
        datos: { evento: eventoAlerta, reglaId: regla.id, ...datos,
          ...(companyAccesses.has(usuarioId) ? { tipo: 'alerta_regla_manifiesto', version: 1,
            destino: 'representante', accesosEmpresa: companyAccesses.get(usuarioId) } : {}) },
      });
    }

    // Explicit legacy addresses are a distinct channel, not registered-user
    // subscriptions. Never activate it as a side effect of enabling other mail.
    const authorizedEmails = [...new Set(emails.map(email => email.trim().toLowerCase()))].filter(email => externalAlertRecipientAllowed(email));
    if (authorizedEmails.length > 0) {
      await emailService.sendAlertEmail(authorizedEmails, regla, manifiestoId ?? '', datos);
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

    case 'ANOMALIA_GPS': {
      // These observations compare receipt times, not necessarily sensor
      // times. Distinct titles also prevent one class hiding another in the
      // existing per-title notification deduplication window.
      const receiptTitles: Record<string, string> = {
        VELOCIDAD_ANORMAL: 'GPS: posible velocidad elevada',
        PARADA_PROLONGADA: 'GPS: posible parada',
        GPS_PERDIDO: 'GPS: sin posiciones recibidas',
      };
      await notificarAdmins(
        'ANOMALIA_DETECTADA',
        receiptTitles[event.tipoAnomalia] || '⚠️ Anomalía GPS Detectada',
        `${event.numero ? `${event.numero} · ` : ''}${event.descripcion}`,
        event.manifiestoId,
        event.severidad === 'ALTA' ? 'URGENTE' : 'ALTA',
        event.userId,
      );
      break;
    }

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
    await dispararReglasAlerta(eventoAlerta, manifiestoId, datos,
      event.type === 'DURACION_TRANSITO_OBSERVADA' || event.type === 'TIEMPO_EXCESIVO');
  }

  logger.info({ eventType: event.type }, 'AlertaSubscriber processed event');
}
