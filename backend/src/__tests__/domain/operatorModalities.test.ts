import { describe, expect, it } from 'vitest';
import { approvedOperatorModeChange, operatorModalitiesForType } from '../../domain/operatorModalities';

describe('operator form selections do not invent permissions', () => {
  it.each(['FIJO', 'IN_SITU'] as const)('maps the exact %s form selection to its runtime mode', type => {
    expect(operatorModalitiesForType(type)).toEqual([type]);
  });
  it('does not infer a new mode from legacy or arbitrary text', () => {
    for (const value of ['TRATAMIENTO', 'DISPOSICION_FINAL', 'ALMACENAMIENTO', '', undefined]) expect(operatorModalitiesForType(value)).toBeUndefined();
  });
  it('preserves existing modes on an unrelated or unchanged revision', () => {
    expect(approvedOperatorModeChange({ tipoOperador: 'FIJO' }, undefined, true)).toEqual({});
    expect(approvedOperatorModeChange({ tipoOperador: 'FIJO' }, 'FIJO', true)).toEqual({});
  });
  it('applies an administrator-approved exact change, but denies a self-granted change', () => {
    expect(approvedOperatorModeChange({ tipoOperador: 'FIJO' }, 'IN_SITU', true)).toEqual({ modalidades: ['IN_SITU'] });
    expect(() => approvedOperatorModeChange({ tipoOperador: 'FIJO' }, 'IN_SITU', false)).toThrow('revisión administrativa');
  });
});
