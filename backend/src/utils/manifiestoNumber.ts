import type { Prisma } from '@prisma/client';
import { isTrainingSession } from '../lib/trainingScope';
import { syntheticPreviewEnabled } from '../config/syntheticPreview';

/**
 * Generate a unique manifiesto number in format YYYY-NNNNNN.
 *
 * Call within the creation transaction after acquiring its advisory lock.
 * Keep the lock held until the corresponding manifest is inserted.
 */
export async function generarNumeroManifiesto(tx: Pick<Prisma.TransactionClient, 'manifiesto'>): Promise<string> {
  const año = new Date().getFullYear();
  const prefix = `${isTrainingSession() ? 'CAP-' : syntheticPreviewEnabled() ? 'PRUEBA-' : ''}${año}-`;
  const latest = await tx.manifiesto.findFirst({
    where: { numero: { startsWith: prefix } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  });
  const maxNum = latest
    ? parseInt(latest.numero.replace(prefix, ''), 10) || 0
    : 0;
  return `${prefix}${(maxNum + 1).toString().padStart(6, '0')}`;
}
