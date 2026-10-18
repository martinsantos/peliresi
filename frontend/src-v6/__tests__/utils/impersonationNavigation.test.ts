import { describe, expect, it } from 'vitest';
import { impersonationDestination, safeAdminReturnPath } from '../../utils/impersonationNavigation';

describe('impersonation navigation', () => {
  it('stays on the same app surface after changing user', () => {
    expect(impersonationDestination('/app/switch-user', '/dashboard')).toBe('/app/dashboard');
    expect(impersonationDestination('/mobile/switch-user', '/dashboard')).toBe('/mobile/dashboard');
    expect(impersonationDestination('/switch-user', '/dashboard')).toBe('/dashboard');
  });

  it('restores an admin path only on the same surface', () => {
    expect(safeAdminReturnPath('/app/switch-user?rol=OPERADOR', '/app/dashboard')).toBe('/app/switch-user?rol=OPERADOR');
    expect(safeAdminReturnPath('//evil.test/path', '/app/dashboard')).toBe('/app/switch-user');
    expect(safeAdminReturnPath('/switch-user', '/app/dashboard')).toBe('/app/switch-user');
  });
});
