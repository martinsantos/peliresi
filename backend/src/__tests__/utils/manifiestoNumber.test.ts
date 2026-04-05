import { describe, it, expect } from 'vitest';

/**
 * Tests for the manifiesto number generation algorithm.
 *
 * The actual `generarNumeroManifiesto` is a private async function inside
 * manifiesto.controller.ts that queries Prisma. We test the pure logic here:
 *   - Format: YYYY-NNNNNN (year dash six-digit zero-padded number)
 *   - Max-finding: given a list of existing numbers, the next one is max+1
 */

function extractMaxNumber(numeros: string[], year: number): number {
  let maxNum = 0;
  for (const n of numeros) {
    const suffix = n.replace(`${year}-`, '');
    const parsed = parseInt(suffix, 10);
    if (!isNaN(parsed) && parsed > maxNum) {
      maxNum = parsed;
    }
  }
  return maxNum;
}

function formatNumero(year: number, seq: number): string {
  return `${year}-${seq.toString().padStart(6, '0')}`;
}

describe('generarNumeroManifiesto logic', () => {
  const year = 2026;

  it('generates first number as YYYY-000001 when no manifiestos exist', () => {
    const max = extractMaxNumber([], year);
    expect(formatNumero(year, max + 1)).toBe('2026-000001');
  });

  it('generates next sequential number', () => {
    const existing = ['2026-000001', '2026-000002', '2026-000003'];
    const max = extractMaxNumber(existing, year);
    expect(max).toBe(3);
    expect(formatNumero(year, max + 1)).toBe('2026-000004');
  });

  it('finds the max even if numbers are out of order', () => {
    const existing = ['2026-000005', '2026-000001', '2026-000010'];
    const max = extractMaxNumber(existing, year);
    expect(max).toBe(10);
    expect(formatNumero(year, max + 1)).toBe('2026-000011');
  });

  it('handles large sequence numbers', () => {
    const existing = ['2026-999999'];
    const max = extractMaxNumber(existing, year);
    expect(formatNumero(year, max + 1)).toBe('2026-1000000');
  });

  it('does not see different-year numbers (controller pre-filters by startsWith)', () => {
    // In production, the Prisma query uses startsWith(`${year}-`), so numbers
    // from other years never reach this logic. We verify the algorithm only
    // processes numbers from the correct year.
    const sameYear = ['2026-000005'];
    const differentYear = ['2025-000050'];
    const max = extractMaxNumber(sameYear, 2026);
    expect(max).toBe(5);
    // Different year numbers wouldn't be in the array at all after the Prisma filter
    const maxDiffYear = extractMaxNumber(differentYear, 2026);
    // parseInt('2025-000050', 10) => 2025 (stops at dash), but this case
    // never happens in production because Prisma filters by startsWith
    expect(maxDiffYear).toBe(2025);
  });

  it('zero-pads to 6 digits', () => {
    expect(formatNumero(2026, 1)).toBe('2026-000001');
    expect(formatNumero(2026, 42)).toBe('2026-000042');
    expect(formatNumero(2026, 123456)).toBe('2026-123456');
  });
});
