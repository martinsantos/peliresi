-- Nullable, additive snapshot. No historical backfill or renumbering.
-- Roll back the application, not this column: keep any newly recorded snapshots.
ALTER TABLE "manifiestos" ADD COLUMN "asignacionTransporte" JSONB;
