ALTER TABLE "documentos" ADD COLUMN "transportistaId" TEXT;
CREATE INDEX "documentos_transportistaId_idx" ON "documentos"("transportistaId");
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_transportistaId_fkey"
  FOREIGN KEY ("transportistaId") REFERENCES "transportistas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
