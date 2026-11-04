import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const out = process.env.QA_ARTIFACTS!;
assert.match(out, /^\/work\/sitrep\/\.qa-operational-ui-current\d+$/);
const processes = JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'));
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL, '');
  assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const flag of ['MANIFEST_PROPOSALS_ENABLED','MANIFEST_ADDENDA_ENABLED','MANIFEST_PARTY_REVIEW_ENABLED',
    'MANIFEST_CERTIFICATES_ENABLED','MANIFEST_TRANSPORT_HANDOFF_ENABLED','TRANSPORT_MULTI_GPS_ENABLED']) assert.equal(env[flag], 'true');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const origins: Array<Record<string, unknown>> = [];
try {
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.22.95' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  const directory = path.join(out, 'proposal-e2e-' + (process.env.QA_BROWSER_ATTEMPT || 'initial'));
  const proofs = readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory())
    .map(entry => path.join(directory, entry.name, 'proof.json')).filter(existsSync)
    .map(file => JSON.parse(readFileSync(file, 'utf8')))
    .filter(proof => proof.noTripOrGps === true);
  assert.equal(proofs.length, 6);
  const pairs = proofs.map(proof => `${proof.surface}:${proof.creator}`).sort();
  assert.deepEqual(pairs, ['app:generador','app:operador','app:transportista',
    'web-desktop:generador','web-desktop:operador','web-desktop:transportista']);
  for (const proof of proofs) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: proof.id },
      select: { numero: true, isDemoData: true, estado: true, modalidad: true, transportistaId: true, fechaRetiro: true } });
    assert.equal(manifest.numero, proof.numero); assert.equal(manifest.isDemoData, true);
    assert.equal(manifest.modalidad, 'IN_SITU'); assert.equal(manifest.estado, 'RECIBIDO');
    assert.ok(manifest.transportistaId); assert.equal(manifest.fechaRetiro, null);
    for (const tipo of ['FIRMA','APROBACION_TRANSPORTISTA','APROBACION_OPERADOR'])
      assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: proof.id, tipo } }), 1);
    assert.equal(await db.tramoTransporte.count({ where: { manifiestoId: proof.id } }), 0);
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: proof.id } }), 0);
    origins.push({ surface: proof.surface, creator: proof.creator, approvals: 3, trip: false, gps: false });
  }
  const api = JSON.parse(readFileSync(path.join(out, 'operational-http.json'), 'utf8'));
  assert.equal(api.complete, true); assert.equal(api.created.length, 3);
  assert.deepEqual(api.created.map((item: { creator: string }) => item.creator).sort(), ['generador','operador','transportista']);
  for (const item of api.created) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, isDemoData: true, estado: true } });
    assert.equal(manifest.numero, item.numero); assert.equal(manifest.isDemoData, true); assert.equal(manifest.estado, 'TRATADO');
    assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: item.id, tipo: 'ENTREGA' } }), 1);
    assert.equal(await db.auditoria.count({ where: { manifiestoId: item.id, accion: 'CONFIRMAR_ENTREGA_V1' } }), 1);
    assert.equal(await db.certificadoManifiesto.count({ where: { manifiestoId: item.id, id: { in: [item.partialId,item.finalId] } } }), 2);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const report = { productCommit: process.env.GITHUB_SHA, synthetic: true, runtimeProcesses: processes.length,
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, origins, apiCases: api.created.length };
  writeFileSync(path.join(out, 'operational-current-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
