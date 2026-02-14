-- Composite indexes for 50 concurrent transportistas scaling
-- GPS queries: WHERE manifiestoId = X ORDER BY timestamp DESC
CREATE INDEX IF NOT EXISTS "tracking_gps_manifiestoId_timestamp_idx" ON "tracking_gps"("manifiestoId", "timestamp");

-- Manifiesto lookup by numero (used in QR validation, search)
CREATE INDEX IF NOT EXISTS "manifiestos_numero_idx" ON "manifiestos"("numero");

-- Transportista dashboard: WHERE transportistaId = X AND estado = Y
CREATE INDEX IF NOT EXISTS "manifiestos_transportistaId_estado_idx" ON "manifiestos"("transportistaId", "estado");
