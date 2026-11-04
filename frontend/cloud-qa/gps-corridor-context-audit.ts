import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.SITREP_QA_RUN, 'gps-corridor-fix-20261030');
const out = '/work/sitrep/.qa-gps-corridor-fix-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const processes = read('processes.json');
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const source = read('source-comparison.json');
assert.equal(source.files, 1832); assert.equal(source.equal, true); assert.deepEqual(source.mismatches, []);
const browser = read('gps-corridor-context-browser.json');
assert.equal(browser.stats.expected, 2); assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0); assert.equal(browser.stats.flaky, 0); assert.deepEqual(browser.errors, []);
const proofs = readdirSync(path.join(out, 'gps-corridor-context-browser'), { withFileTypes: true }).filter(entry => entry.isDirectory())
  .map(entry => path.join(out, 'gps-corridor-context-browser', entry.name, 'corridor-browser-proof.json'))
  .filter(existsSync).map(file => JSON.parse(readFileSync(file, 'utf8')));
assert.deepEqual(proofs.map(proof => proof.surface).sort(), ['app', 'web-desktop']);
assert.ok(proofs.every(proof => proof.oldTextPreserved && proof.directAndConfiguredNotices && proof.bellUnclipped && proof.manifestLinks && !proof.errors.length));
const fixture = read('gps-corridor-context-fixture.json');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  for (const item of Object.values(fixture.cases) as Array<any>) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, isDemoData: true } });
    assert.equal(manifest.numero, item.numero); assert.equal(manifest.isDemoData, true);
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: item.id } }), 3);
    const [old, direct, configured] = await Promise.all([item.historicalId, item.directNoticeId, item.configuredNoticeId]
      .map(id => db.notificacion.findUniqueOrThrow({ where: { id } })));
    assert.equal(old.usuarioId, fixture.receiverId); assert.equal(old.mensaje, fixture.historicalText);
    assert.equal(direct.usuarioId, fixture.receiverId); assert.equal(direct.titulo, '⚠️ Anomalía GPS Detectada');
    assert.equal(configured.usuarioId, fixture.generatorId); assert.equal(configured.titulo, item.liveRule);
    for (const notice of [direct, configured]) {
      assert.match(notice.mensaje, /posiciones recibidas/i); assert.match(notice.mensaje, /hora de captura no disponible/i);
      assert.match(notice.mensaje, /no se compara una ruta vial autorizada/i); assert.match(notice.mensaje, /verific[aá].*transporte/i);
    }
  }
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [index, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.46.27.${90 + index}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(path.join(out, 'gps-corridor-context-audit.json'), JSON.stringify({ synthetic: true, production: false,
    sourceFiles: source.files, surfaces: proofs.map(proof => proof.surface), capClosed: true,
    emailAttempts: 0, emailsSent: 0, pushEnabled: false }, null, 2));
  console.log('Auditoría del corredor y del entorno de preview aprobada.');
} finally { await db.$disconnect(); }
