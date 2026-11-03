import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { mailPolicy } from './email-policy';
import { escapeMail, mailAction, mailShell, mailText } from './email-templates';
import { inspectionManagementRecipientIds } from './inspectionManagementRole.service';

/** Mail for presentations made through the limited acta link and the team's answers.
 * Rows are written to email_queue inside the business transaction under a stable id
 * (one per event, audience and recipient), never sent from here. Delivery stays behind
 * the global kill switch, the `inspecciones` family and its own explicit flag, and is
 * rechecked at flush time (revoked/expired link, reassignment, account changes). */
export type ActMailEvent = 'PRESENTACION_RECIBIDA' | 'RESPUESTA_PUBLICADA';
export type ActMailAudience = 'INSPECCIONADO' | 'INSPECTOR' | 'JEFATURA';
export const ACT_MAIL_PREFIX = 'inspection-act:';
const KIND: Record<string, string> = { APELACION: 'apelación', DESCARGO: 'descargo', CONSULTA: 'consulta' };
const kindOf = (tipo: string) => KIND[tipo] || 'presentación';
const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const when = (value: Date | string) => new Date(value).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' });

export type ActMailContext = {
  event: ActMailEvent; audience: ActMailAudience; inspeccionId: string; numero: string; numeroActa?: string | null;
  tipo: string; nombre: string; fecha: Date | string; presentadaAt?: Date | string; inspector: string; responsable?: string; expiresAt: string;
};

function rows(items: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border-collapse:collapse">${items.map(([label, value]) => `<tr><td style="padding:8px 12px 8px 0;vertical-align:top;width:34%;color:#526359;font-size:14px;border-top:1px solid #e4ebe6">${escapeMail(label)}</td><td style="padding:8px 0;vertical-align:top;border-top:1px solid #e4ebe6">${escapeMail(value)}</td></tr>`).join('')}</table>`;
}

/** Every variant states the reason, the dossier, who is responsible and the next action. */
export function renderInspectionActMail(c: ActMailContext): { subject: string; html: string; text: string } {
  const kind = kindOf(c.tipo), acta = c.numeroActa || c.numero, received = c.event === 'PRESENTACION_RECIBIDA';
  const linkNote = `Usá el enlace personal del correo «Copia del acta ${acta}». Está disponible hasta el ${when(c.expiresAt)}. Por seguridad, este aviso no incluye ese enlace.`;
  let subject: string, title: string, table: Array<[string, string]>, after = '';
  if (c.audience === 'INSPECCIONADO') {
    subject = received ? `Recibimos tu ${kind} sobre el acta ${acta}` : `Respuesta del equipo de inspección · acta ${acta}`;
    title = received ? `Recibimos tu ${kind}` : 'El equipo de inspección respondió';
    table = received
      ? [['Motivo', `Confirmación de recepción de tu ${kind}.`], ['Acta', acta], ['Registrada', `${when(c.fecha)} · a nombre de ${c.nombre}`], ['Responsable', 'Equipo de inspección de la Dirección General de Fiscalización Ambiental'], ['Próxima acción', `El equipo la revisará. La respuesta aparecerá en el mismo enlace. ${linkNote}`]]
      : [['Motivo', `Hay una respuesta a tu ${kind}${c.presentadaAt ? ` del ${when(c.presentadaAt)}` : ''}.`], ['Acta', acta], ['Responsable', 'Equipo de inspección de la Dirección General de Fiscalización Ambiental'], ['Próxima acción', `Consultá la respuesta. ${linkNote}`]];
    after = `<p style="font-size:14px">${received ? 'Registrar la presentación no implica aceptación ni suspende automáticamente los plazos del acta.' : 'La respuesta no modifica por sí misma los plazos del acta.'} Si no reconocés esta actuación, comunicate con el equipo de inspección.</p>`;
  } else if (received) {
    subject = c.audience === 'INSPECTOR' ? `${capital(kind)} recibida · inspección ${c.numero}` : `Seguimiento · ${kind} recibida en ${c.numero}`;
    title = c.audience === 'INSPECTOR' ? `Nueva ${kind} para responder` : `Seguimiento de una ${kind}`;
    table = [['Motivo', `Se registró una ${kind} mediante el enlace limitado del acta ${acta}.`], ['Expediente', c.numero], ['Presentada por', `${c.nombre} · identidad declarada por quien usó el enlace`], ['Responsable de responder', `${c.inspector} (inspector asignado)`],
      ['Próxima acción', c.audience === 'INSPECTOR' ? 'Revisá la presentación y publicá la respuesta desde Expediente y seguimiento → Copia del acta y respuestas.' : 'Supervisar que el inspector asignado publique la respuesta. No requiere otra acción si ya la atiende.']];
    after = mailAction(`/inspecciones/${encodeURIComponent(c.inspeccionId)}`, 'Abrir el expediente');
  } else {
    subject = c.audience === 'INSPECTOR' ? `Respuesta publicada · inspección ${c.numero}` : `Seguimiento · respuesta publicada en ${c.numero}`;
    title = 'Respuesta publicada al inspeccionado';
    table = [['Motivo', `Se publicó la respuesta a una ${kind} en el enlace limitado del acta ${acta}.`], ['Expediente', c.numero], ['Respondió', c.responsable || 'Equipo de inspección'], ['Responsable del expediente', `${c.inspector} (inspector asignado)`], ['Próxima acción', 'Ninguna obligatoria. Queda registrada en el expediente; revisá el seguimiento si corresponde.']];
    after = mailAction(`/inspecciones/${encodeURIComponent(c.inspeccionId)}`, 'Abrir el expediente');
  }
  const html = mailShell(`<h1 style="color:#1B5E3C;font-size:22px;line-height:1.3;margin:0 0 8px">${escapeMail(title)}</h1>${rows(table)}${after}`);
  return { subject: '[SITREP] ' + subject, html, text: mailText(html) };
}

