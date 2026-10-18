/** Account/security outbox. Called inside the account transaction, never SMTP. */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { escapeMail, mailLink, mailShell } from './email-templates';
import { mailPolicy } from './email-policy';

export type AccountMailEvent = 'created' | 'enabled' | 'disabled' | 'deleted' | 'roleChanged' | 'emailChanged' | 'passwordChanged';
type Recipient = { id: string; email: string; emailVerified: boolean };
const labels: Record<AccountMailEvent, [string, string]> = {
  created: ['Cuenta creada', 'La administración creó tu cuenta de SITREP. No se envían contraseñas por correo.'],
  enabled: ['Cuenta habilitada', 'La administración habilitó tu cuenta de SITREP.'],
  disabled: ['Cuenta deshabilitada', 'La administración deshabilitó el acceso de tu cuenta a SITREP.'],
  deleted: ['Cuenta dada de baja', 'La administración dio de baja tu cuenta de SITREP.'],
  roleChanged: ['Permisos de cuenta modificados', 'La administración modificó el perfil de acceso de tu cuenta de SITREP.'],
  emailChanged: ['Correo de cuenta modificado', 'La dirección de correo de tu cuenta de SITREP fue modificada. Este aviso se envía a la dirección anterior verificada.'],
  passwordChanged: ['Contraseña modificada', 'La contraseña de tu cuenta de SITREP fue modificada.'],
};
export function renderAccountMail(event: AccountMailEvent): { subject: string; html: string } {
  const [title, body] = labels[event];
  const action = ['created', 'enabled', 'roleChanged', 'passwordChanged'].includes(event)
    ? `<p><a href="${escapeMail(mailLink('/login'))}" style="display:inline-block;padding:12px 20px;background:#1B5E3C;color:#fff;border-radius:8px;text-decoration:none">Ingresar a SITREP</a></p>` : '';
  return { subject: '[SITREP] ' + title, html: mailShell(`<h1 style="font-size:22px;color:#1B5E3C">${title}</h1><p>${body}</p><p>Si no reconocés este cambio, contactá a la administración de SITREP por tu canal habitual.</p>${action}`) };
}
export async function recordAccountMail(tx: Prisma.TransactionClient, recipient: Recipient, event: AccountMailEvent): Promise<void> {
  const policy = mailPolicy(process.env);
  const optedIn = (process.env.EMAIL_NOTIFICATION_FAMILIES || '').split(',').includes('cuentas');
  const reason = !policy.enabled ? policy.reason : !optedIn ? 'EVENT_NOT_ENABLED' : !recipient.emailVerified ? 'RECIPIENT_NOT_VERIFIED' : null;
  // Critical account changes use the previously verified address, even on deactivation;
  // they are not optional operational alerts. Family activation is a separate gate.
  const mail = renderAccountMail(event);
  await tx.emailQueue.create({ data: {
    id: 'account:' + randomUUID(), to: recipient.email, ...mail,
    tipo: 'TRANSACCIONAL', prioridad: 'CRITICA',
    estado: reason ? 'SUPRIMIDO' : 'PENDIENTE', error: reason || 'NOTIFICATION_READY',
  } });
}
export async function recordAccountChanges(tx: Prisma.TransactionClient, before: Recipient & { rol: string; activo: boolean }, after: { email: string; rol: string; activo: boolean }): Promise<void> {
  if (before.email !== after.email) await recordAccountMail(tx, before, 'emailChanged');
  if (before.rol !== after.rol) await recordAccountMail(tx, before, 'roleChanged');
  if (before.activo !== after.activo) await recordAccountMail(tx, before, after.activo ? 'enabled' : 'disabled');
}
