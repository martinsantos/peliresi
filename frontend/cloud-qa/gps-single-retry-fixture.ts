import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  const [generator, carrier, operator] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
  ]);
  for (const user of [generator, carrier, operator]) assert.equal(user.activo, true);
  assert.match(generator.generador.razonSocial, /^QA /);
  assert.match(carrier.transportista.razonSocial, /^QA /);
  assert.match(operator.operador.razonSocial, /^QA /);
  const run = randomUUID().slice(0, 8), cases: Record<string, { id: string; numero: string }> = {}, queueCases: Record<string, { id: string; numero: string }> = {};
  for (const surface of ['web-desktop', 'app']) {
    const numero = `QA-GPS-RETRY-${run}-${surface.toUpperCase()}`;
    const create = (number: string) => db.manifiesto.create({ data: {
      numero: number, generadorId: generator.generador.id, transportistaId: carrier.transportista.id,
      operadorId: operator.operador.id, creadoPorId: carrier.id, estado: 'EN_TRANSITO',
      modalidad: 'FIJO', fechaRetiro: new Date(), isDemoData: true,
      asignacionTransporte: { version: 1, transportistaId: carrier.transportista.id, vehiculo: null, chofer: null },
    }, select: { id: true, numero: true } });
    cases[surface] = await create(numero);
    queueCases[surface] = await create(`QA-GPS-QUEUE-${run}-${surface.toUpperCase()}`);
  }
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'single-gps-private.json'), JSON.stringify({ cases, queueCases }), { mode: 0o600 });
  console.log('Viajes artificiales aislados preparados para probar GPS y cola.');
} finally { await db.$disconnect(); }
