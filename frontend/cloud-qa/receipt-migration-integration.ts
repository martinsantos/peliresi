import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { receiptMigrationStatements } from './receipt-migration-policy.ts';

// Real PostgreSQL rehearsal before db push; no production copy or product edits.
// The entire disposable namespace is rolled back, including its synthetic rows.
await assertCloudDatabase();
const sql = await readFile(path.join(root, 'backend/prisma/migrations/20261008220000_document_analysis/migration.sql'), 'utf8');
const statements = receiptMigrationStatements(sql);
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const checks: string[] = [];
const rollback = new Error('successful receipt rehearsal: rollback synthetic namespace');
let failure: string | undefined;
try {
  try {
    await db.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
      await tx.$executeRawUnsafe('CREATE SCHEMA receipt_migration_qa');
      await tx.$executeRawUnsafe('SET LOCAL search_path TO receipt_migration_qa');
      for (const table of ['documentos', 'documentos_solicitud']) {
        await tx.$executeRawUnsafe(`CREATE TABLE "${table}" ("id" TEXT PRIMARY KEY, "path" TEXT NOT NULL, "estado" TEXT NOT NULL)`);
        await tx.$executeRawUnsafe(`INSERT INTO "${table}" VALUES ('original', '/retained/synthetic-original.pdf', 'APROBADO')`);
      }
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      const columns = await tx.$queryRawUnsafe("SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='receipt_migration_qa' AND table_name IN ('documentos','documentos_solicitud') AND column_name IN ('sha256','analisis') ORDER BY table_name,column_name");
      assert.deepEqual(columns, ['documentos', 'documentos_solicitud'].flatMap(table_name => [
        { table_name, column_name: 'analisis', data_type: 'jsonb', is_nullable: 'YES' },
        { table_name, column_name: 'sha256', data_type: 'text', is_nullable: 'YES' },
      ]));
      checks.push('exact SQL creates the four nullable columns without rewriting original document metadata');
      const indexes = await tx.$queryRawUnsafe("SELECT indexname FROM pg_indexes WHERE schemaname='receipt_migration_qa' AND indexname IN ('documentos_sha256_idx','documentos_solicitud_sha256_idx') ORDER BY indexname");
      assert.deepEqual(indexes, [{ indexname: 'documentos_sha256_idx' }, { indexname: 'documentos_solicitud_sha256_idx' }]);
      checks.push('both reviewed SHA indexes exist');
      await tx.$executeRawUnsafe("INSERT INTO huellas_recibo (sha256,\"documentoId\",origen) VALUES ('synthetic-sha','original','SOLICITUD')");
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      for (const table of ['documentos', 'documentos_solicitud']) {
        assert.deepEqual(await tx.$queryRawUnsafe(`SELECT * FROM "${table}"`), [{ id: 'original', path: '/retained/synthetic-original.pdf', estado: 'APROBADO', sha256: null, analisis: null }]);
      }
      assert.equal((await tx.$queryRawUnsafe('SELECT * FROM huellas_recibo')).length, 1);
      const primary = await tx.$queryRawUnsafe("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='receipt_migration_qa'::regnamespace AND conrelid='huellas_recibo'::regclass AND contype='p'");
      assert.deepEqual(primary, [{ definition: 'PRIMARY KEY (sha256)' }]);
      checks.push('a second application is idempotent and retains the unique receipt fingerprint');
      throw rollback;
    }, { timeout: 20000 });
    assert.fail('The rehearsal must never commit');
  } catch (error) { assert.equal(error, rollback); }
  assert.deepEqual(await db.$queryRawUnsafe("SELECT nspname FROM pg_namespace WHERE nspname='receipt_migration_qa'"), []);
  checks.push('rollback removes the entire synthetic rehearsal namespace');
} catch (error) {
  failure = error instanceof Error ? error.message : String(error); throw error;
} finally {
  await db.$disconnect();
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'receipt-migration.json'), JSON.stringify({
    commit: process.env.GITHUB_SHA, migrationSha256: createHash('sha256').update(sql).digest('hex'),
    passed: checks.length, failed: failure ? 1 : 0, checks, failure,
    database: 'sitrep_night_qa_20260926', port: 55440, exactSql: true,
    committed: false, productionDataWritten: false, externalProvidersDisabled: true,
  }, null, 2));
}
assert.equal(checks.length, 4);
