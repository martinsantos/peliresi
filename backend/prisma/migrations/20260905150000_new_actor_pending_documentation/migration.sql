-- Change defaults only. Existing actors/demo access are intentionally untouched.
ALTER TABLE "generadores" ALTER COLUMN "activo" SET DEFAULT false;
ALTER TABLE "transportistas" ALTER COLUMN "activo" SET DEFAULT false;
ALTER TABLE "operadores" ALTER COLUMN "activo" SET DEFAULT false;
