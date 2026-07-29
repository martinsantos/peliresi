-- Drop redundant fechaCreacion column from manifiestos
-- This column was always equal to createdAt (@default(now()), never explicitly set).
-- All queries now use createdAt which has proper indexes.

ALTER TABLE "manifiestos" DROP COLUMN IF EXISTS "fechaCreacion";
