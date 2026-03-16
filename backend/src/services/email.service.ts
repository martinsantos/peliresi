/**
 * SITREP - Email Service
 * Envío de alertas via Postfix local (puerto 25, sin auth)
 */

import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '25'),
    secure: false,
    ignoreTLS: true,
});

export const emailService = {
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
            } catch {
                // skip if error
            }
        }

        const from = process.env.SMTP_FROM || 'SITREP <no-reply@sitrep.ultimamilla.com.ar>';
        const subject = `[SITREP] Alerta: ${regla.nombre}`;
        const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0D8A4F;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;font-size:18px">⚠️ Alerta SITREP: ${regla.nombre}</h2>
        </div>
        <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          ${regla.descripcion ? `<p style="color:#374151">${regla.descripcion}</p>` : ''}
          ${manifiestoNumero ? `<p><b>Manifiesto:</b> ${manifiestoNumero}</p>` : ''}
          <p><b>Detalles:</b> ${datos?.descripcion || JSON.stringify(datos)}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
          <p style="font-size:12px;color:#6b7280">Sistema de Trazabilidad de Residuos Peligrosos — Provincia de Mendoza</p>
        </div>
      </div>`;

        try {
            await transporter.sendMail({ from, to: emails.join(', '), subject, html });
            console.log(`[EMAIL] Alerta enviada a: ${emails.join(', ')}`);
        } catch (err) {
            console.error('[EMAIL] Error enviando alerta:', err);
        }
    },
};
