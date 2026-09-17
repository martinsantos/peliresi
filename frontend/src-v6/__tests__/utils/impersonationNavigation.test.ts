import { describe, expect, it } from 'vitest';
import {
  currentAppLocation,
  getImpersonationRedirectPath,
  hasStoredImpersonationSession,
  IMPERSONATION_STORAGE_KEY,
  isPwaPath,
  safeImpersonationReturnPath,
} from '../../utils/impersonationNavigation';

describe('impersonation navigation', () => {
  it('recognizes the PWA mount without confusing ordinary web paths', () => {
    expect(isPwaPath('/app')).toBe(true);
    expect(isPwaPath('/app/switch-user')).toBe(true);
    expect(isPwaPath('/switch-user')).toBe(false);
  });

  it('keeps impersonation redirects inside the surface where they started', () => {
    expect(getImpersonationRedirectPath('/switch-user', '/dashboard')).toBe('/dashboard');
    expect(getImpersonationRedirectPath('/app/switch-user', '/dashboard')).toBe('/app/dashboard');
    expect(getImpersonationRedirectPath('/app/dashboard', '/admin/usuarios')).toBe('/app/admin/usuarios');
  });

  it('captures and restores the exact admin route including query and hash', () => {
    expect(currentAppLocation({
      pathname: '/app/admin/usuarios',
      search: '?rol=OPERADOR&page=3',
      hash: '#resultados',
    })).toBe('/app/admin/usuarios?rol=OPERADOR&page=3#resultados');
    expect(safeImpersonationReturnPath(
      '/app/admin/usuarios?rol=OPERADOR&page=3#resultados',
      '/app/dashboard',
    )).toBe('/app/admin/usuarios?rol=OPERADOR&page=3#resultados');
  });

  it('rejects external and protocol-relative return targets', () => {
    expect(safeImpersonationReturnPath('https://evil.example/path', '/dashboard')).toBe('/admin/usuarios');
    expect(safeImpersonationReturnPath('//evil.example/path', '/app/dashboard')).toBe('/app/admin/usuarios');
    expect(safeImpersonationReturnPath(undefined, '/app/dashboard')).toBe('/app/admin/usuarios');
  });

  it('recognizes only a complete persisted impersonation session', () => {
    const complete = {
      getItem: (key: string) => key === IMPERSONATION_STORAGE_KEY
        ? JSON.stringify({ adminToken: 'admin-access', adminRefreshToken: 'admin-refresh', adminUser: { id: 'admin' } })
        : null,
    };
    expect(hasStoredImpersonationSession(complete)).toBe(true);
    expect(hasStoredImpersonationSession({ getItem: () => '{"adminToken":"incomplete"}' })).toBe(false);
    expect(hasStoredImpersonationSession({ getItem: () => 'invalid-json' })).toBe(false);
    expect(hasStoredImpersonationSession(undefined)).toBe(false);
  });
});
