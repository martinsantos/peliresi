-- Las salidas documentales comparten el expediente y conservan su redacción
-- estructurada. JSONB permite evolucionar el formulario sin duplicar pantallas
-- ni perder compatibilidad con inspecciones existentes.
ALTER TABLE "inspecciones"
  ADD COLUMN "datosActa" JSONB,
  ADD COLUMN "informeTecnico" JSONB;
