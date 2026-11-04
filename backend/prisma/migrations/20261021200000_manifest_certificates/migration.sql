CREATE TABLE "certificados_manifiesto" (
  "id" TEXT NOT NULL, "manifiestoId" TEXT NOT NULL, "autorId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL, "numero" TEXT NOT NULL, "finalKey" TEXT,
  "documento" JSONB NOT NULL, "pdf" BYTEA NOT NULL, "pdfSha256" TEXT NOT NULL,
  "firmaImagen" TEXT NOT NULL, "firmaSha256" TEXT NOT NULL, "solicitudSha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "certificados_manifiesto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "certificados_manifiesto_manifiestoId_fkey" FOREIGN KEY ("manifiestoId") REFERENCES "manifiestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "certificados_manifiesto_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "certificados_manifiesto_numero_key" ON "certificados_manifiesto"("numero");
CREATE UNIQUE INDEX "certificados_manifiesto_manifiestoId_finalKey_key" ON "certificados_manifiesto"("manifiestoId", "finalKey");
CREATE INDEX "certificados_manifiesto_manifiestoId_createdAt_idx" ON "certificados_manifiesto"("manifiestoId", "createdAt");
