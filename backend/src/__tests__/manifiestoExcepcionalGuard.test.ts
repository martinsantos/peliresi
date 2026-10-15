import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/prisma', () => ({ default: {} }));
import { exceptionalEnabled } from '../controllers/manifiesto-excepcional.controller';
afterEach(() => vi.unstubAllEnvs());
it('keeps exceptional endpoints closed unless explicitly enabled', () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_ENABLED', '');
  const next = vi.fn();
  exceptionalEnabled({} as never, {} as never, next);
  expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 404 });
});
it('passes the feature gate only for an explicit true value', () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_ENABLED', 'true');
  const next = vi.fn(); exceptionalEnabled({} as never, {} as never, next);
  expect(next).toHaveBeenCalledWith();
});
