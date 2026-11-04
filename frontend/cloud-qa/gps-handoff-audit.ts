import { stripVTControlCharacters } from 'node:util';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-gps-handoff-20261101';
const previous = '/work/sitrep/.qa-operational-ui-current2026110103';
const candidate = 'dd6e957df6b61a8934a812f74d6dafc7056b0534';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.GITHUB_SHA, candidate);
assert.equal(process.env.QA_COMPAT_BACKEND, 'gps-handoff-dd6e957d');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const prior = JSON.parse(readFileSync(path.join(previous, 'closure-80a-audit.json'), 'utf8'));
assert.equal(prior.productCommit, '80a283bb7987a1906c8857eb5b147b2054d30b68');
assert.equal(prior.browserTests, 37); assert.equal(prior.synthetic, true); assert.equal(prior.production, false);
const baseline = JSON.parse(readFileSync(path.join(previous, 'gps-unreadable-handoff-baseline-80a.json'), 'utf8'));
assert.equal(baseline.stats.unexpected, 4); assert.equal(baseline.stats.expected, 0);
const specs = baseline.suites.flatMap((suite: any) => suite.specs || []);
function baselineError(title: string, project: string): string {
  const matching = specs.filter((item: any) => item.title === title); assert.ok(matching.length);
  const test = matching.flatMap((item: any) => item.tests).find((item: any) => item.projectName === project); assert.ok(test);
  assert.equal(test.status, 'unexpected'); return stripVTControlCharacters(test.results[0].error.message);
}
assert.match(baselineError('explains an unreadable GPS copy before a handoff and keeps the form', 'app'), /No se pudo verificar o guardar el recorrido/);
assert.match(baselineError('explains an unreadable GPS copy before a handoff and keeps the form', 'web-desktop'), /browserType\.launch/);
for (const surface of ['app', 'web-desktop']) assert.match(baselineError('keeps keyboard focus inside the blocked delivery dialog and restores it on Escape', surface), /Received: false/);
for (const name of ['gps-unreadable-handoff-final-dd6e.json', 'gps-delivery-browser.json']) {
  const report = read(name); assert.equal(report.stats.expected, 6, name); assert.equal(report.stats.unexpected, 0, name);
  assert.equal(report.stats.skipped, 0, name); assert.equal(report.stats.flaky, 0, name); assert.deepEqual(report.errors, [], name);
}
for (const stage of ['before', 'after']) {
  const source = read(`source-${stage}.json`); assert.equal(source.commit, candidate); assert.equal(source.stage, stage);
  assert.equal(source.files, 911); assert.deepEqual(source.missing, []); assert.deepEqual(source.different, []);
}
const backend = read('backend-reuse.json'); assert.equal(backend.fromCommit, '62516a08a3fe189d7d5612520d678162674f1b32');
assert.equal(backend.toCommit, candidate); assert.deepEqual(backend.changedBackendFiles, []);
const unit = read('unit.json'); assert.equal(unit.success, true); assert.equal(unit.numFailedTests, 0); assert.ok(unit.numPassedTests >= 116);
const manual = readFileSync(path.join(out, 'manual.tap'), 'utf8'), manualCount = Number(manual.match(/# tests (\d+)/)?.[1]);
assert.ok(manualCount >= 55); assert.equal(Number(manual.match(/# pass (\d+)/)?.[1]), manualCount); assert.match(manual, /# fail 0\b/);
const delivery = read('gps-delivery-audit.json'); assert.equal(delivery.production, false); assert.equal(delivery.physicalGps, false);
assert.equal(delivery.checked.length, 6);
assert.equal(delivery.checked.filter((entry: any) => entry.state === 'ENTREGADO' && entry.points === 2).length, 4);
assert.equal(delivery.checked.filter((entry: any) => entry.state === 'EN_TRANSITO' && entry.points === 2).length, 2);
const runtime = read('runtime-proof.json'); assert.equal(runtime.source, candidate); assert.match(runtime.backend, /\.qa-scheduled-pause-20261101\/dist\/index\.js$/);
const processes = read('processes.json'); assert.deepEqual(processes.map((p: any) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(env.GITHUB_SHA, candidate); assert.equal(env.QA_ARTIFACTS, out);
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.SITREP_PAUSE_BACKGROUND_JOBS, 'true');
  assert.equal(env.QA_WEB_BUILD, path.join(out, 'web')); assert.equal(env.QA_APP_BUILD, path.join(out, 'app'));
  for (const key of externalKeys) assert.equal(env[key], '', key);
}
const fixture = read('gps-unreadable-handoff-private.json');
const { PrismaClient } = backendRequire('@prisma/client'); const db = new PrismaClient();
try {
  for (const item of Object.values(fixture.cases) as Array<{ id: string; numero: string }>) {
    const trip = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, estado: true, isDemoData: true } });
    assert.deepEqual(trip, { numero: item.numero, estado: 'EN_TRANSITO', isDemoData: true });
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: item.id } }), 0);
    assert.equal(await db.tramoTransporte.count({ where: { manifiestoId: item.id } }), 0);
  }
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [index, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.61.${90 + index}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { productCommit: candidate, priorIntegratedCommit: prior.productCommit, priorIntegratedBrowserCases: 37,
    targetedBrowserCases: 6, deliveryRegressionCases: 6, unitTests: unit.numPassedTests, manualTests: manualCount,
    baselineProductFailures: 3, baselineBrowserLaunchFailures: 1, synthetic: true, production: false,
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, gpsSimulated: true };
  writeFileSync(path.join(out, 'gps-handoff-audit.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
