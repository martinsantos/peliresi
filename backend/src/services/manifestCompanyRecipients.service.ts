import { isTrainingSession } from '../lib/trainingScope';
import type { Prisma } from '@prisma/client';
import { empresaEnabled } from '../domain/empresa';

export type ManifestCompanyAccess = {
 empresaId: string; actividadId: string; rol: string; razonSocial: string;
 establecimientoId?: string; establecimiento?: string;
};
export type ManifestCompanyRecipient = { usuarioId: string; accesosEmpresa: ManifestCompanyAccess[] };

/** The same approved activity/site rules used by resolveCompanyContext, in the
 * caller's transaction. Being responsible alone never grants dossier access. */
export async function manifestCompanyRecipients(db: Prisma.TransactionClient, manifiestoId: string): Promise<ManifestCompanyRecipient[]> {
 if (!empresaEnabled() || isTrainingSession()) return [];
 const manifest = await db.manifiesto.findUnique({ where: { id: manifiestoId }, select: {
  generadorId: true, transportistaId: true, operadorId: true, contextoEmpresa: true,
 } });
 if (!manifest) return [];
 const refs = [
  { rol: 'GENERADOR', actorId: manifest.generadorId },
  { rol: 'TRANSPORTISTA', actorId: manifest.transportistaId },
  { rol: 'OPERADOR', actorId: manifest.operadorId },
 ].filter((p): p is {rol:string;actorId:string} => !!p.actorId);
 const activities = await db.empresaActividad.findMany({ where: { activa: true, OR: refs } });
 if (!activities.length) return [];
 const companyIds = [...new Set(activities.map(a => a.empresaId))];
 const [companies, grants, sites, actors] = await Promise.all([
  db.empresa.findMany({ where: { id: { in: companyIds }, activa: true } }),
  db.autorizacionEmpresa.findMany({ where: { actividadId: { in: activities.map(a => a.id) }, activa: true } }),
  db.establecimientoEmpresa.findMany({ where: { empresaId: { in: companyIds }, activo: true } }),
  Promise.all(activities.map(async a => ({
   activity: a,
   actor: await (a.rol === 'GENERADOR' ? db.generador.findUnique({where:{id:a.actorId},select:{activo:true,cuit:true}}) : a.rol === 'TRANSPORTISTA' ? db.transportista.findUnique({where:{id:a.actorId},select:{activo:true,cuit:true}}) : db.operador.findUnique({where:{id:a.actorId},select:{activo:true,cuit:true}})),
  }))),
 ]);
 const people = grants.length ? await db.usuario.findMany({ where: { id: { in: [...new Set(grants.map(g => g.usuarioId))] }, activo: true, emailVerified: true, rol: { in: ['GENERADOR','TRANSPORTISTA','OPERADOR'] } }, select: { id: true } }) : [];
 const users = new Set(people.map(p => p.id));
 const snapshot = manifest.contextoEmpresa as { empresaId?: string; establecimientoId?: string } | null;
 const result = new Map<string, ManifestCompanyAccess[]>();
 for (const grant of grants) {
  const activity = activities.find(a => a.id === grant.actividadId && a.empresaId === grant.empresaId);
  const company = companies.find(c => c.id === grant.empresaId);
  const actor = actors.find(a => a.activity.id === activity?.id)?.actor;
  if (!users.has(grant.usuarioId) || !activity || !company || !actor?.activo || actor.cuit.replace(/\D/g, '') !== company.cuit) continue;
  const site = sites.find(s => s.empresaId === company.id && s.id === snapshot?.establecimientoId && snapshot.empresaId === company.id);
  if (!grant.todosEstablecimientos && (!site || !grant.establecimientoIds.includes(site.id))) continue;
  const access: ManifestCompanyAccess = { empresaId: company.id, actividadId: activity.id, rol: activity.rol, razonSocial: company.razonSocial,
   ...(site ? { establecimientoId: site.id, establecimiento: site.nombre } : {}) };
  result.set(grant.usuarioId, [...(result.get(grant.usuarioId) || []), access]);
 }
 return [...result].map(([usuarioId, accesosEmpresa]) => ({ usuarioId, accesosEmpresa }));
}
