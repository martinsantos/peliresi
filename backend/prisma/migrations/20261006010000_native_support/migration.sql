-- Additive only. No legal dossiers, users, roles or existing sequence changed.
CREATE TABLE "agentes_soporte" (
  "usuarioId" TEXT PRIMARY KEY REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "habilitado" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "tickets_soporte" (
  "id" TEXT PRIMARY KEY, "numero" SERIAL NOT NULL UNIQUE,
  "autorId" TEXT NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "responsableId" TEXT REFERENCES "usuarios"("id") ON DELETE SET NULL,
  "asunto" TEXT NOT NULL, "categoria" TEXT NOT NULL DEFAULT 'GENERAL',
  "estado" TEXT NOT NULL DEFAULT 'ABIERTO', "contexto" JSONB NOT NULL,
  "clienteId" TEXT NOT NULL, "huella" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "cerradoAt" TIMESTAMP(3),
  CONSTRAINT "tickets_soporte_estado_check" CHECK ("estado" IN ('ABIERTO','EN_CURSO','ESPERANDO_USUARIO','CERRADO'))
);
CREATE UNIQUE INDEX "tickets_soporte_autorId_clienteId_key" ON "tickets_soporte"("autorId", "clienteId");
CREATE INDEX "tickets_soporte_autorId_updatedAt_idx" ON "tickets_soporte"("autorId", "updatedAt");
CREATE INDEX "tickets_soporte_estado_updatedAt_idx" ON "tickets_soporte"("estado", "updatedAt");
CREATE INDEX "tickets_soporte_responsableId_estado_idx" ON "tickets_soporte"("responsableId", "estado");
CREATE TABLE "mensajes_soporte" (
  "id" TEXT PRIMARY KEY, "ticketId" TEXT NOT NULL REFERENCES "tickets_soporte"("id") ON DELETE RESTRICT,
  "autorId" TEXT NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "cuerpo" TEXT NOT NULL, "interno" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "mensajes_soporte_ticketId_createdAt_idx" ON "mensajes_soporte"("ticketId", "createdAt");
CREATE TABLE "adjuntos_soporte" (
  "id" TEXT PRIMARY KEY, "mensajeId" TEXT NOT NULL REFERENCES "mensajes_soporte"("id") ON DELETE RESTRICT,
  "nombre" TEXT NOT NULL, "mime" TEXT NOT NULL, "bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL, "storageKey" TEXT NOT NULL
);
CREATE INDEX "adjuntos_soporte_mensajeId_idx" ON "adjuntos_soporte"("mensajeId");
CREATE TABLE "eventos_soporte" (
  "id" TEXT PRIMARY KEY, "ticketId" TEXT NOT NULL REFERENCES "tickets_soporte"("id") ON DELETE RESTRICT,
  "usuarioId" TEXT NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "clienteId" TEXT NOT NULL, "huella" TEXT NOT NULL, "accion" TEXT NOT NULL,
  "estadoAnterior" TEXT NOT NULL, "estadoNuevo" TEXT NOT NULL,
  "responsableAnteriorId" TEXT, "responsableNuevoId" TEXT,
  "interno" BOOLEAN NOT NULL DEFAULT false, "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "eventos_soporte_ticketId_usuarioId_clienteId_key" ON "eventos_soporte"("ticketId", "usuarioId", "clienteId");
CREATE INDEX "eventos_soporte_ticketId_createdAt_idx" ON "eventos_soporte"("ticketId", "createdAt");
