import { beforeEach, describe, expect, it } from 'vitest';
import type { Usuario } from '../../types/models';
import {
  activeTripStorageKey,
  actorIdForEffectiveRole,
  clearUserScopedStorage,
  gpsPendingStorageKey,
  pendingQrStorageKey,
  recentSearchesStorageKey,
  tripSnapshotStorageKey,
  tripStatusStorageKey,
} from '../../utils/userContext';

function multiRoleUser(rol: Usuario['rol']): Usuario {
  return {
    id: 'user-1', email: 'multi@sitrep.local', rol, cuit: '30-00000000-0', nombre: 'Multi', apellido: null,
    empresa: null, telefono: null, activo: true, dosFaVerificado: false, createdAt: '', updatedAt: '',
    generador: { id: 'generator-1', razonSocial: 'Empresa G' } as Usuario['generador'],
    transportista: { id: 'transporter-1', razonSocial: 'Empresa T' } as Usuario['transportista'],
    operador: { id: 'operator-1', razonSocial: 'Empresa O' } as Usuario['operador'],
  };
}

describe('user context isolation', () => {
  beforeEach(() => localStorage.clear());

  it.each([
    ['GENERADOR', 'generator-1'],
    ['TRANSPORTISTA', 'transporter-1'],
    ['OPERADOR', 'operator-1'],
  ] as const)('resolves the %s actor from the effective role in a multi-role account', (role, expectedActorId) => {
    expect(actorIdForEffectiveRole(multiRoleUser(role))).toBe(expectedActorId);
  });

  it('namespaces operational context for each authenticated principal', () => {
    expect(activeTripStorageKey('user-a')).not.toBe(activeTripStorageKey('user-b'));
    expect(tripSnapshotStorageKey('user-a', 'manifest-1')).not.toBe(tripSnapshotStorageKey('user-b', 'manifest-1'));
    expect(tripStatusStorageKey('user-a', 'manifest-1')).not.toBe(tripStatusStorageKey('user-b', 'manifest-1'));
    expect(gpsPendingStorageKey('user-a', 'manifest-1')).not.toBe(gpsPendingStorageKey('user-b', 'manifest-1'));
    expect(recentSearchesStorageKey('user-a')).not.toBe(recentSearchesStorageKey('user-b'));
    expect(pendingQrStorageKey('user-a')).not.toBe(pendingQrStorageKey('user-b'));
  });

  it('clears only the selected principal context', () => {
    localStorage.setItem(activeTripStorageKey('user-a'), 'manifest-a');
    localStorage.setItem(recentSearchesStorageKey('user-a'), '["A"]');
    localStorage.setItem(activeTripStorageKey('user-b'), 'manifest-b');
    localStorage.setItem('unrelated', 'keep');

    clearUserScopedStorage('user-a');

    expect(localStorage.getItem(activeTripStorageKey('user-a'))).toBeNull();
    expect(localStorage.getItem(recentSearchesStorageKey('user-a'))).toBeNull();
    expect(localStorage.getItem(activeTripStorageKey('user-b'))).toBe('manifest-b');
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
});
