import { Prisma } from '@prisma/client';

function currents(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap(row => row && typeof row === 'object' && typeof row.corriente === 'string' ? [row.corriente] : []) : [];
}
/** Internal authority notice only; no email/push dispatcher and no permit mutation. */
export async function noticeNewCurrents(tx: Prisma.TransactionClient, original: unknown, observed: unknown, url: string, reviewId: string) {
  if (process.env.MANIFEST_PARTY_REVIEW_ENABLED !== 'true') return;
  const added = [...new Set(currents(observed).filter(y => !currents(original).includes(y)))];
  if (!added.length) return;
  const designated = (process.env.MANIFEST_EXCEPTIONAL_REVIEWERS || '').split(',').filter(Boolean);
  const recipients = await tx.usuario.findMany({ where: { id: { in: designated }, rol: 'ADMIN', activo: true }, select: { id: true } });
  if (!recipients.length) throw new Error('No hay autoridad designada para comunicar las corrientes nuevas');
  await tx.notificacion.createMany({ data: recipients.map(user => ({
    usuarioId: user.id, tipo: 'INFO_GENERAL', titulo: 'Nueva corriente aprobada post facto',
    mensaje: added.join(', ') + '. Conformidad entre partes; no modifica habilitaciones.',
    prioridad: 'ALTA', datos: JSON.stringify({ tipo: 'ADENDA_POST_FACTO', url, reviewId, corrientes: added }),
  })) });
}
