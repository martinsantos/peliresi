import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'payment_identity_20261020');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const tables = ['documento', 'documentoSolicitud', 'solicitudInscripcion', 'pagoTEF', 'registroPagoComprobante', 'clavePagoComprobante', 'eventoPagoComprobante'];
const sql = readFileSync(path.join(root, 'backend/prisma/migrations/20261020180000_payment_identity/migration.sql'), 'utf8');
const before: Record<string, string> = {}, checks: string[] = [];
try {
  assert.deepEqual(await db.$queryRawUnsafe('SELECT current_schema() AS name'), [{ name: 'payment_identity_20261020' }]);
  for (const table of tables) before[table] = sha(JSON.stringify(await db[table].findMany({ orderBy: { [table === 'clavePagoComprobante' ? 'clave' : 'id']: 'asc' } })));
  const marker = new Error('final migration rehearsal rollback');
  try {
    await db.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe('CREATE SCHEMA payment_identity_rehearsal');
      await tx.$executeRawUnsafe('SET LOCAL search_path TO payment_identity_rehearsal');
      await tx.$executeRawUnsafe('CREATE TABLE original_sentinel (id TEXT PRIMARY KEY)');
      await tx.$executeRawUnsafe("INSERT INTO original_sentinel VALUES ('ARTIFICIAL-PRESERVADO')");
      for (const statement of sql.split(';').map(text => text.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      assert.deepEqual(await tx.$queryRawUnsafe('SELECT * FROM original_sentinel'), [{ id: 'ARTIFICIAL-PRESERVADO' }]);
      assert.deepEqual(await tx.$queryRawUnsafe("SELECT indexname FROM pg_indexes WHERE schemaname='payment_identity_rehearsal' AND indexname='eventos_pago_comprobante_registroId_documentoId_sha256_acci_key'"), [{ indexname: 'eventos_pago_comprobante_registroId_documentoId_sha256_acci_key' }]);
      throw marker;
    }, { timeout: 15_000 });
    assert.fail('Rehearsal must roll back');
  } catch (error) { assert.equal(error, marker); }
  assert.deepEqual(await db.$queryRawUnsafe("SELECT nspname FROM pg_namespace WHERE nspname='payment_identity_rehearsal'"), []);
  checks.push('exact final migration SQL rehearsed and completely rolled back, original sentinel unchanged');
  // The first QA-only rehearsal had a PostgreSQL-truncated index name. Rename
  // that owned index only; no table, row, approval, or migration reset.
  const previous = await db.$queryRawUnsafe("SELECT to_regclass('payment_identity_20261020.\"eventos_pago_comprobante_registroId_documentoId_sha256_accion_k\"')::text AS name");
  if (previous[0].name) await db.$executeRawUnsafe('ALTER INDEX payment_identity_20261020."eventos_pago_comprobante_registroId_documentoId_sha256_accion_k" RENAME TO "eventos_pago_comprobante_registroId_documentoId_sha256_acci_key"');
  checks.push('owned QA index matches the final Prisma name; no other namespace or data changed');
  for (const table of tables) assert.equal(sha(JSON.stringify(await db[table].findMany({ orderBy: { [table === 'clavePagoComprobante' ? 'clave' : 'id']: 'asc' } }))), before[table], table);
  checks.push('all seven current QA document/payment tables retain their complete row hashes');
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'migration-final.json'), JSON.stringify({ at: new Date().toISOString(), migrationSha256: sha(sql), passed: checks.length, checks, production: false }, null, 2));
  console.log('Final payment migration: ' + checks.length + ' groups PASS');
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await db.$disconnect(); }
