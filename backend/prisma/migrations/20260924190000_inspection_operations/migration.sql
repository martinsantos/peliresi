-- Additive rollout: existing legajos and their numbers remain unchanged.
ALTER TABLE "inspecciones" ALTER COLUMN "tipoActor" DROP NOT NULL;
ALTER TABLE "inspecciones" ADD COLUMN "clienteId" TEXT;
ALTER TABLE "inspecciones" ADD COLUMN "huellaCreacion" TEXT;
CREATE UNIQUE INDEX "inspecciones_clienteId_key" ON "inspecciones"("clienteId");
CREATE INDEX "inspecciones_fechaProgramada_estado_idx" ON "inspecciones"("fechaProgramada", "estado");
CREATE TABLE "secuencias_inspeccion" (
  "serie" TEXT NOT NULL,
  "anio" INTEGER NOT NULL,
  "ultimo" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "secuencias_inspeccion_pkey" PRIMARY KEY ("serie", "anio"),
  CONSTRAINT "secuencias_inspeccion_ultimo_check" CHECK ("ultimo" BETWEEN 0 AND 99999)
);
-- Imported numbers must not be reused by the new allocator.
INSERT INTO "secuencias_inspeccion" ("serie", "anio", "ultimo")
SELECT split_part("numero", '-', 1), split_part("numero", '-', 2)::INTEGER,
       MAX(split_part("numero", '-', 3)::INTEGER)
FROM "inspecciones" WHERE "numero" ~ '^[A-Z]+-[0-9]{4}-[0-9]{5}$'
GROUP BY 1, 2;
