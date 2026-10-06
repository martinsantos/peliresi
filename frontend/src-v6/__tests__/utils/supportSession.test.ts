import { beforeEach, expect, it } from 'vitest';
import { assertSupportSession, supportSessionMatches, SupportSessionChangedError } from '../../utils/supportSession';

// Unsigned unit markers are never submitted to a server or used as auth.
const marker = (payload: unknown) => 'unit.' + btoa(JSON.stringify(payload)) + '.not-a-credential';
beforeEach(() => localStorage.clear());
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
