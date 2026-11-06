import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { isTrainingSession } from '../lib/trainingScope';
import { mailPolicy } from './email-policy';
import { renderMail } from './email-templates';

type Purpose = 'verify' | 'change';
type Recipient = { id: string; nombre: string; email: string };
const DAY = 24 * 3600_000;

export async function requestMailboxProof(tx: Prisma.TransactionClient, user: Recipient, email: string, purpose: Purpose) {
  const token = 'm.' + user.id + '.' + randomBytes(32).toString('hex');
  const digest = createHash('sha256').update(token).digest('hex');
  const stored = purpose + ':' + JSON.stringify({ digest, email, source: user.email, expires: Date.now() + DAY });
  await tx.usuario.update({ where: { id: user.id }, data: {
    emailVerificationToken: stored, ...(purpose === 'change' ? { passwordResetToken: null, passwordResetExpires: null } : {}),
  } });
  const mail = renderMail(purpose === 'change' ? 'confirmMailbox' : 'verify', { name: user.nombre, token });
  const policy = mailPolicy(process.env);
  const suppressed = isTrainingSession() || !policy.enabled;
  await tx.emailQueue.create({ data: { to: email, subject: mail.subject, html: mail.html, tipo: 'TRANSACCIONAL', prioridad: 'CRITICA',
    estado: suppressed ? 'SUPRIMIDO' : 'PENDIENTE', error: suppressed ? (isTrainingSession() ? 'TRAINING_NO_DELIVERY' : policy.reason) : 'NOTIFICATION_READY' } });
}

export function mailboxProof(stored: string | null, digest: string, source: string) {
  if (!stored || !/^(change|verify):/.test(stored)) return null;
  const index = stored.indexOf(':');
  const data = JSON.parse(stored.slice(index + 1));
  if (data.digest !== digest || data.source !== source || !Number.isFinite(data.expires) || data.expires <= Date.now() || typeof data.email !== 'string') return null;
  return { purpose: stored.slice(0, index) as Purpose, email: data.email as string };
}

export function proofIssuedAt(stored: string | null): number {
  if (!stored || !/^(change|verify):/.test(stored)) return 0;
  try { return Number(JSON.parse(stored.slice(stored.indexOf(':') + 1)).expires) - DAY || 0; }
  catch { return 0; }
}
