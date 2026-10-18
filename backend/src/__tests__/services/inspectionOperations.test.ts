import { describe, expect, it } from 'vitest';
import { inspectionCreateSchema, inspectionPeriod, inspectionScopeForUser, inspectionSeries, inspectionYear, inspectionTypeOf } from '../../domain/inspectionOperations';

describe('inspection operations contracts', () => {
  it.each([
    ['GENERADOR', 'GRP'], ['TRANSPORTISTA', 'TRP'], ['OPERADOR', 'ORP'],
    ['PETROLEO', 'PRP'], ['AIRE', 'ARP'], ['ESPONTANEA', 'IRP'],
  ] as const)('accepts %s as an inspection type independent of a registered actor', (tipoInspeccion, series) => {
    expect(inspectionCreateSchema.parse({ tipoInspeccion }).tipoInspeccion).toBe(tipoInspeccion);
    expect(inspectionSeries(null, tipoInspeccion)).toBe(series);
    expect(inspectionTypeOf({ numero: `${series}-2026-00001`, tipoActor: 'GENERADOR' })).toBe(tipoInspeccion);
  });
  it('rejects reserved D, unknown types and a generator inspection linked to a transport company', () => {
    expect(inspectionCreateSchema.safeParse({ tipoInspeccion: 'D' }).success).toBe(false);
    expect(inspectionCreateSchema.safeParse({ tipoInspeccion: 'OTRO' }).success).toBe(false);
    expect(inspectionCreateSchema.safeParse({ tipoInspeccion: 'GENERADOR', tipoActor: 'TRANSPORTISTA', actorId: 't1' }).success).toBe(false);
  });
  it('preserves legacy clients and old legajos without renumbering', () => {
    expect(inspectionSeries('GENERADOR')).toBe('GRP');
    expect(inspectionTypeOf({ numero: 'I-2026-000002', tipoActor: 'TRANSPORTISTA' })).toBe('TRANSPORTISTA');
  });
  it('accepts a spontaneous finding without fabricating an actor', () => {
    expect(inspectionCreateSchema.parse({ observaciones: 'Derrame en vía pública', latitud: -32, longitud: -68 }).actorId).toBeUndefined();
    expect(inspectionSeries(null)).toBe('IRP');
  });
  it('rejects half links and half coordinates', () => {
    expect(inspectionCreateSchema.safeParse({ tipoActor: 'GENERADOR' }).success).toBe(false);
    expect(inspectionCreateSchema.safeParse({ actorId: 'g1' }).success).toBe(false);
    expect(inspectionCreateSchema.safeParse({ latitud: -32 }).success).toBe(false);
  });
  it('uses the Mendoza year across UTC midnight', () => {
    expect(inspectionYear(new Date('2027-01-01T01:00:00Z'))).toBe(2026);
    expect(inspectionYear(new Date('2027-01-01T03:00:00Z'))).toBe(2027);
  });
  it('uses whole local days and validates calendar dates', () => {
    expect(inspectionPeriod('2026-09-24', '2026-09-24')).toEqual({ gte: new Date('2026-09-24T03:00:00Z'), lte: new Date('2026-09-25T02:59:59.999Z') });
    expect(() => inspectionPeriod('2026-02-30')).toThrow();
    expect(() => inspectionPeriod('2026-09-25', '2026-09-24')).toThrow();
  });
  it('limits ordinary inspectors to assignment and fails closed for non-staff', () => {
    expect(inspectionScopeForUser({ id: 'i1', esInspector: true })).toEqual({ inspectorId: 'i1' });
    expect(inspectionScopeForUser({ id: 'x' })).toEqual({ id: { in: [] } });
    expect(inspectionScopeForUser({ id: 'a', rol: 'ADMIN_OPERADOR' })).toEqual({ tipoActor: 'OPERADOR' });
  });
});
