/** Audit only the isolated synthetic fixture and the preview processes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = process.env.QA_ARTIFACTS!;
assert.equal(out, '/work/sitrep/.qa-receipt-link-20261030');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const fixture = JSON.parse(readFileSync(path.join(out, 'fixture.json'), 'utf8'));
assert.equal(fixture.synthetic, true); assert.equal(fixture.production, false);
assert.match(fixture.owner, /@night-qa\.invalid$/);
const processes = JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'));
assert.deepEqual(processes.map((p: {file: string}) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.QA_WEB_BUILD, `${out}/web-after`); assert.equal(env.QA_APP_BUILD, `${out}/app-after`);
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const before = JSON.parse(readFileSync(path.join(out, 'before.json'), 'utf8')).stats;
const after = JSON.parse(readFileSync(path.join(out, 'after.json'), 'utf8')).stats;
assert.equal(before.expected, 2); assert.equal(before.unexpected, 4); assert.equal(before.skipped, 0);
assert.equal(after.expected, 6); assert.equal(after.unexpected, 0); assert.equal(after.skipped, 0);
for (const [attempt, expected] of [['before', false], ['after', true]] as const) {
  const dir = path.join(out, attempt);
  const proofs = readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory())
    .map(entry => path.join(dir, entry.name, 'observed.json')).filter(existsSync)
    .map(file => JSON.parse(readFileSync(file, 'utf8')));
  assert.equal(proofs.length, 4);
  assert.deepEqual(proofs.map(p => `${p.surface}:${p.source}`).sort(),
    ['app:avisos', 'app:campana', 'web-desktop:avisos', 'web-desktop:campana']);
  for (const proof of proofs) {
    assert.equal(proof.synthetic, true); assert.equal(proof.hasExactTarget, expected);
    if (expected) assert.equal(proof.selectedCorrectly, true);
  }
}
const digest = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const manual = readFileSync('/work/sitrep/docs/manual/help-data.js');
const servedManual = await fetch('http://127.0.0.1:4177/manual/help-data.js');
assert.equal(servedManual.status, 200); assert.equal(digest(Buffer.from(await servedManual.arrayBuffer())), digest(manual));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const owner = await db.usuario.findUniqueOrThrow({ where: { email: fixture.owner } });
  const application = await db.solicitudInscripcion.findUniqueOrThrow({ where: { id: fixture.operator } });
  assert.equal(application.usuarioId, owner.id); assert.equal(application.tipoActor, 'OPERADOR');
  const document = await db.documentoSolicitud.findUniqueOrThrow({ where: { id: fixture.document } });
  assert.equal(document.solicitudId, application.id);
  for (const id of fixture.notices) {
    const notice = await db.notificacion.findUniqueOrThrow({ where: { id } });
    const data = JSON.parse(notice.datos);
    assert.equal(notice.usuarioId, owner.id); assert.equal(data.solicitudId, application.id);
    assert.equal(data.documentoId, document.id); assert.equal(data.tipo, 'comprobante_repetido');
  }
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.22.96' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { synthetic: true, production: false, before: { failed: 4, passed: 2 },
    after: { passed: 6 }, exactTargets: 4, capClosed: true, emailAttempts: 0, emailsSent: 0,
    pushEnabled: false, manualSha256: digest(manual) };
  writeFileSync(path.join(out, 'audit.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
