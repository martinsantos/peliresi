import type { Prisma } from '@prisma/client';
import { manifestCompanyRecipientsBatch, type ManifestCompanyAccess } from './manifestCompanyRecipients.service';
import { maskEventualNotice, withEventualNoticeContext } from './eventualNoticeContext.service';

type Notice = { usuarioId: string; manifiestoId: string | null; tipo: string; titulo: string; mensaje: string; datos: string | null };
type Data = Record<string, unknown>;
const safeId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const parse = (raw: string | null): Data | null => {
 try { const d = JSON.parse(raw || 'null'); return d && typeof d === 'object' && !Array.isArray(d) ? d : null; }
 catch { return null; }
};
const isLegacyCompanyNotice = (notice: Pick<Notice, 'tipo'>, data: Data | null): boolean =>
 notice.tipo === 'INFO_GENERAL' && !!data && ['propuesta_partes', 'adenda_manifiesto', 'certificado_manifiesto'].includes(String(data.tipo))
  && Array.isArray(data.accesosEmpresa);
export const isManifestRuleCompanyNotice = (notice: Pick<Notice, 'tipo'>, data: Data | null): boolean => {
 if (isLegacyCompanyNotice(notice, data)) return true;
 if (data?.destino !== 'representante') return false;
 if (notice.tipo === 'INFO_GENERAL' && data.tipo === 'reversion_manifiesto') return true;
 if (notice.tipo === 'ALERTA_SISTEMA' && ['duracion_transito_configurada', 'alerta_regla_manifiesto', 'recordatorio_operacion'].includes(String(data.tipo))) return true;
 if (notice.tipo === 'VENCIMIENTO_PROXIMO' && data.tipo === 'recordatorio_firma') return true;
 const stateTypes: Record<string, string> = { EN_TRANSITO: 'MANIFIESTO_EN_TRANSITO', ENTREGADO: 'MANIFIESTO_ENTREGADO',
  RECIBIDO: 'MANIFIESTO_RECIBIDO', EN_TRATAMIENTO: 'INFO_GENERAL', TRATADO: 'MANIFIESTO_TRATADO', CANCELADO: 'INFO_GENERAL' };
 if (data.tipo === 'estado_manifiesto' && stateTypes[String(data.estado)] === notice.tipo) return true;
 const eventTypes: Record<string, string> = { INCIDENTE: 'INCIDENTE_REPORTADO', RECHAZO: 'MANIFIESTO_RECHAZADO', DIFERENCIA_PESO: 'ALERTA_SISTEMA', ENTREGA: 'MANIFIESTO_ENTREGADO' };
 return data.tipo === 'alerta_evento_manifiesto' && eventTypes[String(data.evento)] === notice.tipo;
};

/** The original activity and site are part of the audience, not an authority. */
export function matchingManifestRuleAccesses(data: Data, current: ManifestCompanyAccess[]): ManifestCompanyAccess[] {
 if (data.version !== 1 || !Array.isArray(data.accesosEmpresa)) return [];
 return current.filter(access => data.accesosEmpresa instanceof Array && data.accesosEmpresa.some((saved: unknown) => {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return false;
  const a = saved as Record<string, unknown>;
  return safeId(a.empresaId) && safeId(a.actividadId) && a.empresaId === access.empresaId
   && a.actividadId === access.actividadId && a.rol === access.rol
   && (a.establecimientoId === undefined || safeId(a.establecimientoId))
   && a.establecimientoId === access.establecimientoId;
 }));
}

/** Mutation responses do not repeat the private content. */
export function maskManifestRuleCompanyNotice<T extends Notice>(notice: T): T {
 notice = maskEventualNotice(notice);
 if (!isManifestRuleCompanyNotice(notice, parse(notice.datos))) return notice;
 return { ...notice, manifiestoId: null, manifiesto: null, titulo: 'Aviso para tu empresa',
  mensaje: 'Consultá tus avisos para conocer el estado actual.',
  datos: JSON.stringify({ tipo: 'alerta_empresa_no_disponible', version: 1 }) };
}

/** Revalidate on every read, in a fixed number of queries per page. */
export async function withManifestRuleCompanyNoticeContext<T extends Notice>(db: Prisma.TransactionClient, notices: T[]): Promise<T[]> {
 notices = await withEventualNoticeContext(db, notices);
 const data = notices.map(n => parse(n.datos));
 const targets = notices.filter((n, i) => isManifestRuleCompanyNotice(n, data[i]));
 if (!targets.length) return notices;
 const eligible = await manifestCompanyRecipientsBatch(db, targets.map(n => n.manifiestoId).filter(safeId), targets.map(n => n.usuarioId).filter(safeId));
 // Older proposal/addendum/certificate notices may contain company metadata on
 // a direct actor owner too. Preserve that independent owner access, but only
 // after checking the current actor; a revoked representative is masked.
 const ownerIds = notices.flatMap((notice, index) => {
  const d = data[index];
  if (!isLegacyCompanyNotice(notice, d) || !safeId(notice.manifiestoId) || !d) return [];
  const match = eligible.get(notice.manifiestoId)?.find(r => r.usuarioId === notice.usuarioId);
  return match && matchingManifestRuleAccesses(d, match.accesosEmpresa).length ? [] : [notice.manifiestoId];
 });
 const owners = ownerIds.length ? await db.manifiesto.findMany({ where: { id: { in: [...new Set(ownerIds)] } }, select: {
  id: true, generador: { select: { usuarioId: true, activo: true } },
  transportista: { select: { usuarioId: true, activo: true } }, operador: { select: { usuarioId: true, activo: true } },
 } }) : [];
 return notices.map((notice, index) => {
  const d = data[index];
  if (!isManifestRuleCompanyNotice(notice, d)) return notice;
  const match = safeId(notice.manifiestoId) && d
   ? eligible.get(notice.manifiestoId)?.find(r => r.usuarioId === notice.usuarioId) : undefined;
  const accesses = d && match ? matchingManifestRuleAccesses(d, match.accesosEmpresa) : [];
  if (!accesses.length) {
   const current = isLegacyCompanyNotice(notice, d) ? owners.find(m => m.id === notice.manifiestoId) : undefined;
   const directOwner = current && [current.generador, current.transportista, current.operador]
    .some(actor => actor?.activo && actor.usuarioId === notice.usuarioId);
   if (directOwner && d) {
    const { accesosEmpresa: _revokedAccess, ...ownerData } = d;
    return { ...notice, datos: JSON.stringify(ownerData) };
   }
   return { ...notice, manifiestoId: null, manifiesto: null,
    titulo: 'Aviso no disponible', mensaje: 'Tu acceso a esta información ya no está disponible. Revisá tus autorizaciones.',
    datos: JSON.stringify({ tipo: 'alerta_empresa_no_disponible', version: 1 }) };
  }
  return { ...notice, datos: JSON.stringify({ ...d, accesosEmpresa: accesses }) };
 });
}
