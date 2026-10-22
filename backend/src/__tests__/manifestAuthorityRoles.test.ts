import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/prisma', () => ({ default: {} }));
import { ADDENDUM_AUTHORITY_ROLES, canReviewAsAddendumAuthority } from '../domain/addendumAuthority';
import { exceptionalDesignatedReviewer } from '../controllers/manifiesto-excepcional.controller';
import { noticeNewCurrents } from '../services/postFactoNotice.service';
import { eventualNoticeAudience } from '../services/eventualNotice.service';
import { inTrainingSession } from '../lib/trainingScope';

afterEach(() => vi.unstubAllEnvs());
function roles() {
  vi.stubEnv('MANIFEST_REVIEW_AUTHORITY_BY_ROLE', 'true');
  vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS', '');
  vi.stubEnv('MANIFEST_PARTY_REVIEW_ENABLED', 'true');
}
it.each(ADDENDUM_AUTHORITY_ROLES)('authorizes active %s by role only when configured, without self-review', rol => {
  roles();
  const user = { id: 'authority', rol, activo: true }, record = { creadoPorId: 'operator' };
  expect(canReviewAsAddendumAuthority(user, record)).toBe(true);
  for (const patch of [{ activo: false }, { restricted: true }, { impersonatedBy: { id: 'another' } }, { rol: 'OPERADOR' as const }]) {
    expect(canReviewAsAddendumAuthority({ ...user, ...patch }, record)).toBe(false);
  }
  expect(canReviewAsAddendumAuthority(user, { creadoPorId: user.id })).toBe(false);
  expect(canReviewAsAddendumAuthority(user, { ...record, impersonadoPorId: user.id })).toBe(false);
  vi.stubEnv('MANIFEST_REVIEW_AUTHORITY_BY_ROLE', 'false');
  expect(canReviewAsAddendumAuthority(user, record)).toBe(false);
});
it('keeps eventual review with active ADMIN, never sector administrators, restricted or impersonated users', () => {
  roles();
  const user = { id: 'authority', rol: 'ADMIN', activo: true };
  expect(exceptionalDesignatedReviewer(user as never)).toBe(true);
  for (const patch of [{ activo: false }, { restricted: true }, { impersonatedBy: { id: 'another' } }, ...ADDENDUM_AUTHORITY_ROLES.slice(1).map(rol => ({ rol }))]) {
    expect(exceptionalDesignatedReviewer({ ...user, ...patch } as never)).toBe(false);
  }
});
it('uses the same authority scope for new-current notices, without selecting user IDs', async () => {
  roles();
  const tx = { usuario: { findMany: vi.fn().mockResolvedValue([{ id: 'authority' }]) }, notificacion: { createMany: vi.fn() } };
  await noticeNewCurrents(tx as never, [], [{ corriente: 'Y21' }], '/manifiestos/m/adendas', 'review', 'generator', { id: 'a', version: 1, manifiestoId: 'm', numero: 'QA-M' });
  expect(tx.usuario.findMany).toHaveBeenLastCalledWith({ where: { rol: { in: ADDENDUM_AUTHORITY_ROLES }, activo: true }, select: { id: true } });
  await noticeNewCurrents(tx as never, [], [{ corriente: 'Y21' }], '/eventual', 'review');
  expect(tx.usuario.findMany).toHaveBeenLastCalledWith({ where: { rol: 'ADMIN', activo: true }, select: { id: true } });
  tx.usuario.findMany.mockResolvedValue([]);
  await expect(noticeNewCurrents(tx as never, [], [{ corriente: 'Y21' }], '/eventual', 'review')).rejects.toMatchObject({ statusCode: 409 });
});
it('requested eventual reviews notify administrators except the creator and impersonator', async () => {
  roles();
  const tx = { usuario: { findMany: vi.fn().mockResolvedValue([]) } };
  await eventualNoticeAudience(tx as never, { creadoPorId: 'creator', impersonadoPorId: 'impersonator', datos: {}, operadorId: null } as never, 'SOLICITAR_REVISION', 'requester');
  expect(tx.usuario.findMany.mock.calls[0][0].where.OR.at(-1)).toEqual({ rol: 'ADMIN', id: { notIn: ['creator', 'impersonator'] } });
});
it('role configuration never opens classroom authority scope', async () => {
  roles();
  expect(await inTrainingSession(() => canReviewAsAddendumAuthority({ id: 'real-admin', rol: 'ADMIN', activo: true }, { creadoPorId: 'other' }))).toBe(false);
  const tx = { usuario: { findMany: vi.fn().mockResolvedValue([{ id: 'cap-20261012-admin-1' }]) }, notificacion: { createMany: vi.fn() } };
  await inTrainingSession(() => noticeNewCurrents(tx as never, [], [{ corriente: 'Y21' }], '/eventual', 'review', 'cap-20261012-operador-1'));
  expect(tx.usuario.findMany).toHaveBeenCalledWith({ where: { id: { in: ['cap-20261012-admin-1'] }, rol: 'ADMIN', activo: true }, select: { id: true } });
});
