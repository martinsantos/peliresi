-- Las evidencias no se eliminan: una corrección conserva el archivo original,
-- el responsable, la fecha y el motivo de anulación para mantener la cadena de custodia.
ALTER TABLE "evidencias_inspeccion"
  ADD COLUMN "anuladaAt" TIMESTAMP(3),
  ADD COLUMN "anuladaPorId" TEXT,
  ADD COLUMN "motivoAnulacion" TEXT;

ALTER TABLE "evidencias_inspeccion"
  ADD CONSTRAINT "evidencias_inspeccion_anuladaPorId_fkey"
  FOREIGN KEY ("anuladaPorId") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "evidencias_inspeccion_inspeccionId_anuladaAt_idx"
ON "evidencias_inspeccion"("inspeccionId", "anuladaAt");
