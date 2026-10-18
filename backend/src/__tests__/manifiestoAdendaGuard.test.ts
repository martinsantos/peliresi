import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/prisma', () => ({ default: {} }));
import { addendaEnabled } from '../controllers/manifiesto-adenda.controller';
afterEach(() => vi.unstubAllEnvs());
it('does not enable ordinary addenda implicitly when exceptional ledgers are enabled', () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_ENABLED', 'true'); vi.stubEnv('MANIFEST_ADDENDA_ENABLED', '');
  const next = vi.fn(); addendaEnabled({} as never, {} as never, next);
  expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 404 });
});
it('requires explicit ordinary addenda flag', () => {
  vi.stubEnv('MANIFEST_ADDENDA_ENABLED', 'true'); const next = vi.fn();
  addendaEnabled({} as never, {} as never, next); expect(next).toHaveBeenCalledWith();
});
