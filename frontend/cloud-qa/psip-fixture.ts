import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  const inspector = await db.usuario.findUniqueOrThrow({ where: { email: 'inspector@night-qa.invalid' } });
  const stamp = randomUUID().slice(0, 8);
  let number = 0;
  async function create(estado: string, relations: Record<string, string | null> = { tipoActor: 'GENERADOR' }) {
    return db.inspeccion.create({ data: { numero: `QA-PSIP-${stamp}-${++number}`, inspectorId: inspector.id,
      estado, plazoRespuestaAt: new Date('2030-01-01T12:00:00Z'), observaciones: 'QA PSIP artificial; ninguna comunicación externa.', ...relations } });
  }
  const actors = {} as Record<string, any>;
  for (const [login, type, key] of [['generador2', 'GENERADOR', 'generador'], ['transportista', 'TRANSPORTISTA', 'transportista'], ['operador', 'OPERADOR', 'operador']]) {
    const user = await db.usuario.findUniqueOrThrow({ where: { email: `${login}@night-qa.invalid` }, include: { [key]: true } });
    assert.ok(user[key]?.id);
    actors[type] = { login, relations: { tipoActor: type, [`${key}Id`]: user[key].id } };
  }
  const cases = {} as Record<string, Record<string, string>>;
  for (const project of ['web-desktop', 'web-responsive', 'app']) {
    cases[project] = {};
    for (const type of Object.keys(actors)) cases[project][type] = (await create('NOTIFICADA', actors[type].relations)).id;
  }
  const paging = [] as string[];
  for (let index = 0; index < 32; index++) paging.push((await create(['NOTIFICADA', 'EN_DESCARGO', 'REQUIERE_SUBSANACION'][index % 3], actors.GENERADOR.relations)).id);
  const closed = await create('CERRADA_CONFORME', actors.GENERADOR.relations);
  const spontaneous = await create('EN_REVISION', { tipoActor: null });
  writeFileSync(process.env.QA_ARTIFACTS + '/psip-fixture.json', JSON.stringify({ synthetic: true, production: false, cases, actors, paging, closed: closed.id, spontaneous: spontaneous.id, prefix: `QA-PSIP-${stamp}-` }, null, 2));
  console.log('PSIP isolated synthetic fixture ready; CAP closed, delivery disabled.');
} finally { await db.$disconnect(); }
