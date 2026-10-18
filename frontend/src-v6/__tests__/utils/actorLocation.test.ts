import { describe, expect, it } from 'vitest';
import { resolveActorLocation, validCoordinates } from '../../utils/actorLocation';

describe('actor map position provenance', () => {
  it('uses registered coordinates before any stale geocoded position', () => {
    expect(resolveActorLocation({ latitud: -32.943, longitud: -68.755 }, [-34.6175, -67.4867])).toMatchObject({
      position: [-32.943, -68.755], source: 'registered', department: 'Maipú',
    });
  });
  it('accepts complete geocoded coordinates but labels their approximation', () => {
    expect(resolveActorLocation({ latitud: null, longitud: null }, [-34.6175, -67.4867])).toMatchObject({
      source: 'geocoded', department: 'San Rafael', label: expect.stringContaining('aproximada'),
    });
  });
  it('keeps address-derived references at the exact reference point, not an invented establishment', () => {
    expect(resolveActorLocation({ domicilio: 'Ruta de prueba, MAIPU' })).toMatchObject({
      position: [-32.943, -68.755], source: 'department-reference', department: 'Maipú',
      label: expect.stringContaining('no es la ubicación del establecimiento'),
    });
  });
  it('does not silently relocate an unknown establishment to Capital', () => {
    expect(resolveActorLocation({ domicilio: 'Dirección no identificada' })).toMatchObject({
      position: null, source: 'unknown', department: null,
    });
  });
  it.each([null, [], [null, null], [NaN, -68], [-32, Infinity], [91, 0], [0, -181], ['-32', '-68'], [-32]])('rejects incomplete or invalid coordinates %j', pair => {
    expect(validCoordinates(pair)).toBe(false);
    expect(resolveActorLocation({}, pair).position).toBeNull();
  });
  it('does not treat valid zero coordinates as absent', () => {
    expect(validCoordinates([0, 0])).toBe(true);
  });
});
