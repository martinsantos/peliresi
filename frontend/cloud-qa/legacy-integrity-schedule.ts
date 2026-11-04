import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.SITREP_QA_RUN, 'legacy-integrity-20261030');
const out = process.env.QA_ARTIFACTS!, fixture = JSON.parse(readFileSync(path.join(out, 'legacy-integrity-fixture.json'), 'utf8'));
assert.equal(fixture.synthetic, true); assert.equal(fixture.production, false);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const changes = [];
  for (const kind of ['mismatch', 'badEvidence', 'valid', 'missing', 'ordinary']) {
    const before = await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.cases[kind].id } });
    assert.equal(before.isDemoData, true); assert.equal(before.numero, fixture.cases[kind].numero);
    assert.equal(before.estado, ['missing', 'ordinary'].includes(kind) ? 'PENDIENTE_APROBACION' : 'APROBADO');
    const date = new Date('2099-12-25T15:00:00.000Z');
    await db.manifiesto.update({ where: { id: before.id }, data: { fechaEstimadaRetiro: date } });
    changes.push({ kind, before: before.fechaEstimadaRetiro, after: date });
  }
  writeFileSync(path.join(out, 'legacy-schedule-fixture.json'), JSON.stringify({ synthetic: true, changes }, null, 2));
  console.log('Cinco fechas artificiales preparadas para la vista de programados.');
} finally { await db.$disconnect(); }
