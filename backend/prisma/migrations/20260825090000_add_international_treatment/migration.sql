CREATE TYPE "AlcanceTratamiento" AS ENUM ('NACIONAL', 'INTERNACIONAL');
CREATE TYPE "TipoEntidadExterior" AS ENUM ('TRANSPORTISTA', 'OPERADOR');
CREATE TYPE "EstadoEntidadExterior" AS ENUM ('BORRADOR', 'PENDIENTE', 'APROBADO', 'RECHAZADO', 'INACTIVO');

ALTER TABLE "generadores"
  ADD COLUMN "alcanceTratamiento" "AlcanceTratamiento" NOT NULL DEFAULT 'NACIONAL';

CREATE TABLE "entidades_exteriores" (
  "id" TEXT NOT NULL,
  "tipo" "TipoEntidadExterior" NOT NULL,
  "razonSocial" TEXT NOT NULL,
  "pais" TEXT NOT NULL,
  "identificacionFiscal" TEXT,
  "domicilio" TEXT,
  "telefono" TEXT,
  "email" TEXT,
  "numeroHabilitacion" TEXT,
  "estado" "EstadoEntidadExterior" NOT NULL DEFAULT 'PENDIENTE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "entidades_exteriores_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "manifiestos"
  ALTER COLUMN "operadorId" DROP NOT NULL,
  ADD COLUMN "alcanceTratamiento" "AlcanceTratamiento" NOT NULL DEFAULT 'NACIONAL',
  ADD COLUMN "transportistaExteriorId" TEXT,
  ADD COLUMN "operadorExteriorId" TEXT,
  ADD COLUMN "declaracionTratamientoInternacional" TEXT;

CREATE INDEX "entidades_exteriores_tipo_estado_idx" ON "entidades_exteriores"("tipo", "estado");
CREATE INDEX "entidades_exteriores_pais_idx" ON "entidades_exteriores"("pais");
CREATE INDEX "manifiestos_alcanceTratamiento_idx" ON "manifiestos"("alcanceTratamiento");
CREATE INDEX "manifiestos_transportistaExteriorId_idx" ON "manifiestos"("transportistaExteriorId");
CREATE INDEX "manifiestos_operadorExteriorId_idx" ON "manifiestos"("operadorExteriorId");

ALTER TABLE "manifiestos"
  ADD CONSTRAINT "manifiestos_transportistaExteriorId_fkey"
    FOREIGN KEY ("transportistaExteriorId") REFERENCES "entidades_exteriores"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "manifiestos_operadorExteriorId_fkey"
    FOREIGN KEY ("operadorExteriorId") REFERENCES "entidades_exteriores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
