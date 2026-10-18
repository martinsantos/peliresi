import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
vi.mock('../../config/config', () => ({ config: { JWT_SECRET: 'qa-only-training-signature' } }));
import { trainingSession } from '../../middlewares/trainingSession';
import { isTrainingSession, TRAINING_REALM } from '../../lib/trainingScope';
const sign = (claims: object) => jwt.sign(claims, 'qa-only-training-signature');
beforeEach(() => { vi.stubEnv('TRAINING_DATABASE_URL', 'postgresql://school@localhost/test?schema=sitrep_training'); });
afterEach(() => vi.unstubAllEnvs());
function run(path: string, token?: string, body?: object, method = 'GET') {
  const next = vi.fn(() => isTrainingSession());
  const header = vi.fn();
  trainingSession({ path, method, headers: { authorization: token ? 'Bearer ' + token : undefined }, body } as never, { setHeader: header } as never, next);
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
it.each(['/api/manifiestos/one/adendas/two/anexo', '/api/manifiestos/one/adendas/two/%61nexo', '/api/admin/jobs/vencimientos', '/api/auth/register', '/api/blockchain', '/api/pdf/certificado/one', '/api/inspecciones/one/acta.pdf', '/api/inspecciones/one/acta%2epdf'])('blocks irreversible or external capabilities: %s', path => {
  const { next } = run(path, sign({ realm: TRAINING_REALM, impersonatedBy: 'real-admin' }));
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  expect(isTrainingSession()).toBe(false);
});
it('does not fall back to production when school configuration is absent', () => {
  vi.stubEnv('TRAINING_DATABASE_URL', '');
  expect(run('/api/manifiestos', sign({ realm: TRAINING_REALM, impersonatedBy: 'real-admin' })).next)
    .toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
});
it.each(['/api/admin/usuarios', '/api/solicitudes', '/api/alertas'])('allows scoped reading but not unreviewed mutations: %s', path => {
  const token = sign({ realm: TRAINING_REALM, impersonatedBy: 'real-admin' });
  expect(run(path, token).next.mock.results[0].value).toBe(true);
  expect(run(path, token, {}, 'POST').next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
});

it.each([
  {id:'cap-20261012-admin-1',trainingDirect:true},
  {id:'cap-20261012-admin-2',realm:TRAINING_REALM,trainingDirect:true},
  {id:'cap-20261012-admin-1',realm:TRAINING_REALM,trainingDirect:'true'},
  {id:'cap-20261012-admin-1',realm:TRAINING_REALM,trainingDirect:true,impersonatedBy:'real-admin'},
  {id:'cap-20261012-admin-1',realm:TRAINING_REALM,trainingDirect:true,restricted:true},
])('rejects malformed direct claims without a public fallback: %j',claim=>{
  vi.stubEnv('TRAINING_DIRECT_LOGIN_UNTIL','2099-01-01T00:00:00Z');
  expect(run('/api/manifiestos',sign(claim)).next).toHaveBeenCalledWith(expect.objectContaining({statusCode:401}));
});
it.each(['/api/admin/impersonate/real-admin','/api/admin/training/impersonate/other','/api/pdf/manifiesto/one','/api/push/subscribe','/api/auth/change-password','/api/auth/register','/api/admin/jobs/mail'])('direct CAP cannot escape through %s',path=>{
  vi.stubEnv('TRAINING_DIRECT_LOGIN_UNTIL','2099-01-01T00:00:00Z');
  expect(run(path,sign({id:'cap-20261012-admin-1',realm:TRAINING_REALM,trainingDirect:true}),{},'POST').next)
    .toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));
});
it('revokes existing signed direct tokens when the classroom window ends',()=>{
  vi.stubEnv('TRAINING_DIRECT_LOGIN_UNTIL','2000-01-01T00:00:00Z');
  expect(run('/api/manifiestos',sign({id:'cap-20261012-admin-1',realm:TRAINING_REALM,trainingDirect:true})).next)
    .toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));
});

it.each(['/api/auth/refresh-token/','/api/auth/%72efresh-token'])('retains school scope for normalized refresh path %s',path=>{
  vi.stubEnv('TRAINING_DIRECT_LOGIN_UNTIL','2099-01-01T00:00:00Z');
  const refreshToken=sign({id:'cap-20261012-admin-1',realm:TRAINING_REALM,trainingDirect:true});
  expect(run(path,undefined,{refreshToken},'POST').next.mock.results[0].value).toBe(true);
});
