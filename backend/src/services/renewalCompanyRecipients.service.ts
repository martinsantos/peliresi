import type { Prisma, Renovacion } from '@prisma/client';
import { empresaEnabled } from '../domain/empresa';
import { isTrainingSession } from '../lib/trainingScope';

type RenewalActor = Pick<Renovacion, 'tipoActor' | 'generadorId' | 'operadorId'>;

/** Activity-level decisions are visible to people who can currently operate
 * that activity in at least one active site. Responsibility alone grants no access.
 * Reused at creation and before optional mail delivery to honor revocations. */
export async function renewalCompanyRecipients(db: Prisma.TransactionClient, renewal: RenewalActor): Promise<string[]> {
  if (!empresaEnabled() || isTrainingSession()) return [];
  const actorId = renewal.tipoActor === 'GENERADOR' ? renewal.generadorId : renewal.operadorId;
  if (!actorId || !['GENERADOR', 'OPERADOR'].includes(renewal.tipoActor)) return [];
  const activity = await db.empresaActividad.findFirst({ where: { rol: renewal.tipoActor, actorId, activa: true } });
  if (!activity) return [];
  const [company, actor, grants, sites] = await Promise.all([
    db.empresa.findFirst({ where: { id: activity.empresaId, activa: true } }),
    renewal.tipoActor === 'GENERADOR'
      ? db.generador.findUnique({ where: { id: actorId }, select: { activo: true, cuit: true } })
      : db.operador.findUnique({ where: { id: actorId }, select: { activo: true, cuit: true } }),
    db.autorizacionEmpresa.findMany({ where: { empresaId: activity.empresaId, actividadId: activity.id, activa: true } }),
    db.establecimientoEmpresa.findMany({ where: { empresaId: activity.empresaId, activo: true }, select: { id: true } }),
  ]);
  if (!company || !actor?.activo || actor.cuit.replace(/\D/g, '') !== company.cuit || !sites.length) return [];
  const ids = [...new Set(grants.filter(g => g.todosEstablecimientos || sites.some(s => g.establecimientoIds.includes(s.id))).map(g => g.usuarioId))];
  if (!ids.length) return [];
  const users = await db.usuario.findMany({ where: { id: { in: ids }, activo: true, emailVerified: true, rol: { in: ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] } }, select: { id: true } });
  return users.map(user => user.id);
}
