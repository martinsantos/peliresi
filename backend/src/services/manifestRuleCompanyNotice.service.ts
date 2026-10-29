import type { Prisma } from '@prisma/client';
import { manifestCompanyRecipientsBatch, type ManifestCompanyAccess } from './manifestCompanyRecipients.service';

type Notice = { usuarioId: string; manifiestoId: string | null; tipo: string; titulo: string; mensaje: string; datos: string | null };
type Data = Record<string, unknown>;
const safeId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const parse = (raw: string | null): Data | null => {
 try { const d = JSON.parse(raw || 'null'); return d && typeof d === 'object' && !Array.isArray(d) ? d : null; }
 catch { return null; }
};
export const isManifestRuleCompanyNotice = (notice: Pick<Notice, 'tipo'>, data: Data | null): boolean =>
 notice.tipo === 'ALERTA_SISTEMA' && data?.destino === 'representante'
 && ['duracion_transito_configurada', 'alerta_regla_manifiesto'].includes(String(data.tipo));

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
 if (!isManifestRuleCompanyNotice(notice, parse(notice.datos))) return notice;
 return { ...notice, manifiestoId: null, manifiesto: null, titulo: 'Aviso para tu empresa',
  mensaje: 'Consultá tus avisos para conocer el estado actual.',
  datos: JSON.stringify({ tipo: 'alerta_empresa_no_disponible', version: 1 }) };
}

/** Revalidate on every read, in a fixed number of queries per page. */
export async function withManifestRuleCompanyNoticeContext<T extends Notice>(db: Prisma.TransactionClient, notices: T[]): Promise<T[]> {
 const data = notices.map(n => parse(n.datos));
 const targets = notices.filter((n, i) => isManifestRuleCompanyNotice(n, data[i]));
 if (!targets.length) return notices;
 const eligible = await manifestCompanyRecipientsBatch(db, targets.map(n => n.manifiestoId).filter(safeId), targets.map(n => n.usuarioId).filter(safeId));
 return notices.map((notice, index) => {
  const d = data[index];
  if (!isManifestRuleCompanyNotice(notice, d)) return notice;
  const match = safeId(notice.manifiestoId) && d
   ? eligible.get(notice.manifiestoId)?.find(r => r.usuarioId === notice.usuarioId) : undefined;
  const accesses = d && match ? matchingManifestRuleAccesses(d, match.accesosEmpresa) : [];
  if (!accesses.length) return { ...notice, manifiestoId: null, manifiesto: null,
   titulo: 'Aviso no disponible', mensaje: 'Tu acceso a esta información ya no está disponible. Revisá tus autorizaciones.',
   datos: JSON.stringify({ tipo: 'alerta_empresa_no_disponible', version: 1 }) };
  return { ...notice, datos: JSON.stringify({ ...d, accesosEmpresa: accesses }) };
 });
}
