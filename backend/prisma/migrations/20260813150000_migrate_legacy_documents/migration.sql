-- Legacy document bridge. This is deliberately additive and idempotent.
-- It links old Documento rows to the private document pipeline without
-- deleting or rewriting the historical row. The binary is copied by the
-- guarded backfill job after the QA operator verifies the storage root.
ALTER TABLE "documentos_regulatorios"
  ADD COLUMN IF NOT EXISTS "legacyDocumentoId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "documentos_regulatorios_legacyDocumentoId_key"
  ON "documentos_regulatorios"("legacyDocumentoId");

DO $$ BEGIN
  ALTER TABLE "documentos_regulatorios"
    ADD CONSTRAINT "documentos_regulatorios_legacyDocumentoId_fkey"
    FOREIGN KEY ("legacyDocumentoId") REFERENCES "documentos"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
