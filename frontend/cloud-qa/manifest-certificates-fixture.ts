import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire } from './safety.ts';

await assertCloudDatabase();
const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema')!;
assert.ok(['manifest_certificates_20261021'].includes(schema));
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), schema);
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const out = process.env.QA_ARTIFACTS!;

export async function protectedTables() {
  const tables = await db.$queryRawUnsafe("SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('information_schema',$1) AND table_schema NOT LIKE 'pg_%' ORDER BY 1,2", schema);
  const result: Record<string, unknown> = {};
  for (const row of tables) {
    assert.match(row.table_schema, /^[a-zA-Z_][a-zA-Z_0-9]*$/); assert.match(row.table_name, /^[a-zA-Z_][a-zA-Z_0-9]*$/);
    result[row.table_schema + '.' + row.table_name] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS hash FROM "${row.table_schema}"."${row.table_name}" t`);
  }
  return result;
}
try {
  if (process.argv[2] === 'prepare') {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT nspname FROM pg_namespace WHERE nspname=$1', schema), []);
    const before = await protectedTables();
    writeFileSync(out + '/protected-schemas-before.json', JSON.stringify(before, null, 2));
    await db.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
    console.log('New private schema allocated; prior QA tables fingerprinted: ' + Object.keys(before).length);
  } else if (process.argv[2] === 'seed') {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT current_schema() AS name'), [{ name: schema }]);
    assert.equal(await db.usuario.count(), 0);
    await import('./manifest-fixture.ts');
    assert.deepEqual(await protectedTables(), JSON.parse(readFileSync(out + '/protected-schemas-before.json', 'utf8')));
    console.log('Canonical synthetic actors, fleet and immutable legacy baseline ready.');
  } else if (process.argv[2] === 'attest-runtime') {
    const processes = JSON.parse(readFileSync(out + '/processes.json', 'utf8'));
    assert.deepEqual(processes.map((entry: { file: string }) => entry.file).sort(), ['runtime.ts', 'server.ts']);
    for (const process of processes) {
      const env = Object.fromEntries(readFileSync(`/proc/${process.pid}/environ`, 'utf8').split('\0').filter(Boolean).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
      assertCloudEnvironment(env);
      assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), schema);
      assert.equal(env.TRAINING_DATABASE_URL, '');
      assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
      assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
      assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
      assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
    }
    const raw = readFileSync(out + '/fixture.json', 'utf8'), fixture = JSON.parse(raw);
    assert.equal(fixture.database, 'sitrep_night_qa_20260926');
    assert.ok(fixture.externalDelivery === undefined || fixture.externalDelivery === false);
    writeFileSync(out + '/fixture-before-attestation.json', raw, { flag: 'wx' });
    writeFileSync(out + '/fixture.json', JSON.stringify({ ...fixture, externalDelivery: false, capClosed: true }));
    writeFileSync(out + '/fixture-runtime-attestation.json', JSON.stringify({ at: new Date().toISOString(), processesVerified: processes.length, schema, externalDelivery: false, capClosed: true, databaseMutations: 0 }));
    console.log('Actual runtime gates verified; only fixture metadata completed, no database mutation.');
  } else if (process.argv[2] === 'audit-protected') {
    const before = JSON.parse(readFileSync(out + '/protected-schemas-before.json', 'utf8'));
    assert.deepEqual(await protectedTables(), before);
    console.log('All prior QA table fingerprints unchanged: ' + Object.keys(before).length);
  } else throw new Error('Unknown fixture phase');
} finally { await db.$disconnect(); }
