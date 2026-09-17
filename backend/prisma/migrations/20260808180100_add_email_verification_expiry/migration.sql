ALTER TABLE "usuarios"
  ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP(3);
