ALTER TABLE "usuarios"
  ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
