import { describe, expect, it } from 'vitest';
import { sameGpsNumber, sameOptionalGpsNumber } from '../../domain/gpsNumericEquality';

function nextValues(value: number, count: bigint): number {
  const data = new DataView(new ArrayBuffer(8));
  data.setFloat64(0, value, false);
  const bits = data.getBigUint64(0, false);
  data.setBigUint64(0, value < 0 ? bits - count : bits + count, false);
  return data.getFloat64(0, false);
}

describe('GPS numeric round-trip comparison', () => {
  it('accepts a database round trip and at most sixteen adjacent numbers', () => {
    const sent = -12.357009851458013;
    expect(sameGpsNumber(-12.35700985145801, sent)).toBe(true);
    for (const value of [-179.9, -32.91, -1e-200, 1e-200, 12.3, 179.9]) {
      expect(sameGpsNumber(nextValues(value, 16n), value)).toBe(true);
      expect(sameGpsNumber(nextValues(value, 17n), value)).toBe(false);
    }
  });

  it('rejects different points, invalid values and absent required fields', () => {
    expect(sameGpsNumber(-32.91, -32.909999)).toBe(false);
    expect(sameGpsNumber(undefined, undefined)).toBe(false);
    expect(sameGpsNumber(NaN, NaN)).toBe(false);
    expect(sameGpsNumber(Infinity, Infinity)).toBe(false);
    expect(sameGpsNumber('12', 12)).toBe(false);
  });

  it('distinguishes optional missing values from measured zero', () => {
    expect(sameOptionalGpsNumber(null, undefined)).toBe(true);
    expect(sameOptionalGpsNumber(null, 0)).toBe(false);
    expect(sameOptionalGpsNumber(-0, 0)).toBe(true);
    expect(sameOptionalGpsNumber(Number.MIN_VALUE, 0)).toBe(true);
  });
});
