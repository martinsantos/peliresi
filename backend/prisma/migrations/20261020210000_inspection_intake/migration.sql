ALTER TABLE "adendas_manifiesto" ADD COLUMN "informeHallazgo" JSONB;

CREATE TABLE "antecedentes_fiscalizacion" (
  "id" TEXT NOT NULL,
  "claveOrigen" TEXT NOT NULL,
  "origen" TEXT NOT NULL,
  "origenId" TEXT NOT NULL,
  "referencia" TEXT NOT NULL,
  "tipoActor" "TipoActorInspeccion" NOT NULL,
  "actorId" TEXT,
  "actorNombre" TEXT NOT NULL,
  "motivos" TEXT[] NOT NULL,
  "evidencia" JSONB NOT NULL,
  "huellaEvidencia" TEXT NOT NULL,
  "creadoPorId" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "version" INTEGER NOT NULL DEFAULT 0,
  "eventos" JSONB NOT NULL,
  "inspeccionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "antecedentes_fiscalizacion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "antecedentes_fiscalizacion_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "inspecciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "antecedentes_fiscalizacion_claveOrigen_key" ON "antecedentes_fiscalizacion"("claveOrigen");
CREATE INDEX "antecedentes_fiscalizacion_estado_tipoActor_createdAt_idx" ON "antecedentes_fiscalizacion"("estado", "tipoActor", "createdAt");
CREATE INDEX "antecedentes_fiscalizacion_origen_origenId_idx" ON "antecedentes_fiscalizacion"("origen", "origenId");
CREATE INDEX "antecedentes_fiscalizacion_inspeccionId_idx" ON "antecedentes_fiscalizacion"("inspeccionId");
