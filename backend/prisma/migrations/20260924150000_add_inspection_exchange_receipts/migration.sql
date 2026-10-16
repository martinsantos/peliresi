ALTER TABLE "intercambios_inspeccion"
  ADD COLUMN "destinatario" "ParteIntercambioInspeccion",
  ADD COLUMN "puestaDisposicionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "vistaPorDestinatarioAt" TIMESTAMP(3);

UPDATE "intercambios_inspeccion"
SET "destinatario" = CASE
  WHEN "parte" = 'AUTORIDAD' THEN 'INSPECCIONADO'::"ParteIntercambioInspeccion"
  ELSE 'AUTORIDAD'::"ParteIntercambioInspeccion"
END
WHERE "destinatario" IS NULL;

-- Existing exchanges were made available when they were originally created.
UPDATE "intercambios_inspeccion"
SET "puestaDisposicionAt" = "createdAt";

ALTER TABLE "intercambios_inspeccion"
  ALTER COLUMN "destinatario" SET NOT NULL;

CREATE INDEX "intercambios_inspeccion_destinatario_vista_idx"
  ON "intercambios_inspeccion"("inspeccionId", "destinatario", "vistaPorDestinatarioAt");
