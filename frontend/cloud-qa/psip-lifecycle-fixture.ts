import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-operational-ui-current2026103060');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  const inspector = await db.usuario.findUniqueOrThrow({ where: { email: 'inspector@night-qa.invalid' } });
  assert.equal(inspector.activo, true); assert.equal(inspector.esInspector, true);
  const actors: Record<string, any> = {};
  for (const [login, type, key] of [['generador2', 'GENERADOR', 'generador'], ['transportista', 'TRANSPORTISTA', 'transportista'], ['operador', 'OPERADOR', 'operador']]) {
    const user = await db.usuario.findUniqueOrThrow({ where: { email: `${login}@night-qa.invalid` }, include: { [key]: true } });
    assert.equal(user.activo, true); assert.ok(user[key]?.id); assert.match(user[key].razonSocial, /^QA /);
    actors[type] = { login, userId: user.id, relations: { tipoActor: type, [`${key}Id`]: user[key].id } };
  }
  const cases: Record<string, Record<string, string>> = {}, run = randomUUID().slice(0, 8);
  for (const surface of ['web-desktop', 'app']) {
    cases[surface] = {};
    for (const type of Object.keys(actors)) {
      const row = await db.inspeccion.create({ data: { numero: `QA-PSIP-LIFECYCLE-${run}-${surface}-${type}`,
        inspectorId: inspector.id, estado: 'NOTIFICADA', plazoRespuestaAt: new Date('2030-01-01T12:00:00Z'),
        observaciones: 'QA: expediente artificial para revisar requerimientos desde Avisos.', ...actors[type].relations }, select: { id: true } });
      cases[surface][type] = row.id;
    }
  }
  writeFileSync(process.env.QA_ARTIFACTS + '/psip-lifecycle-fixture.json', JSON.stringify({ synthetic: true, production: false, cases, actors }, null, 2), { mode: 0o600 });
  console.log('Seis expedientes artificiales preparados para el ida y vuelta PSIP.');
} finally { await db.$disconnect(); }
