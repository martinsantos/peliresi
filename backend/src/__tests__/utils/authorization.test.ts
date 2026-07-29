import { describe, expect, it } from 'vitest';
import {
  buildActorWhere,
  buildManifestAccessWhere,
  canAccessManifestRecord,
  isUnsafePathSegment,
} from '../../utils/authorization';

const baseUser = {
  id: 'user-1',
  email: 'u@test.com',
  nombre: 'User',
  activo: true,
  esInspector: false,
  restricted: false,
  generador: null,
  transportista: null,
  operador: null,
};

describe('authorization helpers', () => {
  it('rejects unsafe path segments and encoded traversal', () => {
    expect(isUnsafePathSegment('../secret')).toBe(true);
    expect(isUnsafePathSegment('abc%2Fdef')).toBe(true);
    expect(isUnsafePathSegment('abc%252Fdef')).toBe(true);
    expect(isUnsafePathSegment('safe-cuid-123')).toBe(false);
  });

  it('builds deny-by-default manifest scope for users without actor relation', () => {
    expect(buildManifestAccessWhere({ ...baseUser, rol: 'GENERADOR' as const })).toEqual({ id: '__NO_ACCESS__' });
  });

  it('scopes regular users to their actor relation', () => {
    expect(buildManifestAccessWhere({
      ...baseUser,
      rol: 'TRANSPORTISTA' as const,
      transportista: { id: 'trans-1' },
    })).toEqual({ transportistaId: 'trans-1' });
  });

  it('does not grant sub-admin global manifest access without actor relation', () => {
    expect(buildManifestAccessWhere({ ...baseUser, rol: 'ADMIN_OPERADOR' as const })).toEqual({ id: '__NO_ACCESS__' });
  });

  it('allows manifest reads only for related actors or root admin', () => {
    const manifest = { generadorId: 'gen-1', transportistaId: 'trans-1', operadorId: 'op-1' };
    expect(canAccessManifestRecord({ ...baseUser, rol: 'GENERADOR' as const, generador: { id: 'gen-1' } }, manifest, 'read')).toBe(true);
    expect(canAccessManifestRecord({ ...baseUser, rol: 'GENERADOR' as const, generador: { id: 'other' } }, manifest, 'read')).toBe(false);
    expect(canAccessManifestRecord({ ...baseUser, rol: 'ADMIN' as const }, manifest, 'operador')).toBe(true);
  });

  it('scopes actor list access by actor type', () => {
    expect(buildActorWhere({ ...baseUser, rol: 'OPERADOR' as const, operador: { id: 'op-1' } }, 'operador')).toEqual({ id: 'op-1' });
    expect(buildActorWhere({ ...baseUser, rol: 'OPERADOR' as const, operador: { id: 'op-1' } }, 'generador')).toEqual({ id: '__NO_ACCESS__' });
    expect(buildActorWhere({ ...baseUser, rol: 'ADMIN_GENERADOR' as const }, 'generador')).toEqual({});
  });
});
