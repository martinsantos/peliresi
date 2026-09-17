import { describe, expect, it } from 'vitest';
import { distanciaHaversine, distanciaPuntoSegmento } from '../../utils/geo';

describe('geo calculations', () => {
  it('returns zero for the same point', () => {
    expect(distanciaHaversine(-32.89, -68.84, -32.89, -68.84)).toBe(0);
  });

  it('calculates a plausible Mendoza distance', () => {
    const distance = distanciaHaversine(-32.8895, -68.8458, -33.0137, -68.8738);
    expect(distance).toBeGreaterThan(13);
    expect(distance).toBeLessThan(15);
  });

  it('measures distance to the nearest point of a segment', () => {
    const onSegment = distanciaPuntoSegmento(0, 0.5, 0, 0, 0, 1);
    const offSegment = distanciaPuntoSegmento(0.1, 0.5, 0, 0, 0, 1);
    expect(onSegment).toBeCloseTo(0, 6);
    expect(offSegment).toBeGreaterThan(11);
  });
});
