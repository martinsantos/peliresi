import { describe, expect, it } from 'vitest';
import { getImpersonationRedirectPath, isPwaPath } from '../../../src-v6/utils/impersonationNavigation';

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
});
