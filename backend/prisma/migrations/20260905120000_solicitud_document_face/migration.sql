-- Additive: preserve all historical documents. Never infer verified faces
-- from user-controlled filenames.
ALTER TABLE "documentos_solicitud" ADD COLUMN "cara" TEXT;
ALTER TABLE "documentos_solicitud" ADD CONSTRAINT "documentos_solicitud_cara_check"
  CHECK ("cara" IS NULL OR "cara" IN ('FRENTE', 'DORSO'));
