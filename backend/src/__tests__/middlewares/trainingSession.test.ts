import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
vi.mock('../../config/config', () => ({ config: { JWT_SECRET: 'qa-only-training-signature' } }));
import { trainingSession } from '../../middlewares/trainingSession';
import { isTrainingSession, TRAINING_REALM } from '../../lib/trainingScope';
const sign = (claims: object) => jwt.sign(claims, 'qa-only-training-signature');
beforeEach(() => { vi.stubEnv('TRAINING_DATABASE_URL', 'postgresql://school@localhost/test?schema=sitrep_training'); });
afterEach(() => vi.unstubAllEnvs());
function run(path: string, token?: string, body?: object) {
  const next = vi.fn(() => isTrainingSession());
  const header = vi.fn();
  trainingSession({ path, headers: { authorization: token ? 'Bearer ' + token : undefined }, body } as never, { setHeader: header } as never, next);
  return { next, header };
}
it('ignores an unsigned request flag', () => {
  const { next } = run('/api/manifiestos', undefined, { realm: TRAINING_REALM });
  expect(next.mock.results[0].value).toBe(false);
});
it('activates only the verified training realm within the request callback', () => {
  const { next, header } = run('/api/manifiestos', sign({ realm: TRAINING_REALM, impersonatedBy: 'real-admin' }));
  expect(next.mock.results[0].value).toBe(true); expect(header).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(isTrainingSession()).toBe(false);
});
it('retains training on refresh despite an expired bearer token', () => {
  const expired = jwt.sign({ realm: TRAINING_REALM }, 'qa-only-training-signature', { expiresIn: -1 });
  const { next } = run('/api/auth/refresh-token', expired, { refreshToken: sign({ realm: TRAINING_REALM, impersonatedBy: 'real-admin' }) });
  expect(next.mock.results[0].value).toBe(true);
});
it.each(['/api/admin/jobs/vencimientos', '/api/auth/register', '/api/blockchain', '/api/pdf/certificado/one', '/api/inspecciones/one/acta.pdf', '/api/inspecciones/one/acta%2epdf'])('blocks irreversible or external capabilities: %s', path => {
  const { next } = run(path, sign({ realm: TRAINING_REALM, impersonatedBy: 'real-admin' }));
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  expect(isTrainingSession()).toBe(false);
});
it('does not fall back to production when school configuration is absent', () => {
  vi.stubEnv('TRAINING_DATABASE_URL', '');
  expect(run('/api/manifiestos', sign({ realm: TRAINING_REALM, impersonatedBy: 'real-admin' })).next)
    .toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
});
