-- CreateIndex (production performance optimization)

-- Manifiesto indexes
CREATE INDEX IF NOT EXISTS "manifiestos_generadorId_idx" ON "manifiestos"("generadorId");
CREATE INDEX IF NOT EXISTS "manifiestos_transportistaId_idx" ON "manifiestos"("transportistaId");
CREATE INDEX IF NOT EXISTS "manifiestos_operadorId_idx" ON "manifiestos"("operadorId");
CREATE INDEX IF NOT EXISTS "manifiestos_estado_idx" ON "manifiestos"("estado");
CREATE INDEX IF NOT EXISTS "manifiestos_createdAt_idx" ON "manifiestos"("createdAt");
CREATE INDEX IF NOT EXISTS "manifiestos_estado_createdAt_idx" ON "manifiestos"("estado", "createdAt");

-- ManifiestoResiduo indexes
CREATE INDEX IF NOT EXISTS "manifiestos_residuos_manifiestoId_idx" ON "manifiestos_residuos"("manifiestoId");

-- EventoManifiesto indexes
CREATE INDEX IF NOT EXISTS "eventos_manifiesto_manifiestoId_idx" ON "eventos_manifiesto"("manifiestoId");
CREATE INDEX IF NOT EXISTS "eventos_manifiesto_manifiestoId_tipo_idx" ON "eventos_manifiesto"("manifiestoId", "tipo");

-- TrackingGPS indexes
CREATE INDEX IF NOT EXISTS "tracking_gps_manifiestoId_idx" ON "tracking_gps"("manifiestoId");

-- Auditoria indexes
CREATE INDEX IF NOT EXISTS "auditorias_manifiestoId_idx" ON "auditorias"("manifiestoId");
CREATE INDEX IF NOT EXISTS "auditorias_createdAt_idx" ON "auditorias"("createdAt");

-- AlertaGenerada indexes
CREATE INDEX IF NOT EXISTS "alertas_generadas_manifiestoId_idx" ON "alertas_generadas"("manifiestoId");
CREATE INDEX IF NOT EXISTS "alertas_generadas_estado_idx" ON "alertas_generadas"("estado");

-- AnomaliaTransporte indexes
CREATE INDEX IF NOT EXISTS "anomalias_transporte_manifiestoId_idx" ON "anomalias_transporte"("manifiestoId");