const FAMILY = 'inspecciones';
/** Separate flag: the inspeccionado address is declared by staff, not a verified account. */
export function inspectionActMailState(env: NodeJS.ProcessEnv = process.env): { ready: boolean; reason: string } {
  const policy = mailPolicy(env);
  if (!policy.enabled) return { ready: false, reason: policy.reason };
  if (env.INSPECTION_FIELD_MODEL_ENABLED !== 'true' || env.INSPECTION_ACT_MAIL_ENABLED !== 'true' || !(env.EMAIL_NOTIFICATION_FAMILIES || '').split(',').map(s => s.trim()).includes(FAMILY)) return { ready: false, reason: 'EVENT_NOT_ENABLED' };
  return { ready: true, reason: '' };
}
export function actMailId(eventoId: string, audience: ActMailAudience, recipientKey: string) { return `${ACT_MAIL_PREFIX}${eventoId}:${audience}:${recipientKey}`; }
function parseId(id: string) { const [eventoId, audience, key] = id.slice(ACT_MAIL_PREFIX.length).split(':'); return eventoId && key && ['INSPECCIONADO', 'INSPECTOR', 'JEFATURA'].includes(audience) ? { eventoId, audience: audience as ActMailAudience, key } : null; }
const validMail = (value: unknown): value is string => typeof value === 'string' && /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(value) && value.length <= 254;

type QueueInput = {
  event: ActMailEvent; eventoId: string; autorId?: string | null; managers: string[];
  inspection: { id: string; numero: string; numeroActa?: string | null; inspectorId: string };
  share: { destinatario?: string | null; expiresAt: string };
  tipo: string; nombre: string; fecha: Date; presentadaAt?: Date;
};
/** Call only on the fresh-create branch; idempotent replays must not reach here. No copy to the author.
 * `managers` is read before the transaction, like the in-app notices. */
