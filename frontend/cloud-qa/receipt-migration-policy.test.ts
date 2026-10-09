import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { receiptMigrationStatements } from './receipt-migration-policy.ts';

const sql = readFileSync(new URL('../../backend/prisma/migrations/20261008220000_document_analysis/migration.sql', import.meta.url), 'utf8');
test('accepts the exact seven additive statements, including its source comment', () => {
  assert.equal(receiptMigrationStatements(sql).length, 7);
});
test('rejects data deletion, other tables and extra statements', () => {
  for (const extra of ['DELETE FROM "documentos";', 'DROP TABLE "usuarios";', 'TRUNCATE "documentos";', 'UPDATE "documentos" SET "path" = NULL;']) {
    assert.throws(() => receiptMigrationStatements(sql + extra));
  }
});
test('rejects weakening uniqueness or changing column types', () => {
  assert.throws(() => receiptMigrationStatements(sql.replace('TEXT PRIMARY KEY', 'TEXT')));
  assert.throws(() => receiptMigrationStatements(sql.replace('"analisis" JSONB', '"analisis" TEXT')));
});
test('formatting does not weaken the immutable statement whitelist', () => {
  assert.equal(receiptMigrationStatements(sql.replaceAll(' TEXT', '\n TEXT')).length, 7);
  assert.throws(() => receiptMigrationStatements(sql.replace('"huellas_recibo"', '"usuarios"')));
});
