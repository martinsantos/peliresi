import { describe, expect, it } from 'vitest';
import { actorNumber, actorCoordinates } from '../../domain/actorNumbers';
describe('explicit optional actor numbers', () => {
  it('keeps zero, null and omitted distinct', () => {
    expect(actorNumber(0, 'QA')).toBe(0); expect(actorNumber('0', 'QA')).toBe(0);
    expect(actorNumber(null, 'QA')).toBeNull(); expect(actorNumber(undefined, 'QA')).toBeUndefined();
  });
  it('accepts actual decimal precision and numeric scientific notation', () => {
    expect(actorNumber('-32.123456', 'QA')).toBe(-32.123456); expect(actorNumber('1e-7', 'QA')).toBe(1e-7);
  });
  it('does not coerce boolean, container, whitespace or invalid text to numbers', () => {
    for (const value of [false, [], {}, ' ', 'NaN', 'Infinity', '0x10', NaN, Infinity]) expect(() => actorNumber(value, 'QA')).toThrow();
  });
  it('validates geographic bounds without a fabricated fallback', () => {
    expect(actorCoordinates(0, 0)).toEqual({ latitud: 0, longitud: 0 }); expect(actorCoordinates(-90, 180)).toEqual({ latitud: -90, longitud: 180 });
    expect(() => actorCoordinates(-91, 0)).toThrow(); expect(() => actorCoordinates(0, 181)).toThrow();
  });
  it('preserves explicit unknown coordinates and leaves omitted coordinates untouched', () => {
    expect(actorCoordinates(null, null)).toEqual({ latitud: null, longitud: null }); expect(actorCoordinates(undefined, undefined)).toEqual({});
  });
});
