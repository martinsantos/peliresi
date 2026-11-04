import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-opening-20261031';
const suffix = process.env.QA_INTAKE_RUN || '';
assert.match(suffix, /^[a-z0-9-]*$/);
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, ''); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const user = await db.usuario.findUniqueOrThrow({ where: { email: 'generador2@night-qa.invalid' }, include: { generador: true } });
  const inspector = await db.usuario.findUniqueOrThrow({ where: { email: 'inspector@night-qa.invalid' } });
  assert.ok(user.generador && user.generador.razonSocial.startsWith('QA '));
  assert.equal(inspector.esInspector, true); assert.equal(inspector.activo, true);
  const cases: Record<string, { id: string; referencia: string; actorId: string }> = {};
  const run = randomUUID().slice(0, 8);
  for (const surface of ['web-desktop', 'app']) {
    const id = randomBytes(32).toString('hex'), referencia = `QA-OPEN-INTAKE-${run}-${surface}`;
    const evidencia = { motivo: 'Antecedente artificial de prueba; no acredita infracción.' };
    const huellaEvidencia = createHash('sha256').update(JSON.stringify(evidencia)).digest('hex');
    await db.antecedenteFiscalizacion.create({ data: { id, claveOrigen: 'QA:' + id, origen: 'INFORME_ADENDA', origenId: 'qa-' + id,
      referencia, tipoActor: 'GENERADOR', actorId: user.generador.id, actorNombre: user.generador.razonSocial,
      motivos: ['CANTIDAD_DIFERENTE'], evidencia, huellaEvidencia, creadoPorId: user.id, eventos: [] } });
    cases[surface] = { id, referencia, actorId: user.generador.id };
  }
  writeFileSync(path.join(out, `intake-fixture${suffix ? '-' + suffix : ''}.json`), JSON.stringify({ synthetic: true, inspectorId: inspector.id, cases }), { flag: 'wx', mode: 0o600 });
  console.log('Dos antecedentes artificiales preparados para web y app.');
} finally { await db.$disconnect(); }
