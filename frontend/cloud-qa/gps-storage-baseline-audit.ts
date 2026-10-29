import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, ''); assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const out = process.env.QA_ARTIFACTS!, fixture = JSON.parse(readFileSync(path.join(out, 'gps-transition-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient(), results = [];
try {
 const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
 for (const { email } of TRAINING_LOGINS) {
  assert.match(email, /@capacitacion\.invalid$/);
  const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
   headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.22.95' },
   body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
  assert.equal(response.status, 403);
 }
 for (const surface of ['web-desktop', 'app']) {
  const item = fixture.cases[surface]['fleet-delivery'];
  const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, isDemoData: true, estado: true } });
  assert.equal(manifest.numero, item.numero); assert.equal(manifest.isDemoData, true); assert.equal(manifest.estado, 'ENTREGADO');
  const points = await db.trackingGPS.count({ where: { manifiestoId: item.id } });
  const deliveries = await db.eventoManifiesto.count({ where: { manifiestoId: item.id, tipo: 'ENTREGA' } });
  assert.equal(points, 0); assert.equal(deliveries, 1); results.push({ surface, state: manifest.estado, points, deliveries });
 }
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 const proof = { synthetic: true, production: false, capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, results };
 writeFileSync(path.join(out, 'gps-storage-baseline-audit.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
