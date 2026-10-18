/**
 * SITREP - Email Service (Queue + Digest)
 *
 * All emails go through a DB queue (email_queue table).
 * - TRANSACCIONAL: immediate send attempt, fallback to queue on failure.
 * - ALERTA: batched into hourly digests per recipient, flushed every 5 min.
 *
 * Rate limits per recipient per day prevent quota exhaustion.
 * Disabled mail is terminal SUPRIMIDO. Activation needs an explicit ISO cutoff.
 *
 * ENVIADO means SMTP accepted, not delivered/read. Uncertain attempts need review.
 */

import nodemailer from 'nodemailer';
import { isTrainingSession } from '../lib/trainingScope';
import prisma from '../lib/prisma';
import logger from '../utils/logger';
import { mailPolicy, mendozaDayStart, retryableSmtpFailure, externalAlertRecipientAllowed } from './email-policy';
import { escapeMail, mailText, mailShell, mailAction, renderMail } from './email-templates';
import { queueCommittedNotificationEmails, queuedNoticeStillEligible } from './notification-mail.service';

// ── Config ──────────────────────────────────────────────────────────

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '25');
const FROM = process.env.SMTP_FROM || 'SITREP <no-reply@sitrep.ultimamilla.com.ar>';
const DISABLE_EMAILS = !mailPolicy(process.env).enabled;
const LIMIT_TRANSACCIONAL = parseInt(process.env.EMAIL_DAILY_LIMIT_TRANSACCIONAL || '10');
const LIMIT_ALERTA = parseInt(process.env.EMAIL_DAILY_LIMIT_ALERTA || '6');
const MAX_RETRIES = parseInt(process.env.EMAIL_MAX_RETRIES || '3');
const FLUSH_INTERVAL = parseInt(process.env.EMAIL_FLUSH_INTERVAL_MS || '300000');

const transporter = nodemailer.createTransport(
  SMTP_USER
    ? { host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, requireTLS: !['localhost', '127.0.0.1', '::1'].includes(SMTP_HOST), auth: { user: SMTP_USER, pass: SMTP_PASS }, connectionTimeout: 10000, socketTimeout: 20000 }
    : { host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, requireTLS: !['localhost', '127.0.0.1', '::1'].includes(SMTP_HOST), connectionTimeout: 10000, socketTimeout: 20000 }
);

// ── HTML Templates ──────────────────────────────────────────────────

function baseTemplate(contenido: string): string {
  return mailShell(contenido);
}

export function digestTemplate(items: { subject: string; html: string }[], hour: string): string {
  const listItems = items.map(i =>
    `<li style="margin:8px 0;padding:8px 12px;background:#fff;border-left:3px solid #1B5E3C;border-radius:0 4px 4px 0">${escapeMail(i.subject)}</li>`
  ).join('');
  return baseTemplate(`
    <h1 style="color:#1B5E3C;font-size:22px;line-height:1.3;margin:0 0 16px">Resumen de alertas</h1>
    <p style="font-size:13px;color:#526359">${escapeMail(hour)}</p>
    <p>${items.length} alerta${items.length > 1 ? 's' : ''} en este periodo:</p>
    <ul style="list-style:none;padding:0">${listItems}</ul>
    ${mailAction('/alertas', 'Revisar alertas')}
    <p style="font-size:13px;color:#526359">El enlace requiere una cuenta de SITREP. Si no tenés acceso, consultá al equipo que autorizó este aviso.</p>
  `);
}

// ── Rate Limiting ───────────────────────────────────────────────────

async function checkDailyLimit(to: string, tipo: 'TRANSACCIONAL' | 'ALERTA', queueId = ''): Promise<boolean> {
  const limit = tipo === 'TRANSACCIONAL' ? LIMIT_TRANSACCIONAL : LIMIT_ALERTA;
  const today = mendozaDayStart();

  const count = await prisma.emailQueue.count({
    where: {
      to,
      tipo,
      // Operational notices must never consume the account/recovery allowance.
      // Both buckets retain the same configured cap; neither becomes unlimited.
      ...(tipo === 'TRANSACCIONAL' ? queueId.startsWith('notification:')
        ? { id: { startsWith: 'notification:' } }
        : { NOT: { id: { startsWith: 'notification:' } } } : {}),
      estado: 'ENVIADO',
      sentAt: { gte: today },
    },
  });

  return count < limit;
}

