-- Additive and fail-closed: no inference/backfill for historical inactive accounts.
ALTER TABLE "usuarios" ADD COLUMN "motivoInactividad" TEXT;
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_motivo_inactividad_check"
  CHECK ("motivoInactividad" IS NULL OR "motivoInactividad" IN ('PENDIENTE_APROBACION', 'SUSPENDIDA'));
