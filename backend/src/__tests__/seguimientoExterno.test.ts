import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/prisma', () => ({ default: {} }));
import { externalTrackingQuery, externalTrackingAccess } from '../controllers/seguimientoExterno.controller';
afterEach(() => vi.unstubAllEnvs());
it('validates bounded filters without normalizing or joining doubtful identities', () => {
  expect(externalTrackingQuery.parse({})).toEqual({ rol: 'generador', identificacion: '', page: 1 });
  expect(externalTrackingQuery.parse({ rol: 'transportista', identificacion: '  DU 12-?  ', page: '2' }))
    .toEqual({ rol: 'transportista', identificacion: 'DU 12-?', page: 2 });
  for (const input of [{ page: 0 }, { page: 1.5 }, { page: 100001 }, { rol: 'otro' }, { operadorId: 'foreign' },
    { identificacion: ['a', 'b'] }, { identificacion: 'x'.repeat(501) }]) expect(externalTrackingQuery.safeParse(input).success).toBe(false);
});
it('accepts the external operator as a tracked role', () => {
  expect(externalTrackingQuery.parse({ rol: 'operador' }).rol).toBe('operador');
});
// Spec v2 §5 (B): creator and registered parties read tracking of their own records only.
it('the designated authority sees everything; everyone else is filtered to their own records', () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS', 'authority');
  expect(externalTrackingAccess({ rol: 'ADMIN', id: 'authority' } as never)).toEqual({ reviewer: true, filter: null });
  const cases: Array<[Record<string, unknown>, string, string[]]> = [
    [{ id: 'u1', rol: 'OPERADOR', operador: { id: 'own' } }, '"operadorId"', ['u1', 'own']],
    [{ id: 'u2', rol: 'GENERADOR', generador: { id: 'gen' } }, "'generador'", ['u2', 'gen']],
    [{ id: 'u3', rol: 'TRANSPORTISTA', transportista: { id: 'tr' } }, "'transportista'", ['u3', 'tr']],
    [{ id: 'other', rol: 'ADMIN' }, '"creadoPorId"', ['other']],
    [{ id: 'authority', rol: 'ADMIN', impersonatedBy: { id: 'other' } }, '"creadoPorId"', ['authority']],
  ];
  for (const [user, column, values] of cases) {
    const access = externalTrackingAccess(user as never);
    expect(access.reviewer).toBe(false);
    expect(access.filter!.sql).toContain('"creadoPorId"');
    expect(access.filter!.sql).toContain(column);
    expect(access.filter!.values).toEqual(values);
  }
  for (const user of [{ rol: 'GENERADOR' }, { rol: 'TRANSPORTISTA' }, { rol: 'OPERADOR' }, { rol: 'ADMIN_OPERADOR', id: 'x' },
    { rol: 'OPERADOR', operador: { id: 'own' }, restricted: true }])
    expect(() => externalTrackingAccess(user as never)).toThrow(/reservado/);
});
