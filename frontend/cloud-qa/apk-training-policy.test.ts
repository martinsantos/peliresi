import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainingRequestAllowed } from './apk-training-policy.ts';
const origin = 'https://sitrep.ultimamilla.com.ar';
const token = (claims: object) => 'Bearer header.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.not-an-authentication-token';
test('teacher cannot read operational lists or impersonate operational users', () => {
  const auth = token({ id: 'teacher' });
  for (const route of ['/api/admin/usuarios', '/api/manifiestos', '/api/inspecciones', '/api/admin/impersonate/real'])
    for (const method of ['GET', 'POST', 'DELETE']) assert.equal(trainingRequestAllowed(origin + route, method, null, auth, 'teacher'), false);
  assert.equal(trainingRequestAllowed(origin + '/api/admin/training/usuarios', 'GET', null, auth, 'teacher'), true);
});
test('only teacher-owned training sessions can perform the explicit synthetic reply', () => {
  const claims = { id: 'cap-20261012-transportista-5', realm: 'sitrep-capacitacion-v1', impersonatedBy: 'teacher' };
  const path = '/api/inspecciones/cap-20261012-participacion-5-TRANSPORTISTA-abierta/intercambios';
  assert.equal(trainingRequestAllowed(origin + path, 'POST', null, token(claims), 'teacher'), true);
  for (const change of [{ realm: undefined }, { impersonatedBy: 'other' }, { id: 'real-user' }])
    assert.equal(trainingRequestAllowed(origin + path, 'POST', null, token({ ...claims, ...change }), 'teacher'), false);
  for (const path of ['/api/manifiestos', '/api/auth/register', '/api/admin/jobs/vencimientos', '/api/inspecciones/real/intercambios'])
    assert.equal(trainingRequestAllowed(origin + path, 'POST', null, token(claims), 'teacher'), false);
});
