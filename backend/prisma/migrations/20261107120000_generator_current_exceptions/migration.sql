-- Additive: generator current-stream exceptions (one open per generator, closed by registration).
CREATE TABLE "excepciones_corriente_generador" (
  "id" TEXT PRIMARY KEY,
  "generadorId" TEXT NOT NULL REFERENCES "generadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "origen" TEXT NOT NULL CHECK ("origen" IN ('ADENDA', 'MANIFIESTO')),
  "origenId" TEXT NOT NULL,
  "manifiestoId" TEXT NOT NULL,
  "corrientes" TEXT[] NOT NULL CHECK (cardinality("corrientes") > 0),
  "detalle" JSONB NOT NULL,
  "motivo" TEXT NOT NULL,
  "otorgadaPorId" TEXT NOT NULL,
  "impersonadoPorId" TEXT,
  "cerradaAt" TIMESTAMP(3),
  "cierre" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (("cerradaAt" IS NULL) = ("cierre" IS NULL))
);
CREATE UNIQUE INDEX "excepciones_corriente_generador_origen_origenId_key" ON "excepciones_corriente_generador"("origen", "origenId");
CREATE INDEX "excepciones_corriente_generador_generadorId_cerradaAt_idx" ON "excepciones_corriente_generador"("generadorId", "cerradaAt");
CREATE INDEX "excepciones_corriente_generador_manifiestoId_idx" ON "excepciones_corriente_generador"("manifiestoId");
