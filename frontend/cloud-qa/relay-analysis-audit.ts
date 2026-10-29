import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = process.env.QA_ARTIFACTS!;
assert.equal(out, '/work/sitrep/.qa-relay-analysis-20261029');
const processes = JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'));
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const http = read(path.join(out, 'relay-analysis-http-proof.json'));
assert.equal(http.pointsAccepted, 10); assert.equal(http.duplicateAcceptedOnce, true);
assert.equal(http.anomalyRecorded, true); assert.equal(http.adminInboxNotified, true); assert.equal(http.fakeIncidentAuthor, false);
const browserRoot = path.join(out, 'gps-alert-atomic-browser');
const browser = readdirSync(browserRoot, { withFileTypes: true }).filter(entry => entry.isDirectory())
  .map(entry => read(path.join(browserRoot, entry.name, 'gps-alert-atomic-browser-proof.json')));
assert.deepEqual(browser.map(item => item.surface).sort(), ['app', 'web-desktop']);
for (const item of browser) { assert.equal(item.bell, true); assert.equal(item.exactManifest, true); assert.deepEqual(item.errors, []); }
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
assert.equal(digest(path.join(out, 'manual', 'help-data.js')), digest('/work/sitrep/docs/manual/help-data.js'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.22.97' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const proof = { synthetic: true, capClosed: true, emailAttempts: 0, emailsSent: 0, pushEnabled: false,
    surfaces: browser.map(item => item.surface).sort(), manualSha256: digest('/work/sitrep/docs/manual/help-data.js') };
  writeFileSync(path.join(out, 'relay-analysis-audit.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
