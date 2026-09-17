import { describe, expect, it } from 'vitest';
import {
  finiteNonNegative,
  finitePositive,
  normalizeUnit,
  summarizeQuantities,
  summaryByUnit,
  toMassKg,
} from '../../utils/quantities';

describe('quantity utilities', () => {
  it('normalizes supported aliases and casing', () => {
    expect(normalizeUnit(' KG ')).toBe('kg');
    expect(normalizeUnit('toneladas')).toBe('tn');
    expect(normalizeUnit('Litros')).toBe('lt');
    expect(normalizeUnit('unidades')).toBe('un');
    expect(normalizeUnit('m3')).toBeNull();
  });

  it('accepts only finite numeric values in the requested range', () => {
    expect(finiteNonNegative('0')).toBe(0);
    expect(finitePositive('0')).toBeNull();
    expect(finitePositive('2.5')).toBe(2.5);
    expect(finiteNonNegative(-1)).toBeNull();
    expect(finiteNonNegative(Number.NaN)).toBeNull();
  });

  it('converts compatible mass units to kilograms', () => {
    expect(toMassKg(500, 'kg')).toBe(500);
    expect(toMassKg(1.5, 'tn')).toBe(1500);
    expect(toMassKg(2, 'lt')).toBeNull();
  });

  it('keeps incompatible dimensions separated', () => {
    const summary = summarizeQuantities([
      { cantidad: 500, unidad: 'KG' },
      { cantidad: 1.5, unidad: 'tn' },
      { cantidad: 20, unidad: 'lt' },
      { cantidad: 3, unidad: 'un' },
      { cantidad: 4, unidad: 'm3' },
    ]);

    expect(summary).toEqual({
      massKg: 2000,
      volumeLiters: 20,
      units: 3,
      unknown: { m3: 4 },
    });
    expect(summaryByUnit(summary)).toEqual({ kg: 2000, lt: 20, un: 3, m3: 4 });
  });
});
