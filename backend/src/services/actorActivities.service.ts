import prisma from '../lib/prisma';
import { approvedActivities } from '../domain/actorActivities';
export async function accountActivities(account: Parameters<typeof approvedActivities>[0] & { id: string }) {
  if (process.env.ACTOR_MULTIROLE_ENABLED !== 'true') return [];
  const approvals = await prisma.solicitudInscripcion.findMany({
    where: { usuarioId: account.id, estado: 'APROBADA' },
    select: { tipoActor: true, generadorId: true, transportistaId: true, operadorId: true },
  });
  return approvedActivities(account, approvals);
}
