import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/prisma', () => ({ default: {} }));
import { exceptionalEnabled, exceptionalCanReview, exceptionalReadWhere, sameExceptionalCreator } from '../controllers/manifiesto-excepcional.controller';
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
it('blocks a site-limited company context before any eventual endpoint is reached', () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_ENABLED', 'true');
  const next = vi.fn();
  exceptionalEnabled({ user: { rol: 'GENERADOR', empresaContexto: { todasSedes: false, establecimientoId: 'site-north' } } } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, message: expect.stringMatching(/todos los establecimientos/i) }));
});
it.each([undefined, { todasSedes: true }])('keeps an authorized personal or whole-company context available: %j', empresaContexto => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_ENABLED', 'true');
  const next = vi.fn();
  exceptionalEnabled({ user: { rol: 'GENERADOR', empresaContexto } } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith();
});
it('does not grant a former company creator access from a different active activity', () => {
  const user = { id: 'representative', rol: 'OPERADOR', operador: { id: 'other-actor' },
    empresaContexto: { empresaId: 'company', actividadId: 'other-activity', todasSedes: true } };
  expect(exceptionalReadWhere(user as never)).toEqual({ operadorId: 'other-actor' });
});
it('lectura: el revisor ve todo; administración ve lo propio; cada actor ve sólo su actividad', () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS', 'qa-reviewer');
  expect(exceptionalReadWhere({ id: 'qa-reviewer', rol: 'ADMIN' } as never)).toEqual({});
  expect(exceptionalReadWhere({ id: 'qa-admin', rol: 'ADMIN' } as never)).toEqual({ creadoPorId: 'qa-admin' });
  expect(exceptionalReadWhere({ id: 'qa-reviewer', rol: 'ADMIN', impersonatedBy: { id: 'x' } } as never)).toEqual({ creadoPorId: 'qa-reviewer' });
  expect(exceptionalReadWhere({ id: 'u', rol: 'OPERADOR', operador: { id: 'op' } } as never))
    .toEqual({ operadorId: 'op' });
  expect(exceptionalReadWhere({ id: 'u', rol: 'GENERADOR', generador: { id: 'gen' } } as never))
    .toEqual({ datos: { path: ['generador', 'padronId'], equals: 'gen' } });
  expect(exceptionalReadWhere({ id: 'u', rol: 'TRANSPORTISTA', transportista: { id: 'tr' } } as never))
    .toEqual({ datos: { path: ['transportista', 'padronId'], equals: 'tr' } });
  for (const user of [{ id: 'u', rol: 'ADMIN_GENERADOR' }, { id: 'u', rol: 'ADMIN_OPERADOR' }, { id: 'u', rol: 'GENERADOR' },
    { id: 'u', rol: 'OPERADOR', operador: null }, { id: 'u', rol: 'OPERADOR', operador: { id: 'op' }, restricted: true }])
    expect(() => exceptionalReadWhere(user as never)).toThrow(expect.objectContaining({ statusCode: 403 }));
});
it.each([
  [{ autorRol:'GENERADOR', autorActorId:'actor-a' }, { rol:'GENERADOR', parte:'generador', actorId:'actor-a' }, true],
  [{ autorRol:'GENERADOR', autorActorId:'actor-a' }, { rol:'GENERADOR', parte:'generador', actorId:'actor-b' }, false],
  [{ autorRol:'GENERADOR', autorActorId:'actor-a' }, { rol:'OPERADOR', parte:'operador', actorId:'actor-a' }, false],
  [{ autorRol:'ADMIN' }, { rol:'ADMIN' }, true],
  [{ autorRol:'GENERADOR', autorActorId:'actor-a' }, { rol:'ADMIN' }, false],
  [{ autorRol:null, operadorId:'old-op' }, { rol:'OPERADOR', parte:'operador', actorId:'old-op' }, true],
  [{ autorRol:null, operadorId:'old-op' }, { rol:'OPERADOR', parte:'operador', actorId:'other' }, false],
  [{ autorRol:null, operadorId:'old-op' }, { rol:'GENERADOR', parte:'generador', actorId:'old-op' }, false],
] as const)('binds a retry to the creator activity: %j / %j', (record, creator, expected) => {
  expect(sameExceptionalCreator(record, creator)).toBe(expected);
});
