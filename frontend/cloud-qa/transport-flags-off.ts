import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase } from './safety.ts';
await assertCloudDatabase();
for (const flag of ['ENTERPRISE_ENABLED', 'ACTOR_MULTIROLE_ENABLED', 'MANIFEST_EXCEPTIONAL_ENABLED', 'MANIFEST_ADDENDA_ENABLED', 'MANIFEST_TRANSPORT_HANDOFF_ENABLED', 'TRANSPORT_MULTI_GPS_ENABLED', 'PUSH_MANIFEST_NOTICES_ENABLED']) assert.equal(process.env[flag], 'false', flag);
const directory = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(await readFile(path.join(directory, 'handoff-private.json'), 'utf8'));
const login = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: fixture.users.origin.email, password: fixture.password }) });
assert.equal(login.status, 200);
const token = (await login.json()).data.tokens.accessToken;
const paths = ['/manifiestos/cargas-en-curso', '/manifiestos/relevos-asignados', `/manifiestos/${fixture.browsers.web.id}/tramos`];
for (const route of paths) {
  const response = await fetch('http://127.0.0.1:3037/api' + route, { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(response.status, 404, route);
}
const key = await fetch('http://127.0.0.1:3037/api/push/vapid-key', { headers: { Authorization: 'Bearer ' + token } });
assert.equal((await key.json()).data.enabled, false);
await writeFile(path.join(directory, 'transport-default-off.json'), JSON.stringify({ passed: true, disabledRoutes: paths, externalPushEnabled: false, production: false }, null, 2));
console.log('PASS: 3 transport routes disabled and push key unavailable; synthetic preview only');
