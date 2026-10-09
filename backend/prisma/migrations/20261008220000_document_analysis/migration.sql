-- Additive only. Existing document paths and original bytes remain untouched.
ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "sha256" TEXT;
ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "analisis" JSONB;
ALTER TABLE "documentos_solicitud" ADD COLUMN IF NOT EXISTS "sha256" TEXT;
ALTER TABLE "documentos_solicitud" ADD COLUMN IF NOT EXISTS "analisis" JSONB;
CREATE INDEX IF NOT EXISTS "documentos_sha256_idx" ON "documentos"("sha256");
CREATE INDEX IF NOT EXISTS "documentos_solicitud_sha256_idx" ON "documentos_solicitud"("sha256");
CREATE TABLE IF NOT EXISTS "huellas_recibo" (
  "sha256" TEXT PRIMARY KEY,
  "documentoId" TEXT NOT NULL,
  "origen" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
