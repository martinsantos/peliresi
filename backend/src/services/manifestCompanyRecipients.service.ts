import { isTrainingSession } from '../lib/trainingScope';
import type { Prisma } from '@prisma/client';
import { empresaEnabled } from '../domain/empresa';

export type ManifestCompanyAccess = {
 empresaId: string; actividadId: string; rol: string; razonSocial: string;
 establecimientoId?: string; establecimiento?: string;
};
export type ManifestCompanyRecipient = { usuarioId: string; accesosEmpresa: ManifestCompanyAccess[] };

/** Recheck current activity, actor, account and site in bounded batches.
 * Being responsible alone never grants dossier access. */
export async function manifestCompanyRecipientsBatch(db: Prisma.TransactionClient, manifiestoIds: string[], usuarioIds?: string[]): Promise<Map<string, ManifestCompanyRecipient[]>> {
 const result = new Map<string, ManifestCompanyRecipient[]>();
 if (!empresaEnabled() || isTrainingSession() || !manifiestoIds.length || usuarioIds?.length === 0) return result;
 const manifests = await db.manifiesto.findMany({ where: { id: { in: [...new Set(manifiestoIds)] } }, select: {
  id: true, generadorId: true, transportistaId: true, operadorId: true, contextoEmpresa: true,
 } });
 const refs = new Map<string, { rol: string; actorId: string }>();
 for (const manifest of manifests) for (const ref of [
  { rol: 'GENERADOR', actorId: manifest.generadorId }, { rol: 'TRANSPORTISTA', actorId: manifest.transportistaId },
  { rol: 'OPERADOR', actorId: manifest.operadorId },
 ]) if (ref.actorId) refs.set(`${ref.rol}:${ref.actorId}`, { rol: ref.rol, actorId: ref.actorId });
 if (!refs.size) return result;
 const activities = await db.empresaActividad.findMany({ where: { activa: true, OR: [...refs.values()] } });
 if (!activities.length) return result;
 const companyIds = [...new Set(activities.map(a => a.empresaId))];
 const actorIds = (role: string) => [...new Set(activities.filter(a => a.rol === role).map(a => a.actorId))];
 const [companies, grants, sites, generators, carriers, operators] = await Promise.all([
  db.empresa.findMany({ where: { id: { in: companyIds }, activa: true } }),
  db.autorizacionEmpresa.findMany({ where: { actividadId: { in: activities.map(a => a.id) }, activa: true,
   ...(usuarioIds ? { usuarioId: { in: [...new Set(usuarioIds)] } } : {}) } }),
  db.establecimientoEmpresa.findMany({ where: { empresaId: { in: companyIds }, activo: true } }),
  db.generador.findMany({ where: { id: { in: actorIds('GENERADOR') } }, select: { id: true, activo: true, cuit: true } }),
  db.transportista.findMany({ where: { id: { in: actorIds('TRANSPORTISTA') } }, select: { id: true, activo: true, cuit: true } }),
  db.operador.findMany({ where: { id: { in: actorIds('OPERADOR') } }, select: { id: true, activo: true, cuit: true } }),
 ]);
 const people = grants.length ? await db.usuario.findMany({ where: { id: { in: [...new Set(grants.map(g => g.usuarioId))] },
  activo: true, emailVerified: true, rol: { in: ['GENERADOR','TRANSPORTISTA','OPERADOR'] } }, select: { id: true } }) : [];
 const users = new Set(people.map(p => p.id)), companyById = new Map(companies.map(c => [c.id, c]));
 const actorByRef = new Map<string, { id: string; activo: boolean; cuit: string }>([
  ...generators.map(a => [`GENERADOR:${a.id}`, a] as const), ...carriers.map(a => [`TRANSPORTISTA:${a.id}`, a] as const),
  ...operators.map(a => [`OPERADOR:${a.id}`, a] as const),
 ]);
 const activitiesByRef = new Map<string, typeof activities>();
 for (const activity of activities) {
  const key = `${activity.rol}:${activity.actorId}`, group = activitiesByRef.get(key) || [];
  group.push(activity); activitiesByRef.set(key, group);
 }
 const grantsByActivity = new Map<string, typeof grants>();
 for (const grant of grants) {
  const group = grantsByActivity.get(grant.actividadId) || [];
  group.push(grant); grantsByActivity.set(grant.actividadId, group);
 }
 const siteById = new Map(sites.map(site => [site.id, site]));
 for (const manifest of manifests) {
  const snapshot = manifest.contextoEmpresa as { empresaId?: string; establecimientoId?: string } | null;
  const recipients = new Map<string, ManifestCompanyAccess[]>();
  for (const ref of [
   { rol: 'GENERADOR', actorId: manifest.generadorId }, { rol: 'TRANSPORTISTA', actorId: manifest.transportistaId },
   { rol: 'OPERADOR', actorId: manifest.operadorId },
  ]) {
   if (!ref.actorId) continue;
   for (const activity of activitiesByRef.get(`${ref.rol}:${ref.actorId}`) || []) {
    const company = companyById.get(activity.empresaId), actor = actorByRef.get(`${activity.rol}:${activity.actorId}`);
    if (!company || !actor?.activo || actor.cuit.replace(/\D/g, '') !== company.cuit) continue;
    const candidate = snapshot?.establecimientoId ? siteById.get(snapshot.establecimientoId) : undefined;
    const site = candidate?.empresaId === company.id && snapshot?.empresaId === company.id ? candidate : undefined;
    for (const grant of grantsByActivity.get(activity.id) || []) {
     if (!users.has(grant.usuarioId) || grant.empresaId !== company.id) continue;
     if (!grant.todosEstablecimientos && (!site || !grant.establecimientoIds.includes(site.id))) continue;
     const access: ManifestCompanyAccess = { empresaId: company.id, actividadId: activity.id, rol: activity.rol,
      razonSocial: company.razonSocial, ...(site ? { establecimientoId: site.id, establecimiento: site.nombre } : {}) };
     recipients.set(grant.usuarioId, [...(recipients.get(grant.usuarioId) || []), access]);
    }
   }
  }
  result.set(manifest.id, [...recipients].map(([usuarioId, accesosEmpresa]) => ({ usuarioId, accesosEmpresa })));
 }
 return result;
}

export async function manifestCompanyRecipients(db: Prisma.TransactionClient, manifiestoId: string): Promise<ManifestCompanyRecipient[]> {
 return (await manifestCompanyRecipientsBatch(db, [manifiestoId])).get(manifiestoId) || [];
}
