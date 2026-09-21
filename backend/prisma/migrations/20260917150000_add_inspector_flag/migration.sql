-- Existing SITREP installations already expose this flag in the Prisma schema.
-- Keep the migration idempotent because some environments received the column
-- during the original inspection rollout before it was represented in Git.
ALTER TABLE "usuarios"
ADD COLUMN IF NOT EXISTS "esInspector" BOOLEAN NOT NULL DEFAULT false;
