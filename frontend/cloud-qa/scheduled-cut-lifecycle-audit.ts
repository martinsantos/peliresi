/** Read-only checks of the artificial records and browser evidence for this cut. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026110101';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'scheduled-cut-62516a08');
assert.equal(process.env.GITHUB_SHA, '62516a08a3fe189d7d5612520d678162674f1b32');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const attempt = process.env.QA_BROWSER_ATTEMPT || 'initial';
assert.ok(['initial', 'candidate-mail-v3'].includes(attempt));
const read = (file: string) => JSON.parse(readFileSync(path.join(out, file), 'utf8'));
for (const file of ['manifest-complete.json', `proposal-e2e-${attempt}.json`]) {
  const report = read(file);
  assert.equal(report.stats.expected, 6, file);
  assert.equal(report.stats.unexpected, 0, file);
  assert.equal(report.stats.skipped, 0, file);
  assert.equal(report.stats.flaky, 0, file);
  assert.deepEqual(report.errors, [], file);
}
const receipts = read('receipts-verified.json');
assert.equal(receipts.results.length, 6);
assert.equal(receipts.emailAttempts, 0);
assert.equal(receipts.emailSent, 0);
for (const item of receipts.results) {
  assert.equal(item.declaration, 'Y1 21 kg');
  assert.equal(item.received, 'Y1 22 kg');
  assert.equal(item.treatedFinding, 'Y12 1 kg');
  assert.equal(item.original, 'OBSERVADA');
  assert.equal(item.rectification, 'APROBADA');
}
const processes = read('processes.json');
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.SITREP_PAUSE_BACKGROUND_JOBS, 'true');
  assert.equal(env.TRAINING_DATABASE_URL, '');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '', key);
}
const runtime = read('runtime-proof.json');
assert.match(runtime.backend, /\.qa-scheduled-pause-20261101\/dist\/index\.js$/);
const proofsDir = path.join(out, `proposal-e2e-${attempt}`);
const proofs = readdirSync(proofsDir, { withFileTypes: true }).filter(entry => entry.isDirectory())
  .map(entry => path.join(proofsDir, entry.name, 'proof.json'))
  .filter(existsSync)
  .map(file => JSON.parse(readFileSync(file, 'utf8')));
assert.equal(proofs.length, 6);
assert.deepEqual(proofs.map(p => `${p.surface}:${p.creator}`).sort(),
  ['app:generador', 'app:operador', 'app:transportista', 'web-desktop:generador', 'web-desktop:operador', 'web-desktop:transportista']);
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const olderMail = '/work/sitrep/backend/dist/services/notification-mail.service.js';
const currentMail = '/work/sitrep/.qa-scheduled-pause-20261101/dist/services/notification-mail.service.js';
const mailRendererMatchesCandidate = hash(olderMail) === hash(currentMail);

const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  for (const proof of proofs) {
    assert.equal(proof.approvals, 3); assert.equal(proof.noTripOrGps, true); assert.deepEqual(proof.errors, []);
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: proof.id },
      select: { numero: true, isDemoData: true, modalidad: true, estado: true, transportistaId: true, fechaRetiro: true } });
    assert.equal(manifest.numero, proof.numero); assert.equal(manifest.isDemoData, true);
    assert.equal(manifest.modalidad, 'IN_SITU'); assert.equal(manifest.estado, 'RECIBIDO');
    assert.ok(manifest.transportistaId); assert.equal(manifest.fechaRetiro, null);
    for (const tipo of ['FIRMA', 'APROBACION_TRANSPORTISTA', 'APROBACION_OPERADOR'])
      assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: proof.id, tipo } }), 1);
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: proof.id } }), 0);
    assert.equal(await db.tramoTransporte.count({ where: { manifiestoId: proof.id } }), 0);
  }
  const emailAttempts = await db.emailQueue.count({ where: { intentos: { gt: 0 } } });
  const emailSent = await db.emailQueue.count({ where: { sentAt: { not: null } } });
  assert.equal(emailAttempts, 0); assert.equal(emailSent, 0);
  const result = { productCommit: process.env.GITHUB_SHA, synthetic: true, production: false, attempt,
    ordinaryBrowserCases: 6, inSituBrowserCases: 6, certificatesVerified: receipts.results.length,
    emailAttempts, emailSent, pushEnabled: false, capClosed: true,
    scheduledJobsPaused: true, olderMailRendererMatchesCandidate: mailRendererMatchesCandidate,
    inSituMailRenderer: attempt === 'candidate-mail-v3' ? 'candidate' : 'older-build',
    preferredLinksOpenedByEachParty: attempt === 'candidate-mail-v3' };
  const name = attempt === 'initial' ? 'scheduled-cut-lifecycle-audit.json' : `scheduled-cut-lifecycle-audit-${attempt}.json`;
  writeFileSync(path.join(out, name), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
