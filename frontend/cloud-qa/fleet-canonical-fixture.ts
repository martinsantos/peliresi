import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-operational-ui-current2026102942');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const names = { origin: 'transportista', foreign: 'transportista2', generator: 'generador', operator: 'operador', admin: 'admin' };
  const users: Record<string, any> = {};
  for (const [role, name] of Object.entries(names)) {
    const user = await db.usuario.findUniqueOrThrow({ where: { email: `${name}@night-qa.invalid` },
      include: { generador: true, transportista: true, operador: true } });
    assert.equal(user.activo, true); assert.equal(user.email, `${name}@night-qa.invalid`);
    users[role] = user;
  }
  for (const actor of [users.origin.transportista, users.foreign.transportista, users.generator.generador, users.operator.operador]) {
    assert.ok(actor); assert.match(actor.razonSocial, /^QA /);
  }
  assert.notEqual(users.origin.transportista.id, users.foreign.transportista.id);
  const fixture = { password: 'OnlyLocal-NightQA-2026!',
    users: Object.fromEntries(Object.entries(users).map(([key, user]) => [key, { id: user.id, email: user.email }])),
    carriers: { origin: { id: users.origin.transportista.id }, foreign: { id: users.foreign.transportista.id } },
    browsers: { web: { generadorId: users.generator.generador.id, operadorId: users.operator.operador.id } } };
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'handoff-private.json'), JSON.stringify(fixture), { mode: 0o600 });
  console.log('Participantes artificiales existentes verificados para GPS de varias cargas.');
} finally { await db.$disconnect(); }
