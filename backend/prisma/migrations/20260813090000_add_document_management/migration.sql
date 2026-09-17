-- Gestión documental, ATM y certificados firmados (espejo SITREP).
-- Migración aditiva: no elimina ni reescribe los modelos históricos.

DO $$ BEGIN
  CREATE TYPE "EstadoScanArchivo" AS ENUM ('CUARENTENA', 'LIMPIO', 'RECHAZADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "TipoDocumentoRegulatorio" AS ENUM (
    'ATM_COMPROBANTE_SELLADO',
    'OTRO',
    'CONSTANCIA_AFIP',
    'HABILITACION_ACTOR',
    'SEGURO_AMBIENTAL',
    'TARJETA_IDENTIFICACION_VEHICULO',
    'AUTORIZACION_USO_VEHICULO',
    'LICENCIA_CONDUCIR',
    'MEMORIA_TECNICA',
    'RESOLUCION_DPA',
    'CERTIFICADO_HABILITACION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "EstadoDocumentoRegulatorio" AS ENUM (
    'PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMPLAZADO', 'VENCIDO', 'REVOCADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "archivos_binarios" (
  "id" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "nombreOriginal" TEXT NOT NULL,
  "mimeDetectado" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "estadoScan" "EstadoScanArchivo" NOT NULL DEFAULT 'CUARENTENA',
  "motorScan" TEXT,
  "versionScan" TEXT,
  "escaneadoAt" TIMESTAMP(3),
  "creadoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "archivos_binarios_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "archivos_binarios_storageKey_key" ON "archivos_binarios"("storageKey");
CREATE UNIQUE INDEX IF NOT EXISTS "archivos_binarios_sha256_key" ON "archivos_binarios"("sha256");
CREATE INDEX IF NOT EXISTS "archivos_binarios_creadoPorId_idx" ON "archivos_binarios"("creadoPorId");
CREATE INDEX IF NOT EXISTS "archivos_binarios_estadoScan_idx" ON "archivos_binarios"("estadoScan");

CREATE TABLE IF NOT EXISTS "requisitos_documentales" (
  "id" TEXT NOT NULL,
  "tipoActor" "Rol" NOT NULL,
  "tipo" "TipoDocumentoRegulatorio" NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1',
  "obligatorio" BOOLEAN NOT NULL DEFAULT true,
  "requiereVigencia" BOOLEAN NOT NULL DEFAULT false,
  "requiereFrenteDorso" BOOLEAN NOT NULL DEFAULT false,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "requisitos_documentales_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "requisitos_documentales_tipoActor_tipo_version_key" ON "requisitos_documentales"("tipoActor", "tipo", "version");
CREATE INDEX IF NOT EXISTS "requisitos_documentales_tipoActor_activo_idx" ON "requisitos_documentales"("tipoActor", "activo");

CREATE TABLE IF NOT EXISTS "documentos_regulatorios" (
  "id" TEXT NOT NULL,
  "archivoId" TEXT NOT NULL,
  "tipo" "TipoDocumentoRegulatorio" NOT NULL,
  "estado" "EstadoDocumentoRegulatorio" NOT NULL DEFAULT 'PENDIENTE',
  "generadorId" TEXT,
  "transportistaId" TEXT,
  "operadorId" TEXT,
  "vehiculoId" TEXT,
  "choferId" TEXT,
  "numeroNormalizado" TEXT,
  "emisor" TEXT,
  "cara" TEXT,
  "emitidoAt" TIMESTAMP(3),
  "vigenteDesde" TIMESTAMP(3),
  "vigenteHasta" TIMESTAMP(3),
  "datosOcr" JSONB,
  "confianzaOcr" DOUBLE PRECISION,
  "version" INTEGER NOT NULL DEFAULT 1,
  "reemplazaAId" TEXT,
  "solicitudId" TEXT,
  "credencialId" TEXT,
  "emisionId" TEXT,
  "legacyDocumentoId" TEXT,
  "revisadoPorId" TEXT,
  "revisadoAt" TIMESTAMP(3),
  "motivoRechazo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "documentos_regulatorios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "documentos_regulatorios_generadorId_idx" ON "documentos_regulatorios"("generadorId");
CREATE INDEX IF NOT EXISTS "documentos_regulatorios_transportistaId_idx" ON "documentos_regulatorios"("transportistaId");
CREATE INDEX IF NOT EXISTS "documentos_regulatorios_operadorId_idx" ON "documentos_regulatorios"("operadorId");
CREATE INDEX IF NOT EXISTS "documentos_regulatorios_vehiculoId_idx" ON "documentos_regulatorios"("vehiculoId");
CREATE INDEX IF NOT EXISTS "documentos_regulatorios_choferId_idx" ON "documentos_regulatorios"("choferId");
CREATE INDEX IF NOT EXISTS "documentos_regulatorios_solicitudId_idx" ON "documentos_regulatorios"("solicitudId");
CREATE INDEX IF NOT EXISTS "documentos_regulatorios_credencialId_idx" ON "documentos_regulatorios"("credencialId");
CREATE INDEX IF NOT EXISTS "documentos_regulatorios_emisionId_idx" ON "documentos_regulatorios"("emisionId");
CREATE INDEX IF NOT EXISTS "documentos_regulatorios_tipo_estado_idx" ON "documentos_regulatorios"("tipo", "estado");

CREATE TABLE IF NOT EXISTS "comprobantes_atm" (
  "id" TEXT NOT NULL,
  "documentoId" TEXT NOT NULL,
  "generadorId" TEXT,
  "transportistaId" TEXT,
  "operadorId" TEXT,
  "emisor" TEXT NOT NULL,
  "referenciaNormalizada" TEXT NOT NULL,
  "cuitContribuyente" TEXT,
  "concepto" TEXT,
  "periodo" TEXT,
  "fechaPago" TIMESTAMP(3),
  "importeCentavos" BIGINT,
  "fingerprintHmac" TEXT,
  "estadoValidacion" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "comprobantes_atm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "comprobantes_atm_documentoId_key" ON "comprobantes_atm"("documentoId");
CREATE UNIQUE INDEX IF NOT EXISTS "comprobantes_atm_fingerprintHmac_key" ON "comprobantes_atm"("fingerprintHmac");
CREATE UNIQUE INDEX IF NOT EXISTS "comprobantes_atm_emisor_referenciaNormalizada_key" ON "comprobantes_atm"("emisor", "referenciaNormalizada");
CREATE INDEX IF NOT EXISTS "comprobantes_atm_generadorId_idx" ON "comprobantes_atm"("generadorId");
CREATE INDEX IF NOT EXISTS "comprobantes_atm_transportistaId_idx" ON "comprobantes_atm"("transportistaId");
CREATE INDEX IF NOT EXISTS "comprobantes_atm_operadorId_idx" ON "comprobantes_atm"("operadorId");

CREATE TABLE IF NOT EXISTS "credenciales_actor" (
  "id" TEXT NOT NULL,
  "generadorId" TEXT,
  "transportistaId" TEXT,
  "operadorId" TEXT,
  "tipo" TEXT NOT NULL,
  "alcance" TEXT,
  "vigenteDesde" TIMESTAMP(3) NOT NULL,
  "vigenteHasta" TIMESTAMP(3) NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "politicaVersion" TEXT NOT NULL DEFAULT '1',
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credenciales_actor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "credenciales_actor_generadorId_idx" ON "credenciales_actor"("generadorId");
CREATE INDEX IF NOT EXISTS "credenciales_actor_transportistaId_idx" ON "credenciales_actor"("transportistaId");
CREATE INDEX IF NOT EXISTS "credenciales_actor_operadorId_idx" ON "credenciales_actor"("operadorId");
CREATE INDEX IF NOT EXISTS "credenciales_actor_estado_vigenteHasta_idx" ON "credenciales_actor"("estado", "vigenteHasta");

CREATE TABLE IF NOT EXISTS "emisiones_certificados" (
  "id" TEXT NOT NULL,
  "credencialId" TEXT NOT NULL,
  "serial" TEXT NOT NULL,
  "tokenFirmado" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "snapshotHash" TEXT NOT NULL,
  "pdfStorageKey" TEXT NOT NULL,
  "pdfSha256" TEXT NOT NULL,
  "politicaVersion" TEXT NOT NULL,
  "emitidoPorId" TEXT NOT NULL,
  "emitidoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "emisiones_certificados_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "emisiones_certificados_serial_key" ON "emisiones_certificados"("serial");
CREATE UNIQUE INDEX IF NOT EXISTS "emisiones_certificados_tokenFirmado_key" ON "emisiones_certificados"("tokenFirmado");
CREATE UNIQUE INDEX IF NOT EXISTS "emisiones_certificados_pdfStorageKey_key" ON "emisiones_certificados"("pdfStorageKey");
CREATE INDEX IF NOT EXISTS "emisiones_certificados_credencialId_emitidoAt_idx" ON "emisiones_certificados"("credencialId", "emitidoAt");

ALTER TABLE "documentos_solicitud"
  ADD COLUMN IF NOT EXISTS "archivoId" TEXT,
  ADD COLUMN IF NOT EXISTS "sha256" TEXT,
  ADD COLUMN IF NOT EXISTS "estadoScan" "EstadoScanArchivo" NOT NULL DEFAULT 'CUARENTENA',
  ADD COLUMN IF NOT EXISTS "vigenteDesde" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "vigenteHasta" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "datosOcr" JSONB,
  ADD COLUMN IF NOT EXISTS "confianzaOcr" DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "documentos_solicitud_archivoId_idx" ON "documentos_solicitud"("archivoId");

ALTER TABLE "documentos_solicitud"
  ADD CONSTRAINT "documentos_solicitud_archivoId_fkey"
  FOREIGN KEY ("archivoId") REFERENCES "archivos_binarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documentos_regulatorios"
  ADD CONSTRAINT "documentos_regulatorios_archivoId_fkey"
  FOREIGN KEY ("archivoId") REFERENCES "archivos_binarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "documentos_regulatorios_generadorId_fkey"
  FOREIGN KEY ("generadorId") REFERENCES "generadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "documentos_regulatorios_transportistaId_fkey"
  FOREIGN KEY ("transportistaId") REFERENCES "transportistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "documentos_regulatorios_operadorId_fkey"
  FOREIGN KEY ("operadorId") REFERENCES "operadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "documentos_regulatorios_vehiculoId_fkey"
  FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "documentos_regulatorios_choferId_fkey"
  FOREIGN KEY ("choferId") REFERENCES "choferes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "documentos_regulatorios_solicitudId_fkey"
  FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "documentos_regulatorios_credencialId_fkey"
  FOREIGN KEY ("credencialId") REFERENCES "credenciales_actor"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "documentos_regulatorios_emisionId_fkey"
  FOREIGN KEY ("emisionId") REFERENCES "emisiones_certificados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comprobantes_atm"
  ADD CONSTRAINT "comprobantes_atm_documentoId_fkey"
  FOREIGN KEY ("documentoId") REFERENCES "documentos_regulatorios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "comprobantes_atm_generadorId_fkey"
  FOREIGN KEY ("generadorId") REFERENCES "generadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "comprobantes_atm_transportistaId_fkey"
  FOREIGN KEY ("transportistaId") REFERENCES "transportistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "comprobantes_atm_operadorId_fkey"
  FOREIGN KEY ("operadorId") REFERENCES "operadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credenciales_actor"
  ADD CONSTRAINT "credenciales_actor_generadorId_fkey"
  FOREIGN KEY ("generadorId") REFERENCES "generadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "credenciales_actor_transportistaId_fkey"
  FOREIGN KEY ("transportistaId") REFERENCES "transportistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "credenciales_actor_operadorId_fkey"
  FOREIGN KEY ("operadorId") REFERENCES "operadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "emisiones_certificados"
  ADD CONSTRAINT "emisiones_certificados_credencialId_fkey"
  FOREIGN KEY ("credencialId") REFERENCES "credenciales_actor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A regulatory document/credential/ATM receipt must always have exactly one
-- business subject. This is deliberately enforced in PostgreSQL because
-- Prisma cannot express an XOR across nullable relations.
ALTER TABLE "documentos_regulatorios"
  ADD CONSTRAINT "documentos_regulatorios_exactly_one_subject_ck"
  CHECK ((("generadorId" IS NOT NULL)::int + ("transportistaId" IS NOT NULL)::int +
          ("operadorId" IS NOT NULL)::int + ("vehiculoId" IS NOT NULL)::int +
          ("choferId" IS NOT NULL)::int) = 1);
ALTER TABLE "comprobantes_atm"
  ADD CONSTRAINT "comprobantes_atm_exactly_one_actor_ck"
  CHECK ((("generadorId" IS NOT NULL)::int + ("transportistaId" IS NOT NULL)::int +
          ("operadorId" IS NOT NULL)::int) = 1);
ALTER TABLE "credenciales_actor"
  ADD CONSTRAINT "credenciales_actor_exactly_one_actor_ck"
  CHECK ((("generadorId" IS NOT NULL)::int + ("transportistaId" IS NOT NULL)::int +
          ("operadorId" IS NOT NULL)::int) = 1);

-- Requirements are seeded idempotently by the application/QA fixture. No
-- existing actor, demo account or historical document is changed here.
INSERT INTO "requisitos_documentales" ("id", "tipoActor", "tipo", "version", "obligatorio", "requiereVigencia", "requiereFrenteDorso", "updatedAt")
VALUES
  ('req-generador-afip-v1', 'GENERADOR', 'CONSTANCIA_AFIP', '1', true, false, false, CURRENT_TIMESTAMP),
  ('req-generador-memoria-v1', 'GENERADOR', 'MEMORIA_TECNICA', '1', true, false, false, CURRENT_TIMESTAMP),
  ('req-generador-habilitacion-v1', 'GENERADOR', 'CERTIFICADO_HABILITACION', '1', true, true, false, CURRENT_TIMESTAMP),
  ('req-operador-afip-v1', 'OPERADOR', 'CONSTANCIA_AFIP', '1', true, false, false, CURRENT_TIMESTAMP),
  ('req-operador-habilitacion-v1', 'OPERADOR', 'CERTIFICADO_HABILITACION', '1', true, true, false, CURRENT_TIMESTAMP),
  ('req-operador-dpa-v1', 'OPERADOR', 'RESOLUCION_DPA', '1', true, false, false, CURRENT_TIMESTAMP),
  ('req-transportista-afip-v1', 'TRANSPORTISTA', 'CONSTANCIA_AFIP', '1', true, false, false, CURRENT_TIMESTAMP),
  ('req-transportista-habilitacion-v1', 'TRANSPORTISTA', 'CERTIFICADO_HABILITACION', '1', true, true, false, CURRENT_TIMESTAMP),
  ('req-transportista-seguro-v1', 'TRANSPORTISTA', 'SEGURO_AMBIENTAL', '1', true, true, false, CURRENT_TIMESTAMP)
ON CONFLICT ("tipoActor", "tipo", "version") DO NOTHING;
