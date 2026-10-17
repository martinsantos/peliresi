import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/prisma', () => ({ default: {} }));
import { exceptionalEnabled, exceptionalCanReview, exceptionalReadWhere } from '../controllers/manifiesto-excepcional.controller';
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
it('lectura: el revisor ve todo; quien creó, lo suyo; cada parte, sólo donde figura con alta', () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS', 'qa-reviewer');
  expect(exceptionalReadWhere({ id: 'qa-reviewer', rol: 'ADMIN' } as never)).toEqual({});
  expect(exceptionalReadWhere({ id: 'qa-admin', rol: 'ADMIN' } as never)).toEqual({ creadoPorId: 'qa-admin' });
  expect(exceptionalReadWhere({ id: 'qa-reviewer', rol: 'ADMIN', impersonatedBy: { id: 'x' } } as never)).toEqual({ creadoPorId: 'qa-reviewer' });
  expect(exceptionalReadWhere({ id: 'u', rol: 'OPERADOR', operador: { id: 'op' } } as never))
    .toEqual({ OR: [{ creadoPorId: 'u' }, { operadorId: 'op' }] });
  expect(exceptionalReadWhere({ id: 'u', rol: 'GENERADOR', generador: { id: 'gen' } } as never))
    .toEqual({ OR: [{ creadoPorId: 'u' }, { datos: { path: ['generador', 'padronId'], equals: 'gen' } }] });
  expect(exceptionalReadWhere({ id: 'u', rol: 'TRANSPORTISTA', transportista: { id: 'tr' } } as never))
    .toEqual({ OR: [{ creadoPorId: 'u' }, { datos: { path: ['transportista', 'padronId'], equals: 'tr' } }] });
  for (const user of [{ id: 'u', rol: 'ADMIN_GENERADOR' }, { id: 'u', rol: 'ADMIN_OPERADOR' }, { id: 'u', rol: 'GENERADOR' },
    { id: 'u', rol: 'OPERADOR', operador: null }, { id: 'u', rol: 'OPERADOR', operador: { id: 'op' }, restricted: true }])
    expect(() => exceptionalReadWhere(user as never)).toThrow(expect.objectContaining({ statusCode: 403 }));
});
