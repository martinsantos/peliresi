-- AUDITOR is a system-wide read-only role. Authorization remains enforced in
-- the API; this migration only makes the role a first-class database value.
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'AUDITOR';
