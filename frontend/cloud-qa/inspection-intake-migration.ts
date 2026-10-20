import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
await assertCloudDatabase();
const schema = 'inspection_intake_20261020';
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), schema);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const sql = readFileSync(root + '/backend/prisma/migrations/20261020210000_inspection_intake/migration.sql', 'utf8');
const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function protectedSchemas() {
  const result = {} as Record<string, unknown>;
  for (const protectedSchema of ['public', 'payment_identity_20261020']) {
    const tables = await db.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY table_name", protectedSchema);
    for (const { table_name: table } of tables) {
      assert.match(table, /^[a-zA-Z_][a-zA-Z_0-9]*$/);
      result[protectedSchema + '.' + table] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS hash FROM "${protectedSchema}"."${table}" t`);
    }
  }
  return result;
}
try {
  if (process.argv[2] === 'prepare') {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT nspname FROM pg_namespace WHERE nspname=$1', schema), []);
    writeFileSync(process.env.QA_ARTIFACTS + '/protected-schemas-before.json', JSON.stringify(await protectedSchemas(), null, 2));
    await db.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
    console.log('Fresh private QA schema allocated; all public/prior QA tables fingerprinted.');
  } else {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT current_schema() AS name'), [{ name: schema }]);
    const legacyId = randomUUID();
    await db.$executeRawUnsafe('INSERT INTO adendas_manifiesto (id,"manifiestoId","creadoPorId","huellaSolicitud",declaracion,residuos,motivo,revisiones,"updatedAt") VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::jsonb,NOW())', legacyId, 'QA-HISTORICAL-NOT-A-REAL-MANIFEST', 'QA-HISTORICAL-AUTHOR', 'unchanged-hash', JSON.stringify({ numero: 'QA-HISTORICAL', residuos: [] }), '[]', 'Artificial historical preservation', '[]');
    const before = (await db.$queryRawUnsafe('SELECT row_to_json(t) AS row FROM adendas_manifiesto t WHERE id=$1', legacyId))[0].row;
    const rollback = new Error('rehearsal rollback');
    try {
      await db.$transaction(async (tx: any) => {
        for (const statement of statements) await tx.$executeRawUnsafe(statement);
        assert.equal((await tx.$queryRawUnsafe('SELECT "informeHallazgo" FROM adendas_manifiesto WHERE id=$1', legacyId))[0].informeHallazgo, null);
        throw rollback;
      });
    } catch (error) { assert.equal(error, rollback); }
    assert.equal((await db.$queryRawUnsafe("SELECT COUNT(*)::int AS count FROM information_schema.columns WHERE table_schema=$1 AND table_name='adendas_manifiesto' AND column_name='informeHallazgo'", schema))[0].count, 0);
    await db.$transaction(async (tx: any) => { for (const statement of statements) await tx.$executeRawUnsafe(statement); });
    const after = (await db.$queryRawUnsafe('SELECT row_to_json(t) AS row FROM adendas_manifiesto t WHERE id=$1', legacyId))[0].row;
    const { informeHallazgo, ...original } = after;
    assert.equal(informeHallazgo, null); assert.deepEqual(original, before);
    const protectedBefore = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/protected-schemas-before.json', 'utf8'));
    assert.deepEqual(await protectedSchemas(), protectedBefore);
    const password = await backendRequire('bcryptjs').hash('OnlyLocal-NightQA-2026!', 8), users: Record<string, string> = {};
    for (const [key, rol, esInspector] of [['admin', 'ADMIN', false], ['admin-generador', 'ADMIN_GENERADOR', false], ['admin-operador', 'ADMIN_OPERADOR', false], ['admin-transporte', 'ADMIN_TRANSPORTISTA', false], ['inspector', 'GENERADOR', true]]) {
      const user = await db.usuario.create({ data: { email: key + '@night-qa.invalid', nombre: 'QA ' + key, password, rol, esInspector, activo: true, emailVerified: true, notifEmail: false } }); users[String(key)] = user.id;
    }
    writeFileSync(process.env.QA_ARTIFACTS + '/fixture.json', JSON.stringify({ users, synthetic: true }));
    writeFileSync(process.env.QA_ARTIFACTS + '/migration.json', JSON.stringify({ passed: 4, legacyId, legacyHash: hash(before), migrationSha256: createHash('sha256').update(sql).digest('hex'), checks: ['rolled-back exact migration', 'legacy NULL finding and all columns preserved', 'all protected QA schema rows unchanged', 'only new private schema migrated'], production: false }, null, 2));
    console.log('Migration: 4 groups PASS, exact SQL and rollback, prior history preserved.');
  }
} finally { await db.$disconnect(); }
