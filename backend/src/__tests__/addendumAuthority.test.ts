import { afterEach, expect, it, vi } from 'vitest';
import { ADDENDUM_AUTHORITY_ROLES, canReviewAsAddendumAuthority } from '../domain/addendumAuthority';
vi.mock('../lib/prisma', () => ({ default: {} }));
import { exceptionalDesignatedReviewer } from '../controllers/manifiesto-excepcional.controller';

afterEach(() => vi.unstubAllEnvs());
it.each(ADDENDUM_AUTHORITY_ROLES)('permits only the explicitly designated active %s account', rol => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS', 'selected');
  const user = { id: 'selected', rol, activo: true }, record = { creadoPorId: 'operator' };
  expect(canReviewAsAddendumAuthority(user, record)).toBe(true);
  for (const other of [{ ...user, id: 'another' }, { ...user, activo: false }, { ...user, restricted: true },
    { ...user, impersonatedBy: { id: 'other-admin' } }]) expect(canReviewAsAddendumAuthority(other, record)).toBe(false);
  expect(canReviewAsAddendumAuthority(user, { creadoPorId: user.id })).toBe(false);
  expect(canReviewAsAddendumAuthority(user, { ...record, impersonadoPorId: user.id })).toBe(false);
  vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS', '');
  expect(canReviewAsAddendumAuthority(user, record)).toBe(false);
});
it.each(['GENERADOR', 'OPERADOR', 'TRANSPORTISTA'] as const)('does not promote designated %s to authority', rol => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS', 'selected');
  expect(canReviewAsAddendumAuthority({ id: 'selected', rol, activo: true }, { creadoPorId: 'other' })).toBe(false);
});
it('keeps sector authorities outside the exceptional-ledger permission boundary', () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS', 'selected');
  for (const rol of ['ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA']) {
    expect(exceptionalDesignatedReviewer({ id: 'selected', rol, activo: true })).toBe(false);
  }
  expect(canReviewAsAddendumAuthority(undefined, { creadoPorId: 'other' })).toBe(false);
});
