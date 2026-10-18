CREATE TABLE "conciliaciones_participantes_externos" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "registroId" TEXT NOT NULL REFERENCES "registros_manifiesto_excepcional"("id") ON DELETE RESTRICT,
  "rol" TEXT NOT NULL CHECK ("rol" IN ('generador', 'transportista')),
  "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  "accion" TEXT NOT NULL CHECK ("accion" IN ('VINCULAR', 'DESVINCULAR')),
  "actorId" TEXT,
  "ficha" JSONB,
  "motivo" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("registroId", "rol", "revision")
);
