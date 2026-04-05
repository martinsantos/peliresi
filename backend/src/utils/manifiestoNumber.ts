import prisma from '../lib/prisma';

/**
 * Generate a unique manifiesto number in format YYYY-NNNNNN.
 *
 * Uses findFirst + ORDER BY DESC instead of loading all manifiestos of the year.
 * O(1) vs O(n) — critical as the table grows.
 */
export async function generarNumeroManifiesto(): Promise<string> {
  const año = new Date().getFullYear();
  const latest = await prisma.manifiesto.findFirst({
    where: { numero: { startsWith: `${año}-` } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  });
  const maxNum = latest
    ? parseInt(latest.numero.replace(`${año}-`, ''), 10) || 0
    : 0;
  return `${año}-${(maxNum + 1).toString().padStart(6, '0')}`;
}
