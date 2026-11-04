import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

/** Keep the existing authorized deletion, but never delete the actor first and
 * then discover a support-author FK. The user lock also serializes new reports. */
export async function deleteAccountPreservingSupport(usuarioId: string, removeActors: (db: Prisma.TransactionClient) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM usuarios WHERE id = ${usuarioId} FOR UPDATE`;
      const references = await Promise.all([
        db.ticketSoporte.count({ where: { OR: [{ autorId: usuarioId }, { responsableId: usuarioId }, { registradoPorId: usuarioId }] } }),
        db.mensajeSoporte.count({ where: { autorId: usuarioId } }),
        db.eventoSoporte.count({ where: { usuarioId } }),
      ]);
      if (references.some(count => count > 0)) throw new AppError('No se puede eliminar: la cuenta tiene historial o asignaciones en soporte. Desactivala para conservar su historial.', 400);
      // Preserve the shared identity and its other activities and authority history.
      const account = await db.usuario.findUnique({ where: { id: usuarioId }, select: { generador: { select: { id: true } }, transportista: { select: { id: true } }, operador: { select: { id: true } } } });
      if (account && [account.generador, account.transportista, account.operador].filter(Boolean).length > 1) throw new AppError('La cuenta tiene varias actividades. Desactivá la actividad que corresponda para conservar los otros roles y su historial.', 400);
      const representation = await Promise.all([
        db.solicitudInscripcion.count({ where: { usuarioId } }), db.responsableEmpresa.count({ where: { usuarioId } }),
        db.autorizacionEmpresa.count({ where: { usuarioId } }), db.eventoEmpresa.count({ where: { usuarioId } }),
      ]);
      if (representation.some(count => count > 0)) throw new AppError('La cuenta tiene inscripciones o historial de representación. Desactivá la cuenta o la actividad; no se elimina su trazabilidad.', 400);
      await removeActors(db);
      // A membership is not historical authorship. With no support history it
      // may be removed together with the already-authorized account deletion.
      await db.agenteSoporte.deleteMany({ where: { usuarioId } });
      await db.usuario.delete({ where: { id: usuarioId } });
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2003') throw new AppError('No se puede eliminar: la cuenta tiene referencias pendientes. Desactivala para conservar su historial.', 400);
    throw error;
  }
}
