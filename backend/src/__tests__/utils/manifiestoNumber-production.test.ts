import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { generarNumeroManifiesto } from '../../utils/manifiestoNumber';

// Exercise production code, rather than a second copy of the algorithm.
describe('generarNumeroManifiesto production function', () => {
  afterEach(() => vi.useRealTimers());
  it.each([
    [null, '2026-000001'],
    [{ numero: '2026-000042' }, '2026-000043'],
    [{ numero: '2026-123456' }, '2026-123457'],
  ])('allocates from the latest number in the supplied transaction', async (latest, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T12:00:00Z'));
    const findFirst = vi.fn().mockResolvedValue(latest);
    const tx = { manifiesto: { findFirst } } as unknown as Pick<Prisma.TransactionClient, 'manifiesto'>;
    await expect(generarNumeroManifiesto(tx)).resolves.toBe(expected);
    expect(findFirst).toHaveBeenCalledWith({
      where: { numero: { startsWith: '2026-' } }, orderBy: { numero: 'desc' }, select: { numero: true },
    });
  });
});
