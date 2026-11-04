import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-fleet-freshness-20261030'; assert.equal(process.env.QA_ARTIFACTS, out);
const load = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
for (const [name, expected] of [['browser-before.json', 6], ['browser-after.json', 8], ['fleet-browser.json', 2],
  ['fleet-monitor.json', 2], ['browser-console.json', 2]] as const) {
  const stats = load(name).stats;
  assert.equal(stats.expected, expected); assert.equal(stats.unexpected, 0); assert.equal(stats.skipped, 0);
}
const consoleDirs = readdirSync(path.join(out, 'browser-console'), { withFileTypes: true }).filter(entry => entry.isDirectory());
assert.equal(consoleDirs.length, 2);
for (const dir of consoleDirs) {
  const capture = JSON.parse(readFileSync(path.join(out, 'browser-console', dir.name, 'console-0.json'), 'utf8'));
  for (const event of capture.events) {
    assert.equal(event.type, 'warning');
    assert.match(event.text, /^(Service Worker registration blocked by Playwright|\[SW(?:-App)?\] Registration failed:)/);
  }
}
assert.match(readFileSync(path.join(out, 'vitest-final2.log'), 'utf8'), /91 passed/);
assert.match(readFileSync(path.join(out, 'manual-final.log'), 'utf8'), /# pass 34\b/);
assert.match(readFileSync(path.join(out, 'manual-final.log'), 'utf8'), /# fail 0\b/);
const processes = load('processes.json');
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.QA_COMPAT_BACKEND, 'fleet-freshness');
  assert.equal(env.QA_WEB_BUILD, out + '/web-final2'); assert.equal(env.QA_APP_BUILD, out + '/app-final2');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
assert.equal(qaBackendEntry(), '/work/sitrep/backend/dist-qa-eventual-notices-20261030/index.js');
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const expected: Record<string, string> = load('source-digests.json');
for (const [file, digest] of Object.entries(expected)) assert.equal(hash(readFileSync('/work/sitrep/' + file)), digest, file);
const source = readFileSync('/work/sitrep/docs/manual/help-data.js');
const served = await fetch('http://127.0.0.1:4177/manual/help-data.js'); assert.equal(served.status, 200);
assert.equal(hash(Buffer.from(await served.arrayBuffer())), hash(source));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.99.7' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const fleet = load('fleet-current-audit.json'); assert.equal(fleet.results.length, 2);
  const report = { synthetic: true, production: false, baselineBrowserPasses: 6, finalBrowserPasses: 8,
    multipleLoadBrowserPasses: 2, monitorBrowserPasses: 2, consoleRepeatPasses: 2,
    unitPasses: 91, manualPasses: 34, comparedFiles: Object.keys(expected).length,
    manualSha256: hash(source), backend: '73a4afa1 isolated preview', capClosed: true, emailAttempts: 0, emailsSent: 0, pushEnabled: false };
  writeFileSync(path.join(out, 'audit.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
