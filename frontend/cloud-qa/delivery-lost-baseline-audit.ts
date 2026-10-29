import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const out = process.env.QA_ARTIFACTS!, fixture = JSON.parse(readFileSync(path.join(out, 'gps-transition-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient(), results = [];
try {
  for (const proc of JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'))) {
    const env = Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`, 'utf8').split('\0').filter(Boolean)
      .map(entry => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]));
    assertCloudEnvironment(env);
    assert.equal(env.TRAINING_DATABASE_URL, '');
    assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
    assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
    assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
    for (const key of externalKeys) assert.equal(env[key], '');
  }
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.22.96' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  for (const [surface, cases] of Object.entries(fixture.cases) as Array<[string, any]>) {
    const item = cases['admin-delivery'];
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, estado: true, isDemoData: true } });
    assert.equal(manifest.numero, item.numero); assert.equal(manifest.isDemoData, true); assert.equal(manifest.estado, 'ENTREGADO');
    const deliveries = await db.eventoManifiesto.count({ where: { manifiestoId: item.id, tipo: 'ENTREGA' } });
    assert.equal(deliveries, 1); results.push({ surface, state: manifest.estado, deliveries });
  }
  const report = { synthetic: true, production: false, capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, results };
  writeFileSync(path.join(out, 'delivery-lost-audit.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
