import { describe, expect, it } from 'vitest';
import { documentaryResolution } from '../../domain/manifiestoAdendaDocument';

const row = (id: string, decision?: string, rectificaId: string | null = null) => ({
  id, rectificaId, revisiones: decision ? [{ decision }] : [],
});

describe('documentary resolution of an observed and rectified addendum', () => {
  it('keeps the observation and its correction unresolved until the correction is approved', () => {
    const result = documentaryResolution([row('original', 'OBSERVADA'), row('correction', undefined, 'original')]);
    expect(result.counts).toEqual({ total: 2, pendientes: 1, observadas: 1, rechazadas: 0 });
    expect(result.resolvedObservations.size).toBe(0);
  });

  it('retains the observed original but stops counting it when an approved correction resolves it', () => {
    const records = [row('original', 'OBSERVADA'), row('correction', 'APROBADA', 'original')];
    const before = JSON.stringify(records);
    const result = documentaryResolution(records);
    expect(result.counts).toEqual({ total: 2, pendientes: 0, observadas: 0, rechazadas: 0 });
    expect(result.resolvedObservations.has('original')).toBe(true);
    expect(JSON.stringify(records)).toBe(before);
  });

  it('resolves a chain of observed corrections only when a later correction is approved', () => {
    const result = documentaryResolution([row('a', 'OBSERVADA'), row('b', 'OBSERVADA', 'a'), row('c', 'APROBADA', 'b')]);
    expect(result.counts.observadas).toBe(0);
    expect([...result.resolvedObservations].sort()).toEqual(['a', 'b']);
  });

  it('continues blocking for other independent or branched unresolved addenda', () => {
    const result = documentaryResolution([
      row('a', 'OBSERVADA'), row('b', 'APROBADA', 'a'), row('c', undefined, 'a'),
      row('other', 'OBSERVADA'), row('rejected', 'RECHAZADA'),
    ]);
    expect(result.counts).toEqual({ total: 5, pendientes: 1, observadas: 1, rechazadas: 1 });
    expect([...result.resolvedObservations]).toEqual(['a']);
  });

  it.each(['PENDIENTE', 'RECHAZADA'])('does not silently resolve an original in %s', decision => {
    const result = documentaryResolution([row('a', decision === 'PENDIENTE' ? undefined : decision), row('b', 'APROBADA', 'a')]);
    expect(result.resolvedObservations.size).toBe(0);
    expect(result.counts.pendientes + result.counts.rechazadas).toBe(1);
  });

  it('reinstates the observation if the correction is no longer approved', () => {
    const result = documentaryResolution([
      row('a', 'OBSERVADA'),
      { ...row('b', undefined, 'a'), revisiones: [{ decision: 'APROBADA' }, { decision: 'OBSERVADA' }] },
    ]);
    expect(result.counts.observadas).toBe(2);
    expect(result.resolvedObservations.size).toBe(0);
  });

  it.each([
    [row('a', 'OBSERVADA', 'b'), row('b', 'APROBADA', 'a')],
    [row('a', 'OBSERVADA', 'missing'), row('b', 'APROBADA', 'a')],
  ])('fails closed for an invalid lineage', (...records) => {
    const result = documentaryResolution(records);
    expect(result.counts.observadas).toBe(1);
    expect(result.resolvedObservations.size).toBe(0);
  });

  it('does not accept an approved correction whose original is missing', () => {
    const result = documentaryResolution([row('orphan', 'APROBADA', 'missing')]);
    expect(result.counts).toEqual({ total: 1, pendientes: 1, observadas: 0, rechazadas: 0 });
  });

  it('handles a deep history without recursion or quadratic traversal', () => {
    const records = Array.from({ length: 5000 }, (_, i) =>
      row(String(i), i === 4999 ? 'APROBADA' : 'OBSERVADA', i ? String(i - 1) : null));
    const result = documentaryResolution(records);
    expect(result.counts.observadas).toBe(0);
    expect(result.resolvedObservations.size).toBe(4999);
  });
});
