import nodemailer from 'nodemailer';
import config from '../config/config';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP.HOST,
      port: config.SMTP.PORT,
      secure: config.SMTP.PORT === 465, // true for 465, false for other ports
      auth: config.SMTP.USER && config.SMTP.PASS ? {
        user: config.SMTP.USER,
        pass: config.SMTP.PASS,
      } : undefined,
    });
  }

  // Enviar email genérico
  async sendEmail(to: string, subject: string, html: string) {
    try {
      const info = await this.transporter.sendMail({
        from: config.SMTP.FROM,
        to,
        subject,
        html,
      });
      console.log('Email enviado: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error enviando email:', error);
      // No lanzamos el error para no bloquear el flujo principal
      return null;
    }
  }

  // Enviar notificación de manifiesto
  async sendManifestNotification(to: string, numero: string, estado: string, mensaje: string) {
    const subject = `SITREP - Manifiesto ${numero}: ${estado}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1a56db; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">SITREP</h1>
          <p style="margin: 5px 0 0;">Sistema de Trazabilidad de Residuos Peligrosos</p>
        </div>
        <div style="padding: 24px; color: #333;">
          <h2 style="color: #1a56db;">Actualización de Manifiesto</h2>
          <p>Estimado usuario,</p>
          <p>Le informamos que el manifiesto <strong>${numero}</strong> ha cambiado de estado.</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Nuevo Estado:</strong> ${estado}</p>
            <p style="margin: 10px 0 0;">${mensaje}</p>
          </div>
          <p>Puede consultar los detalles ingresando al sistema:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://sitrep.ultimamilla.com.ar" style="background-color: #1a56db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Acceder al Sistema</a>
          </div>
          <p style="font-size: 12px; color: #6b7280; margin-top: 40px;">
            Este es un correo automático, por favor no responda a este mensaje.<br>
            DGFA - Ministerio de Energía y Ambiente - Mendoza
          </p>
        </div>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }
}

export const emailService = new EmailService();
