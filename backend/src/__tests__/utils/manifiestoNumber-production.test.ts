import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { generarNumeroManifiesto } from '../../utils/manifiestoNumber';
import { inTrainingSession } from '../../lib/trainingScope';

// Exercise production code, rather than a second copy of the algorithm.
describe('generarNumeroManifiesto production function', () => {
  afterEach(() => vi.useRealTimers());
  it('allocates visibly marked practice numbers from a separate prefix', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
    const findFirst = vi.fn().mockResolvedValue({ numero: 'CAP-2026-000009' });
    const tx = { manifiesto: { findFirst } } as unknown as Pick<Prisma.TransactionClient, 'manifiesto'>;
    await expect(inTrainingSession(() => generarNumeroManifiesto(tx))).resolves.toBe('CAP-2026-000010');
    expect(findFirst).toHaveBeenCalledWith({
      where: { numero: { startsWith: 'CAP-2026-' } }, orderBy: { numero: 'desc' }, select: { numero: true },
    });
  });
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
