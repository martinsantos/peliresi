import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = process.env.QA_ARTIFACTS!;
assert.equal(out, '/work/sitrep/.qa-manifest-gps-context-20261029');
const processes = JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'));
assert.deepEqual(processes.map((item: { file: string }) => item.file).sort(), ['runtime.ts', 'server.ts']);
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
const fixture = read(path.join(out, 'manifest-gps-context-private.json'));
const browserRoot = path.join(out, 'manifest-gps-context-browser');
const dirs = readdirSync(browserRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => path.join(browserRoot, entry.name));
const proofs = dirs.map(dir => path.join(dir, 'manifest-gps-context-proof.json')).filter(existsSync).map(read);
const combinations = proofs.map(item => `${item.surface}:${item.role}`).sort();
assert.deepEqual(combinations, ['app:admin', 'app:generador', 'app:operador', 'app:transportista',
  'web-desktop:admin', 'web-desktop:generador', 'web-desktop:operador', 'web-desktop:transportista', 'web-responsive:admin'].sort());
for (const proof of proofs) { assert.equal(proof.window, 100); assert.equal(proof.marker, true); assert.deepEqual(proof.errors, []); }
for (const surface of ['app', 'web-desktop', 'web-responsive']) {
  assert.ok(dirs.some(dir => dir.endsWith(surface) && existsSync(path.join(dir, 'gps-una-posicion.png'))), surface);
}
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
assert.equal(digest(path.join(out, 'manual', 'help-data.js')), digest('/work/sitrep/docs/manual/help-data.js'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  for (const item of [fixture.active, fixture.finished]) assert.equal(await db.trackingGPS.count({ where: { manifiestoId: item.id } }), 103);
  assert.equal(await db.trackingGPS.count({ where: { manifiestoId: fixture.single.id } }), 1);
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
    combinations, unchangedSyntheticPointCounts: true, manualSha256: digest('/work/sitrep/docs/manual/help-data.js') };
  writeFileSync(path.join(out, 'manifest-gps-context-audit.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
