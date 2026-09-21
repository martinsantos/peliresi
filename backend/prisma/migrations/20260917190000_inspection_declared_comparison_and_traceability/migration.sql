CREATE TYPE "ResultadoComparacionInspeccion" AS ENUM (
  'PENDIENTE', 'COINCIDE', 'DIFIERE', 'NO_VERIFICADO', 'NO_APLICA'
);

ALTER TABLE "inspecciones"
  ADD COLUMN "declaradoSnapshot" JSONB;

CREATE TABLE "comparaciones_inspeccion" (
  "id" TEXT NOT NULL,
  "inspeccionId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "categoria" TEXT NOT NULL,
  "etiqueta" TEXT NOT NULL,
  "origen" TEXT NOT NULL,
  "valorDeclarado" TEXT,
  "valorObservado" TEXT,
  "resultado" "ResultadoComparacionInspeccion" NOT NULL DEFAULT 'PENDIENTE',
  "observacion" TEXT,
  "orden" INTEGER NOT NULL,
  "verificadoPorId" TEXT,
  "verificadoAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "comparaciones_inspeccion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "evidencias_inspeccion"
  ADD COLUMN "comparacionId" TEXT,
  ADD COLUMN "eventoId" TEXT;

ALTER TABLE "eventos_inspeccion"
  ADD COLUMN "canal" TEXT NOT NULL DEFAULT 'SISTEMA',
  ADD COLUMN "estadoEntrega" TEXT,
  ADD COLUMN "destinatario" TEXT,
  ADD COLUMN "metadata" JSONB;

CREATE UNIQUE INDEX "comparaciones_inspeccion_inspeccionId_codigo_key"
  ON "comparaciones_inspeccion"("inspeccionId", "codigo");
CREATE INDEX "comparaciones_inspeccion_inspeccionId_categoria_orden_idx"
  ON "comparaciones_inspeccion"("inspeccionId", "categoria", "orden");
CREATE INDEX "comparaciones_inspeccion_resultado_idx"
  ON "comparaciones_inspeccion"("resultado");
CREATE INDEX "evidencias_inspeccion_comparacionId_idx"
  ON "evidencias_inspeccion"("comparacionId");
CREATE INDEX "evidencias_inspeccion_eventoId_idx"
  ON "evidencias_inspeccion"("eventoId");

ALTER TABLE "comparaciones_inspeccion"
  ADD CONSTRAINT "comparaciones_inspeccion_inspeccionId_fkey"
  FOREIGN KEY ("inspeccionId") REFERENCES "inspecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comparaciones_inspeccion"
  ADD CONSTRAINT "comparaciones_inspeccion_verificadoPorId_fkey"
  FOREIGN KEY ("verificadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidencias_inspeccion"
  ADD CONSTRAINT "evidencias_inspeccion_comparacionId_fkey"
  FOREIGN KEY ("comparacionId") REFERENCES "comparaciones_inspeccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidencias_inspeccion"
  ADD CONSTRAINT "evidencias_inspeccion_eventoId_fkey"
  FOREIGN KEY ("eventoId") REFERENCES "eventos_inspeccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
