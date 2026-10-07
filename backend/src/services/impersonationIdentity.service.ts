import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

/** Call only with claims already verified by jwt.verify. This identifies the
 * human operator; it NEVER grants that operator's permissions to the subject. */
export async function verifiedImpersonator(claim: unknown, subjectId: string, restricted = false) {
  if (claim === undefined) return undefined;
  if (restricted || typeof claim !== 'string' || !claim || claim === subjectId) throw new AppError('Sesión de impersonación inválida', 401);
  const administrator = await prisma.usuario.findUnique({ where: { id: claim }, select: { id: true, nombre: true, rol: true, activo: true } });
  if (!administrator?.activo || administrator.rol !== 'ADMIN') throw new AppError('La sesión administradora ya no está habilitada', 401);
  return { id: administrator.id, nombre: administrator.nombre };
}
