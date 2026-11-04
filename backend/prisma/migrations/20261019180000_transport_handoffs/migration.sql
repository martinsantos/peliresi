CREATE TABLE "tramos_transporte" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "manifiestoId" TEXT NOT NULL REFERENCES "manifiestos"("id") ON DELETE CASCADE,
  "orden" INTEGER NOT NULL,
  "tipo" TEXT NOT NULL CHECK ("tipo" IN ('ORIGINAL', 'REGISTRADO', 'EXTERNO')),
  "transportistaId" TEXT,
  "datos" JSONB NOT NULL,
  "creadoPorId" TEXT NOT NULL,
  "impersonadoPorId" TEXT,
  "motivo" TEXT NOT NULL,
  "huellaSolicitud" TEXT NOT NULL,
  "inicio" TIMESTAMP(3) NOT NULL,
  "fin" TIMESTAMP(3),
  "latitud" DOUBLE PRECISION,
  "longitud" DOUBLE PRECISION,
  "accesoVersion" TEXT,
  "accesoHasta" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tramos_fechas" CHECK ("fin" IS NULL OR "fin" >= "inicio")
);
CREATE UNIQUE INDEX "tramos_transporte_manifiestoId_orden_key" ON "tramos_transporte"("manifiestoId", "orden");
CREATE UNIQUE INDEX "tramos_transporte_un_activo" ON "tramos_transporte"("manifiestoId") WHERE "fin" IS NULL;
CREATE INDEX "tramos_transporte_manifiestoId_inicio_idx" ON "tramos_transporte"("manifiestoId", "inicio");
ALTER TABLE "tracking_gps" ADD COLUMN "tramoId" TEXT REFERENCES "tramos_transporte"("id"), ADD COLUMN "emisor" TEXT;
CREATE INDEX "tracking_gps_tramoId_timestamp_idx" ON "tracking_gps"("tramoId", "timestamp");
