-- Add new roles to Rol enum
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'ADMIN_TRANSPORTISTA';
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'ADMIN_GENERADOR';
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'ADMIN_OPERADOR';

-- Add email verification and password reset fields to usuarios
ALTER TABLE "usuarios"
  ADD COLUMN IF NOT EXISTS "emailVerified"          BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT,
  ADD COLUMN IF NOT EXISTS "passwordResetToken"     TEXT,
  ADD COLUMN IF NOT EXISTS "passwordResetExpires"   TIMESTAMP(3);
