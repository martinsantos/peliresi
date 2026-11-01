/** Prepare only artificial cases for the final combined preview regression. */
import assert from 'node:assert/strict';
import { constants, readFileSync, writeFileSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = process.env.QA_ARTIFACTS!;
assert.ok(['/work/sitrep/.qa-operational-ui-current2026103070', '/work/sitrep/.qa-operational-ui-current2026103080',
  '/work/sitrep/.qa-operational-ui-current2026103090', '/work/sitrep/.qa-operational-ui-current2026103110',
  '/work/sitrep/.qa-operational-ui-current2026103111', '/work/sitrep/.qa-operational-ui-current2026103112',
  '/work/sitrep/.qa-operational-ui-current2026103113', '/work/sitrep/.qa-operational-ui-current2026103114',
  '/work/sitrep/.qa-operational-ui-current2026110102', '/work/sitrep/.qa-operational-ui-current2026110103'].includes(out));
assert.equal(process.env.UPLOADS_DIR, path.join(out, 'uploads'));
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const writeNew = (name: string, value: unknown) => writeFileSync(path.join(out, name), JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
try {
  const names = { origin: 'transportista', foreign: 'transportista2', generator: 'generador', operator: 'operador', admin: 'admin' };
  const users: Record<string, any> = {};
  for (const [role, name] of Object.entries(names)) {
    const user = await db.usuario.findUniqueOrThrow({ where: { email: `${name}@night-qa.invalid` },
      include: { generador: true, transportista: true, operador: true } });
    assert.equal(user.activo, true); assert.equal(user.email, `${name}@night-qa.invalid`); users[role] = user;
  }
  for (const actor of [users.origin.transportista, users.foreign.transportista, users.generator.generador, users.operator.operador]) {
    assert.ok(actor); assert.match(actor.razonSocial, /^QA /);
  }
  assert.notEqual(users.origin.transportista.id, users.foreign.transportista.id);
  writeNew('handoff-private.json', { password: 'OnlyLocal-NightQA-2026!',
    users: Object.fromEntries(Object.entries(users).map(([key, user]) => [key, { id: user.id, email: user.email }])),
    carriers: { origin: { id: users.origin.transportista.id }, foreign: { id: users.foreign.transportista.id } },
    browsers: { web: { generadorId: users.generator.generador.id, operadorId: users.operator.operador.id } } });

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
  writeNew('psip-lifecycle-fixture.json', { synthetic: true, production: false, cases, actors });

  const pdfFixture = JSON.parse(readFileSync('/work/sitrep/.qa-inspection-pdf-extent-20261030/browser-fixture.json', 'utf8'));
  const pdfCase = await db.inspeccion.findUniqueOrThrow({ where: { id: pdfFixture.inspection.id }, select: { numero: true } });
  assert.equal(pdfFixture.synthetic, true); assert.match(pdfCase.numero, /^QA-ACTA-EXTENSA-/);
  assert.equal(pdfCase.numero, pdfFixture.inspection.numero); writeNew('browser-fixture.json', pdfFixture);

  const photo = JSON.parse(readFileSync('/work/sitrep/.qa-inspection-evidence-focus-20261030/fixture.json', 'utf8'));
  assert.equal(photo.synthetic, true); assert.match(photo.inspection.numero, /^QA-EVIDENCIA-/);
  const evidence = await db.evidenciaInspeccion.findUniqueOrThrow({ where: { id: photo.evidence.id } });
  assert.equal(evidence.inspeccionId, photo.inspection.id); assert.equal(evidence.descripcion, 'Imagen artificial de revisión');
  const expectedKey = `inspecciones/${photo.inspection.id}/qa-foto.png`;
  assert.equal(evidence.storageKey, expectedKey);
  const input = path.join('/work/sitrep/.qa-inspection-evidence-focus-20261030/uploads', expectedKey);
  assert.equal(createHash('sha256').update(readFileSync(input)).digest('hex'), evidence.sha256);
  const target = path.join(process.env.UPLOADS_DIR!, expectedKey);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await copyFile(input, target, constants.COPYFILE_EXCL); writeNew('fixture.json', photo);
  console.log('Casos artificiales y evidencia existentes verificados; seis expedientes PSIP preparados.');
} finally { await db.$disconnect(); }
