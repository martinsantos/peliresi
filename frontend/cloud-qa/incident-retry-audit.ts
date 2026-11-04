import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-incident-retry-final-20261101';
const commit = '17e74c8d85dc1cc3854886e3d70f6d62abb0898d';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.GITHUB_SHA, commit);
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const report = read('browser-final.json');
assert.equal(report.stats.expected, 8); assert.equal(report.stats.unexpected, 0); assert.equal(report.stats.skipped, 0); assert.equal(report.stats.flaky, 0);
assert.deepEqual(report.errors, []);
const baselineOut = '/work/sitrep/.qa-incident-retry-baseline-20261101';
const baseline = JSON.parse(readFileSync(path.join(baselineOut, 'browser-baseline.json'), 'utf8'));
assert.equal(baseline.stats.expected, 2); assert.equal(baseline.stats.unexpected, 0); assert.equal(baseline.stats.skipped, 0);
const backend = read('backend-unit.json'), frontend = read('frontend-unit-final.json');
assert.equal(backend.success, true); assert.equal(backend.numFailedTests, 0); assert.ok(backend.numPassedTests >= 25);
assert.equal(frontend.success, true); assert.equal(frontend.numFailedTests, 0); assert.ok(frontend.numPassedTests >= 65);
const manual = readFileSync(path.join(out, 'manual-test.tap'), 'utf8');
const manualCount = Number(manual.match(/# tests (\d+)/)?.[1]);
assert.ok(manualCount >= 55); assert.equal(Number(manual.match(/# pass (\d+)/)?.[1]), manualCount); assert.match(manual, /# fail 0\b/);
for (const stage of ['before', 'after']) {
  const source = read(`source-${stage}.json`); assert.equal(source.commit, commit); assert.equal(source.files, 2674);
  assert.deepEqual(source.missing, []); assert.deepEqual(source.different, []);
  const assets = read(`assets-${stage}.json`); assert.equal(assets.commit, commit); assert.ok(assets.files > 400); assert.deepEqual(assets.different, []);
  const network = read(`network-isolation-${stage}.json`);
  assert.deepEqual(network.networks, ['sitrep-qa-enterprise-net-20261016']); assert.equal(network.internal, true);
  assert.equal(network.publishedPorts, false); assert.equal(network.nanoCpus, 1000000000);
  assert.equal(network.memoryBytes, 2147483648); assert.equal(network.memorySwapBytes, 2147483648);
}
const http = read('incident-http-audit.json');
assert.equal(http.simultaneousRequests, 8); assert.equal(http.created, 1); assert.equal(http.operatorNotices, 2);
assert.equal(http.lateRetryAcknowledged, true); assert.equal(http.newAfterDeliveryRejected, true);
const processes = read('processes.json'); assert.deepEqual(processes.map((item: { file: string }) => item.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(env.QA_ARTIFACTS, out); assert.equal(env.GITHUB_SHA, commit);
  assert.equal(env.QA_COMPAT_BACKEND, 'incident-retry-final'); assert.equal(env.SITREP_PAUSE_BACKGROUND_JOBS, 'true');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.TRAINING_DATABASE_URL, '');
  for (const key of externalKeys) assert.equal(env[key], '', key);
}
const runtime = read('runtime-proof.json'); assert.equal(runtime.source, commit);
assert.match(runtime.backend, /\.qa-incident-retry-final-20261101\/dist-backend\/index\.js$/);
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
for (const name of ['help-data.js', 'directorio.html']) {
  const source = readFileSync(path.join(out, 'source/docs/manual', name));
  const response = await fetch('http://127.0.0.1:4177/manual/' + name); assert.equal(response.status, 200);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(source));
}
const fixture = read('incident-fixture.json'); assert.equal(fixture.synthetic, true);
const { PrismaClient } = backendRequire('@prisma/client'); const db = new PrismaClient();
try {
  const browserCases = Object.entries(fixture.cases).filter(([name]) => name !== 'race') as Array<[string, { id: string; numero: string }]>;
  assert.equal(browserCases.length, 8);
  for (const [name, item] of browserCases) {
    const trip = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, isDemoData: true, estado: true } });
    assert.equal(trip.numero, item.numero); assert.match(trip.numero, /^QA-INCIDENT-FINAL-/); assert.equal(trip.isDemoData, true);
    assert.equal(trip.estado, 'EN_TRANSITO');
    assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: item.id, tipo: 'INCIDENTE', isDemoData: true } }), 1, name);
    assert.equal(await db.notificacion.count({ where: { manifiestoId: item.id, tipo: 'INCIDENTE_REPORTADO', usuarioId: fixture.users.operator } }), 1, name);
    assert.equal(await db.auditoria.count({ where: { manifiestoId: item.id, accion: 'REGISTRAR_INCIDENTE_V1' } }), 1, name);
  }
  const oldFixture = JSON.parse(readFileSync(path.join(baselineOut, 'incident-fixture.json'), 'utf8'));
  assert.equal(oldFixture.synthetic, true);
  for (const item of Object.values(oldFixture.cases) as Array<{ id: string; numero: string }>) {
    const trip = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, isDemoData: true } });
    assert.equal(trip.numero, item.numero); assert.match(trip.numero, /^QA-INCIDENT-RETRY-/); assert.equal(trip.isDemoData, true);
    assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: item.id, tipo: 'INCIDENTE' } }), 2);
  }
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [index, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.229.${90 + index}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { productCommit: commit, synthetic: true, production: false, baselineDuplicateCases: 2,
    browserCases: 8, backendUnit: backend.numPassedTests, frontendUnit: frontend.numPassedTests, manualTests: manualCount,
    simultaneousRequests: http.simultaneousRequests, capClosed: true, pushEnabled: false, emailAttempts: 0, emailSent: 0 };
  writeFileSync(path.join(out, 'incident-final-audit.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
