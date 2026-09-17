-- Approved demo accounts remain available for training sessions.
-- This is a forward migration because the original demo-user migration may
-- already be recorded as applied with a finite expiration date.
UPDATE "usuarios"
SET "demoExpiresAt" = NULL
WHERE "esDemo" = true
  AND "demoExpiresAt" IS NOT NULL;
