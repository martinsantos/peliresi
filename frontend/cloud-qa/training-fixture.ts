import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { loadSeed } from './load-seed.ts';

await assertCloudDatabase();
const expected = 'postgresql://sitrep_training_role@127.0.0.1:55440/sitrep_night_qa_20260926?schema=sitrep_training';
assert.equal(process.env.TRAINING_DATABASE_URL, expected);
const { PrismaClient } = backendRequire('@prisma/client');
const operational = new PrismaClient();
let training: any;
try {
  execFileSync('/usr/lib/postgresql/16/bin/createuser', ['-h', '127.0.0.1', '-p', '55440', '-U', 'qa', '--no-superuser', '--no-createdb', '--no-createrole', 'sitrep_training_role']);
  await operational.$executeRawUnsafe('CREATE SCHEMA sitrep_training AUTHORIZATION sitrep_training_role');
  execFileSync(path.join(root, 'backend/node_modules/.bin/prisma'), ['db', 'push', '--skip-generate'], {
    cwd: path.join(root, 'backend'), env: { ...process.env, DATABASE_URL: expected }, stdio: 'inherit',
  });
  training = new PrismaClient({ datasources: { db: { url: expected } } });
  await assert.rejects(() => training.$queryRawUnsafe('SELECT id FROM public.usuarios LIMIT 1'), /permission denied/i);
  loadSeed(); // Register the existing TypeScript loader; never invoke the QA reset.
  const { seedTrainingCohort } = backendRequire(path.join(root, 'backend/scripts/seed-training-cohort.ts'));
  const before = await operational.usuario.count();
  const first = await seedTrainingCohort(training);
  const repeat = await seedTrainingCohort(training);
  assert.equal(await training.usuario.count(), 40);
  assert.equal(await training.manifiesto.count(), 35);
  assert.equal(await training.inspeccion.count(), 45);
  assert.equal(await training.intercambioInspeccion.count(), 90);
  assert.equal(await training.ticketSoporte.count(), 15);
  assert.equal(await training.trackingGPS.count(), 25);
  assert.equal(await operational.usuario.count(), before);
  assert.deepEqual(first.users, repeat.users);
  await assert.rejects(() => seedTrainingCohort(operational), /outside the training schema/);
  // Schema-only artifact for additive provisioning; never carries classroom or real rows.
  const schema = execFileSync('/usr/lib/postgresql/16/bin/pg_dump', ['-h', '127.0.0.1', '-p', '55440', '-U', 'qa',
    '-d', 'sitrep_night_qa_20260926', '--schema=sitrep_training', '--schema-only', '--no-owner', '--no-privileges'], { encoding: 'utf8' });
  assert.ok(schema.includes('CREATE SCHEMA sitrep_training;'));
  assert.ok(!/^(?:COPY |INSERT |DROP |CREATE DATABASE|ALTER ROLE)/m.test(schema));
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'training-schema.sql'), schema, { flag: 'wx' });
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'training-fixture.json'), JSON.stringify({
    ...first, database: 'sitrep_night_qa_20260926', externalDelivery: false,
    publicAccessDenied: true, repeatPreservedData: true, productionConnected: false,
  }, null, 2));
} finally { await training?.$disconnect(); await operational.$disconnect(); }
