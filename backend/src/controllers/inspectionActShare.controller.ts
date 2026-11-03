import type { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import prisma from '../lib/prisma';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { canAccessInspection, inspectionInclude } from './inspeccion.controller';
import { inspectionSignatureHash } from '../domain/inspectionSignature';
import { streamInspectionActPdf } from '../services/inspectionFieldActPdf.service';
import { resolveInspectionEvidence } from '../services/inspectionEvidence.service';
import { inspectionManagementRecipientIds } from '../services/inspectionManagementRole.service';
import { mailShell, mailLink, escapeMail, mailText } from '../services/email-templates';
import { queueInspectionActMails, listInspectionActMails, inspectionActMailState, mailDateTime } from '../services/inspectionActMail.service';

function enabled() { if (process.env.INSPECTION_FIELD_MODEL_ENABLED !== 'true') throw new AppError('Recurso no disponible', 404); }
const shareHash = (token: string) => createHash('sha256').update(token).digest('hex');
function protect(res: Response) { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); }
function validSignature(event: any) {
  const meta = event?.metadata;
  if (!event || event.tipo !== 'ACTA_FIRMADA' || !meta?.snapshot || !meta?.firma || inspectionSignatureHash(meta.snapshot) !== meta.contenidoSha256) throw new AppError('No pudo verificarse la copia firmada', 409);
  return meta;
}
async function access(req: Request, tx: any = prisma) {
  enabled(); const token = req.get('X-Sitrep-Acta-Token') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) throw new AppError('El enlace no es válido o venció. Solicitá uno nuevo al equipo de inspección.', 403);
  const event = await tx.eventoInspeccion.findUnique({ where: { id: req.params.accesoId } }); const meta = event?.metadata as any;
  if (!event || event.tipo !== 'ACTA_ACCESO_HABILITADO' || !meta?.tokenHash || !/^[a-f0-9]{64}$/.test(meta.tokenHash) || !timingSafeEqual(Buffer.from(meta.tokenHash, 'hex'), Buffer.from(shareHash(token), 'hex')) || !Number.isFinite(Date.parse(meta.expiresAt)) || Date.parse(meta.expiresAt) <= Date.now()) throw new AppError('El enlace no es válido o venció. Solicitá uno nuevo al equipo de inspección.', 403);
  const revoked = await tx.eventoInspeccion.findFirst({ where: { inspeccionId: event.inspeccionId, tipo: 'ACTA_ACCESO_REVOCADO', metadata: { path: ['accesoId'], equals: event.id } } });
  if (revoked) throw new AppError('Este enlace fue revocado. Solicitá uno nuevo al equipo de inspección.', 403);
  const signature = await tx.eventoInspeccion.findFirst({ where: { id: meta.firmaId, inspeccionId: event.inspeccionId, tipo: 'ACTA_FIRMADA' } });
  return { event, meta, signature, signed: validSignature(signature) };
}
async function staff(req: AuthRequest) {
  enabled(); const i = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, include: inspectionInclude });
  if (!i) throw new AppError('Inspección no encontrada', 404);
  if (!canAccessInspection(req.user, i)) throw new AppError('No autorizado para esta inspección', 403);
  return i;
}
export async function createActShare(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    protect(res); const i = await staff(req);
    const input = z.object({ firmaId: z.string().min(1), destinatario: z.string().trim().email(), diasAcceso: z.number().int().min(1).max(30).default(7) }).strict().parse(req.body);
    const signature = i.eventos.find(e => e.id === input.firmaId && e.tipo === 'ACTA_FIRMADA'); const signed = validSignature(signature);
    const token = randomBytes(32).toString('hex'); const expiresAt = new Date(Date.now() + input.diasAcceso * 86400000).toISOString();
    const event = await prisma.eventoInspeccion.create({ data: { inspeccionId: i.id, usuarioId: req.user.id, tipo: 'ACTA_ACCESO_HABILITADO', titulo: 'Acceso limitado a copia firmada preparado', destinatario: input.destinatario, estadoEntrega: 'NO_ENVIADO', visibleActor: false, metadata: { schemaVersion: 1, firmaId: signature!.id, contenidoSha256: signed.contenidoSha256, tokenHash: shareHash(token), expiresAt } } });
    const path = `/acta-compartida/${event.id}#${token}`, url = mailLink(path), appUrl = mailLink('/app' + path);
    const html = mailShell(`<h1 style="color:#1B5E3C;font-size:22px">Tu copia del acta ${escapeMail(i.numeroActa || i.numero)}</h1><p>Podés consultar y descargar la versión firmada, presentar un descargo o una apelación y consultar la respuesta del equipo de inspección.</p><p>Este enlace es personal. Su acceso vence el ${escapeMail(mailDateTime(expiresAt))}; este vencimiento no modifica los plazos del acta.</p><p><a href="${escapeMail(url)}" style="background:#1B5E3C;color:white;display:inline-block;padding:12px 20px;border-radius:6px">Consultar mi acta</a></p><p><a href="${escapeMail(appUrl)}">Abrir en la app</a></p>`);
    res.status(201).json({ success: true, data: { id: event.id, url, appUrl, expiresAt, destinatario: input.destinatario, correo: { subject: `[SITREP] Copia del acta ${i.numeroActa || i.numero}`, html, text: mailText(html), enviado: false } } });
  } catch(e) { next(e); }
}
export async function revokeActShare(req: AuthRequest, res: Response, next: NextFunction) {
  try { const i = await staff(req); const event = i.eventos.find(e => e.id === req.params.accesoId && e.tipo === 'ACTA_ACCESO_HABILITADO'); if (!event) throw new AppError('Acceso no encontrado', 404);
    await prisma.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM "inspecciones" WHERE id = ${i.id} FOR UPDATE`; await tx.eventoInspeccion.create({ data: { inspeccionId: i.id, usuarioId: req.user.id, tipo: 'ACTA_ACCESO_REVOCADO', titulo: 'Acceso limitado revocado', metadata: { accesoId: event.id } } }); }); res.json({ success: true });
  } catch(e) { next(e); }
}
export async function readSharedAct(req: Request, res: Response, next: NextFunction) {
  try {
    protect(res); const a = await access(req);
    const messages = await prisma.eventoInspeccion.findMany({ where: { inspeccionId: a.event.inspeccionId, tipo: { in: ['ACTA_PRESENTACION_RECIBIDA', 'ACTA_PRESENTACION_RESPONDIDA'] }, metadata: { path: ['accesoId'], equals: a.event.id } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    res.json({ success: true, data: { numero: a.signed.snapshot.numeroActa || a.signed.snapshot.numero, firmante: a.signed.firma.nombre, expiresAt: a.meta.expiresAt, contenidoSha256: a.signed.contenidoSha256, mensajes: messages.map(e => { const m = e.metadata as any; return { id: e.id, fecha: e.createdAt, tipo: m.tipo, nombre: m.nombre, texto: e.detalle, respondeAId: m.respondeAId, autoridad: e.tipo === 'ACTA_PRESENTACION_RESPONDIDA' }; }) } });
  } catch(e) { next(e); }
}
export async function downloadSharedAct(req: Request, res: Response, next: NextFunction) {
  try { protect(res); const a = await access(req); await streamInspectionActPdf(res, { ...a.signed.snapshot, version: a.signed.version, estado: 'EN_CAMPO', eventos: [], intercambios: [], informeTecnico: {}, firmasCapturadas: [{ ...a.signed.firma, registradaAt: a.signature.createdAt, contenidoSha256: a.signed.contenidoSha256 }] }, resolveInspectionEvidence); } catch(e) { next(e); }
}
const presentationSchema = z.object({ clienteId: z.string().uuid(), tipo: z.enum(['DESCARGO', 'APELACION', 'CONSULTA']), nombre: z.string().trim().min(2).max(200), texto: z.string().trim().min(10).max(12000) }).strict();
export async function presentSharedAct(req: Request, res: Response, next: NextFunction) {
  try {
    protect(res); const a = await access(req), input = presentationSchema.parse(req.body); const managers = await inspectionManagementRecipientIds();
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "inspecciones" WHERE id = ${a.event.inspeccionId} FOR UPDATE`;
      const fresh = await access(req, tx);
      const previous = await tx.eventoInspeccion.findFirst({ where: { inspeccionId: a.event.inspeccionId, tipo: 'ACTA_PRESENTACION_RECIBIDA', metadata: { path: ['clienteId'], equals: input.clienteId } } });
      if (previous) { const m = previous.metadata as any; if (m.accesoId !== a.event.id || previous.detalle !== input.texto || m.nombre !== input.nombre || m.tipo !== input.tipo) throw new AppError('La solicitud ya pertenece a otra presentación.', 409); return { id: previous.id, fecha: previous.createdAt }; }
      const event = await tx.eventoInspeccion.create({ data: { inspeccionId: a.event.inspeccionId, usuarioId: fresh.event.usuarioId, tipo: 'ACTA_PRESENTACION_RECIBIDA', titulo: 'Presentación recibida mediante enlace limitado', detalle: input.texto, visibleActor: false, canal: 'ENLACE_PERSONAL', metadata: { clienteId: input.clienteId, accesoId: a.event.id, firmaId: a.meta.firmaId, tipo: input.tipo, nombre: input.nombre, identidad: 'DECLARADA_POR_PORTADOR_DEL_ENLACE' } } });
      const inspection = await tx.inspeccion.findUniqueOrThrow({ where: { id: a.event.inspeccionId } });
      const recipients = await tx.usuario.findMany({ where: { activo: true, OR: [{ rol: 'ADMIN' }, { id: inspection.inspectorId }, { id: { in: managers } }, ...(inspection.tipoActor ? [{ rol: `ADMIN_${inspection.tipoActor}` as any }] : [])] }, select: { id: true } });
      await tx.notificacion.createMany({ data: recipients.map(u => ({ usuarioId: u.id, tipo: 'INFO_GENERAL', titulo: `PSIP · ${input.tipo === 'APELACION' ? 'Apelación' : input.tipo === 'DESCARGO' ? 'Descargo' : 'Consulta'} recibida`, mensaje: `${inspection.numero} · Revisá la presentación y respondé al inspeccionado.`, datos: JSON.stringify({ tipo: 'agenda_inspeccion', version: 1, inspeccionId: inspection.id, destino: 'inspeccion', eventoId: event.id, soloCampana: true }) })) });
      // Bell notices stay soloCampana; mail for this event has its own guarded ledger.
      await queueInspectionActMails(tx, { event: 'PRESENTACION_RECIBIDA', eventoId: event.id, managers, inspection, share: { destinatario: fresh.event.destinatario, expiresAt: fresh.meta.expiresAt }, tipo: input.tipo, nombre: input.nombre, fecha: event.createdAt });
      return { id: event.id, fecha: event.createdAt };
    });
    res.status(201).json({ success: true, data: result, message: 'Presentación registrada para revisión. No cambia ni suspende automáticamente los plazos del acta.' });
  } catch(e) { next(e); }
}
export async function respondSharedAct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const i = await staff(req); const input = z.object({ clienteId: z.string().uuid(), respondeAId: z.string().min(1), texto: z.string().trim().min(10).max(12000) }).strict().parse(req.body); const managers = await inspectionManagementRecipientIds();
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "inspecciones" WHERE id = ${i.id} FOR UPDATE`;
      const prior = await tx.eventoInspeccion.findFirst({ where: { inspeccionId: i.id, tipo: 'ACTA_PRESENTACION_RESPONDIDA', metadata: { path: ['clienteId'], equals: input.clienteId } } });
      if (prior) { const m = prior.metadata as any; if (prior.usuarioId !== req.user.id || prior.detalle !== input.texto || m.respondeAId !== input.respondeAId) throw new AppError('La respuesta ya corresponde a otra operación.', 409); return prior.id; }
      const original = await tx.eventoInspeccion.findFirst({ where: { id: input.respondeAId, inspeccionId: i.id, tipo: 'ACTA_PRESENTACION_RECIBIDA' } }); if (!original) throw new AppError('Presentación no encontrada', 404); const meta = original.metadata as any;
      const event = await tx.eventoInspeccion.create({ data: { inspeccionId: i.id, usuarioId: req.user.id, tipo: 'ACTA_PRESENTACION_RESPONDIDA', titulo: 'Respuesta disponible al inspeccionado', detalle: input.texto, visibleActor: false, canal: 'ENLACE_PERSONAL', estadoEntrega: 'DISPONIBLE_NO_ENVIADO', metadata: { clienteId: input.clienteId, respondeAId: original.id, accesoId: meta.accesoId, firmaId: meta.firmaId, tipo: 'RESPUESTA', nombre: 'Equipo de inspección' } } });
      const share = await tx.eventoInspeccion.findFirst({ where: { id: meta.accesoId, inspeccionId: i.id, tipo: 'ACTA_ACCESO_HABILITADO' } });
      const revoked = share && await tx.eventoInspeccion.findFirst({ where: { inspeccionId: i.id, tipo: 'ACTA_ACCESO_REVOCADO', metadata: { path: ['accesoId'], equals: share.id } }, select: { id: true } });
      // A revoked link gets no mail; staff still receive the follow-up copy.
      await queueInspectionActMails(tx, { event: 'RESPUESTA_PUBLICADA', eventoId: event.id, autorId: req.user.id, managers, inspection: i, share: { destinatario: share && !revoked ? share.destinatario : null, expiresAt: String((share?.metadata as any)?.expiresAt || '') }, tipo: meta.tipo, nombre: meta.nombre, fecha: event.createdAt, presentadaAt: original.createdAt });
      return event.id;
    });
    res.json({ success: true, data: { id: result }, message: 'Respuesta disponible en el enlace del acta. No se enviaron correos.' });
  } catch(e) { next(e); }
}
/** Prepared mail for this dossier's link events. Shown to staff with the same access as the dossier. */
export async function listActMails(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    protect(res); const i = await staff(req);
    const ids = i.eventos.filter(e => e.tipo === 'ACTA_PRESENTACION_RECIBIDA' || e.tipo === 'ACTA_PRESENTACION_RESPONDIDA').map(e => e.id);
    const state = inspectionActMailState();
    res.json({ success: true, data: { envioHabilitado: state.ready, motivo: state.reason, correos: await listInspectionActMails(ids) } });
  } catch(e) { next(e); }
}
