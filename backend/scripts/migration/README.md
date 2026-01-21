# Migración Masiva de Generadores - SITREP

Este directorio contiene los scripts necesarios para migrar ~1,850 generadores desde archivos Excel/CSV al sistema SITREP.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `transform-generadores.ts` | Transforma datos del CSV fuente al formato de la DB |
| `migrate-generadores.ts` | Ejecuta la migración por lotes con backup |
| `validate-migration.ts` | Valida la integridad de los datos post-migración |
| `rollback-migration.ts` | Revierte la migración (completa o parcial) |

## Requisitos

- Node.js 18+
- `tsx` instalado (`npm install -g tsx`)
- Acceso SSH al servidor de producción
- Docker con el contenedor de PostgreSQL corriendo

## Datos de Producción

- **Servidor**: 23.105.176.45
- **URL**: https://sitrep.ultimamilla.com.ar
- **Container DB**: `directus-admin-database-1`
- **Base de datos**: `trazabilidad_demo`
- **Usuario DB**: `directus`

---

## Proceso de Migración

### FASE 1: Preparación Local

#### 1.1 Transformar datos del CSV

```bash
# Desde el directorio backend/
npx tsx scripts/migration/transform-generadores.ts \
  "/ruta/a/generadores21012926" \
  --output generadores-transformados.json
```

Esto genera:
- `generadores-transformados.json` - Datos listos para migrar
- `generadores-transformados-errors.json` - Registros con errores (si hay)
- `generadores-transformados-duplicates.json` - CUITs duplicados (si hay)

#### 1.2 Revisar el archivo transformado

```bash
# Ver cantidad de registros
cat generadores-transformados.json | jq length

# Ver primeros 3 registros
cat generadores-transformados.json | jq '.[0:3]'

# Contar emails generados automáticamente
cat generadores-transformados.json | jq '[.[] | select(.emailGenerado == true)] | length'
```

### FASE 2: Prueba en Local (Opcional pero recomendado)

#### 2.1 Descargar backup de producción

```bash
# Crear backup en servidor
ssh root@23.105.176.45 "docker exec directus-admin-database-1 \
  pg_dump -U directus trazabilidad_demo | gzip > /backups/backup-$(date +%Y%m%d).sql.gz"

# Descargar
scp root@23.105.176.45:/backups/backup-*.sql.gz ./backups/
```

#### 2.2 Restaurar en DB local

```bash
# Crear DB local
createdb sitrep_staging

# Restaurar
gunzip -c backups/backup-*.sql.gz | psql sitrep_staging

# Configurar DATABASE_URL para apuntar a local
export DATABASE_URL="postgresql://user:pass@localhost:5432/sitrep_staging"
```

#### 2.3 Probar migración en local

```bash
# Dry-run primero
npx tsx scripts/migration/migrate-generadores.ts \
  generadores-transformados.json \
  --dry-run --no-backup

# Si todo ok, ejecutar real
npx tsx scripts/migration/migrate-generadores.ts \
  generadores-transformados.json \
  --no-backup
```

### FASE 3: Migración en Producción

#### 3.1 Preparación

```bash
# Conectar al servidor
ssh root@23.105.176.45

# Verificar estado del servidor
free -h && df -h && pm2 list

# Verificar DB
docker exec directus-admin-database-1 psql -U directus -d trazabilidad_demo \
  -c "SELECT COUNT(*) as generadores FROM generadores"
```

#### 3.2 Crear backup GOLDEN

```bash
# Este es el backup que usaremos para rollback si algo falla
docker exec directus-admin-database-1 pg_dump \
  -U directus trazabilidad_demo | gzip > /backups/GOLDEN-pre-migracion-$(date +%Y%m%d).sql.gz

# Verificar
ls -la /backups/GOLDEN*
```

#### 3.3 Copiar archivos al servidor

```bash
# Desde tu máquina local
scp generadores-transformados.json root@23.105.176.45:/var/www/sitrep-backend/

scp scripts/migration/*.ts root@23.105.176.45:/var/www/sitrep-backend/scripts/migration/
```

#### 3.4 Ejecutar migración

```bash
# En el servidor
cd /var/www/sitrep-backend

# Opción A: Dry-run primero
npx tsx scripts/migration/migrate-generadores.ts \
  generadores-transformados.json \
  --batch-size 200 \
  --dry-run

# Opción B: Ejecutar real
npx tsx scripts/migration/migrate-generadores.ts \
  generadores-transformados.json \
  --batch-size 200 \
  --delay 2000
```

