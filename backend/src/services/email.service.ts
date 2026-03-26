/**
 * SITREP - Email Service (Queue + Digest)
 *
 * All emails go through a DB queue (email_queue table).
 * - TRANSACCIONAL: immediate send attempt, fallback to queue on failure.
 * - ALERTA: batched into hourly digests per recipient, flushed every 5 min.
 *
 * Rate limits per recipient per day prevent quota exhaustion.
 * Kill switch: DISABLE_EMAILS=true suppresses sends but still queues.
 *
 * Migration to Brevo: change SMTP_HOST/SMTP_USER/SMTP_PASS in .env. No code changes.
 */

import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';
import logger from '../utils/logger';

// ── Config ──────────────────────────────────────────────────────────

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '25');
const FROM = process.env.SMTP_FROM || 'SITREP <no-reply@sitrep.ultimamilla.com.ar>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://sitrep.ultimamilla.com.ar';
const DISABLE_EMAILS = process.env.DISABLE_EMAILS === 'true';
const LIMIT_TRANSACCIONAL = parseInt(process.env.EMAIL_DAILY_LIMIT_TRANSACCIONAL || '10');
const LIMIT_ALERTA = parseInt(process.env.EMAIL_DAILY_LIMIT_ALERTA || '6');
const MAX_RETRIES = parseInt(process.env.EMAIL_MAX_RETRIES || '3');
const FLUSH_INTERVAL = parseInt(process.env.EMAIL_FLUSH_INTERVAL_MS || '300000');

const transporter = nodemailer.createTransport(
  SMTP_USER
    ? { host: SMTP_HOST, port: SMTP_PORT, secure: false, auth: { user: SMTP_USER, pass: SMTP_PASS } }
    : { host: 'localhost', port: 25, secure: false, ignoreTLS: true }
);

// ── HTML Templates ──────────────────────────────────────────────────

function baseTemplate(contenido: string): string {
  return `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#1B5E3C;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:18px">SITREP — Trazabilidad de Residuos Peligrosos</h2>
    </div>
    <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
      ${contenido}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px"/>
      <p style="font-size:12px;color:#6b7280">Provincia de Mendoza — Direccion General de Fiscalizacion Ambiental</p>
    </div>
  </div>`;
}

function digestTemplate(items: { subject: string; html: string }[], hour: string): string {
  const listItems = items.map(i =>
    `<li style="margin:8px 0;padding:8px 12px;background:#fff;border-left:3px solid #1B5E3C;border-radius:0 4px 4px 0">${i.subject}</li>`
  ).join('');
  return baseTemplate(`
    <h3 style="color:#1B5E3C">Resumen de alertas — ${hour}</h3>
    <p>${items.length} alerta${items.length > 1 ? 's' : ''} en este periodo:</p>
    <ul style="list-style:none;padding:0">${listItems}</ul>
    <p style="font-size:13px;color:#6b7280;margin-top:16px">
      Para configurar tus preferencias de notificacion, ingresa a
      <a href="${FRONTEND_URL}" style="color:#1B5E3C">SITREP</a>.
    </p>
  `);
}

// ── Rate Limiting ───────────────────────────────────────────────────

async function checkDailyLimit(to: string, tipo: 'TRANSACCIONAL' | 'ALERTA'): Promise<boolean> {
  const limit = tipo === 'TRANSACCIONAL' ? LIMIT_TRANSACCIONAL : LIMIT_ALERTA;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.emailQueue.count({
    where: {
      to,
      tipo,
      estado: 'ENVIADO',
      sentAt: { gte: today },
    },
  });

  return count < limit;
}

// ── Low-level send (SMTP) ───────────────────────────────────────────

async function smtpSend(to: string, subject: string, html: string): Promise<void> {
  if (DISABLE_EMAILS) {
    logger.info({ to, subject }, 'Email suppressed (DISABLE_EMAILS=true)');
    return;
  }
  await transporter.sendMail({ from: FROM, to, subject, html });
  logger.info({ to, subject }, 'Email sent');
}

// ── Queue helpers ───────────────────────────────────────────────────

function digestKeyFor(to: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hour = String(now.getHours()).padStart(2, '0');
  return `alerta:${to}:${date}:${hour}`;
}

