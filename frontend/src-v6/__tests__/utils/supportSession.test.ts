import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { assertSupportSession, supportRequestContext, supportSessionMatches, SupportSessionChangedError } from '../../utils/supportSession';

// Unsigned unit markers are never submitted to a server or used as auth.
const marker = (payload: unknown) => 'unit.' + btoa(JSON.stringify(payload)) + '.not-a-credential';
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.unstubAllEnvs());
it('blocks a missing credential without inventing an authenticated owner', () => {
  expect(supportSessionMatches('owner')).toBe(false);
  expect(() => assertSupportSession('owner')).toThrow(SupportSessionChangedError);
});
it('requires the expected account and permits renewal of that same account', () => {
  localStorage.setItem('sitrep_access_token', marker({ id: 'owner', iat: 1 }));
  expect(supportSessionMatches('owner')).toBe(true); expect(supportSessionMatches('other')).toBe(false);
  localStorage.setItem('sitrep_access_token', marker({ id: 'owner', iat: 2 }));
  expect(() => assertSupportSession('owner')).not.toThrow();
});
it('blocks stale UI ownership after a new account credential replaces it', () => {
  localStorage.setItem('sitrep_access_token', marker({ id: 'other' }));
  expect(() => assertSupportSession('owner')).toThrow(SupportSessionChangedError);
  expect(supportSessionMatches('other')).toBe(true);
});
it('fails closed for malformed or non-account claims', () => {
  for (const token of ['bad', 'unit.%%.x', marker(null), marker([]), marker({ id: 17 }), marker({ sub: 'owner' })]) {
    localStorage.setItem('sitrep_access_token', token); expect(supportSessionMatches('owner')).toBe(false);
  }
});
it('binds a represented report to the expected signed operator without treating the client hint as authorization', () => {
  localStorage.setItem('sitrep_access_token', marker({ id: 'owner' }));
  expect(supportSessionMatches('owner', 'admin')).toBe(false);
  localStorage.setItem('sitrep_access_token', marker({ id: 'owner', impersonatedBy: 'admin' }));
  expect(supportSessionMatches('owner', 'admin')).toBe(true);
  expect(supportSessionMatches('owner', 'other-admin')).toBe(false);
  expect(() => assertSupportSession('owner', 'other-admin')).toThrow(SupportSessionChangedError);
});

it('keeps request context stable for renewal and changes it for another role or represented operator', () => {
  localStorage.setItem('sitrep_access_token', marker({ id: 'owner', rol: 'GENERADOR', iat: 1 }));
  const original = supportRequestContext();
  localStorage.setItem('sitrep_access_token', marker({ id: 'owner', rol: 'GENERADOR', iat: 2 }));
  expect(supportRequestContext()).toBe(original);
  localStorage.setItem('sitrep_access_token', marker({ id: 'owner', rol: 'OPERADOR' }));
  expect(supportRequestContext()).not.toBe(original);
  const role = supportRequestContext();
  localStorage.setItem('sitrep_access_token', marker({ id: 'owner', rol: 'OPERADOR', impersonatedBy: 'admin' }));
  expect(supportRequestContext()).not.toBe(role);
});
it('captures actual activity and company headers for same-account context changes', () => {
  vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true'); vi.stubEnv('VITE_ENTERPRISE_ENABLED', 'true');
  localStorage.setItem('sitrep_access_token', marker({ id: 'owner', rol: 'GENERADOR' }));
  const original = supportRequestContext();
  sessionStorage.setItem('sitrep_activity:owner', 'TRANSPORTISTA');
  expect(supportRequestContext()).not.toBe(original);
  const activity = supportRequestContext();
  sessionStorage.setItem('sitrep_company:owner', JSON.stringify({ empresaId: 'company', actividadId: 'activity' }));
  expect(supportRequestContext()).not.toBe(activity);
});
