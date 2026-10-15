CREATE TABLE "adendas_manifiesto" (
  "id" TEXT PRIMARY KEY,
  "manifiestoId" TEXT NOT NULL REFERENCES "manifiestos"("id") ON DELETE RESTRICT,
  "creadoPorId" TEXT NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "impersonadoPorId" TEXT REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "huellaSolicitud" TEXT NOT NULL,
  "declaracion" JSONB NOT NULL,
  "residuos" JSONB NOT NULL,
  "motivo" TEXT NOT NULL,
  "rectificaId" TEXT REFERENCES "adendas_manifiesto"("id") ON DELETE RESTRICT,
  "revisiones" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "adendas_manifiesto_manifiestoId_createdAt_idx" ON "adendas_manifiesto"("manifiestoId", "createdAt");
