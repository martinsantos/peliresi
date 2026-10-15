CREATE TABLE "registros_manifiesto_excepcional" (
  "id" TEXT PRIMARY KEY,
  "operadorId" TEXT NOT NULL REFERENCES "operadores"("id") ON DELETE RESTRICT,
  "creadoPorId" TEXT NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "impersonadoPorId" TEXT REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "huellaSolicitud" TEXT NOT NULL,
  "datos" JSONB NOT NULL,
  "eventos" JSONB NOT NULL,
  "etapa" TEXT NOT NULL DEFAULT 'REGISTRADO',
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "registros_manifiesto_excepcional_operadorId_createdAt_idx"
ON "registros_manifiesto_excepcional"("operadorId", "createdAt");
