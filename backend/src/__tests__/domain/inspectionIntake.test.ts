import { describe, expect, it } from 'vitest';
import { isInspectionAdministrator, isInspectionGeneralManager } from '../../domain/inspectionOperations';
import { findingAtDestination, intakeDecisionSchema, intakeScope, wasteDifferences } from '../../domain/inspectionIntake';
const waste = (corriente: string, cantidad: number, unidad = 'kg') => ({ corriente, cantidad, unidad });
describe('operator finding within the addendum', () => {
  it('detects quantity differences and omitted streams independently, including repeated rows', () => {
    expect(wasteDifferences([waste('Y1', 10), waste('Y1', 5)], [waste('Y1', 20), waste('Y21', 3)])).toEqual([
      { corriente: 'Y1', unidad: 'kg', declarado: 15, observado: 20, tipo: 'CANTIDAD_DIFERENTE' },
      { corriente: 'Y21', unidad: 'kg', declarado: null, observado: 3, tipo: 'Y_OMITIDA' },
    ]);
  });
  it('preserves units and distinguishes not observed from a measured zero', () => {
    expect(wasteDifferences([waste('Y1', 10), waste('Y2', 9)], [waste('Y1', 1, 't')]).map(row => row.tipo)).toEqual(['UNIDAD_DIFERENTE', 'NO_OBSERVADA']);
    expect(wasteDifferences([waste('Y1', 0.1), waste('Y1', 0.2)], [waste('Y1', 0.3)])).toEqual([]);
    expect(wasteDifferences([waste('Y1', 1e12)], [waste('Y1', 1e12 - 1)])[0].tipo).toBe('CANTIDAD_DIFERENTE');
  });
  it.each([['lt', 'l'], ['tn', 't']])('recognizes %s and %s as spellings of the same unit without changing evidence', (original, observed) => {
    const declared = [waste('Y1', 12.5, original)], actual = [waste('Y1', 12.5, observed)];
    expect(wasteDifferences(declared, actual)).toEqual([]);
    expect(declared[0].unidad).toBe(original); expect(actual[0].unidad).toBe(observed);
    expect(wasteDifferences(declared, [waste('Y1', 13, observed)])).toEqual([
      { corriente: 'Y1', unidad: observed, declarado: 12.5, observado: 13, tipo: 'CANTIDAD_DIFERENTE' },
    ]);
  });
  it('does not attribute a driver observation or pre-arrival declaration to a destination operator', () => {
    expect(findingAtDestination('OPERADOR', 'RECIBIDO')).toBe(true);
    expect(findingAtDestination('OPERADOR', 'TRATADO')).toBe(true);
    expect(findingAtDestination('OPERADOR', 'EN_TRANSITO')).toBe(false);
    expect(findingAtDestination('TRANSPORTISTA', 'RECIBIDO')).toBe(false);
  });
});
describe('inspection intake remains a scoped evaluation, not an automatic sanction', () => {
  it('limits sector staff and inspectors to their existing responsibility', () => {
    expect(intakeScope({ rol: 'ADMIN' })).toEqual({});
    expect(intakeScope({ rol: 'ADMIN_OPERADOR' })).toEqual({ tipoActor: 'OPERADOR' });
    expect(intakeScope({ id: 'i', rol: 'GENERADOR', esInspector: true })).toEqual({ inspeccion: { inspectorId: 'i' } });
    expect(intakeScope({ rol: 'OPERADOR' })).toEqual({ id: { in: [] } });
  });
  it('requires a reason, current version and an explicit inspection to link', () => {
    const command = { id: '00000000-0000-4000-8000-000000000001', version: 0, accion: 'DESCARTADA', motivo: 'Pesaje documentado' };
    expect(intakeDecisionSchema.safeParse(command).success).toBe(true);
    for (const extra of [{ motivo: '' }, { version: -1 }, { accion: 'VINCULADA' }, { inspeccionId: 'fake' }, { evidencia: {} }]) expect(intakeDecisionSchema.safeParse({ ...command, ...extra }).success).toBe(false);
  });
});

describe('explicit inspection management capability', () => {
  it.each(['GENERADOR', 'OPERADOR', 'TRANSPORTISTA', 'ADMIN_OPERADOR'])('chief with base role %s sees all intakes and can organize externals', rol => {
    const chief = { id: 'chief', rol, esJefeInspecciones: true };
    expect(intakeScope(chief)).toEqual({});
    expect(isInspectionAdministrator(chief)).toBe(true);
    expect(isInspectionGeneralManager(chief)).toBe(true);
  });
  it('does not grant general authority to sector admins or ordinary inspectors', () => {
    expect(isInspectionGeneralManager({ rol: 'ADMIN_GENERADOR' })).toBe(false);
    expect(isInspectionAdministrator({ rol: 'GENERADOR' })).toBe(false);
    expect(intakeScope({ id: 'chief', rol: 'GENERADOR', esJefeInspecciones: false })).toEqual({ id: { in: [] } });
    expect(intakeScope({ rol: 'ADMIN_OPERADOR', esJefeInspecciones: false })).toEqual({ tipoActor: 'OPERADOR' });
  });
});
