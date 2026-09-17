import { describe, expect, it } from 'vitest';
import {
  classifyActorRoleLink,
  differingFields,
  duplicateNormalizedKeys,
  normalizeCertificate,
  normalizeCuit,
  treatmentKey,
  type ActorRoleRecord,
} from '../../utils/officialRosterValidation';

describe('official roster migration validation', () => {
  it('normalizes CUIT and certificate variants to stable business keys', () => {
    expect(normalizeCuit('30-70748677-1')).toBe('30707486771');
    expect(normalizeCertificate('O – 101')).toBe('O-000101');
    expect(normalizeCertificate('t-7')).toBe('T-000007');
  });

  it('detects duplicates after normalization', () => {
    const rows = [{ cuit: '30-70748677-1' }, { cuit: '30707486771' }, { cuit: '30-50111112-7' }];
    expect(duplicateNormalizedKeys(rows, (row) => normalizeCuit(row.cuit))).toEqual(['30707486771']);
  });

  it('compares dates, arrays and floating point values using migration semantics', () => {
    const actual = {
      fecha: '2026-09-15T03:00:00.000Z',
      modalidades: ['IN SITU', 'FIJO'],
      factorR: 1.0000000001,
      observacion: 'dato conservado',
    };
    const expected = {
      fecha: '2026-09-15',
      modalidades: ['FIJO', 'IN SITU'],
      factorR: 1,
      observacion: null,
    };
    expect(differingFields(actual, expected, ['fecha', 'modalidades', 'factorR', 'observacion'])).toEqual([]);
  });

  it('builds a stable treatment composite key', () => {
    expect(treatmentKey('30-70748677-1', ' y8 ', '  Incineración   térmica '))
      .toBe('30707486771|Y8|Incineración térmica');
  });

  it('accepts active and historical multi-role links but rejects an unbacked role', () => {
    const counterparts: ActorRoleRecord[] = [
      { role: 'GENERADOR', cuit: '30-70748677-1', active: true, userId: 'u1' },
      { role: 'OPERADOR', cuit: '30-70748677-1', active: true, userId: 'u1' },
      { role: 'OPERADOR', cuit: '30-71611995-1', active: false, userId: 'u2' },
    ];

    expect(classifyActorRoleLink({
      actorRole: 'GENERADOR', actorCuit: '30-70748677-1', userRole: 'OPERADOR', userId: 'u1', counterparts,
    })).toBe('MULTIROLE_ACTIVE');
    expect(classifyActorRoleLink({
      actorRole: 'GENERADOR', actorCuit: '30-71611995-1', userRole: 'OPERADOR', userId: 'u2', counterparts,
    })).toBe('MULTIROLE_INACTIVE');
    expect(classifyActorRoleLink({
      actorRole: 'GENERADOR', actorCuit: '30-00000000-0', userRole: 'OPERADOR', userId: 'u3', counterparts,
    })).toBe('UNBACKED');
    expect(classifyActorRoleLink({
      actorRole: 'GENERADOR', actorCuit: '30-00000000-0', userRole: 'GENERADOR', userId: 'u3', counterparts,
    })).toBe('MATCHED');
  });
});
