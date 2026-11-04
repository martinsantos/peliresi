import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
await assertCloudDatabase();
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const url = new URL(process.env.DATABASE_URL!); assert.equal(url.searchParams.get('schema'), 'payment_identity_20261020');
url.searchParams.set('schema', 'public'); const original = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const sql = readFileSync(path.join(root, 'backend/prisma/migrations/20261020180000_payment_identity/migration.sql'), 'utf8');
const statements = sql.split(';').map(text => text.trim()).filter(Boolean);
const hash = (row: unknown) => createHash('sha256').update(JSON.stringify(row)).digest('hex');
const tables = ['documento', 'documentoSolicitud', 'solicitudInscripcion', 'pagoTEF'] as const;
const snapshot: Record<string, Array<{ id: string; hash: string }>> = {};
const checks: string[] = [];
try {
  assert.deepEqual(await db.$queryRawUnsafe('SELECT current_schema() AS name'), [{ name: 'payment_identity_20261020' }]);
  const originalHashes: Record<string, Array<{ id: string; hash: string }>> = {};
  for (const table of tables) originalHashes[table] = (await original[table].findMany({ orderBy: { id: 'asc' } })).map((row: { id: string }) => ({ id: row.id, hash: hash(row) }));
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'shared-qa-original-records.json'), JSON.stringify({ tables: originalHashes }, null, 2));
  for (const table of tables) snapshot[table] = (await db[table].findMany({ orderBy: { id: 'asc' } })).map((row: { id: string }) => ({ id: row.id, hash: hash(row) }));
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'original-records.json'), JSON.stringify({ at: new Date().toISOString(), tables: snapshot, emailQueue: await db.emailQueue.count() }, null, 2));
  const marker = new Error('rehearsal rollback');
  try {
    await db.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe('CREATE SCHEMA payment_identity_rehearsal');
      await tx.$executeRawUnsafe('SET LOCAL search_path TO payment_identity_rehearsal');
      await tx.$executeRawUnsafe('CREATE TABLE old_documents (id TEXT PRIMARY KEY, state TEXT)');
      await tx.$executeRawUnsafe("INSERT INTO old_documents VALUES ('original-artificial', 'APROBADO')");
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      assert.deepEqual(await tx.$queryRawUnsafe('SELECT * FROM old_documents'), [{ id: 'original-artificial', state: 'APROBADO' }]);
      const names = await tx.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='payment_identity_rehearsal' ORDER BY table_name");
      assert.equal(names.length, 4);
      const unique = await tx.$queryRawUnsafe("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='payment_identity_rehearsal'::regnamespace AND conrelid='claves_pago_comprobante'::regclass AND contype='p'");
      assert.deepEqual(unique, [{ definition: 'PRIMARY KEY (clave)' }]);
      throw marker;
    }, { timeout: 15_000 });
    assert.fail('Rehearsal cannot commit');
  } catch (error) { assert.equal(error, marker); }
  assert.deepEqual(await db.$queryRawUnsafe("SELECT nspname FROM pg_namespace WHERE nspname='payment_identity_rehearsal'"), []);
  checks.push('exact additive SQL and unique alias constraint rehearsed in a rolled-back namespace; original row unchanged');
  assert.deepEqual(await db.$queryRawUnsafe("SELECT to_regclass('payment_identity_20261020.registros_pago_comprobante')::text AS existing"), [{ existing: null }]);
  await db.$transaction(async (tx: any) => { for (const statement of statements) await tx.$executeRawUnsafe(statement); }, { timeout: 15_000 });
  checks.push('exact SQL applied once only to the isolated synthetic QA database, with no db push or reset');
  for (const table of tables) assert.deepEqual((await db[table].findMany({ orderBy: { id: 'asc' } })).map((row: { id: string }) => ({ id: row.id, hash: hash(row) })), snapshot[table]);
  checks.push('every original document, application and TEF payment retains its complete row hash');
  assert.equal(await db.registroPagoComprobante.count(), 0); assert.equal(await db.clavePagoComprobante.count(), 0);
  const password = await backendRequire('bcryptjs').hash('OnlyLocal-NightQA-2026!', 8);
  for (const [email, rol] of [['admin', 'ADMIN'], ['admin-generador', 'ADMIN_GENERADOR'], ['admin-operador', 'ADMIN_OPERADOR'], ['admin-transporte', 'ADMIN_TRANSPORTISTA'], ['inspector', 'ADMIN_GENERADOR']]) await db.usuario.create({ data: { email: email + '@night-qa.invalid', nombre: 'QA ' + email, password, rol, esInspector: email === 'inspector', activo: true, emailVerified: true } });
  checks.push('isolated schema and five artificial reviewer accounts; shared QA records preserved');
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'migration.json'), JSON.stringify({ at: new Date().toISOString(), migrationSha256: createHash('sha256').update(sql).digest('hex'), passed: checks.length, checks, sourceCounts: Object.fromEntries(tables.map(table => [table, snapshot[table].length])), production: false, capClosed: true }, null, 2));
  console.log('Payment identity migration: ' + checks.length + ' checks PASS; original rows preserved');
} catch (error) { console.error(JSON.stringify({ failed: true, error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; }
finally { await db.$disconnect(); await original.$disconnect(); }