#### 3.5 Monitorear (en otra terminal)

```bash
# Logs del backend
pm2 logs sitrep-backend --lines 100

# Uso de recursos
htop

# Espacio en disco
watch df -h
```

### FASE 4: Validación

```bash
# Ejecutar validación
npx tsx scripts/migration/validate-migration.ts generadores-transformados.json

# Verificar conteos manualmente
docker exec directus-admin-database-1 psql -U directus -d trazabilidad_demo -c "
  SELECT
    (SELECT COUNT(*) FROM generadores) as total_generadores,
    (SELECT COUNT(*) FROM usuarios WHERE rol='GENERADOR') as usuarios_generador,
    (SELECT COUNT(*) FROM generadores WHERE email LIKE '%@sitrep.local') as emails_generados
"
```

### FASE 5: Verificación en UI

1. Abrir https://sitrep.ultimamilla.com.ar
2. Login como admin
3. Ir a Gestión de Actores → Generadores
4. Verificar:
   - Paginación funciona
   - Búsqueda por CUIT funciona
   - Los datos se ven correctos

---

## Rollback

### Rollback Completo (restaurar backup)

```bash
# Listar backups disponibles
npx tsx scripts/migration/rollback-migration.ts --list

# Restaurar backup GOLDEN
npx tsx scripts/migration/rollback-migration.ts \
  --full /backups/GOLDEN-pre-migracion-XXXXXXXX.sql.gz
```

### Rollback Parcial (eliminar por fecha)

```bash
# Dry-run primero
npx tsx scripts/migration/rollback-migration.ts \
  --partial \
  --after "2026-01-21T00:00:00Z" \
  --dry-run

# Ejecutar real
npx tsx scripts/migration/rollback-migration.ts \
  --partial \
  --after "2026-01-21T00:00:00Z"
```

### Rollback Manual con SQL

```sql
-- Identificar generadores migrados (por fecha)
SELECT COUNT(*) FROM generadores WHERE "createdAt" > '2026-01-21 00:00:00';

-- Eliminar generadores sin manifiestos
DELETE FROM generadores
WHERE "createdAt" > '2026-01-21 00:00:00'
  AND id NOT IN (SELECT "generadorId" FROM manifiestos);

-- Eliminar usuarios huérfanos
DELETE FROM usuarios
WHERE rol = 'GENERADOR'
  AND "createdAt" > '2026-01-21 00:00:00'
  AND id NOT IN (SELECT "usuarioId" FROM generadores);
```

---

## Troubleshooting

### Error: "CUIT ya existe"

El script salta automáticamente CUITs duplicados. Revisar el archivo de errores.

### Error: "Email ya existe"

El script genera emails placeholder (`generador-CERT@sitrep.local`) para emails duplicados o inválidos.

### Error de memoria

Reducir el tamaño del lote:
```bash
npx tsx scripts/migration/migrate-generadores.ts data.json --batch-size 50
```

### Timeout en la conexión

Aumentar el delay entre lotes:
```bash
npx tsx scripts/migration/migrate-generadores.ts data.json --delay 5000
```

### Error de backup

Si los backups fallan, se puede continuar con `--no-backup` (no recomendado en producción).

---

## Campos del CSV Fuente

| Campo CSV | Campo DB | Notas |
|-----------|----------|-------|
| CERTIFICADO | numeroInscripcion | Obligatorio |
| RAZON SOCIAL | razonSocial | Obligatorio |
| CUIT | cuit | Normalizado a XX-XXXXXXXX-X |
| DOMICILIO LEGAL calle y Nº | domicilio | Concatenado con localidad y depto |
| DOMICILIO LEGAL Localidad | domicilio | Concatenado |
| DOMICILIO LEGAL Depto. | domicilio | Concatenado |
| CORREO ELECTRONICO P/NOTIFICAR | email | Placeholder si inválido |
| TELEFONOS DE CONTACTO | telefono | Limpiado de caracteres especiales |
| CATEGORIAS DE CONTROL AUTORIZADAS | categoria | Obligatorio |

---

## Seguridad

- El password inicial de cada generador es su CUIT (hasheado con bcrypt)
- Los generadores se crean con `activo: true` y `aprobado: true`
- Los backups se crean en `/backups/` en el servidor
- Los logs se guardan en `./logs/` con timestamp

---

## Contacto

Para problemas con la migración, revisar los logs en `./logs/` o contactar al equipo de desarrollo.
