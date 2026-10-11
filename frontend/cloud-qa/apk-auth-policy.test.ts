import test from 'node:test';
import assert from 'node:assert/strict';
import { apkCredentials, apkOrigin, apkRequestAllowed, qaApkEmail } from './apk-auth-policy.ts';

test('only the explicitly authorized temporary account may log in', () => {
  const url = apkOrigin + '/api/auth/login';
  assert.equal(apkRequestAllowed(url, 'POST', JSON.stringify({ email: qaApkEmail, password: 'secret' }), true), true);
  for (const body of ['{}', '{', JSON.stringify({ email: 'someone@real.org', password: 'secret' }),
    JSON.stringify({ email: qaApkEmail, cuit: '123', password: 'secret' })])
    assert.equal(apkRequestAllowed(url, 'POST', body, true), false);
  assert.equal(apkRequestAllowed(url, 'POST', JSON.stringify({ email: qaApkEmail, password: 'secret' }), false), false);
});
test('never authorizes business writes, mail, credentials changes or GET mutations', () => {
  for (const route of ['/api/solicitudes', '/api/soporte/tickets', '/api/manifiestos/1/aprobar',
    '/api/auth/verify-email?token=x', '/api/auth/forgot-password', '/api/auth/change-password', '/api/admin/usuarios'])
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
      assert.equal(apkRequestAllowed(apkOrigin + route, method, '{}', true), false);
});
test('safe reads and session closure are narrow and exact', () => {
  assert.equal(apkRequestAllowed(apkOrigin + '/api/manifiestos?limit=5', 'GET', null, true), true);
  assert.equal(apkRequestAllowed(apkOrigin + '/api/auth/logout', 'POST', '{}', true), true);
  for (const url of ['https://other.invalid/api/auth/profile', 'http://sitrep.ultimamilla.com.ar/api/auth/profile',
    apkOrigin + '/api/manifiestos/real-id', apkOrigin + '/api/auth/profile/extra'])
    assert.equal(apkRequestAllowed(url, 'GET', null, true), false);
});
test('missing, wrong-account or weak credentials fail closed', () => {
  const valid = { email: qaApkEmail, id: 'cmqa1234567890123456', password: 'a'.repeat(48) };
  assert.deepEqual(apkCredentials(JSON.stringify(valid)), valid);
  for (const value of [undefined, '{}', JSON.stringify({ ...valid, email: 'admin@real.org' }),
    JSON.stringify({ ...valid, password: 'short' }), JSON.stringify({ ...valid, id: '' })])
    assert.throws(() => apkCredentials(value));
});
