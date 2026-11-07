// Apply the additive exception migration ONLY to the isolated preview database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const X = '/qa/excepcion-y-20261107/backend';
const pid = fs.readFileSync('/qa/alta-ocr-correcciones-20261106/relink-api.pid', 'utf8').trim();
const env = Object.fromEntries(fs.readFileSync('/proc/' + pid + '/environ', 'utf8').split('\0').filter(Boolean).map(kv => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]));
assert.match(env.DATABASE_URL, /127\.0\.0\.1:55441\/sitrep_ephemeral_qa_1a93\?schema=inspection_field_20261103/);
const { PrismaClient } = createRequire(X + '/package.json')('@prisma/client');
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const [where] = await db.$queryRaw`SELECT current_database() AS name, current_schema() AS schema`;
assert.deepEqual(where, { name: 'sitrep_ephemeral_qa_1a93', schema: 'inspection_field_20261103' });
const [{ exists }] = await db.$queryRaw`SELECT to_regclass('excepciones_corriente_generador') IS NOT NULL AS exists`;
if (exists) console.log('tabla ya existente; sin cambios');
else {
  const sql = fs.readFileSync(X + '/prisma/migrations/20261107120000_generator_current_exceptions/migration.sql', 'utf8');
  const statements = sql.split(/;\s*\n/).map(s => s.replace(/^--.*$/gm, '').trim()).filter(Boolean);
  await db.$transaction(statements.map(s => db.$executeRawUnsafe(s)));
  console.log('migración aplicada en preview:', statements.length, 'sentencias');
}
console.log('filas', await db.excepcionCorrienteGenerador.count());
await db.$disconnect();
