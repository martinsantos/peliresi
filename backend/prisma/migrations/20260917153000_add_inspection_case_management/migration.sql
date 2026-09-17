CREATE TYPE "TipoActorInspeccion" AS ENUM ('GENERADOR', 'TRANSPORTISTA', 'OPERADOR');
CREATE TYPE "EstadoInspeccion" AS ENUM (
  'BORRADOR', 'PLANIFICADA', 'EN_CAMPO', 'EN_REVISION', 'NOTIFICADA',
  'EN_DESCARGO', 'REQUIERE_SUBSANACION', 'CERRADA_CONFORME',
  'DERIVADA_LEGALES', 'EN_TRAMITE_LEGAL', 'DERIVADA_ATM',
  'FINALIZADA', 'CANCELADA'
);
CREATE TYPE "ResultadoItemInspeccion" AS ENUM ('PENDIENTE', 'CUMPLE', 'NO_CUMPLE', 'NO_APLICA');
CREATE TYPE "TipoEvidenciaInspeccion" AS ENUM ('FOTO', 'AUDIO', 'DOCUMENTO');

CREATE TABLE "inspecciones" (
  "id" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "numeroActa" TEXT,
  "tipoActor" "TipoActorInspeccion" NOT NULL,
  "generadorId" TEXT,
  "transportistaId" TEXT,
  "operadorId" TEXT,
  "inspectorId" TEXT NOT NULL,
  "estado" "EstadoInspeccion" NOT NULL DEFAULT 'BORRADOR',
  "ubicacion" TEXT,
  "latitud" DOUBLE PRECISION,
  "longitud" DOUBLE PRECISION,
  "fechaProgramada" TIMESTAMP(3),
  "iniciadaAt" TIMESTAMP(3),
  "cerradaCampoAt" TIMESTAMP(3),
  "plazoRespuestaAt" TIMESTAMP(3),
  "observaciones" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inspecciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "items_inspeccion" (
  "id" TEXT NOT NULL,
  "inspeccionId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "categoria" TEXT NOT NULL,
  "etiqueta" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  "obligatorio" BOOLEAN NOT NULL DEFAULT true,
  "resultado" "ResultadoItemInspeccion" NOT NULL DEFAULT 'PENDIENTE',
  "observacion" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "items_inspeccion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidencias_inspeccion" (
  "id" TEXT NOT NULL,
  "inspeccionId" TEXT NOT NULL,
  "tipo" "TipoEvidenciaInspeccion" NOT NULL,
  "nombreOriginal" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeDetectado" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "descripcion" TEXT,
  "transcripcion" TEXT,
  "creadoPorId" TEXT NOT NULL,
  "capturadaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "latitud" DOUBLE PRECISION,
  "longitud" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidencias_inspeccion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "eventos_inspeccion" (
  "id" TEXT NOT NULL,
  "inspeccionId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "detalle" TEXT,
  "estadoDesde" TEXT,
  "estadoHasta" TEXT,
  "visibleActor" BOOLEAN NOT NULL DEFAULT false,
  "usuarioId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "eventos_inspeccion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inspecciones_numero_key" ON "inspecciones"("numero");
CREATE INDEX "inspecciones_estado_createdAt_idx" ON "inspecciones"("estado", "createdAt");
CREATE INDEX "inspecciones_inspectorId_estado_idx" ON "inspecciones"("inspectorId", "estado");
CREATE INDEX "inspecciones_generadorId_idx" ON "inspecciones"("generadorId");
CREATE INDEX "inspecciones_transportistaId_idx" ON "inspecciones"("transportistaId");
CREATE INDEX "inspecciones_operadorId_idx" ON "inspecciones"("operadorId");
CREATE UNIQUE INDEX "items_inspeccion_inspeccionId_codigo_key" ON "items_inspeccion"("inspeccionId", "codigo");
CREATE INDEX "items_inspeccion_inspeccionId_categoria_orden_idx" ON "items_inspeccion"("inspeccionId", "categoria", "orden");
CREATE UNIQUE INDEX "evidencias_inspeccion_storageKey_key" ON "evidencias_inspeccion"("storageKey");
CREATE INDEX "evidencias_inspeccion_inspeccionId_createdAt_idx" ON "evidencias_inspeccion"("inspeccionId", "createdAt");
CREATE INDEX "evidencias_inspeccion_sha256_idx" ON "evidencias_inspeccion"("sha256");
CREATE INDEX "eventos_inspeccion_inspeccionId_createdAt_idx" ON "eventos_inspeccion"("inspeccionId", "createdAt");

ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_generadorId_fkey" FOREIGN KEY ("generadorId") REFERENCES "generadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "transportistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "operadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "items_inspeccion" ADD CONSTRAINT "items_inspeccion_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "inspecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidencias_inspeccion" ADD CONSTRAINT "evidencias_inspeccion_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "inspecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidencias_inspeccion" ADD CONSTRAINT "evidencias_inspeccion_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "eventos_inspeccion" ADD CONSTRAINT "eventos_inspeccion_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "inspecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_inspeccion" ADD CONSTRAINT "eventos_inspeccion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
