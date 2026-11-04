import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'inspection_intake_20261020');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const original = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/intake-fixture.json', 'utf8')), stamp = randomUUID().slice(0, 8);
try {
  const cases: Record<string, any> = {};
  for (const project of ['web-desktop', 'web-responsive', 'app']) {
    cases[project] = {};
    for (const name of ['finding', 'handoff']) {
      const source = await db.manifiesto.findUniqueOrThrow({ where: { id: original.cases[project][name].id }, include: { residuos: true } });
      cases[project][name] = await db.manifiesto.create({ data: { numero: `QA-HALLAZGO-${stamp}-${project}-${name}`, estado: name === 'handoff' ? 'EN_TRANSITO' : 'RECIBIDO',
        generadorId: source.generadorId, transportistaId: source.transportistaId, operadorId: source.operadorId, creadoPorId: source.creadoPorId, modalidad: 'FIJO', isDemoData: true,
        ...(name === 'handoff' ? { fechaRetiro: new Date() } : {}), residuos: { create: source.residuos.map((row: any) => ({ tipoResiduoId: row.tipoResiduoId, cantidad: row.cantidad, unidad: row.unidad, estado: row.estado })) } } });
    }
  }
  const result = JSON.stringify({ stamp, cases, synthetic: true, production: false }, null, 2);
  writeFileSync(process.env.QA_ARTIFACTS + '/intake-browser-fixture.json', result);
  writeFileSync(process.env.QA_ARTIFACTS + '/intake-browser-fixture-' + stamp + '.json', result);
  console.log('New browser cases appended; earlier attempts preserved.');
} finally { await db.$disconnect(); }
