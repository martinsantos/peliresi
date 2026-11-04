import { describe, expect, it } from 'vitest';
import { detectGpsReceptionObservations, type ReceivedGpsPoint } from '../../services/gpsReceptionObservations.service';

const t0 = Date.parse('2026-01-01T00:00:00Z');
const point = (id: string, seconds: number, latitud: number, tramoId: string | null, order?: number,
  emisor?: string | null): ReceivedGpsPoint => ({ id, latitud, longitud: -69, timestamp: new Date(t0 + seconds * 1000),
  tramoId, emisor, tramo: order === undefined ? null : { orden: order } });

describe('received GPS observations per transport segment', () => {
  it('does not infer speed or a stop from two different segments', () => {
    expect(detectGpsReceptionObservations([point('original', 0, -33, null), point('relay', 1, -33.5, 'leg-1', 1)])).toEqual([]);
    expect(detectGpsReceptionObservations([point('original', 0, -33, null), point('relay', 3 * 3600, -33, 'leg-1', 1)])).toEqual([]);
  });

  it('uses the previous receipt of the same leg even when other legs interleave', () => {
    const points = [point('original', 0, -33, null), point('a1', 1, -33, 'leg-1', 1),
      point('b1', 2, -33, 'leg-2', 2), point('a2', 3, -33.5, 'leg-1', 1), point('b2', 4, -33, 'leg-2', 2)];
    const result = detectGpsReceptionObservations(points, { userId: 'admin' });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ previousId: 'a1', currentId: 'a2', authorId: 'admin',
      anomaly: { tipo: 'VELOCIDAD_ANORMAL', severidad: 'ALTA' } });
    expect(result[0].anomaly.descripcion).toMatch(/tramo de relevo 1/i);
    expect(result[0].anomaly.descripcion).toMatch(/hora de captura no disponible/i);
  });

  it('still reports a possible stop and a reception gap within one segment', () => {
    const stop = detectGpsReceptionObservations([point('a', 0, -33, 'leg-1', 1), point('b', 3 * 3600, -33, 'leg-1', 1)]);
    const gap = detectGpsReceptionObservations([point('c', 0, -33, 'leg-2', 2), point('d', 31 * 60, -33.2, 'leg-2', 2)]);
    expect(stop.map(x => x.anomaly.tipo)).toContain('PARADA_PROLONGADA');
    expect(gap.map(x => x.anomaly.tipo)).toContain('GPS_PERDIDO');
    for (const observation of [...stop, ...gap]) {
      expect(observation.anomaly.descripcion).toMatch(/no confirma/i);
      expect(observation.anomaly.descripcion).toMatch(/hora de captura no disponible/i);
    }
  });

  it('never assigns an automatic relay observation to a user', () => {
    const points = [point('a', 0, -33, 'leg-1', 1), point('b', 1, -33.1, 'leg-1', 1)];
    expect(detectGpsReceptionObservations(points, { automatic: true, userId: 'original-carrier' })[0].authorId).toBeUndefined();
    expect(detectGpsReceptionObservations(points, { userId: 'admin' })[0].authorId).toBe('admin');
  });

  it.each([
    ['same sender', 'usuario:carrier', 'usuario:carrier', 'carrier'],
    ['different senders', 'usuario:other', 'usuario:carrier', undefined],
    ['old receipts with no sender', null, null, undefined],
  ])('attributes an original automatic observation only to a confirmed sender: %s', (_label, first, second, expected) => {
    const points = [point('a', 0, -33, null, undefined, first), point('b', 1, -33.1, null, undefined, second)];
    const observation = detectGpsReceptionObservations(points, { automatic: true, userId: 'carrier' })[0];
    expect(observation.authorId).toBe(expected);
    expect(observation.anomaly.descripcion).toMatch(/sin tramo identificado/i);
  });
});