// ── Low-level send (SMTP) ───────────────────────────────────────────

async function smtpSend(to: string, subject: string, html: string): Promise<void> {
  if (isTrainingSession() || DISABLE_EMAILS) {
    throw new Error('EMAIL_DISABLED');
  }
  const result = await transporter.sendMail({ from: FROM, ...(process.env.SMTP_REPLY_TO ? { replyTo: process.env.SMTP_REPLY_TO } : {}), to, subject: subject.replace(/[\r\n]/g, ' '), html, text: mailText(html) });
  if (!result.accepted?.some((address: string | { address: string }) => (typeof address === 'string' ? address : address.address).toLowerCase() === to.toLowerCase())) {
    throw Object.assign(new Error('SMTP_RECIPIENT_NOT_ACCEPTED'), { code: 'EREJECTED' });
  }
  logger.info('SMTP accepted; inbox delivery unverified');
}

// ── Queue helpers ───────────────────────────────────────────────────

function digestKeyFor(to: string): string {
  const now = new Date(Date.now() - 3 * 3600000); // Mendoza, consistent date/hour independent of host TZ.
  const date = now.toISOString().slice(0, 10);
  const hour = String(now.getUTCHours()).padStart(2, '0');
  return `alerta:${to}:${date}:${hour}`;
}

async function enqueueTransaccional(
  to: string,
  subject: string,
  html: string,
  prioridad: 'CRITICA' | 'NORMAL' = 'NORMAL',
): Promise<void> {
  const training = isTrainingSession();
  const row = await prisma.emailQueue.create({
    data: { to, subject, html, tipo: 'TRANSACCIONAL', prioridad, estado: training || DISABLE_EMAILS ? 'SUPRIMIDO' : 'PENDIENTE', maxIntentos: MAX_RETRIES, error: training ? 'TRAINING_NO_DELIVERY' : DISABLE_EMAILS ? mailPolicy(process.env).reason : 'DELIVERY_IN_PROGRESS_OR_UNCERTAIN' },
  });
  if (training || DISABLE_EMAILS) return;

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

  let accepted = false;
  try {
    await smtpSend(to, subject, html);
    accepted = true;
    await prisma.emailQueue.update({
      where: { id: row.id },
      data: { estado: 'ENVIADO', sentAt: new Date(), intentos: { increment: 1 }, error: null, nextRetryAt: null },
    });
  } catch (err: any) {
    // Never retry when SMTP accepted but saving its receipt failed.
    if (accepted) { logger.error({ queueId: row.id }, 'SMTP accepted; receipt persistence failed, manual review required'); return; }
    const retry = retryableSmtpFailure(err);
    const rejected = err?.code === 'EREJECTED' || err?.responseCode >= 500;
    const retryAt = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.emailQueue.update({
      where: { id: row.id },
      data: { estado: retry ? 'FALLIDO' : rejected ? 'SUPRIMIDO' : 'PENDIENTE', intentos: 1, error: retry ? 'SMTP_PRE_ACCEPTANCE_FAILURE' : rejected ? 'SMTP_REJECTED' : 'DELIVERY_UNCERTAIN_REVIEW_REQUIRED', nextRetryAt: retry ? retryAt : null },
    });
    logger.error({ queueId: row.id, retry }, 'Email attempt failed');
  }
}

async function externalRecipientStillAllowed(to: string): Promise<boolean> {
  if (!externalAlertRecipientAllowed(to)) return false;
  // Registered users use the verified relay. A legacy address must not bypass
  // suspension, email verification, preferences or actor permissions.
  return !await prisma.usuario.findFirst({ where: { email: { equals: to, mode: 'insensitive' } }, select: { id: true } });
}

async function enqueueAlerta(to: string, subject: string, html: string): Promise<void> {
  const suppressed = isTrainingSession() || DISABLE_EMAILS || !await externalRecipientStillAllowed(to);
  await prisma.emailQueue.create({
    data: {
      to,
      subject,
      html,
      tipo: 'ALERTA',
      prioridad: 'BAJA',
      estado: suppressed ? 'SUPRIMIDO' : 'DIGEST_PENDIENTE',
      maxIntentos: MAX_RETRIES,
      error: isTrainingSession() ? 'TRAINING_NO_DELIVERY' : DISABLE_EMAILS ? mailPolicy(process.env).reason : suppressed ? 'EXTERNAL_RECIPIENT_NOT_AUTHORIZED' : null,
      digestKey: suppressed ? null : digestKeyFor(to),
    },
  });
  logger.info({ suppressed }, 'Email alert recorded');
}

