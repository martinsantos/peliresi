-- Additive only. No historical payment/document is approved, reassigned or erased.
CREATE TABLE "registros_pago_comprobante" (
  "id" TEXT NOT NULL,
  "ambito" TEXT NOT NULL,
  "origen" TEXT NOT NULL,
  "documentoId" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "cuit" TEXT NOT NULL,
  "identidad" JSONB NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'CONFIRMADO',
  "confirmadoPor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "registros_pago_comprobante_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "registros_pago_comprobante_ambito_idx" ON "registros_pago_comprobante"("ambito");
CREATE INDEX "registros_pago_comprobante_origen_documentoId_idx" ON "registros_pago_comprobante"("origen", "documentoId");
CREATE TABLE "claves_pago_comprobante" (
  "clave" TEXT NOT NULL,
  "registroId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "claves_pago_comprobante_pkey" PRIMARY KEY ("clave"),
  CONSTRAINT "claves_pago_comprobante_registroId_fkey" FOREIGN KEY ("registroId") REFERENCES "registros_pago_comprobante"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "claves_pago_comprobante_registroId_idx" ON "claves_pago_comprobante"("registroId");
CREATE TABLE "eventos_pago_comprobante" (
  "id" TEXT NOT NULL,
  "registroId" TEXT NOT NULL,
  "documentoId" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "accion" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "datos" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "eventos_pago_comprobante_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "eventos_pago_comprobante_registroId_fkey" FOREIGN KEY ("registroId") REFERENCES "registros_pago_comprobante"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "eventos_pago_comprobante_registroId_documentoId_sha256_acci_key" ON "eventos_pago_comprobante"("registroId", "documentoId", "sha256", "accion");
