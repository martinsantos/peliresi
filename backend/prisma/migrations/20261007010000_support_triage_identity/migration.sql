-- Additive: preserve every existing reference, owner, state and message.
ALTER TABLE "tickets_soporte"
  ADD COLUMN "tipo" TEXT,
  ADD COLUMN "prioridad" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "clasificadoAt" TIMESTAMP(3),
  ADD COLUMN "registradoPorId" TEXT;
ALTER TABLE "eventos_soporte" ADD COLUMN "detalle" JSONB;
ALTER TABLE "tickets_soporte" ADD CONSTRAINT "tickets_soporte_registradoPorId_fkey"
  FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "tickets_soporte_tipo_prioridad_estado_idx" ON "tickets_soporte"("tipo", "prioridad", "estado");
