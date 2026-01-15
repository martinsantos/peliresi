# HOTFIX: Tabla Reversiones Estado
## Fecha: 2026-01-15
## Severidad: Media
## Bug: Error 500 en POST /api/manifiestos/:id/revertir-entrega

---

## PROBLEMA

Al ejecutar reversiones de estado vía API, el servidor retorna:
```
Error 500: Cannot read properties of undefined (reading 'create')
```

**Causa raíz:** La tabla `reversiones_estado` no existe en la base de datos de producción. El modelo fue agregado al schema de Prisma pero la migración nunca se ejecutó.

---

## SOLUCIÓN

### Opción 1: Script Automático (Recomendado)

```bash
# En el servidor de producción
cd /var/www/sitrep-prod
./hotfix-reversiones.sh
```

### Opción 2: Manual via SSH

```bash
# 1. Copiar archivo de migración
scp -r backend/prisma/migrations/20260115183000_add_reversiones_estado user@server:/var/www/sitrep-prod/backend/prisma/migrations/

# 2. En el servidor
cd /var/www/sitrep-prod/backend
npx prisma migrate deploy
npx prisma generate
pm2 restart sitrep-backend
```

### Opción 3: SQL Directo (si solo hay acceso a DB)

Ejecutar el siguiente SQL directamente en PostgreSQL:

```sql
-- Add new admin roles to Rol enum
DO $$ BEGIN
    ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'ADMIN_TRANSPORTISTAS';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'ADMIN_OPERADORES';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'ADMIN_GENERADORES';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create TipoReversion enum
DO $$ BEGIN
    CREATE TYPE "TipoReversion" AS ENUM (
        'RECHAZO_ENTREGA',
        'ERROR_TRANSPORTISTA',
        'REVISION_CERTIFICADO',
        'CORRECCION_ADMIN'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create table
CREATE TABLE IF NOT EXISTS "reversiones_estado" (
    "id" TEXT NOT NULL,
    "manifiestoId" TEXT NOT NULL,
    "estadoAnterior" "EstadoManifiesto" NOT NULL,
    "estadoNuevo" "EstadoManifiesto" NOT NULL,
    "motivo" TEXT NOT NULL,
    "tipoReversion" "TipoReversion" NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rolUsuario" "Rol" NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reversiones_estado_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "reversiones_estado_manifiestoId_idx" ON "reversiones_estado"("manifiestoId");
CREATE INDEX IF NOT EXISTS "reversiones_estado_usuarioId_idx" ON "reversiones_estado"("usuarioId");
CREATE INDEX IF NOT EXISTS "reversiones_estado_createdAt_idx" ON "reversiones_estado"("createdAt");

-- Add foreign keys
DO $$ BEGIN
    ALTER TABLE "reversiones_estado" ADD CONSTRAINT "reversiones_estado_manifiestoId_fkey"
    FOREIGN KEY ("manifiestoId") REFERENCES "manifiestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "reversiones_estado" ADD CONSTRAINT "reversiones_estado_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Register migration in Prisma migrations table
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
    gen_random_uuid()::text,
    'hotfix_manual',
    NOW(),
    '20260115183000_add_reversiones_estado',
    NULL,
    NULL,
    NOW(),
    1
) ON CONFLICT DO NOTHING;
```

---

## VERIFICACIÓN

Después de aplicar el hotfix, ejecutar:

```bash
# Test de reversión
curl -X POST "https://sitrep.ultimamilla.com.ar/api/manifiestos/man-test-003/revertir-entrega" \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"motivo":"Test hotfix reversiones"}'

# Respuesta esperada:
# {"success":true,"message":"Entrega revertida correctamente..."}
```

---

## ARCHIVOS MODIFICADOS

1. `backend/prisma/migrations/20260115183000_add_reversiones_estado/migration.sql` (NUEVO)
2. `hotfix-reversiones.sh` (NUEVO)
3. `HOTFIX_REVERSIONES_20260115.md` (NUEVO)

---

## ROLLBACK (si es necesario)

```sql
DROP TABLE IF EXISTS "reversiones_estado";
DROP TYPE IF EXISTS "TipoReversion";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260115183000_add_reversiones_estado';
```

---

**Autor:** Claude AI
**Fecha:** 2026-01-15T18:30:00Z
