-- Personal navigation preference only; no change to roles, notifications or records.
ALTER TABLE "usuarios" ADD COLUMN "preferenciaEnlaces" TEXT NOT NULL DEFAULT 'AUTO';
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_preferenciaEnlaces_check" CHECK ("preferenciaEnlaces" IN ('AUTO', 'WEB', 'APP'));
