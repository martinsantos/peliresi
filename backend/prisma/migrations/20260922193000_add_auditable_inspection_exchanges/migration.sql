-- Conversación formal y auditable entre autoridad e inspeccionado.
CREATE TYPE "ParteIntercambioInspeccion" AS ENUM ('AUTORIDAD', 'INSPECCIONADO', 'SISTEMA');
CREATE TYPE "TipoIntercambioInspeccion" AS ENUM (
  'REQUERIMIENTO',
  'RESPUESTA',
  'DESCARGO',
  'SUBSANACION',
  'PRONUNCIAMIENTO',
  'CIERRE_CONFORME',
  'DERIVACION_LEGALES'
);

CREATE TABLE "intercambios_inspeccion" (
  "id" TEXT NOT NULL,
  "inspeccionId" TEXT NOT NULL,
  "secuencia" INTEGER NOT NULL,
  "clienteId" TEXT,
  "respondeAId" TEXT,
  "tipo" "TipoIntercambioInspeccion" NOT NULL,
  "parte" "ParteIntercambioInspeccion" NOT NULL,
  "asunto" TEXT NOT NULL,
  "cuerpo" TEXT NOT NULL,
  "plazoRespuestaAt" TIMESTAMP(3),
  "presentadoFueraDePlazo" BOOLEAN NOT NULL DEFAULT false,
  "canal" TEXT NOT NULL DEFAULT 'PORTAL_SITREP',
  "versionExpediente" INTEGER NOT NULL,
  "contenidoSha256" TEXT NOT NULL,
  "hashAnterior" TEXT,
  "hashCadena" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "intercambios_inspeccion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "evidencias_inspeccion" ADD COLUMN "intercambioId" TEXT;

CREATE UNIQUE INDEX "intercambios_inspeccion_inspeccionId_secuencia_key"
  ON "intercambios_inspeccion"("inspeccionId", "secuencia");
CREATE UNIQUE INDEX "intercambios_inspeccion_inspeccionId_clienteId_key"
  ON "intercambios_inspeccion"("inspeccionId", "clienteId");
CREATE UNIQUE INDEX "intercambios_inspeccion_hashCadena_key"
  ON "intercambios_inspeccion"("hashCadena");
CREATE INDEX "intercambios_inspeccion_inspeccionId_createdAt_idx"
  ON "intercambios_inspeccion"("inspeccionId", "createdAt");
CREATE INDEX "intercambios_inspeccion_respondeAId_idx"
  ON "intercambios_inspeccion"("respondeAId");
CREATE INDEX "evidencias_inspeccion_intercambioId_idx"
  ON "evidencias_inspeccion"("intercambioId");

ALTER TABLE "intercambios_inspeccion"
  ADD CONSTRAINT "intercambios_inspeccion_inspeccionId_fkey"
  FOREIGN KEY ("inspeccionId") REFERENCES "inspecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intercambios_inspeccion"
  ADD CONSTRAINT "intercambios_inspeccion_autorId_fkey"
  FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "intercambios_inspeccion"
  ADD CONSTRAINT "intercambios_inspeccion_respondeAId_fkey"
  FOREIGN KEY ("respondeAId") REFERENCES "intercambios_inspeccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidencias_inspeccion"
  ADD CONSTRAINT "evidencias_inspeccion_intercambioId_fkey"
  FOREIGN KEY ("intercambioId") REFERENCES "intercambios_inspeccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