async function enqueueTransaccional(
  to: string,
  subject: string,
  html: string,
  prioridad: 'CRITICA' | 'NORMAL' = 'NORMAL',
): Promise<void> {
  const row = await prisma.emailQueue.create({
    data: { to, subject, html, tipo: 'TRANSACCIONAL', prioridad, estado: 'PENDIENTE' },
  });

  // Attempt immediate send
  const withinLimit = await checkDailyLimit(to, 'TRANSACCIONAL');
  if (!withinLimit) {
    await prisma.emailQueue.update({
      where: { id: row.id },
      data: { estado: 'SUPRIMIDO', error: `daily limit: ${LIMIT_TRANSACCIONAL} for ${to}` },
    });
    logger.warn({ to, subject }, 'Email rate limited (TRANSACCIONAL)');
    return;
  }

  try {
    await smtpSend(to, subject, html);
    await prisma.emailQueue.update({
      where: { id: row.id },
      data: { estado: 'ENVIADO', sentAt: new Date() },
    });
  } catch (err: any) {
    const retryAt = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.emailQueue.update({
      where: { id: row.id },
      data: { estado: 'FALLIDO', intentos: 1, error: err?.message || 'unknown', nextRetryAt: retryAt },
    });
    logger.error({ to, subject, err: err?.message }, 'Email failed (queued for retry)');
  }
}

async function enqueueAlerta(to: string, subject: string, html: string): Promise<void> {
  await prisma.emailQueue.create({
    data: {
      to,
      subject,
      html,
      tipo: 'ALERTA',
      prioridad: 'BAJA',
      estado: 'DIGEST_PENDIENTE',
      digestKey: digestKeyFor(to),
    },
  });
  logger.info({ to, subject }, 'Email alert digest queued');
}

// ── Flush (called by timer) ─────────────────────────────────────────

export async function flushEmailQueue(): Promise<void> {
  try {
    // Step 1: Retry failed transactional emails
    const failed = await prisma.$queryRawUnsafe<{ id: string }[]>(`
      SELECT id FROM email_queue
      WHERE estado = 'FALLIDO'
        AND intentos < "maxIntentos"
        AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW())
      ORDER BY prioridad ASC, "createdAt" ASC
      LIMIT 20
      FOR UPDATE SKIP LOCKED
    `);

    for (const { id } of failed) {
      const row = await prisma.emailQueue.findUnique({ where: { id } });
      if (!row) continue;

      const withinLimit = await checkDailyLimit(row.to, row.tipo);
      if (!withinLimit) {
        await prisma.emailQueue.update({
          where: { id },
          data: { estado: 'SUPRIMIDO', error: `daily limit exceeded for ${row.to}` },
        });
        continue;
      }

      try {
        await smtpSend(row.to, row.subject, row.html);
        await prisma.emailQueue.update({
          where: { id },
          data: { estado: 'ENVIADO', sentAt: new Date() },
        });
      } catch (err: any) {
        const newIntentos = row.intentos + 1;
        const nextRetry = new Date(Date.now() + newIntentos * 5 * 60 * 1000);
        await prisma.emailQueue.update({
          where: { id },
          data: {
            intentos: newIntentos,
            error: err?.message || 'unknown',
            nextRetryAt: nextRetry,
            estado: newIntentos >= row.maxIntentos ? 'SUPRIMIDO' : 'FALLIDO',
          },
        });
      }
    }

    // Step 2: Digest alert emails
    const digestKeys = await prisma.emailQueue.findMany({
      where: { estado: 'DIGEST_PENDIENTE', digestKey: { not: null } },
      select: { digestKey: true },
      distinct: ['digestKey'],
    });

    for (const { digestKey } of digestKeys) {
      if (!digestKey) continue;

      // Parse recipient from digestKey: "alerta:{to}:{date}:{hour}"
      const parts = digestKey.split(':');
      const to = parts.slice(1, -2).join(':'); // handles emails with colons (unlikely but safe)
      const hourLabel = parts[parts.length - 1] + ':00';
      const dateLabel = parts[parts.length - 2];

      const withinLimit = await checkDailyLimit(to, 'ALERTA');

      // Fetch all items in this digest group
      const items = await prisma.$queryRawUnsafe<{ id: string; subject: string; html: string }[]>(`
        SELECT id, subject, html FROM email_queue
        WHERE "digestKey" = $1 AND estado = 'DIGEST_PENDIENTE'
        FOR UPDATE SKIP LOCKED
      `, digestKey);

      if (items.length === 0) continue;

      const ids = items.map(i => i.id);

      if (!withinLimit) {
        await prisma.emailQueue.updateMany({
          where: { id: { in: ids } },
          data: { estado: 'SUPRIMIDO', error: `daily digest limit exceeded for ${to}` },
        });
        continue;
      }

      const digestHtml = digestTemplate(items, `${dateLabel} ${hourLabel}`);
      const digestSubject = `[SITREP] Resumen de alertas — ${dateLabel} ${hourLabel}`;

      try {
        await smtpSend(to, digestSubject, digestHtml);
        await prisma.emailQueue.updateMany({
          where: { id: { in: ids } },
          data: { estado: 'ENVIADO', sentAt: new Date() },
        });
      } catch (err: any) {
        await prisma.emailQueue.updateMany({
          where: { id: { in: ids } },
          data: { estado: 'FALLIDO', error: err?.message || 'unknown', intentos: { increment: 1 } },
        });
      }
    }

    // Step 3: Expire stuck failures
    await prisma.emailQueue.updateMany({
      where: { estado: 'FALLIDO', intentos: { gte: MAX_RETRIES } },
      data: { estado: 'SUPRIMIDO', error: 'max retries exceeded' },
    });

  } catch (err) {
    logger.error({ err }, 'flushEmailQueue error');
  }
}

