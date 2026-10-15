import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/prisma', () => ({ default: {} }));
import { exceptionalEnabled, exceptionalCanReview } from '../controllers/manifiesto-excepcional.controller';
afterEach(() => vi.unstubAllEnvs());
it('keeps exceptional endpoints closed unless explicitly enabled', () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_ENABLED', '');
  const next = vi.fn();
  exceptionalEnabled({} as never, {} as never, next);
  expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 404 });
});
it('does not let the creating administrator approve through impersonation or its original account', () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS', 'qa-reviewer');
  const req = { user: { id: 'qa-reviewer', rol: 'ADMIN' } };
  expect(exceptionalCanReview(req as never, { creadoPorId: 'qa-operator' })).toBe(true);
  expect(exceptionalCanReview(req as never, { creadoPorId: 'qa-reviewer' })).toBe(false);
  expect(exceptionalCanReview(req as never, { creadoPorId: 'qa-operator', impersonadoPorId: 'qa-reviewer' })).toBe(false);
  expect(exceptionalCanReview({ user: { ...req.user, impersonatedBy: { id: 'qa-other' } } } as never, { creadoPorId: 'qa-operator' })).toBe(false);
  expect(exceptionalCanReview({ user: { id: 'qa-other', rol: 'ADMIN' } } as never, { creadoPorId: 'qa-operator' })).toBe(false);
});
it('passes the feature gate only for an explicit true value', () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_ENABLED', 'true');
  const next = vi.fn(); exceptionalEnabled({} as never, {} as never, next);
  expect(next).toHaveBeenCalledWith();
});
