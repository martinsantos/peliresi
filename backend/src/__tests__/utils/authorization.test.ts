import { describe, expect, it } from 'vitest';
import {
  buildActorWhere,
  buildManifestAccessWhere,
  canAccessActor,
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

  it('grants each sector admin manifest scope without requiring a synthetic actor relation', () => {
    expect(buildManifestAccessWhere({ ...baseUser, rol: 'ADMIN_GENERADOR' as const })).toEqual({ generadorId: { not: '' } });
    expect(buildManifestAccessWhere({ ...baseUser, rol: 'ADMIN_TRANSPORTISTA' as const })).toEqual({ transportistaId: { not: '' } });
    expect(buildManifestAccessWhere({ ...baseUser, rol: 'ADMIN_OPERADOR' as const })).toEqual({ operadorId: { not: '' } });
  });

  it('allows manifest reads only for related actors or root admin', () => {
    const manifest = { generadorId: 'gen-1', transportistaId: 'trans-1', operadorId: 'op-1' };
    expect(canAccessManifestRecord({ ...baseUser, rol: 'GENERADOR' as const, generador: { id: 'gen-1' } }, manifest, 'read')).toBe(true);
    expect(canAccessManifestRecord({ ...baseUser, rol: 'GENERADOR' as const, generador: { id: 'other' } }, manifest, 'read')).toBe(false);
    expect(canAccessManifestRecord({ ...baseUser, rol: 'ADMIN_GENERADOR' as const }, manifest, 'generador')).toBe(true);
    expect(canAccessManifestRecord({ ...baseUser, rol: 'ADMIN_OPERADOR' as const }, manifest, 'operador')).toBe(true);
    expect(canAccessManifestRecord({ ...baseUser, rol: 'ADMIN' as const }, manifest, 'operador')).toBe(true);
  });

  it('scopes actor list access by actor type', () => {
    expect(buildActorWhere({ ...baseUser, rol: 'OPERADOR' as const, operador: { id: 'op-1' } }, 'operador')).toEqual({ id: 'op-1' });
    expect(buildActorWhere({ ...baseUser, rol: 'OPERADOR' as const, operador: { id: 'op-1' } }, 'generador')).toEqual({ id: '__NO_ACCESS__' });
    expect(buildActorWhere({ ...baseUser, rol: 'ADMIN_GENERADOR' as const }, 'generador')).toEqual({});
  });

  it('grants AUDITOR global reads but never actor or workflow writes', () => {
    const auditor = { ...baseUser, rol: 'AUDITOR' as const };
    const manifest = { generadorId: 'gen-1', transportistaId: 'trans-1', operadorId: 'op-1' };

    expect(buildManifestAccessWhere(auditor)).toEqual({});
    expect(buildActorWhere(auditor, 'generador')).toEqual({});
    expect(canAccessManifestRecord(auditor, manifest, 'read')).toBe(true);
    expect(canAccessManifestRecord(auditor, manifest, 'generador')).toBe(false);
    expect(canAccessManifestRecord(auditor, manifest, 'transportista')).toBe(false);
    expect(canAccessManifestRecord(auditor, manifest, 'operador')).toBe(false);
    expect(canAccessActor(auditor, 'operador', 'op-1', 'read')).toBe(true);
    expect(canAccessActor(auditor, 'operador', 'op-1', 'write')).toBe(false);
  });
});
