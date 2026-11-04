import type { Prisma } from '@prisma/client';
import { empresaEnabled } from '../domain/empresa';
import { isTrainingSession } from '../lib/trainingScope';

type Access = { empresaId: string; actividadId: string; rol: 'GENERADOR'; razonSocial: string };
export type FiscalCompanyRecipient = { generadorId: string; usuarioId: string; acceso: Access };

/** Fiscal records cover the whole actor, not an individual establishment. */
export async function fiscalCompanyRecipients(db: Prisma.TransactionClient, generadorIds: string[], usuarioIds?: string[]): Promise<FiscalCompanyRecipient[]> {
  if (!empresaEnabled() || isTrainingSession() || !generadorIds.length || usuarioIds?.length === 0) return [];
  const activities = await db.empresaActividad.findMany({
    where: { activa: true, rol: 'GENERADOR', actorId: { in: [...new Set(generadorIds)] } },
    select: { id: true, empresaId: true, actorId: true },
  });
  if (!activities.length) return [];
  const [companies, generators, grants] = await Promise.all([
    db.empresa.findMany({ where: { id: { in: [...new Set(activities.map(a => a.empresaId))] }, activa: true }, select: { id: true, cuit: true, razonSocial: true } }),
    db.generador.findMany({ where: { id: { in: activities.map(a => a.actorId) }, activo: true }, select: { id: true, cuit: true } }),
    db.autorizacionEmpresa.findMany({ where: { actividadId: { in: activities.map(a => a.id) }, activa: true, todosEstablecimientos: true,
      ...(usuarioIds ? { usuarioId: { in: [...new Set(usuarioIds)] } } : {}) }, select: { empresaId: true, actividadId: true, usuarioId: true } }),
  ]);
  if (!grants.length) return [];
  const people = await db.usuario.findMany({ where: { id: { in: [...new Set(grants.map(g => g.usuarioId))] },
    activo: true, emailVerified: true, rol: { in: ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] } }, select: { id: true } });
  const activeUsers = new Set(people.map(p => p.id));
  const byActivity = new Map(activities.map(a => [a.id, a]));
  const byCompany = new Map(companies.map(c => [c.id, c]));
  const byGenerator = new Map(generators.map(g => [g.id, g]));
  const recipients = new Map<string, FiscalCompanyRecipient>();
  for (const grant of grants) {
    const activity = byActivity.get(grant.actividadId), company = byCompany.get(grant.empresaId);
    const generator = activity && byGenerator.get(activity.actorId);
    if (!activity || !company || activity.empresaId !== company.id || !generator || !activeUsers.has(grant.usuarioId)
      || generator.cuit.replace(/\D/g, '') !== company.cuit) continue;
    recipients.set(`${generator.id}:${grant.usuarioId}`, { generadorId: generator.id, usuarioId: grant.usuarioId,
      acceso: { empresaId: company.id, actividadId: activity.id, rol: 'GENERADOR', razonSocial: company.razonSocial } });
  }
  return [...recipients.values()];
}

type FiscalNotice = { usuarioId: string; datos: string | null; titulo: string; mensaje: string };
type FiscalData = { tipo?: unknown; destino?: unknown; version?: unknown; generadorId?: unknown; fiscalYear?: unknown; empresaId?: unknown; actividadId?: unknown; motivo?: unknown };
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const parseData = (raw: string | null): FiscalData | null => {
  try { const value = JSON.parse(raw || 'null'); return value && typeof value === 'object' && !Array.isArray(value) ? value : null; }
  catch { return null; }
};

/** Mutation responses need not repeat private fiscal content; a fresh GET revalidates it. */
export function maskFiscalCompanyNotice<T extends FiscalNotice>(notice: T): T {
  const d = parseData(notice.datos);
  return d?.tipo === 'recordatorio_fiscal' && d.destino === 'representante'
    ? { ...notice, titulo: 'Aviso para tu empresa', mensaje: 'Consultá tus avisos para conocer el estado actual.',
      datos: JSON.stringify({ tipo: 'recordatorio_fiscal_no_disponible', version: 1 }) } : notice;
}

/** A stored notice is not a grant. Revalidate its original company on every read. */
export async function withFiscalCompanyNoticeContext<T extends FiscalNotice>(db: Prisma.TransactionClient, notices: T[]): Promise<T[]> {
  const data = notices.map(n => parseData(n.datos));
  const companyNotices = data.filter((d): d is FiscalData => d?.tipo === 'recordatorio_fiscal' && d.destino === 'representante');
  if (!companyNotices.length) return notices;
  const ids = companyNotices.map(d => d.generadorId).filter(safeId);
  const users = notices.filter((_, i) => data[i]?.tipo === 'recordatorio_fiscal' && data[i]?.destino === 'representante').map(n => n.usuarioId);
  const eligible = await fiscalCompanyRecipients(db, ids, users);
  const byKey = new Map(eligible.map(r => [`${r.generadorId}:${r.usuarioId}:${r.acceso.empresaId}:${r.acceso.actividadId}`, r]));
  return notices.map((notice, i) => {
    const d = data[i];
    if (d?.tipo !== 'recordatorio_fiscal' || d.destino !== 'representante') return notice;
    const valid = d.version === 1 && safeId(d.generadorId) && safeId(d.empresaId) && safeId(d.actividadId)
      && Number.isInteger(d.fiscalYear) && Number(d.fiscalYear) >= 2000 && Number(d.fiscalYear) <= 2100
      && typeof d.motivo === 'string' && d.motivo.length >= 10 && d.motivo.length <= 500;
    const recipient = valid ? byKey.get(`${d.generadorId}:${notice.usuarioId}:${d.empresaId}:${d.actividadId}`) : undefined;
    if (!recipient) return { ...notice, titulo: 'Aviso no disponible',
      mensaje: 'Tu acceso a esta información ya no está disponible. Revisá tus autorizaciones.',
      datos: JSON.stringify({ tipo: 'recordatorio_fiscal_no_disponible', version: 1 }) };
    return { ...notice, titulo: `Recordatorio fiscal ${d.fiscalYear}`, mensaje: d.motivo as string,
      datos: JSON.stringify({ tipo: 'recordatorio_fiscal', version: 1, destino: 'representante', generadorId: d.generadorId,
        fiscalYear: d.fiscalYear, accesosEmpresa: [recipient.acceso] }) };
  });
}
