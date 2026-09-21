-- Idempotencia de capturas offline: cada dispositivo genera un clienteId estable
-- y puede reintentar la misma carga sin crear evidencia duplicada.
ALTER TABLE "evidencias_inspeccion" ADD COLUMN "clienteId" TEXT;

CREATE UNIQUE INDEX "evidencias_inspeccion_inspeccionId_clienteId_key"
ON "evidencias_inspeccion"("inspeccionId", "clienteId");
