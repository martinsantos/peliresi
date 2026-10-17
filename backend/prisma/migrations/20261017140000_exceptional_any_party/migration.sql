-- Additive only (spec docs/ESPEC-EVENTUALES-20261017.md §6): no UPDATE, no dropped column,
-- datos/eventos/huellaSolicitud untouched. Rows with "autorRol" NULL predate this change.
ALTER TABLE "registros_manifiesto_excepcional" ALTER COLUMN "operadorId" DROP NOT NULL;
ALTER TABLE "registros_manifiesto_excepcional" ADD COLUMN "autorRol" TEXT;
ALTER TABLE "registros_manifiesto_excepcional" ADD COLUMN "autorActorId" TEXT;
CREATE INDEX "registros_manifiesto_excepcional_creadoPorId_createdAt_idx"
ON "registros_manifiesto_excepcional"("creadoPorId", "createdAt");
