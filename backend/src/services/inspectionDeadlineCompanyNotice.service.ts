import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PARTICIPANT_VISIBLE_STATES } from './inspectionExchange.service';
import { inspectionCompanyRecipientsBatch, type InspectionRef } from './inspectionCompanyNotice.service';
import { requirementSituation } from './alertCataloguePolicy.service';

type Notice = { usuarioId?: string; tipo?: string; titulo?: string; mensaje?: string; datos: string | null };
type Reference = { tipo: 'psip_vencimiento_empresa'; version: 1; casoId: string; autorizacionId: string };
const safeId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const parse = (raw: string | null): any => { try { return JSON.parse(raw || 'null'); } catch { return null; } };
const reference = (raw: string | null): Reference | null => {
  const data = parse(raw);
  return data?.tipo === 'psip_vencimiento_empresa' && data.version === 1 && safeId(data.casoId) && safeId(data.autorizacionId) ? data : null;
};
function unavailable<T extends Notice>(notice: T): T {
  return { ...notice, titulo: 'Aviso no disponible', mensaje: 'Tu acceso a esta información ya no está disponible. Revisá tus autorizaciones.',
    datos: JSON.stringify({ tipo: 'alerta_empresa_no_disponible', version: 1 }) };
}

/** An inspection does not identify a site. Use only a live full-company grant;
 * do not persist the inspected entity or deadline in the representative notice. */
export async function inspectionDeadlineCompanyNoticeRows(db: Prisma.TransactionClient, inspection: InspectionRef, caseId: string, exclude: string[]) {
  if (!safeId(caseId)) return [];
  const recipients = (await inspectionCompanyRecipientsBatch(db, [inspection])).get(inspection.id) || [];
  const omitted = new Set(exclude);
  return recipients.filter(recipient => !omitted.has(recipient.usuarioId)).map(recipient => ({
    id: 'aviso_' + createHash('sha256').update(JSON.stringify([caseId, recipient.usuarioId])).digest('hex'),
    usuarioId: recipient.usuarioId, tipo: 'INFO_GENERAL' as const, prioridad: 'NORMAL' as const,
    titulo: 'Aviso para tu empresa', mensaje: 'Consultá tus avisos para conocer la información disponible.',
    datos: JSON.stringify({ tipo: 'psip_vencimiento_empresa', version: 1, casoId: caseId, autorizacionId: recipient.access.autorizacionId } satisfies Reference),
  }));
}

/** Project only a recipient's own notice from the live case and authorization.
 * A response, rule change or closed case makes the old warning historical. */
export async function withInspectionDeadlineCompanyNoticeContext<T extends Notice>(db: Prisma.TransactionClient, notices: T[]): Promise<T[]> {
  const refs = notices.map(n => n.tipo === 'INFO_GENERAL' ? reference(n.datos) : null);
  const privateNotice = (n: Notice) => parse(n.datos)?.tipo === 'psip_vencimiento_empresa';
  if (!refs.some(Boolean)) return notices.map(n => privateNotice(n) ? unavailable(n) : n);
  const cases = await db.alertaGenerada.findMany({ where: { id: { in: [...new Set(refs.flatMap(r => r ? [r.casoId] : []))] } },
    select: { id: true, datos: true, estado: true, regla: { select: { activa: true } } } });
  const validFacts = (raw: string) => {
    const f = parse(raw);
    return f?.familia === 'catalogo_verificable' && f.version === 1 && f.tipo === 'requerimiento_inspeccion'
      && f.entidad === 'REQUERIMIENTO' && safeId(f.entidadId) && safeId(f.inspeccionId) && safeId(f.actorId)
      && ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(f.tipoActor) && typeof f.vencimiento === 'string'
      && Number.isFinite(Date.parse(f.vencimiento)) ? f : null;
  };
  const facts = new Map(cases.map(item => [item.id, validFacts(item.datos)]));
  const ids = [...new Set([...facts.values()].flatMap(f => f ? [f.entidadId as string] : []))];
  const requests = ids.length ? await db.intercambioInspeccion.findMany({ where: { id: { in: ids } }, select: {
    id: true, inspeccionId: true, tipo: true, parte: true, destinatario: true, plazoRespuestaAt: true,
    respuestas: { select: { tipo: true, parte: true } }, inspeccion: { select: {
      id: true, numero: true, estado: true, tipoActor: true, generadorId: true, transportistaId: true, operadorId: true,
    } },
  } }) : [];
  const requestById = new Map(requests.map(item => [item.id, item]));
  const caseById = new Map(cases.map(item => [item.id, item]));
  const eligible = await inspectionCompanyRecipientsBatch(db, requests.map(r => r.inspeccion).filter(i => PARTICIPANT_VISIBLE_STATES.includes(i.estado)),
    [...new Set(notices.map(n => n.usuarioId).filter(safeId))]);
  return notices.map((notice, index) => {
    const ref = refs[index]; if (!ref) return privateNotice(notice) ? unavailable(notice) : notice;
    const item = caseById.get(ref.casoId), f = item && facts.get(item.id), request = f && requestById.get(f.entidadId);
    const inspection = request?.inspeccion;
    const actorId = inspection?.tipoActor === 'GENERADOR' ? inspection.generadorId : inspection?.tipoActor === 'TRANSPORTISTA' ? inspection.transportistaId : inspection?.operadorId;
    const match = inspection && notice.usuarioId && (eligible.get(inspection.id) || [])
      .find(r => r.usuarioId === notice.usuarioId && r.access.autorizacionId === ref.autorizacionId);
    if (!item || !f || !request || !inspection || !inspection.tipoActor || !match || request.inspeccionId !== f.inspeccionId
      || inspection.tipoActor !== f.tipoActor || actorId !== f.actorId || request.tipo !== 'REQUERIMIENTO'
      || request.parte !== 'AUTORIDAD' || request.destinatario !== 'INSPECCIONADO') return unavailable(notice);
    const active = item.regla.activa && ['PENDIENTE', 'EN_REVISION'].includes(item.estado)
      && request.plazoRespuestaAt?.toISOString() === f.vencimiento && requirementSituation(request, new Date()) === 'PENDIENTE';
    const { autorizacionId: _grant, ...access } = match.access;
    return { ...notice, titulo: active ? 'Requerimiento vencido sin respuesta' : 'Estado actualizado de requerimiento',
      mensaje: active ? `${inspection.numero} · El plazo de este requerimiento venció y todavía no hay una respuesta vinculada. Abrilo para revisar.`
        : `${inspection.numero} · El recordatorio anterior ya no está activo. Abrí el requerimiento para revisar su estado actual.`,
      datos: JSON.stringify({ familia: 'catalogo_verificable', version: 1, tipo: 'requerimiento_inspeccion', entidad: 'REQUERIMIENTO',
        entidadId: request.id, inspeccionId: inspection.id, numero: inspection.numero, vencimiento: f.vencimiento,
        tipoActor: inspection.tipoActor, actorId, estadoDetectado: active ? 'SIN_RESPUESTA' : 'ACTUALIZADO', casoId: item.id,
        destino: 'participacion', representacionVersion: 1, accesosEmpresa: [access] }) };
  });
}
