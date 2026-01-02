# 🔴 Track A: Backend & Base de Datos

## Contexto
Sistema de Trazabilidad de Residuos Peligrosos (SITREP) para DGFA Mendoza.
- **Demo actual**: https://www.ultimamilla.com.ar/demoambiente/
- **Proyecto**: `/trazabilidad-rrpp-demo/backend/`
- **Stack**: Node.js + Express + TypeScript + Prisma + PostgreSQL

---

## Tareas a Ejecutar

### A1: Configurar Base de Datos de Producción
```bash
# En servidor 23.105.176.45
docker exec -it directus-admin-database-1 psql -U directus -c "CREATE DATABASE trazabilidad_prod;"
```

Crear archivo `backend/.env.production.new`:
```env
NODE_ENV=production
PORT=3011
DATABASE_URL="postgresql://directus:umbot_directus_2025!@localhost:5432/trazabilidad_prod?schema=public"
JWT_SECRET=[GENERAR_NUEVO_SECRET_32_CHARS]
JWT_REFRESH_SECRET=[GENERAR_NUEVO_SECRET_32_CHARS]
FRONTEND_URL=https://ambiente.mendoza.gov.ar
ENABLE_ANALYTICS=true
```

### A2: Implementar CU-S05 - Sincronización Offline
Crear `backend/src/controllers/sync.controller.ts`:
```typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const syncController = {
  // Subir operaciones pendientes del dispositivo
  async uploadPending(req: Request, res: Response) {
    const { operations } = req.body;
    // Procesar cola de operaciones offline
    // Manejar conflictos por timestamp
  },
  
  // Descargar manifiestos para cache local
  async downloadForCache(req: Request, res: Response) {
    const userId = req.user?.id;
    // Retornar manifiestos asignados al usuario
  },
  
  // Resolver conflictos de sincronización
  async resolveConflict(req: Request, res: Response) {
    // Política: server-wins con notificación al usuario
  }
};
```

Crear `backend/src/routes/sync.routes.ts` y registrar en app.

### A3: Completar CU-A04 - Roles Granulares
Modificar `backend/src/middlewares/auth.middleware.ts`:
- Agregar permisos granulares (create_manifest, sign_manifest, etc.)
- Implementar matriz de permisos por rol
- Middleware `checkPermission(permission: string)`

### A4: Implementar Emails Reales (CU-S03)
Modificar `backend/src/services/notificationService.ts`:
```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Templates HTML para cada tipo de notificación
```

### A5: Integrar Firma Digital Real
Preparar estructura para integración futura con PKI:
- `backend/src/services/signatureService.ts`
- Interface que permita cambiar de firma demo a firma real

### A6: Backups Automatizados
Crear `backend/scripts/backup-prod.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/backups/trazabilidad"
DATE=$(date +%Y%m%d_%H%M)
docker exec directus-admin-database-1 pg_dump -U directus trazabilidad_prod > "$BACKUP_DIR/backup_$DATE.sql"
# Mantener últimos 7 días
find $BACKUP_DIR -mtime +7 -delete
```

Agregar cron: `0 3 * * * /home/demoambiente/scripts/backup-prod.sh`

---

## Verificación
```bash
# Tests
cd backend && npm test

# Health check
curl http://localhost:3011/api/health

# Verificar sync endpoints
curl http://localhost:3011/api/sync/download -H "Authorization: Bearer TOKEN"
```

---

## Archivos a Modificar/Crear
- [ ] `backend/.env.production.new`
- [ ] `backend/src/controllers/sync.controller.ts`
- [ ] `backend/src/routes/sync.routes.ts`
- [ ] `backend/src/middlewares/auth.middleware.ts` (permisos)
- [ ] `backend/src/services/notificationService.ts` (emails)
- [ ] `backend/src/services/signatureService.ts`
- [ ] `backend/scripts/backup-prod.sh`
