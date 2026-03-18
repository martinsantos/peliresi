/**
 * SITREP - Email Service
 * Envío de emails via SMTP externo (Brevo/Gmail) con fallback a Postfix local
 */

import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '25');
const FROM = process.env.SMTP_FROM || 'SITREP <no-reply@sitrep.ultimamilla.com.ar>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://sitrep.ultimamilla.com.ar';

const transporter = nodemailer.createTransport(
  SMTP_USER
    ? { host: SMTP_HOST, port: SMTP_PORT, secure: false, auth: { user: SMTP_USER, pass: SMTP_PASS } }
    : { host: 'localhost', port: 25, secure: false, ignoreTLS: true }
);

function baseTemplate(contenido: string): string {
  return `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#1B5E3C;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:18px">SITREP — Trazabilidad de Residuos Peligrosos</h2>
    </div>
    <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
      ${contenido}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px"/>
      <p style="font-size:12px;color:#6b7280">Provincia de Mendoza — Dirección General de Fiscalización Ambiental</p>
    </div>
  </div>`;
}

async function send(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[EMAIL] Enviado a ${to}: ${subject}`);
  } catch (err) {
    console.error(`[EMAIL] Error enviando a ${to}:`, err);
  }
}

export const emailService = {
  // ── Alertas de sistema (existente) ──────────────────────────────
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

    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">⚠️ Alerta: ${regla.nombre}</h3>
      ${regla.descripcion ? `<p>${regla.descripcion}</p>` : ''}
      ${manifiestoNumero ? `<p><b>Manifiesto:</b> ${manifiestoNumero}</p>` : ''}
      <p><b>Detalles:</b> ${datos?.descripcion || JSON.stringify(datos)}</p>
    `);

    for (const email of emails) {
      await send(email, `[SITREP] Alerta: ${regla.nombre}`, html);
    }
  },

  // ── Verificación de email (registro) ────────────────────────────
  async sendEmailVerification(email: string, nombre: string, token: string): Promise<void> {
    const link = `${FRONTEND_URL}/verificar-email?token=${token}`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Verificá tu dirección de email</h3>
      <p>Hola <b>${nombre}</b>,</p>
      <p>Para completar tu registro en SITREP, hacé clic en el siguiente botón:</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Verificar mi email
        </a>
      </p>
      <p style="font-size:13px;color:#6b7280">Este enlace expira en 24 horas. Si no creaste una cuenta, podés ignorar este mensaje.</p>
      <p style="font-size:12px;word-break:break-all;color:#9ca3af">${link}</p>
    `);
    await send(email, '[SITREP] Verificá tu cuenta', html);
  },

  // ── Cuenta pendiente de aprobación ──────────────────────────────
  async sendRegistroPendienteEmail(email: string, nombre: string, rol: string): Promise<void> {
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Tu email fue verificado</h3>
      <p>Hola <b>${nombre}</b>,</p>
      <p>Tu dirección de email fue verificada correctamente.</p>
      <p>Tu cuenta con el perfil <b>${rol}</b> está ahora <b>pendiente de aprobación</b> por el administrador del sistema.</p>
      <p>Recibirás otro email cuando tu cuenta sea activada y puedas ingresar a SITREP.</p>
    `);
    await send(email, '[SITREP] Cuenta pendiente de aprobación', html);
  },

  // ── Cuenta aprobada por el admin ────────────────────────────────
  async sendCuentaAprobadaEmail(email: string, nombre: string): Promise<void> {
    const link = `${FRONTEND_URL}/login`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">¡Tu cuenta fue aprobada!</h3>
      <p>Hola <b>${nombre}</b>,</p>
      <p>El administrador del sistema aprobó tu cuenta. Ya podés ingresar a SITREP.</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Ingresar a SITREP
        </a>
      </p>
    `);
    await send(email, '[SITREP] Tu cuenta está activa', html);
  },

  // ── Notificación al admin de nuevo registro ──────────────────────
  async sendNuevoRegistroAdminEmail(adminEmail: string, nombre: string, rol: string): Promise<void> {
    const link = `${FRONTEND_URL}/admin/usuarios`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Nuevo registro pendiente de aprobación</h3>
      <p>Un nuevo usuario se registró en SITREP y requiere tu aprobación:</p>
      <ul>
        <li><b>Nombre:</b> ${nombre}</li>
        <li><b>Perfil:</b> ${rol}</li>
      </ul>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Ir a gestión de usuarios
        </a>
      </p>
    `);
    await send(adminEmail, '[SITREP] Nuevo usuario pendiente de aprobación', html);
  },

  // ── Recuperación de contraseña ───────────────────────────────────
  async sendPasswordResetEmail(email: string, nombre: string, token: string): Promise<void> {
    const link = `${FRONTEND_URL}/reset-password?token=${token}`;
    const html = baseTemplate(`
      <h3 style="color:#1B5E3C">Recuperación de contraseña</h3>
      <p>Hola <b>${nombre}</b>,</p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en SITREP.</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1B5E3C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Restablecer contraseña
        </a>
      </p>
      <p style="font-size:13px;color:#6b7280">Este enlace expira en 1 hora. Si no solicitaste esto, podés ignorar este mensaje.</p>
      <p style="font-size:12px;word-break:break-all;color:#9ca3af">${link}</p>
    `);
    await send(email, '[SITREP] Restablecer contraseña', html);
  },
};
