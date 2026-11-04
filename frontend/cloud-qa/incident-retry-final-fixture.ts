import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-incident-retry-final-20261101';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'incident-retry-final');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, ''); assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'); const db = new PrismaClient();
try {
  const [generator, carrier, otherCarrier, operator, admin] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'transportista2@night-qa.invalid' }, include: { transportista: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
  ]);
  for (const user of [generator, carrier, otherCarrier, operator, admin]) assert.equal(user.activo, true);
  for (const actor of [generator.generador, carrier.transportista, otherCarrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
  const cases: Record<string, { id: string; numero: string }> = {}, run = randomUUID().slice(0, 8);
  for (const label of ['trip-web-desktop', 'trip-app', 'detail-web-desktop', 'detail-app', 'pause-web-desktop', 'pause-app', 'tabs-web-desktop', 'tabs-app', 'race']) {
    cases[label] = await db.manifiesto.create({ data: {
      numero: `QA-INCIDENT-FINAL-${run}-${label.toUpperCase()}`, isDemoData: true,
      generadorId: generator.generador.id, transportistaId: carrier.transportista.id,
      operadorId: operator.operador.id, creadoPorId: carrier.id, estado: 'EN_TRANSITO',
      modalidad: 'FIJO', fechaRetiro: new Date(),
      asignacionTransporte: { version: 1, transportistaId: carrier.transportista.id, vehiculo: null, chofer: null },
    }, select: { id: true, numero: true } });
  }
  writeFileSync(path.join(out, 'incident-fixture.json'), JSON.stringify({ synthetic: true, cases,
    users: { generator: generator.id, carrier: carrier.id, otherCarrier: otherCarrier.id, operator: operator.id, admin: admin.id } }), { flag: 'wx', mode: 0o600 });
  console.log('Nueve viajes artificiales preparados para incidente, pausa y concurrencia.');
} finally { await db.$disconnect(); }
