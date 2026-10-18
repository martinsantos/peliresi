import assert from 'node:assert/strict';

export function receiptMigrationStatements(sql: string): string[] {
  const statements = sql.replace(/^\s*--[^\n]*$/gm, '').split(';').map(value => value.trim().replace(/\s+/g, ' ')).filter(Boolean);
  assert.deepEqual(statements, [
    'ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "sha256" TEXT',
    'ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "analisis" JSONB',
    'ALTER TABLE "documentos_solicitud" ADD COLUMN IF NOT EXISTS "sha256" TEXT',
    'ALTER TABLE "documentos_solicitud" ADD COLUMN IF NOT EXISTS "analisis" JSONB',
    'CREATE INDEX IF NOT EXISTS "documentos_sha256_idx" ON "documentos"("sha256")',
    'CREATE INDEX IF NOT EXISTS "documentos_solicitud_sha256_idx" ON "documentos_solicitud"("sha256")',
    'CREATE TABLE IF NOT EXISTS "huellas_recibo" ( "sha256" TEXT PRIMARY KEY, "documentoId" TEXT NOT NULL, "origen" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP )',
  ], 'Only the reviewed additive receipt migration is permitted');
  return statements;
}
