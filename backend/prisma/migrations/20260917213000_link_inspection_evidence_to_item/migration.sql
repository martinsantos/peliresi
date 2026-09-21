ALTER TABLE "evidencias_inspeccion"
  ADD COLUMN "itemId" TEXT;

CREATE INDEX "evidencias_inspeccion_itemId_idx"
  ON "evidencias_inspeccion"("itemId");

ALTER TABLE "evidencias_inspeccion"
  ADD CONSTRAINT "evidencias_inspeccion_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "items_inspeccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