// ── Public API (drop-in replacement) ────────────────────────────────

export const emailService = {
  // ── Alertas de sistema ──────────────────────────────────────────
  async sendAlertEmail(
    emails: string[],
    regla: { nombre: string; descripcion?: string | null },
    manifiestoId: string | null,
    datos: Record<string, any>
  ): Promise<void> {
    if (emails.length === 0) return;

    let manifiestoNumero = manifiestoId;
    if (manifiestoId) {
      try {
        const m = await prisma.manifiesto.findUnique({
          where: { id: manifiestoId },
          select: { numero: true }
        });
        if (m) manifiestoNumero = m.numero;
      } catch { /* skip */ }
    }

    const summary = `${regla.nombre}${manifiestoNumero ? ` — ${manifiestoNumero}` : ''}`;
    const detail = datos?.descripcion || (manifiestoNumero ? `Manifiesto ${manifiestoNumero}` : regla.nombre);

    for (const email of emails) {
      await enqueueAlerta(email, summary, detail);
    }
  },

  // ── Verificacion de email (registro) ────────────────────────────
  async sendEmailVerification(email: string, nombre: string, token: string): Promise<void> {
    const link = `${FRONTEND_URL}/verificar-email?token=${token}`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Verifica tu direccion de email</h3>
      <p>Hola <b>${nombre}</b>,</p>
      <p>Para completar tu registro en SITREP, hace clic en el siguiente boton:</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Verificar mi email
        </a>
      </p>
      <p style="font-size:13px;color:#6b7280">Este enlace expira en 24 horas. Si no creaste una cuenta, podes ignorar este mensaje.</p>
      <p style="font-size:12px;word-break:break-all;color:#9ca3af">${link}</p>
    `);
    await enqueueTransaccional(email, '[SITREP] Verifica tu cuenta', html, 'CRITICA');
  },

  // ── Cuenta pendiente de aprobacion ──────────────────────────────
  async sendRegistroPendienteEmail(email: string, nombre: string, rol: string): Promise<void> {
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Tu email fue verificado</h3>
      <p>Hola <b>${nombre}</b>,</p>
      <p>Tu direccion de email fue verificada correctamente.</p>
      <p>Tu cuenta con el perfil <b>${rol}</b> esta ahora <b>pendiente de aprobacion</b> por el administrador del sistema.</p>
      <p>Recibiras otro email cuando tu cuenta sea activada y puedas ingresar a SITREP.</p>
    `);
    await enqueueTransaccional(email, '[SITREP] Cuenta pendiente de aprobacion', html);
  },

  // ── Cuenta aprobada por el admin ────────────────────────────────
  async sendCuentaAprobadaEmail(email: string, nombre: string): Promise<void> {
    const link = `${FRONTEND_URL}/login`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Tu cuenta fue aprobada!</h3>
      <p>Hola <b>${nombre}</b>,</p>
      <p>El administrador del sistema aprobo tu cuenta. Ya podes ingresar a SITREP.</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Ingresar a SITREP
        </a>
      </p>
    `);
    await enqueueTransaccional(email, '[SITREP] Tu cuenta esta activa', html);
  },

  // ── Notificacion al admin de nuevo registro ─────────────────────
  async sendNuevoRegistroAdminEmail(adminEmail: string, nombre: string, rol: string): Promise<void> {
    const link = `${FRONTEND_URL}/admin/usuarios`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Nuevo registro pendiente de aprobacion</h3>
      <p>Un nuevo usuario se registro en SITREP y requiere tu aprobacion:</p>
      <ul>
        <li><b>Nombre:</b> ${nombre}</li>
        <li><b>Perfil:</b> ${rol}</li>
      </ul>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Ir a gestion de usuarios
        </a>
      </p>
    `);
    await enqueueTransaccional(adminEmail, '[SITREP] Nuevo usuario pendiente de aprobacion', html);
  },

  // ── Recuperacion de contrasena ──────────────────────────────────
  async sendPasswordResetEmail(email: string, nombre: string, token: string): Promise<void> {
    const link = `${FRONTEND_URL}/reset-password?token=${token}`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Recuperacion de contrasena</h3>
      <p>Hola <b>${nombre}</b>,</p>
      <p>Recibimos una solicitud para restablecer la contrasena de tu cuenta en SITREP.</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Restablecer contrasena
        </a>
      </p>
      <p style="font-size:13px;color:#6b7280">Este enlace expira en 1 hora. Si no solicitaste esto, podes ignorar este mensaje.</p>
      <p style="font-size:12px;word-break:break-all;color:#9ca3af">${link}</p>
    `);
    await enqueueTransaccional(email, '[SITREP] Restablecer contrasena', html, 'CRITICA');
  },

  // ── Solicitud enviada — notificacion al admin ───────────────────
  async sendSolicitudEnviadaAdmin(adminEmail: string, candidatoNombre: string, tipoActor: string): Promise<void> {
    const link = `${FRONTEND_URL}/admin/solicitudes`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Nueva solicitud de inscripcion</h3>
      <p>Se recibio una nueva solicitud de inscripcion que requiere tu revision:</p>
      <ul>
        <li><b>Nombre:</b> ${candidatoNombre}</li>
        <li><b>Tipo de actor:</b> ${tipoActor}</li>
      </ul>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Revisar solicitudes
        </a>
      </p>
    `);
    await enqueueTransaccional(adminEmail, `[SITREP] Nueva solicitud de inscripcion: ${candidatoNombre}`, html);
  },

  // ── Solicitud observada — notificacion al candidato ─────────────
  async sendSolicitudObservadaEmail(email: string, nombre: string, mensajeAdmin: string): Promise<void> {
    const link = `${FRONTEND_URL}/mi-solicitud`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Tu solicitud fue observada</h3>
      <p>Hola <b>${nombre}</b>,</p>
      <p>El administrador reviso tu solicitud de inscripcion y realizo la siguiente observacion:</p>
      <div style="background:#fff;border-left:4px solid #1B5E3C;padding:12px 16px;margin:16px 0;border-radius:0 4px 4px 0">
        <p style="margin:0;white-space:pre-wrap">${mensajeAdmin}</p>
      </div>
      <p>Por favor, ingresa al sistema para responder o corregir la informacion solicitada.</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Ver mi solicitud
        </a>
      </p>
    `);
    await enqueueTransaccional(email, '[SITREP] Tu solicitud fue observada', html);
  },

  // ── Respuesta del candidato — notificacion al admin ─────────────
  async sendRespuestaCandidatoAdmin(adminEmail: string, candidatoNombre: string): Promise<void> {
    const link = `${FRONTEND_URL}/admin/solicitudes`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Respuesta a observacion</h3>
      <p>El candidato <b>${candidatoNombre}</b> respondio a tu observacion sobre su solicitud de inscripcion.</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Revisar solicitudes
        </a>
      </p>
    `);
    await enqueueTransaccional(adminEmail, `[SITREP] ${candidatoNombre} respondio a tu observacion`, html);
  },

  // ── Solicitud rechazada — notificacion al candidato ─────────────
  async sendSolicitudRechazadaEmail(email: string, nombre: string, motivoRechazo: string): Promise<void> {
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Tu solicitud fue rechazada</h3>
      <p>Hola <b>${nombre}</b>,</p>
      <p>Lamentamos informarte que tu solicitud de inscripcion en SITREP fue rechazada.</p>
      <p><b>Motivo del rechazo:</b></p>
      <div style="background:#fff;border-left:4px solid #dc2626;padding:12px 16px;margin:16px 0;border-radius:0 4px 4px 0">
        <p style="margin:0;white-space:pre-wrap">${motivoRechazo}</p>
      </div>
      <p style="font-size:13px;color:#6b7280">Si consideras que se trata de un error, podes comunicarte con la Direccion General de Fiscalizacion Ambiental.</p>
    `);
    await enqueueTransaccional(email, '[SITREP] Tu solicitud fue rechazada', html);
  },

  // ── Modificacion solicitada — notificacion al admin ─────────────
  async sendModificacionSolicitadaAdmin(adminEmail: string, actorNombre: string, tipoActor: string): Promise<void> {
    const link = `${FRONTEND_URL}/admin/renovaciones`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Solicitud de modificacion de datos</h3>
      <p>Un actor registrado solicita modificacion de sus datos:</p>
      <ul>
        <li><b>Nombre:</b> ${actorNombre}</li>
        <li><b>Tipo de actor:</b> ${tipoActor}</li>
      </ul>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Revisar solicitudes de modificacion
        </a>
      </p>
    `);
    await enqueueTransaccional(adminEmail, `[SITREP] ${actorNombre} solicita modificacion de datos`, html);
  },

  // ── Modificacion aprobada — notificacion al actor ───────────────
  async sendModificacionAprobadaEmail(email: string, nombre: string): Promise<void> {
    const link = `${FRONTEND_URL}/login`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Tu solicitud de cambio fue aprobada</h3>
      <p>Hola <b>${nombre}</b>,</p>
      <p>El administrador aprobo tu solicitud de modificacion de datos. Los cambios ya estan reflejados en el sistema.</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Ingresar a SITREP
        </a>
      </p>
    `);
    await enqueueTransaccional(email, '[SITREP] Tu solicitud de cambio fue aprobada', html);
  },

  // ── Modificacion rechazada — notificacion al actor ──────────────
  async sendModificacionRechazadaEmail(email: string, nombre: string, motivo: string): Promise<void> {
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Tu solicitud de cambio fue rechazada</h3>
      <p>Hola <b>${nombre}</b>,</p>
      <p>El administrador rechazo tu solicitud de modificacion de datos.</p>
      <p><b>Motivo:</b></p>
      <div style="background:#fff;border-left:4px solid #dc2626;padding:12px 16px;margin:16px 0;border-radius:0 4px 4px 0">
        <p style="margin:0;white-space:pre-wrap">${motivo}</p>
      </div>
      <p style="font-size:13px;color:#6b7280">Si tenes consultas, podes comunicarte con la Direccion General de Fiscalizacion Ambiental.</p>
    `);
    await enqueueTransaccional(email, '[SITREP] Tu solicitud de cambio fue rechazada', html);
  },
};

// ── Timer setup (called from index.ts) ──────────────────────────────

let flushTimer: ReturnType<typeof setInterval> | null = null;

export function startEmailFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushEmailQueue().catch(err => logger.error({ err }, 'Email flush timer error'));
  }, FLUSH_INTERVAL);
  logger.info({ flushIntervalSec: FLUSH_INTERVAL / 1000, limitTransaccional: LIMIT_TRANSACCIONAL, limitAlerta: LIMIT_ALERTA }, 'Email flush timer started');
  if (DISABLE_EMAILS) logger.warn('DISABLE_EMAILS=true — sends suppressed, queue active');
}

export function stopEmailFlushTimer(): void {
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
}
