import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  const inspector = await db.usuario.findUniqueOrThrow({ where: { email: 'inspector@night-qa.invalid' } });
  const actors: Record<string, string> = {};
  for (const [login, relation] of [['generador', 'generador'], ['generador2', 'generador'], ['transportista', 'transportista'], ['operador', 'operador']]) {
    const user = await db.usuario.findUniqueOrThrow({ where: { email: `${login}@night-qa.invalid` }, include: { [relation]: true } });
    assert.ok(user.activo && user[relation]?.activo);
    actors[login] = user[relation].id;
  }
  const stamp = randomUUID().slice(0, 8);
  const now = Date.now();
  await db.inspeccion.createMany({ data: Array.from({ length: 110 }, (_, index) => ({
    numero: `QA-HISTORIAL-${stamp}-${String(index + 1).padStart(3, '0')}`,
    inspectorId: inspector.id, tipoActor: 'GENERADOR', generadorId: actors.generador2,
    estado: index < 80 ? 'EN_REVISION' : 'CERRADA_CONFORME',
    updatedAt: new Date(now - index * 1000),
    observaciones: 'Expediente artificial de QA; sin comunicaciones externas.',
  })) });
  const grouped = await db.inspeccion.groupBy({ by: ['estado'], where: { tipoActor: 'GENERADOR', generadorId: actors.generador2 }, _count: { estado: true } });
  const byState = Object.fromEntries(grouped.map((row: any) => [row.estado, row._count.estado]));
  const total = Object.values(byState).reduce((sum: number, count: any) => sum + Number(count), 0);
  const closed = ['CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA'].reduce((sum, state) => sum + Number(byState[state] || 0), 0);
  assert.ok(total >= 110 && closed >= 30);
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'inspection-panel-fixture.json'), JSON.stringify({ synthetic: true, externalDelivery: false, capClosed: true, database: 'sitrep_night_qa_20260926', actors, total, closed, open: total - closed, stamp }, null, 2));
  console.log(`Artificial inspection history ready: ${total} cases; emails and push disabled.`);
} finally { await db.$disconnect(); }
