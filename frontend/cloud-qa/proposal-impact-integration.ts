import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.SITREP_QA_RUN, 'proposal-impact-20261030');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
for (const key of externalKeys) assert.equal(process.env[key], '');
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-legacy-integrity-20261030/legacy-integrity-fixture.json', 'utf8'));
assert.equal(fixture.synthetic, true); assert.equal(fixture.production, false);
assert.match(fixture.prefix, /^QA-LEGACY-[A-F0-9]{8}$/);
const { PrismaClient } = backendRequire('@prisma/client');
const { auditProposalImpact } = backendRequire('./dist/services/proposalImpactAudit.service.js');
const db = new PrismaClient();
try {
  const records = await db.manifiesto.findMany({ where: { numero: { startsWith: fixture.prefix } },
    select: { id: true, numero: true, isDemoData: true, estado: true, observaciones: true, updatedAt: true } });
  assert.equal(records.length, 7); assert.ok(records.every((record: any) => record.isDemoData));
  const valid = records.find((record: any) => record.id === fixture.cases.valid.id);
  assert.ok(valid); assert.equal(valid.estado, 'APROBADO');
  const report = await auditProposalImpact(db, { kind: 'synthetic', prefix: fixture.prefix }, 2);
  assert.equal(report.total, 7);
  assert.deepEqual(report.lectura, { soloLectura: true, aislamiento: 'repeatable read', alcance: 'ARTIFICIAL' });
  const reasons: Record<string, number> = {};
  for (const row of report.categoriasExcluyentes) reasons[row.causa] = (reasons[row.causa] || 0) + row.cantidad;
  assert.deepEqual(reasons, { DECISION_INVALIDA: 1, PARTES_O_MODALIDAD_DISTINTAS: 2, SIN_OBSERVACION_ESTRUCTURAL: 1,
    FALTAN_APROBACIONES: 1, MARCADOR_INVALIDO: 1, SIN_PROPUESTA: 1 });
  assert.equal(report.categoriasExcluyentes.reduce((sum: number, row: any) => sum + row.cantidad, 0), report.total);
  assert.deepEqual(report.coherenciaEstado, { aprobadoSinAlgunEventoDeAprobacion: 0, pendienteConTresDecisiones: 0, borradorConMarcador: 0 });
  assert.equal(report.cronologia.listosEvaluados, 1);
  const text = JSON.stringify(report);
  assert.ok(!text.includes(fixture.prefix));
  for (const record of records) { assert.ok(!text.includes(record.id)); assert.ok(!text.includes(record.numero)); }
  // Demonstrate that PostgreSQL refuses a write in a read-only transaction.
  // Even a misconfiguration that allowed it would roll back due to the thrown sentinel.
  let blocked = false;
  try {
    await db.$transaction(async (tx: any) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.manifiesto.update({ where: { id: valid.id }, data: { observaciones: 'QA-only read-only transaction probe' } });
      throw new Error('WRITE_ALLOWED_AND_ROLLED_BACK');
    });
  } catch (error) {
    assert.ok(!String(error).includes('WRITE_ALLOWED_AND_ROLLED_BACK'));
    assert.match(String(error), /read.only|solo lectura|25006/i); blocked = true;
  }
  assert.equal(blocked, true);
  const after = await db.manifiesto.findUniqueOrThrow({ where: { id: valid.id }, select: { observaciones: true, updatedAt: true } });
  assert.equal(after.observaciones, valid.observaciones); assert.equal(after.updatedAt.getTime(), valid.updatedAt.getTime());

  // Change one independent synthetic row after the first page. The report
  // must still contain the complete snapshot taken at the start of its scan.
  const original = await db.manifiesto.findUniqueOrThrow({ where: { id: valid.id },
    include: { generador: true, transportista: true, operador: true } });
  for (const actor of [original.generador, original.transportista, original.operador]) assert.match(actor.razonSocial, /^QA /);
  const prefix = `QA-SNAPSHOT-${randomUUID().slice(0, 8).toUpperCase()}`, created: string[] = [];
  const reader = new PrismaClient();
  let changedDuringScan = false, liveCount = -1, snapshotTotal = -1;
  try {
    for (let i = 0; i < 3; i++) {
      const row = await db.manifiesto.create({ data: { numero: `${prefix}-${i}`, estado: 'PENDIENTE_APROBACION',
        modalidad: 'FIJO', isDemoData: true, generadorId: original.generadorId, transportistaId: original.transportistaId,
        operadorId: original.operadorId, creadoPorId: original.creadoPorId }, select: { id: true } });
      created.push(row.id);
    }
    const target = await db.manifiesto.findFirstOrThrow({ where: { id: { in: created }, isDemoData: true, numero: { startsWith: prefix } }, orderBy: { id: 'desc' } });
    reader.$use(async (params: any, next: (params: any) => Promise<unknown>) => {
      const result = await next(params);
      if (!changedDuringScan && params.model === 'Manifiesto' && params.action === 'findMany') {
        const update = await db.manifiesto.updateMany({ where: { id: target.id, isDemoData: true, numero: { startsWith: prefix } }, data: { estado: 'CANCELADO' } });
        assert.equal(update.count, 1); changedDuringScan = true;
        liveCount = await db.manifiesto.count({ where: { id: { in: created }, estado: 'PENDIENTE_APROBACION' } });
      }
      return result;
    });
    const snapshot = await auditProposalImpact(reader, { kind: 'synthetic', prefix }, 1);
    snapshotTotal = snapshot.total;
    assert.equal(changedDuringScan, true); assert.equal(liveCount, 2); assert.equal(snapshotTotal, 3);
    assert.deepEqual(snapshot.categoriasExcluyentes.map((row: any) => [row.estado, row.causa, row.cantidad]),
      [['PENDIENTE_APROBACION', 'SIN_PROPUESTA', 3]]);
  } finally {
    await reader.$disconnect();
    const removed = await db.manifiesto.deleteMany({ where: { id: { in: created }, isDemoData: true, numero: { startsWith: prefix } } });
    assert.equal(removed.count, created.length);
  }
  // Exercise the manual operational command only against this isolated,
  // artificial database. It must reject a mistaken server identity.
  const env = { ...process.env, SITREP_AUDIT_DATABASE_URL: process.env.DATABASE_URL,
    SITREP_AUDIT_EXPECTED_DATABASE: 'sitrep_night_qa_20260926', SITREP_AUDIT_EXPECTED_ADDRESS: '127.0.0.1',
    SITREP_AUDIT_EXPECTED_PORT: '55440', SITREP_AUDIT_EXPECTED_SCHEMA: 'proposal_operations_20261021' };
  const invoke = (overrides: Record<string, string>) => spawnSync(process.execPath,
    ['/work/sitrep/backend/dist/scripts/auditProposalImpact.js', '--operativo'],
    { env: { ...env, ...overrides }, encoding: 'utf8', timeout: 100000, maxBuffer: 1024 * 1024 });
  const wrong = invoke({ SITREP_AUDIT_EXPECTED_PORT: '55441' });
  assert.equal(wrong.status, 1); assert.equal(wrong.stdout, ''); assert.match(wrong.stderr, /No se completó la auditoría/);
  assert.ok(!wrong.stderr.includes(process.env.DATABASE_URL!));
  const operational = invoke({}); assert.equal(operational.status, 0, operational.stderr);
  const operationalReport = JSON.parse(operational.stdout);
  const expectedOperational = await db.manifiesto.count({ where: { isDemoData: false,
    estado: { in: ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO'] } } });
  assert.equal(operationalReport.total, expectedOperational);
  assert.equal(operationalReport.lectura.alcance, 'OPERATIVO');
  assert.ok(!operational.stdout.includes(process.env.DATABASE_URL!));
  for (const record of records) { assert.ok(!operational.stdout.includes(record.id)); assert.ok(!operational.stdout.includes(record.numero)); }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const output = { synthetic: true, production: false, pagesize: 2, cases: 7, anonymousOnly: true,
    writeBlocked: true, recordUnchanged: true, concurrentSnapshot: { snapshotTotal, liveCount, changedDuringScan },
    temporarySyntheticRowsRemoved: created.length, operationalCliTestedOnlyOnSyntheticDatabase: true,
    expectedIdentityRequired: true, incorrectIdentityRejected: true, operationalRecordCountVerified: true,
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, report };
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'proposal-impact-proof.json'), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output));
} finally { await db.$disconnect(); }
