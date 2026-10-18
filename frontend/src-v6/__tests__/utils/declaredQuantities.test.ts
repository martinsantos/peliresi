import { describe, expect, it } from 'vitest';
import { declaredQuantities, formatDeclaredQuantity } from '../../utils/declaredQuantities';

describe('declared quantities', () => {
  it('never adds litres, kilograms and counts into an invented weight', () => {
    expect(declaredQuantities([{ cantidad: 10, unidad: 'kg' }, { cantidad: 20, unidad: 'l' }, { cantidad: 2, unidad: 'kg' }, { cantidad: 3, unidad: 'unidades' }])).toEqual([
      { unidad: 'kg', cantidad: 12 }, { unidad: 'l', cantidad: 20 }, { unidad: 'unidades', cantidad: 3 },
    ]);
  });
  it('normalizes case and spaces but does not infer conversion factors', () => {
    expect(declaredQuantities([{ cantidad: 1, unidad: ' KG ' }, { cantidad: 2, unidad: 'kg' }, { cantidad: 1, unidad: 'tn' }])).toEqual([
      { unidad: 'kg', cantidad: 3 }, { unidad: 'tn', cantidad: 1 },
    ]);
  });
  it('marks incomplete quantities instead of silently fabricating a total', () => {
    expect(declaredQuantities([{ cantidad: 10, unidad: 'kg' }, { cantidad: NaN, unidad: 'kg' }])).toEqual([{ unidad: 'kg', cantidad: null }]);
    expect(declaredQuantities([{ cantidad: 5 }])).toEqual([{ unidad: 'sin unidad informada', cantidad: 5 }]);
  });
  it('keeps small quantities and meaningful fractions visible', () => {
    expect(formatDeclaredQuantity(1.5)).toBe('1,5');
    expect(formatDeclaredQuantity(0.0000001)).toBe('0,0000001');
    expect(formatDeclaredQuantity(null)).toBe('Sin dato completo');
  });
});
