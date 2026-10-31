import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-pwa-continuity-20261031';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'pwa-continuity');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const run = process.env.QA_PWA_RUN || '';
assert.match(run, /^after-v\d+$/);
const report = read('browser-' + run + '.json');
assert.equal(report.stats.expected, 10); assert.equal(report.stats.skipped, 4);
assert.equal(report.stats.unexpected, 0); assert.equal(report.stats.flaky, 0);
const baseline = read('browser-before-v1.json');
assert.equal(baseline.stats.expected, 4); assert.equal(baseline.stats.skipped, 2); assert.equal(baseline.stats.unexpected, 0);
const webBaseline = read('browser-web-before-v3.json');
assert.equal(webBaseline.stats.expected, 1); assert.equal(webBaseline.stats.unexpected, 0);
function proof(directory: string, filename: string) {
  const base = path.join(out, directory);
  return readdirSync(base, { withFileTypes: true }).filter(entry => entry.isDirectory())
    .map(entry => path.join(base, entry.name, filename)).filter(existsSync)
    .map(file => JSON.parse(readFileSync(file, 'utf8')));
}
const shellBefore = proof('browser-before-v1', 'shell-proof.json');
assert.equal(shellBefore.length, 1);
assert.deepEqual([shellBefore[0].visibleNewRelease, shellBefore[0].savedNewRelease], [true, true]);
const tabBefore = proof('browser-before-v1', 'tab-proof.json');
assert.equal(tabBefore.length, 1); assert.equal(tabBefore[0].oldChunkRetained, false);
const webBefore = proof('browser-web-before-v3', 'web-tab-proof.json');
assert.equal(webBefore.length, 1); assert.equal(webBefore[0].synthetic, true);
const shell = proof('browser-' + run, 'shell-proof.json');
assert.equal(shell.length, 1);
assert.deepEqual([shell[0].waiting, shell[0].visibleNewRelease, shell[0].savedNewRelease], ['installed', false, false]);
for (const filename of ['tab-proof.json', 'web-tab-proof.json']) {
  const values = proof('browser-' + run, filename);
  assert.equal(values.length, 1); assert.equal(values[0].synthetic, true); assert.equal(values[0].oldChunkRetained, true);
}
for (const filename of ['offline-proof.json', 'draft-update-proof.json']) {
  const values = proof('browser-' + run, filename);
  assert.deepEqual(values.map(value => value.surface).sort(), ['app', 'web-desktop']);
  assert.ok(values.every(value => value.synthetic && value.automaticWrites === 0));
}
const logins = proof('browser-' + run, 'login-update-proof.json');
assert.deepEqual(logins.map(value => value.surface).sort(), ['app', 'web-desktop']);
assert.ok(logins.every(value => value.synthetic && value.loginRequests === 0));
const installs = proof('browser-' + run, 'install-proof.json');
assert.equal(installs.length, 1);
assert.deepEqual(installs[0], { synthetic: true, promptEventSimulated: true, nativeInstallationTested: false });
for (const proc of read('processes.json')) {
  const env = Object.fromEntries(readFileSync('/proc/' + proc.pid + '/environ', 'utf8').split('\0').filter(Boolean)
    .map(entry => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(env.QA_COMPAT_BACKEND, 'pwa-continuity');
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const { TRAINING_LOGINS } = backendRequire(path.join(root, 'backend/dist-qa-actor-overview-20261031/lib/trainingDirectLogin.js'));
for (const { email } of TRAINING_LOGINS) {
  assert.match(email, /@capacitacion\.invalid$/);
  const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.89.96' },
    body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
  assert.equal(response.status, 403);
}
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const get = async (url: string) => {
  const response = await fetch('http://127.0.0.1:4177' + url);
  assert.equal(response.status, 200); return response.text();
};
const manual = await get('/manual/help-data.js');
assert.equal(sha(manual), sha(readFileSync(path.join(root, 'docs/manual/help-data.js'), 'utf8')));
const webWorker = await get('/sw.js');
assert.equal(sha(webWorker), sha(readFileSync(path.join(root, 'frontend/public/sw.js'), 'utf8')));
const appWorker = await get('/app/sw-app.js');
const version = appWorker.match(/const SW_VERSION = '(\d{14})'/)?.[1];
assert.ok(version);
assert.equal(sha(appWorker), sha(readFileSync(path.join(root, 'frontend/public/sw-app.js'), 'utf8').replaceAll('__SW_VERSION__', version)));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  for (const text of ['QA borrador sin conexión con service worker', 'QA borrador conservado durante actualización']) {
    assert.equal(await db.inspeccion.count({ where: { observaciones: { contains: text } } }), 0);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(path.join(out, 'audit-' + run + '.json'), JSON.stringify({ synthetic: true, production: false,
    realServiceWorkers: true, distinctBuilds: true, browserChecks: 10, automaticWrites: 0,
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, nativeAndroidTested: false,
    manualMatches: true, webWorkerMatches: true, appWorkerMatches: true }), { flag: 'wx', mode: 0o600 });
  console.log('PWA auditada en preview: cachés, borradores, CAP cerrado y cero correos.');
} finally { await db.$disconnect(); }
