import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-gps-send-ambiguity-20261101';
const commit = '540ecfff63304bbba5268ccc24c9a3960bdf849c';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.GITHUB_SHA, commit);
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
for (const stage of ['before', 'after']) {
  const browser = read(`browser-${stage}.json`);
  assert.equal(browser.stats.expected, 2); assert.equal(browser.stats.unexpected, 0);
  assert.equal(browser.stats.skipped, 0); assert.deepEqual(browser.errors, []);
  const source = read(`source-${stage}.json`); assert.equal(source.commit, commit); assert.equal(source.files, 2684);
  assert.deepEqual(source.missing, []); assert.deepEqual(source.different, []);
  const assets = read(`assets-${stage}.json`); assert.equal(assets.commit, commit); assert.ok(assets.files > 400); assert.deepEqual(assets.different, []);
  const network = read(`network-${stage}.json`);
  assert.deepEqual(network.networks, ['sitrep-qa-enterprise-net-20261016']); assert.equal(network.internal, true);
  assert.equal(network.publishedPorts, false); assert.equal(network.nanoCpus, 1000000000);
  assert.equal(network.memoryBytes, 2147483648); assert.equal(network.memorySwapBytes, 2147483648);
}
const delivery = read('gps-delivery-browser.json');
assert.equal(delivery.stats.expected, 6); assert.equal(delivery.stats.unexpected, 0); assert.equal(delivery.stats.skipped, 0);
const deliveryProof = read('gps-delivery-audit.json');
assert.equal(deliveryProof.production, false); assert.equal(deliveryProof.physicalGps, false); assert.equal(deliveryProof.checked.length, 6);
const red = read('red-tests.json'), targeted = read('targeted-tests.json'), regression = read('gps-regression.json'), panel = read('gps-panel-final.json');
assert.equal(red.numFailedTests, 4); assert.equal(targeted.success, true); assert.equal(targeted.numFailedTests, 0);
assert.equal(regression.success, true); assert.equal(regression.numFailedTests, 0); assert.ok(regression.numPassedTests >= 211);
assert.equal(panel.success, true); assert.equal(panel.numFailedTests, 0); assert.ok(panel.numPassedTests >= 16);
const manual = readFileSync(path.join(out, 'manual-final.tap'), 'utf8');
const manualCount = Number(manual.match(/# tests (\d+)/)?.[1]);
assert.ok(manualCount >= 55); assert.equal(Number(manual.match(/# pass (\d+)/)?.[1]), manualCount); assert.match(manual, /# fail 0\b/);
const runtime = read('runtime-proof.json'); assert.equal(runtime.source, commit);
assert.match(runtime.backend, /\.qa-incident-retry-final-20261101\/dist-backend\/index\.js$/);
for (const { pid } of read('processes.json')) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(env.QA_ARTIFACTS, out); assert.equal(env.GITHUB_SHA, commit);
  assert.equal(env.QA_COMPAT_BACKEND, 'gps-send-ambiguity'); assert.equal(env.SITREP_PAUSE_BACKGROUND_JOBS, 'true');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.TRAINING_DATABASE_URL, '');
  for (const key of externalKeys) assert.equal(env[key], '', key);
}
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
for (const file of ['help-data.js', 'directorio.html']) {
  const source = readFileSync(path.join(out, 'source/docs/manual', file));
  const response = await fetch('http://127.0.0.1:4177/manual/' + file); assert.equal(response.status, 200);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(source));
}
const fixture = read('fixture.json'); assert.equal(fixture.synthetic, true);
const { PrismaClient } = backendRequire('@prisma/client'); const db = new PrismaClient();
try {
  for (const [name, item] of Object.entries(fixture.cases) as Array<[string, { id: string; numero: string }]>) {
    const trip = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, isDemoData: true, estado: true } });
    assert.equal(trip.numero, item.numero); assert.match(trip.numero, /^QA-GPS-RESPONSE-/);
    assert.equal(trip.isDemoData, true); assert.equal(trip.estado, 'EN_TRANSITO');
    const points = await db.trackingGPS.findMany({ where: { manifiestoId: item.id } });
    assert.equal(points.length, 1, name); assert.equal(points[0].latitud, -33.1234); assert.equal(points[0].longitud, -68.1234);
  }
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [index, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.233.${50 + index}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { productCommit: commit, synthetic: true, production: false, beforeBrowser: 2, afterBrowser: 2,
    deliveryBrowser: 6, priorProductRegression: regression.numPassedTests, finalPanelTests: panel.numPassedTests,
    manualTests: manualCount, capClosed: true, pushEnabled: false, emailAttempts: 0, emailSent: 0 };
  writeFileSync(path.join(out, 'final-audit.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