export async function queueInspectionActMails(tx: Prisma.TransactionClient, input: QueueInput): Promise<number> {
  const managers = input.managers;
  const staff = await tx.usuario.findMany({ where: { activo: true, emailVerified: true, notifEmail: true, ...(input.autorId ? { id: { not: input.autorId } } : {}), OR: [{ id: input.inspection.inspectorId, esInspector: true }, ...(managers.length ? [{ id: { in: managers } }] : [])] }, select: { id: true, email: true } });
  const people = await tx.usuario.findMany({ where: { id: { in: [input.inspection.inspectorId, ...(input.autorId ? [input.autorId] : [])] } }, select: { id: true, nombre: true } });
  const inspector = people.find(p => p.id === input.inspection.inspectorId)?.nombre || 'Inspector asignado', responsable = people.find(p => p.id === input.autorId)?.nombre;
  const base = { event: input.event, inspeccionId: input.inspection.id, numero: input.inspection.numero, numeroActa: input.inspection.numeroActa, tipo: input.tipo, nombre: input.nombre, fecha: input.fecha, presentadaAt: input.presentadaAt, inspector, responsable, expiresAt: input.share.expiresAt };
  const targets: Array<{ audience: ActMailAudience; key: string; to: string }> = staff.filter(u => validMail(u.email)).map(u => ({ audience: u.id === input.inspection.inspectorId ? 'INSPECTOR' : 'JEFATURA', key: u.id, to: u.email }));
  if (validMail(input.share.destinatario) && Date.parse(input.share.expiresAt) > Date.now()) targets.push({ audience: 'INSPECCIONADO', key: 'enlace', to: input.share.destinatario });
  if (!targets.length) return 0;
  const state = inspectionActMailState();
  const result = await tx.emailQueue.createMany({ skipDuplicates: true, data: targets.map(t => { const mail = renderInspectionActMail({ ...base, audience: t.audience }); return {
    id: actMailId(input.eventoId, t.audience, t.key), to: t.to, subject: mail.subject, html: mail.html, tipo: 'TRANSACCIONAL' as const, prioridad: 'NORMAL' as const,
    estado: state.ready ? 'PENDIENTE' as const : 'SUPRIMIDO' as const, error: state.ready ? 'NOTIFICATION_READY' : state.reason,
  }; }) });
  return result.count;
}

/** Recheck at delivery: never mail a revoked/expired link or a reassigned/changed account. */
export async function inspectionActMailStillEligible(queueId: string, recipient: string): Promise<boolean> {
  const parsed = parseId(queueId);
  if (!parsed || !inspectionActMailState().ready) return false;
  const event = await prisma.eventoInspeccion.findUnique({ where: { id: parsed.eventoId } });
  if (!event || !['ACTA_PRESENTACION_RECIBIDA', 'ACTA_PRESENTACION_RESPONDIDA'].includes(event.tipo)) return false;
  const meta = event.metadata as any;
  if (parsed.audience === 'INSPECCIONADO') {
    const share = await prisma.eventoInspeccion.findFirst({ where: { id: meta?.accesoId, inspeccionId: event.inspeccionId, tipo: 'ACTA_ACCESO_HABILITADO' } });
    const revoked = share && await prisma.eventoInspeccion.findFirst({ where: { inspeccionId: event.inspeccionId, tipo: 'ACTA_ACCESO_REVOCADO', metadata: { path: ['accesoId'], equals: share.id } }, select: { id: true } });
    return Boolean(share && !revoked && parsed.key === 'enlace' && share.destinatario?.toLowerCase() === recipient.toLowerCase() && Date.parse((share.metadata as any)?.expiresAt) > Date.now());
  }
  const [inspection, user] = await Promise.all([
    prisma.inspeccion.findUnique({ where: { id: event.inspeccionId }, select: { inspectorId: true } }),
    prisma.usuario.findUnique({ where: { id: parsed.key }, select: { id: true, email: true, activo: true, emailVerified: true, notifEmail: true, esInspector: true } }),
  ]);
  if (!inspection || !user?.activo || !user.emailVerified || !user.notifEmail || user.email.toLowerCase() !== recipient.toLowerCase() || (user.id === event.usuarioId && event.tipo === 'ACTA_PRESENTACION_RESPONDIDA')) return false;
  if (parsed.audience === 'INSPECTOR') return user.esInspector && inspection.inspectorId === user.id;
  return (await inspectionManagementRecipientIds()).includes(user.id) && inspection.inspectorId !== user.id;
}

const AUDIENCE_ORDER: ActMailAudience[] = ['INSPECCIONADO', 'INSPECTOR', 'JEFATURA'];
/** Staff-facing ledger of prepared mail for an inspection's link events. */
export async function listInspectionActMails(eventIds: string[]) {
  if (!eventIds.length) return [];
  const queued = await prisma.emailQueue.findMany({ where: { OR: eventIds.map(id => ({ id: { startsWith: `${ACT_MAIL_PREFIX}${id}:` } })) }, select: { id: true, to: true, subject: true, html: true, estado: true, error: true, createdAt: true, sentAt: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  return queued.map(row => { const parsed = parseId(row.id)!; return { id: row.id, eventoId: parsed.eventoId, audiencia: parsed.audience, destinatario: row.to, asunto: row.subject, html: row.html, estado: row.estado, motivo: row.error, createdAt: row.createdAt, sentAt: row.sentAt }; })
    .sort((a, b) => a.eventoId === b.eventoId ? AUDIENCE_ORDER.indexOf(a.audiencia) - AUDIENCE_ORDER.indexOf(b.audiencia) : 0);
}
