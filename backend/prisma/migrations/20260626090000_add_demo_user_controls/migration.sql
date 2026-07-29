ALTER TABLE "usuarios"
  ADD COLUMN IF NOT EXISTS "esDemo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "demoExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "forcePasswordChange" BOOLEAN NOT NULL DEFAULT false;

UPDATE "usuarios"
SET "esDemo" = true,
    "demoExpiresAt" = NOW() + INTERVAL '30 days',
    "forcePasswordChange" = false
WHERE email IN (
  'admin@dgfa.mendoza.gov.ar',
  'quimica.mendoza@industria.com',
  'transportes.andes@logistica.com',
  'tratamiento.residuos@planta.com'
);
