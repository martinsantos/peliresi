/** Compatibility proof on a new, empty cloud database only. Never drops data. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { loadSeed } from './load-seed.ts';

await assertCloudDatabase();
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const output = process.env.QA_ARTIFACTS!;
const work = path.join(process.env.RUNNER_TEMP!, 'manifest-legacy-schema');
await mkdir(work, { recursive: true });
let oldDb: InstanceType<typeof PrismaClient> | undefined;
try {
  const tables = await db.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  assert.equal(tables.length, 0, 'Requires a fresh empty QA database, never an existing installation');
  const schema = await readFile(path.join(root, 'backend/prisma/schema.prisma'), 'utf8');
  const field = /^[ \t]*asignacionTransporte[ \t]+Json\?[ \t]*\r?\n/m;
  assert.ok(field.test(schema));
  const legacySchema = schema.replace(field, '').replace(/model RegistroManifiestoExcepcional \{[\s\S]*?\n\}/, '')
    .replace('generator client {', `generator client {\n  output = "${work}/client"`);
  const schemaPath = path.join(work, 'schema.prisma');
  await writeFile(schemaPath, legacySchema);
  const prisma = backendRequire.resolve('prisma/build/index.js');
  for (const args of [['generate', '--schema', schemaPath], ['db', 'push', '--schema', schemaPath, '--skip-generate']]) {
    execFileSync(process.execPath, [prisma, ...args], { cwd: path.join(root, 'backend'), env: process.env, stdio: 'inherit', timeout: 120000 });
  }
  // The canonical seed creates users/catalogues, not manifests; these models
  // are identical before/after this single additive change.
  const fixture = await loadSeed().seedNightDatabase();
  const LegacyClient = backendRequire(path.join(work, 'client')).PrismaClient;
  oldDb = new LegacyClient();
  const data = { id: 'manifest-qa-pre-migration', numero: 'QA-PRE-MIGRATION', estado: 'TRATADO',
    generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista,
    operadorId: fixture.actors.operador, creadoPorId: fixture.users.admin, isDemoData: true,
    residuos: { create: [{ tipoResiduoId: fixture.wastes[0], cantidad: 8, unidad: 'kg', estado: 'SOLIDO' }] } };
  const before = await oldDb.manifiesto.create({ data, include: { residuos: true, eventos: true } });
  const migration = await readFile(path.join(root, 'backend/prisma/migrations/20261014120000_manifest_transport_assignment/migration.sql'), 'utf8');
  await db.$executeRawUnsafe(migration);
  const exceptionalMigration = await readFile(path.join(root, 'backend/prisma/migrations/20261014220000_manifest_exceptional/migration.sql'), 'utf8');
  for (const statement of exceptionalMigration.split(';').filter(s => s.trim())) await db.$executeRawUnsafe(statement);
  assert.equal(await db.registroManifiestoExcepcional.count(), 0);
  const after = await db.manifiesto.findUniqueOrThrow({ where: { id: data.id }, include: { residuos: true, eventos: true } });
  const { asignacionTransporte, ...historical } = after;
  assert.equal(asignacionTransporte, null);
  assert.deepEqual(historical, before, 'Old fields, dates, state, number, residues and events must remain unchanged');
  // Application rollback keeps the new column and its values. Old Prisma can
  // still read/write its original contract without erasing new snapshots.
  assert.deepEqual(await oldDb.manifiesto.findUniqueOrThrow({ where: { id: data.id }, include: { residuos: true, eventos: true } }), before);
  const snapshot = { version: 1, transportistaId: fixture.actors.transportista,
    vehiculo: { id: 'night-qa-vehicle-1', patente: 'QA0001', marca: 'QA', modelo: 'SINTETICO' }, chofer: null };
  const { residuos: _residues, ...scalars } = data;
  await db.manifiesto.create({ data: { ...scalars, id: 'manifest-qa-new-schema', numero: 'QA-NEW-SCHEMA', asignacionTransporte: snapshot } });
  await oldDb.manifiesto.update({ where: { id: 'manifest-qa-new-schema' }, data: { observaciones: 'QA write through previous client' } });
  assert.deepEqual((await db.manifiesto.findUniqueOrThrow({ where: { id: 'manifest-qa-new-schema' } })).asignacionTransporte, snapshot);
  await oldDb.manifiesto.create({ data: { ...scalars, id: 'manifest-qa-old-client', numero: 'QA-OLD-CLIENT' } });
  assert.equal((await db.manifiesto.findUniqueOrThrow({ where: { id: 'manifest-qa-old-client' } })).asignacionTransporte, null);
  await writeFile(path.join(output, 'manifest-migration.json'), JSON.stringify({ passed: true,
    additiveOnly: true, historicalUnchanged: true, oldClientReadsAndWrites: true, newSnapshotsPreserved: true,
    rollback: 'Application rollback retains nullable column and recorded snapshots; no destructive down migration',
    scope: 'Previous Prisma schema/client on synthetic DB; not a production migration or full previous-backend rollout' }, null, 2));
} finally { await oldDb?.$disconnect(); await db.$disconnect(); }
