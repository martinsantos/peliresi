import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const schema = 'actor_onboarding_20261020';
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
    await db.$executeRawUnsafe('CREATE SCHEMA actor_onboarding_20261020');
    console.log('New private schema allocated; prior QA tables fingerprinted: ' + Object.keys(before).length);
  } else if (process.argv[2] === 'seed') {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT current_schema() AS name'), [{ name: schema }]);
    assert.equal(await db.usuario.count(), 0);
    const password = await backendRequire('bcryptjs').hash('OnlyLocal-NightQA-2026!', 8), users: Record<string, string> = {};
    for (const [key, rol] of [['admin','ADMIN'], ['admin-generador','ADMIN_GENERADOR'], ['admin-operador','ADMIN_OPERADOR'], ['admin-transporte','ADMIN_TRANSPORTISTA']]) {
      const user = await db.usuario.create({ data: { email: key + '@night-qa.invalid', nombre: 'QA ' + key, password, rol, activo: true, emailVerified: true, notifEmail: false } });
      users[key] = user.id;
    }
    assert.deepEqual(await protectedTables(), JSON.parse(readFileSync(out + '/protected-schemas-before.json', 'utf8')));
    writeFileSync(out + '/fixture.json', JSON.stringify({ users, synthetic: true, schema }));
    console.log('Four artificial reviewing accounts; all prior QA rows unchanged.');
  } else if (process.argv[2] === 'audit-protected') {
    const before = JSON.parse(readFileSync(out + '/protected-schemas-before.json', 'utf8'));
    assert.deepEqual(await protectedTables(), before);
    console.log('All prior QA table fingerprints unchanged: ' + Object.keys(before).length);
  } else throw new Error('Unknown fixture phase');
} finally { await db.$disconnect(); }
