import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/prisma', () => ({ default: {} }));
import { externalTrackingQuery, externalTrackingScope } from '../controllers/seguimientoExterno.controller';
afterEach(() => vi.unstubAllEnvs());
it('validates bounded filters without normalizing or joining doubtful identities', () => {
  expect(externalTrackingQuery.parse({})).toEqual({ rol: 'generador', identificacion: '', page: 1 });
  expect(externalTrackingQuery.parse({ rol: 'transportista', identificacion: '  DU 12-?  ', page: '2' }))
    .toEqual({ rol: 'transportista', identificacion: 'DU 12-?', page: 2 });
  for (const input of [{ page: 0 }, { page: 1.5 }, { page: 100001 }, { rol: 'operador' }, { operadorId: 'foreign' },
    { identificacion: ['a', 'b'] }, { identificacion: 'x'.repeat(501) }]) expect(externalTrackingQuery.safeParse(input).success).toBe(false);
});
it('allows only the own operator or the existing designated authority scope', () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS', 'authority');
  expect(externalTrackingScope({ rol: 'OPERADOR', operador: { id: 'own' } } as never)).toBe('own');
  expect(externalTrackingScope({ rol: 'ADMIN', id: 'authority' } as never)).toBeNull();
  for (const user of [{ rol: 'GENERADOR' }, { rol: 'TRANSPORTISTA' }, { rol: 'OPERADOR' },
    { rol: 'ADMIN', id: 'other' }, { rol: 'ADMIN', id: 'authority', impersonatedBy: { id: 'other' } }])
    expect(() => externalTrackingScope(user as never)).toThrow(/reservado/);
});
