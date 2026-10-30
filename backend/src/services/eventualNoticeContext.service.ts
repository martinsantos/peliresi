import type { Prisma } from '@prisma/client';
import { manifestFeatureEnabled } from '../lib/manifestTraining';
import { eventualNoticeAudienceBatch, eventualNoticeEvent, type EventualRecipient } from './eventualNotice.service';

type Notice = { usuarioId: string; manifiestoId: string | null; tipo: string; titulo: string; mensaje: string; datos: string | null };
type Data = Record<string, unknown>;
const safeId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
export function eventualNoticeData(raw: string | null): Data | null {
  try { const data = JSON.parse(raw || 'null'); return data && typeof data === 'object' && !Array.isArray(data) ? data : null; }
  catch { return null; }
}
const isEventual = (notice: Pick<Notice, 'tipo'>, data: Data | null) => notice.tipo === 'INFO_GENERAL' && data?.tipo === 'manifiesto_eventual';

/** A current grant must also match a context that originally received this
 * notice. Old notices have no company snapshot and may only use direct access. */
export function matchingEventualRecipient(data: Data, current?: EventualRecipient): EventualRecipient | null {
  if (!current) return null;
  if (!Object.prototype.hasOwnProperty.call(data, 'accesoVersion')) {
    const legacy = { ...current, accesosEmpresa: [] };
    return legacy.actividadesPropias.length || legacy.autoridad ? legacy : null;
  }
  if (data.accesoVersion !== 1 || !Array.isArray(data.actividadesPropias) || !Array.isArray(data.accesosEmpresa) || typeof data.autoridad !== 'boolean') return null;
  const savedOwn = data.actividadesPropias as unknown[], savedCompany = data.accesosEmpresa as unknown[];
  const propias = current.actividadesPropias.filter(a => savedOwn.some(v => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const s = v as Data; return s.rol === a.rol && safeId(s.actorId) && s.actorId === a.actorId;
  }));
  const empresas = current.accesosEmpresa.filter(a => savedCompany.some(v => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const s = v as Data; return s.rol === a.rol && s.actorId === a.actorId && s.empresaId === a.empresaId
      && s.actividadId === a.actividadId && s.autorizacionId === a.autorizacionId && s.revision === a.revision;
  }));
  const autoridad = current.autoridad && data.autoridad === true;
  return propias.length || empresas.length || autoridad ? { ...current, actividadesPropias: propias, accesosEmpresa: empresas, autoridad } : null;
}

export function maskEventualNotice<T extends Notice>(notice: T): T {
  if (!isEventual(notice, eventualNoticeData(notice.datos))) return notice;
  return { ...notice, manifiestoId: null, manifiesto: null, titulo: 'Aviso no disponible',
    mensaje: 'Tu acceso a esta información ya no está disponible. Revisá tus autorizaciones.',
    datos: JSON.stringify({ tipo: 'alerta_empresa_no_disponible', version: 1 }) };
}

/** Revalidate the event, original recipient and current access before returning
 * private text or identifiers. Neither opening nor masking changes the row. */
export async function withEventualNoticeContext<T extends Notice>(db: Prisma.TransactionClient, notices: T[]): Promise<T[]> {
  const data = notices.map(n => eventualNoticeData(n.datos));
  const ids = [...new Set(notices.flatMap((n, i) => isEventual(n, data[i]) && safeId(data[i]?.registroId) ? [data[i]!.registroId as string] : []))];
  if (!notices.some((n, i) => isEventual(n, data[i]))) return notices;
  if (!manifestFeatureEnabled('MANIFEST_EXCEPTIONAL_ENABLED')) return notices.map(maskEventualNotice);
  const records = ids.length ? await db.registroManifiestoExcepcional.findMany({ where: { id: { in: ids } } }) : [];
  const byId = new Map(records.map(record => [record.id, record]));
  const specs = notices.flatMap((n, i) => {
    const d = data[i], record = d && safeId(d.registroId) ? byId.get(d.registroId) : undefined;
    if (!isEventual(n, d) || !record || d?.version !== 1 || !safeId(d.eventoId)) return [];
    const event = eventualNoticeEvent(record, d.eventoId);
    return event && event.kind === d.evento ? [{ index: i, record, ...event }] : [];
  });
  const audiences = await eventualNoticeAudienceBatch(db, specs, [...new Set(specs.map(s => notices[s.index].usuarioId))]);
  const recipientByIndex = new Map(specs.map((spec, i) => [spec.index, audiences[i].find(user => user.id === notices[spec.index].usuarioId)]));
  return notices.map((notice, i) => {
    const d = data[i]; if (!isEventual(notice, d) || !d) return notice;
    const recipient = matchingEventualRecipient(d, recipientByIndex.get(i));
    if (!recipient) return maskEventualNotice(notice);
    return { ...notice, datos: JSON.stringify({ ...d, accesoVersion: 1, actividadesPropias: recipient.actividadesPropias,
      accesosEmpresa: recipient.accesosEmpresa, autoridad: recipient.autoridad }) };
  });
}
