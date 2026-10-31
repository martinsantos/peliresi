import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-opening-20261031';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'inspection-opening');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (file: string) => JSON.parse(readFileSync(path.join(out, file), 'utf8'));
const run = process.env.QA_OPENING_RUN || 'after-v3';
assert.match(run, /^after-v\d+$/);
const report = read(`browser-${run}.json`);
assert.equal(report.stats.unexpected, 0); assert.equal(report.stats.flaky, 0); assert.equal(report.stats.skipped, 2);
for (const proc of read('processes.json')) {
  const env = Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(entry => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(env.QA_COMPAT_BACKEND, 'inspection-opening');
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const browser = path.join(out, `browser-${run}`);
const dirs = readdirSync(browser, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => path.join(browser, entry.name));
const proofs = ['recovered.json', 'receipt-recovered.json'].flatMap(file => dirs.map(dir => path.join(dir, file))
  .filter(existsSync).map(filePath => ({ ...JSON.parse(readFileSync(filePath, 'utf8')), kind: file })));
assert.equal(proofs.length, 4);
assert.deepEqual(proofs.map(p => `${p.kind}:${p.surface}`).sort(), ['receipt-recovered.json:app', 'receipt-recovered.json:web-desktop', 'recovered.json:app', 'recovered.json:web-desktop']);
const suffix = process.env.QA_INTAKE_RUN || '';
assert.match(suffix, /^[a-z0-9-]*$/);
const intakeFixture = read(`intake-fixture${suffix ? '-' + suffix : ''}.json`);
const intakes = dirs.map(dir => path.join(dir, 'intake-recovered.json')).filter(existsSync).map(file => JSON.parse(readFileSync(file, 'utf8')));
assert.equal(intakes.length, 2); assert.deepEqual(intakes.map(p => p.surface).sort(), ['app', 'web-desktop']);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const inspector = await db.usuario.findUniqueOrThrow({ where: { email: 'inspector@night-qa.invalid' }, select: { id: true } });
  for (const proof of proofs) {
    assert.equal(proof.synthetic, true);
    const inspection = await db.inspeccion.findUniqueOrThrow({ where: { id: proof.id }, include: { eventos: true } });
    assert.equal(inspection.inspectorId, inspector.id);
    assert.ok(inspection.observaciones.startsWith(proof.kind === 'recovered.json' ? 'QA apertura recuperable ' : 'QA comprobante local '));
    assert.equal(inspection.estado, 'BORRADOR');
    assert.ok(inspection.clienteId?.startsWith(inspector.id + ':'));
    const events = inspection.eventos.filter((event: any) => event.tipo === 'CREADA');
    assert.equal(events.length, 1);
    const notices = (await db.notificacion.findMany({ where: { datos: { contains: events[0].id } }, select: { usuarioId: true, datos: true } }))
      .filter((notice: any) => { try { return JSON.parse(notice.datos || '{}').eventoId === events[0].id; } catch { return false; } });
    assert.ok(notices.length >= 1);
    assert.equal(new Set(notices.map((notice: any) => notice.usuarioId)).size, notices.length);
  }
  for (const proof of intakes) {
    assert.equal(proof.synthetic, true);
    assert.equal(proof.sourceId, intakeFixture.cases[proof.surface].id);
    const source = await db.antecedenteFiscalizacion.findUniqueOrThrow({ where: { id: proof.sourceId } });
    assert.equal(source.estado, 'VINCULADA'); assert.equal(source.inspeccionId, proof.inspectionId);
    const inspection = await db.inspeccion.findUniqueOrThrow({ where: { id: proof.inspectionId }, include: { eventos: true } });
    assert.equal(inspection.generadorId, intakeFixture.cases[proof.surface].actorId);
    assert.equal(inspection.eventos.filter((event: any) => event.tipo === 'CREADA').length, 1);
    const linked = inspection.eventos.filter((event: any) => event.tipo === 'ANTECEDENTE_VINCULADO');
    assert.equal(linked.length, 1); assert.equal(linked[0].metadata.huellaEvidencia, source.huellaEvidencia);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(path.join(out, `audit-${run}.json`), JSON.stringify({ synthetic: true, production: false, recovered: proofs.length,
    intakesRecovered: intakes.length, oneCreationEventEach: true, noticesUnique: true, capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false }), { flag: 'wx', mode: 0o600 });
  console.log('Cuatro aperturas y dos antecedentes recuperados, sin eventos duplicados. Cero correos.');
} finally { await db.$disconnect(); }