// ── Flush (called by timer) ─────────────────────────────────────────

let flushing = false;
export async function flushEmailQueue(): Promise<void> {
  if (isTrainingSession()) return;
  const policy = mailPolicy(process.env);
  if (!policy.enabled || flushing) return;
  flushing = true;
  try {
    await queueCommittedNotificationEmails();
    // Step 1: Retry failed transactional emails
    const failed = await prisma.$queryRawUnsafe<{ id: string }[]>(`
      SELECT id FROM email_queue
      WHERE (estado = 'FALLIDO' OR (estado = 'PENDIENTE' AND error = 'NOTIFICATION_READY'))
        AND tipo = 'TRANSACCIONAL'
        AND "createdAt" >= $1
        AND intentos < "maxIntentos"
        AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW())
      ORDER BY prioridad ASC, "createdAt" ASC
      LIMIT 20
      FOR UPDATE SKIP LOCKED
    `, policy.notBefore);

    for (const { id } of failed) {
      const row = await prisma.emailQueue.findUnique({ where: { id } });
      if (!row || !(row.estado === 'FALLIDO' || (row.estado === 'PENDIENTE' && row.error === 'NOTIFICATION_READY')) || row.createdAt < policy.notBefore || row.intentos >= row.maxIntentos) continue;
      const claim = await prisma.emailQueue.updateMany({
        where: { id, estado: row.estado, intentos: row.intentos, ...(row.estado === 'PENDIENTE' ? { error: 'NOTIFICATION_READY' } : {}) },
        data: { estado: 'PENDIENTE', error: 'DELIVERY_IN_PROGRESS_OR_UNCERTAIN', nextRetryAt: null },
      });
      if (claim.count !== 1) continue;

      if ((id.startsWith('account:') && !(process.env.EMAIL_NOTIFICATION_FAMILIES || '').split(',').includes('cuentas')) || !await queuedNoticeStillEligible(id, row.to)) {
        await prisma.emailQueue.update({ where: { id }, data: { estado: 'SUPRIMIDO', error: 'RECIPIENT_OR_EVENT_NO_LONGER_ELIGIBLE', nextRetryAt: null } });
        continue;
      }

      const withinLimit = await checkDailyLimit(row.to, row.tipo, id);
      if (!withinLimit) {
        await prisma.emailQueue.update({
          where: { id },
          data: { estado: 'SUPRIMIDO', error: `daily limit exceeded for ${row.to}` },
        });
        continue;
      }

      let accepted = false;
      try {
        await smtpSend(row.to, row.subject, row.html);
        accepted = true;
        await prisma.emailQueue.update({
          where: { id },
          data: { estado: 'ENVIADO', sentAt: new Date(), intentos: { increment: 1 }, error: null, nextRetryAt: null },
        });
      } catch (err: any) {
        if (accepted) { logger.error({ queueId: id }, 'SMTP accepted; receipt persistence failed, manual review required'); continue; }
        const newIntentos = row.intentos + 1;
        const retry = retryableSmtpFailure(err) && newIntentos < row.maxIntentos;
        const rejected = err?.code === 'EREJECTED' || err?.responseCode >= 500;
        const nextRetry = new Date(Date.now() + newIntentos * 5 * 60 * 1000);
        await prisma.emailQueue.update({
          where: { id },
          data: {
            intentos: newIntentos,
            error: retry ? 'SMTP_PRE_ACCEPTANCE_FAILURE' : rejected ? 'SMTP_REJECTED' : 'DELIVERY_UNCERTAIN_REVIEW_REQUIRED',
            nextRetryAt: retry ? nextRetry : null,
            estado: retry ? 'FALLIDO' : rejected ? 'SUPRIMIDO' : 'PENDIENTE',
          },
        });
      }
    }

    // Step 2: Digest alert emails
    const digestKeys = await prisma.emailQueue.findMany({
      where: { estado: 'DIGEST_PENDIENTE', digestKey: { not: null }, createdAt: { gte: policy.notBefore }, OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }] },
      select: { digestKey: true },
      distinct: ['digestKey'],
      take: 20,
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
      const items = await prisma.$queryRawUnsafe<{ id: string; subject: string; html: string; intentos: number; maxIntentos: number }[]>(`
        UPDATE email_queue SET estado = 'PENDIENTE', error = 'DELIVERY_IN_PROGRESS_OR_UNCERTAIN'
        WHERE id IN (
          SELECT id FROM email_queue WHERE "digestKey" = $1 AND estado = 'DIGEST_PENDIENTE' AND "createdAt" >= $2
          AND intentos < "maxIntentos" AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW())
          ORDER BY "createdAt", id LIMIT 50 FOR UPDATE SKIP LOCKED
        ) RETURNING id, subject, html, intentos, "maxIntentos"
      `, digestKey, policy.notBefore);

      if (items.length === 0) continue;

      const ids = items.map(i => i.id);

      if (!await externalRecipientStillAllowed(to)) {
        await prisma.emailQueue.updateMany({ where: { id: { in: ids } },
          data: { estado: 'SUPRIMIDO', error: 'EXTERNAL_RECIPIENT_NOT_AUTHORIZED', nextRetryAt: null } });
        continue;
      }

      if (!withinLimit) {
        await prisma.emailQueue.updateMany({
          where: { id: { in: ids } },
          data: { estado: 'SUPRIMIDO', error: `daily digest limit exceeded for ${to}` },
        });
        continue;
      }

      const digestHtml = digestTemplate(items, `${dateLabel} ${hourLabel} (Mendoza)`);
      const digestSubject = `[SITREP] Resumen de alertas — ${dateLabel} ${hourLabel} (Mendoza)`;

      let accepted = false;
      try {
        await smtpSend(to, digestSubject, digestHtml);
        accepted = true;
        await prisma.emailQueue.updateMany({
          where: { id: { in: ids } },
          data: { estado: 'ENVIADO', sentAt: new Date(), intentos: { increment: 1 }, error: null, nextRetryAt: null },
        });
      } catch (err: any) {
        if (accepted) { logger.error({ queueIds: ids }, 'SMTP digest accepted; receipt persistence failed, manual review required'); continue; }
        const retry = retryableSmtpFailure(err) && items.every(item => item.intentos + 1 < item.maxIntentos);
        const rejected = err?.code === 'EREJECTED' || err?.responseCode >= 500;
        await prisma.emailQueue.updateMany({
          where: { id: { in: ids } },
          data: { estado: retry ? 'DIGEST_PENDIENTE' : rejected ? 'SUPRIMIDO' : 'PENDIENTE', error: retry ? 'SMTP_PRE_ACCEPTANCE_FAILURE' : rejected ? 'SMTP_REJECTED' : 'DELIVERY_UNCERTAIN_REVIEW_REQUIRED', intentos: { increment: 1 }, nextRetryAt: retry ? new Date(Date.now() + 300000) : null },
        });
      }
    }

    // Step 3: Expire stuck failures
    await prisma.emailQueue.updateMany({
      where: { estado: 'FALLIDO', intentos: { gte: MAX_RETRIES }, createdAt: { gte: policy.notBefore } },
      data: { estado: 'SUPRIMIDO', error: 'max retries exceeded' },
    });

  } catch (err) {
    logger.error('flushEmailQueue error; claimed attempts require review');
  } finally { flushing = false; }
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
    if (datos?.isDemoData === true || datos?.modo === 'revision' || datos?.modo === 'prueba') return;

    let manifiestoNumero = manifiestoId;
    if (manifiestoId) {
      try {
        const m = await prisma.manifiesto.findUnique({
          where: { id: manifiestoId },
          select: { numero: true, isDemoData: true }
        });
        if (m?.isDemoData) return;
        if (m) manifiestoNumero = m.numero;
      } catch { return; /* Cannot verify a real vs training resource: do not send. */ }
    }

    const summary = `${regla.nombre}${manifiestoNumero ? ` — ${manifiestoNumero}` : ''}`;
    const detail = datos?.descripcion || (manifiestoNumero ? `Manifiesto ${manifiestoNumero}` : regla.nombre);

    for (const email of new Set(emails.map(value => value.trim().toLowerCase()))) {
      await enqueueAlerta(email, summary, detail);
    }
  },

  // ── Verificacion de email (registro) ────────────────────────────
  async sendEmailVerification(email: string, nombre: string, token: string): Promise<void> {
    const message = renderMail('verify', { name: nombre, token });
    await enqueueTransaccional(email, message.subject, message.html, 'CRITICA');
  },

  // ── Cuenta pendiente de aprobacion ──────────────────────────────
  async sendRegistroPendienteEmail(email: string, nombre: string, rol: string): Promise<void> {
    const message = renderMail('pending', { name: nombre, role: rol });
    await enqueueTransaccional(email, message.subject, message.html);
  },

  // ── Cuenta aprobada por el admin ────────────────────────────────
  async sendCuentaAprobadaEmail(email: string, nombre: string): Promise<void> {
    const message = renderMail('approved', { name: nombre });
    await enqueueTransaccional(email, message.subject, message.html);
  },

  // ── Notificacion al admin de nuevo registro ─────────────────────
  async sendNuevoRegistroAdminEmail(adminEmail: string, nombre: string, rol: string): Promise<void> {
    const message = renderMail('newAccount', { name: nombre, role: rol });
    await enqueueTransaccional(adminEmail, message.subject, message.html);
  },

  // ── Recuperacion de contrasena ──────────────────────────────────
  async sendPasswordResetEmail(email: string, nombre: string, token: string): Promise<void> {
    const message = renderMail('reset', { name: nombre, token });
    await enqueueTransaccional(email, message.subject, message.html, 'CRITICA');
  },

  // ── Solicitud enviada — notificacion al admin ───────────────────
  async sendSolicitudEnviadaAdmin(adminEmail: string, candidatoNombre: string, tipoActor: string): Promise<void> {
    const message = renderMail('application', { name: candidatoNombre, role: tipoActor });
    await enqueueTransaccional(adminEmail, message.subject, message.html);
  },

  // ── Solicitud observada — notificacion al candidato ─────────────
  async sendSolicitudObservadaEmail(email: string, nombre: string, mensajeAdmin: string): Promise<void> {
    const message = renderMail('observed', { name: nombre, message: mensajeAdmin });
    await enqueueTransaccional(email, message.subject, message.html);
  },

  // ── Respuesta del candidato — notificacion al admin ─────────────
  async sendRespuestaCandidatoAdmin(adminEmail: string, candidatoNombre: string): Promise<void> {
    const message = renderMail('response', { name: candidatoNombre });
    await enqueueTransaccional(adminEmail, message.subject, message.html);
  },

  // ── Solicitud rechazada — notificacion al candidato ─────────────
  async sendSolicitudRechazadaEmail(email: string, nombre: string, motivoRechazo: string): Promise<void> {
    const message = renderMail('rejected', { name: nombre, message: motivoRechazo });
    await enqueueTransaccional(email, message.subject, message.html);
  },

  // ── Modificacion solicitada — notificacion al admin ─────────────
  async sendModificacionSolicitadaAdmin(adminEmail: string, actorNombre: string, tipoActor: string): Promise<void> {
    const message = renderMail('modification', { name: actorNombre, role: tipoActor });
    await enqueueTransaccional(adminEmail, message.subject, message.html);
  },

  // ── Modificacion aprobada — notificacion al actor ───────────────
  async sendModificacionAprobadaEmail(email: string, nombre: string): Promise<void> {
    const message = renderMail('modificationApproved', { name: nombre });
    await enqueueTransaccional(email, message.subject, message.html);
  },

  // ── Modificacion rechazada — notificacion al actor ──────────────
  async sendModificacionRechazadaEmail(email: string, nombre: string, motivo: string): Promise<void> {
    const message = renderMail('modificationRejected', { name: nombre, message: motivo });
    await enqueueTransaccional(email, message.subject, message.html);
  },
};

// ── Timer setup (called from index.ts) ──────────────────────────────

let flushTimer: ReturnType<typeof setInterval> | null = null;

export function startEmailFlushTimer(): void {
  if (flushTimer || DISABLE_EMAILS) return;
  flushTimer = setInterval(() => {
    flushEmailQueue().catch(err => logger.error({ err }, 'Email flush timer error'));
  }, FLUSH_INTERVAL);
  logger.info({ flushIntervalSec: FLUSH_INTERVAL / 1000, limitTransaccional: LIMIT_TRANSACCIONAL, limitAlerta: LIMIT_ALERTA }, 'Email flush timer started');
  if (DISABLE_EMAILS) logger.warn('DISABLE_EMAILS=true — sends suppressed, queue active');
}

export function stopEmailFlushTimer(): void {
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
}
