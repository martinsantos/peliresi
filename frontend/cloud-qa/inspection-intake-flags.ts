import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'inspection_intake_20261020');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const processes = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/processes.json', 'utf8'));
  const runtime = processes.find((item: any) => item.file === 'runtime.ts');
  const environment = Object.fromEntries(readFileSync(`/proc/${runtime.pid}/environ`, 'utf8').split('\0').filter(Boolean).map(pair => [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)]));
  for (const flag of ['MANIFEST_EXCEPTIONAL_ENABLED', 'MANIFEST_ADDENDA_ENABLED', 'MANIFEST_PARTY_REVIEW_ENABLED', 'ENTERPRISE_ENABLED', 'ACTOR_MULTIROLE_ENABLED']) assert.equal(environment[flag], 'false');
  for (const flag of ['MANIFEST_TRANSPORT_HANDOFF_ENABLED', 'TRANSPORT_MULTI_GPS_ENABLED']) assert.equal(environment[flag], 'true');
  assert.equal(environment.DISABLE_EMAILS, 'true'); assert.equal(environment.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  const before = await db.antecedenteFiscalizacion.count();
  const login = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'operator@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) }); assert.equal(login.status, 200);
  const token = (await login.json()).data.tokens.accessToken;
  const fixture = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/intake-fixture.json', 'utf8'));
  for (const path of ['/manifiestos/baja-intensidad', `/manifiestos/${fixture.http.finding.id}/adendas`]) {
    const response = await fetch('http://127.0.0.1:3037/api' + path, { headers: { Authorization: 'Bearer ' + token } }); assert.equal(response.status, 404);
  }
  const queue = await fetch('http://127.0.0.1:3037/api/inspecciones/antecedentes', { headers: { Authorization: 'Bearer ' + token } }); assert.equal(queue.status, 403);
  assert.equal(await db.antecedenteFiscalizacion.count(), before);
  for (const name of ['admin', 'generador', 'transporte', 'operador']) {
    const cap = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: name + '@capacitacion.invalid', password: 'NoCAP' }) }); assert.equal(cap.status, 403);
  }
  writeFileSync(process.env.QA_ARTIFACTS + '/flags.json', JSON.stringify({ passed: 3, checks: ['actual process flags preserve disabled origins and enabled transport', 'disabled origins reject without adding intakes and operator cannot read queue', 'four CAP aliases remain closed'], production: false }, null, 2));
  console.log('Current flag configuration: 3 groups PASS.');
} finally { await db.$disconnect(); }
