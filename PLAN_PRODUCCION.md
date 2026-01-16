# Plan de Puesta en Producción - SITREP v10.0

> **Fecha**: 2026-01-16
> **Estado**: En desarrollo DEMO
> **Próximo paso**: Completar desarrollo DEMO, luego ejecutar este plan

---

## Estado Actual del Sistema

### Infraestructura ✅
| Componente | Estado | Detalles |
|------------|--------|----------|
| Backend | ✅ Online | Node.js + Express + Prisma |
| Database | ✅ Connected | PostgreSQL |
| Redis | ✅ Connected | Cache + Sessions |
| Frontend | ✅ Deployed | React + Vite + PWA |
| SSL/HTTPS | ✅ Activo | Let's Encrypt |
| WebSocket | ✅ Activo | Socket.IO para tiempo real |

### Datos Actuales (DEMO)
| Tabla | Registros | Estado |
|-------|-----------|--------|
| Usuarios | 31 | Demo (@demo.com) |
| Manifiestos | 39 | Datos de prueba |
| Generadores | 4 | Empresas ficticias |
| Transportistas | 23 | Datos de prueba |
| Operadores | 3 | Datos de prueba |
| Viajes activos | 3 | Tracking GPS simulado |
| Tipos Residuo | 15 | Catálogo base (mantener) |

### Optimizaciones Aplicadas (v10.0)
- [x] N+1 queries eliminados
- [x] Pool DB: 50 conexiones
- [x] Índices compuestos en Prisma
- [x] React Query para caché frontend
- [x] Health checks robustos
- [x] Logger estructurado (Pino)
- [x] Docker Compose para producción
- [x] Nginx load balancer config

---

## FASE 1: Preparación de Infraestructura

### 1.1 Backup Completo
```bash
# En servidor de producción
pg_dump -U sitrep trazabilidad_rrpp > backup_demo_$(date +%Y%m%d).sql
redis-cli BGSAVE
```

### 1.2 Configurar Variables de Entorno Producción
```bash
# Cambiar en /var/www/sitrep-backend/.env
NODE_ENV=production
JWT_SECRET=<nuevo-secreto-seguro-32-chars>
JWT_REFRESH_SECRET=<otro-secreto-seguro-32-chars>
ADMIN_PASSWORD=<password-seguro>

# Verificar CORS
CORS_ORIGIN=https://sitrep.ultimamilla.com.ar
```

### 1.3 Aplicar Migraciones Pendientes
```bash
cd /var/www/sitrep-backend
npx prisma migrate deploy
npx prisma generate
pm2 restart sitrep-backend
```

---

## FASE 2: Limpieza de Datos Demo

### 2.1 Script de Limpieza
Crear `backend/scripts/cleanup-demo-data.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDemoData() {
  console.log('=== LIMPIEZA DE DATOS DEMO ===');

  // 1. Eliminar en orden por dependencias
  const deletions = [
    prisma.trackingGPS.deleteMany(),
    prisma.viaje.deleteMany(),
    prisma.eventoManifiesto.deleteMany(),
    prisma.residuoManifiesto.deleteMany(),
    prisma.manifiesto.deleteMany(),
    prisma.notificacion.deleteMany(),
    prisma.pushSubscription.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.logActividad.deleteMany(),
    prisma.auditoria.deleteMany(),
    prisma.chofer.deleteMany(),
    prisma.vehiculo.deleteMany(),
    // Eliminar usuarios demo (mantener admin real)
    prisma.usuario.deleteMany({
      where: { email: { contains: '@demo.com' } }
    }),
    // Eliminar actores demo
    prisma.generador.deleteMany(),
    prisma.transportista.deleteMany(),
    prisma.operador.deleteMany(),
  ];

  for (const deletion of deletions) {
    const result = await deletion;
    console.log(`Eliminados: ${result.count} registros`);
  }

  // 2. Mantener catálogos base
  console.log('\n=== DATOS MANTENIDOS ===');
  const tiposResiduo = await prisma.tipoResiduo.count();
  console.log(`Tipos de Residuo: ${tiposResiduo}`);

  // 3. Verificar usuario admin
  const admin = await prisma.usuario.findFirst({
    where: { rol: 'ADMIN' }
  });
  console.log(`Admin: ${admin?.email || 'NO EXISTE - CREAR'}`);

  console.log('\n=== LIMPIEZA COMPLETADA ===');
}

cleanupDemoData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 2.2 Ejecutar Limpieza
```bash
cd /var/www/sitrep-backend
npx ts-node scripts/cleanup-demo-data.ts
```

---

## FASE 3: Migración de Datos Reales

### 3.1 Estructura de Archivos CSV
Preparar en `backend/scripts/migration/data/`:

#### generadores.csv
```csv
razon_social,cuit,email,telefono,direccion,localidad,numero_inscripcion,fecha_habilitacion,categoria
"EMPRESA SA","30-71234567-9","contacto@empresa.com","261-4234567","Av. San Martin 1234","Mendoza","GEN-2024-001","2024-01-15","Grande"
```

#### transportistas.csv
```csv
razon_social,cuit,email,telefono,direccion,numero_habilitacion,fecha_habilitacion
"TRANSPORTE SRL","30-70987654-3","info@transporte.com","261-4567890","Ruta 40 Km 5","TRA-2024-001","2024-02-20"
```

#### vehiculos.csv
```csv
cuit_empresa,patente,marca,modelo,capacidad_kg,numero_habilitacion,vencimiento
"30-70987654-3","AB123CD","Mercedes-Benz","Atego 1726","8000","VEH-2024-001","2025-12-31"
```

#### choferes.csv
```csv
cuit_empresa,nombre,dni,licencia,vencimiento_licencia
"30-70987654-3","Juan Pérez","12345678","LIC-001","2026-06-30"
```

#### operadores.csv
```csv
razon_social,cuit,email,telefono,direccion,numero_habilitacion,fecha_habilitacion,metodo_tratamiento
"TRATAMIENTO SA","30-76543210-1","operador@empresa.com","261-4111222","Parque Industrial","OPE-2024-001","2024-03-01","Incineración"
```

### 3.2 Scripts de Importación

#### import-generadores.ts
```typescript
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

const prisma = new PrismaClient();

async function importGeneradores(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = csv.parse(content, { columns: true, skip_empty_lines: true });

  let success = 0, errors: string[] = [];

  for (const row of records) {
    try {
      const cuitNorm = normalizeCUIT(row.cuit);

      // Crear generador
      const generador = await prisma.generador.create({
        data: {
          razonSocial: row.razon_social.trim().toUpperCase(),
          cuit: cuitNorm,
          email: row.email?.toLowerCase() || null,
          telefono: row.telefono,
          direccion: row.direccion,
          localidad: row.localidad,
          numeroInscripcion: row.numero_inscripcion,
          fechaHabilitacion: row.fecha_habilitacion ? new Date(row.fecha_habilitacion) : null,
          categoria: row.categoria,
          activo: true
        }
      });

      // Crear usuario asociado
      if (row.email) {
        await prisma.usuario.create({
          data: {
            email: row.email.toLowerCase(),
            password: await hashPassword('CambiarPassword123!'),
            nombre: row.razon_social.split(' ')[0],
            rol: 'GENERADOR',
            cuit: cuitNorm,
            empresa: row.razon_social,
            activo: true,
            aprobado: true,
            generador: { connect: { id: generador.id } }
          }
        });
      }

      success++;
    } catch (e) {
      errors.push(`${row.cuit}: ${(e as Error).message}`);
    }
  }

  console.log(`Importados: ${success}, Errores: ${errors.length}`);
  if (errors.length) console.log('Errores:', errors);
}

function normalizeCUIT(cuit: string): string {
  const clean = cuit.replace(/\D/g, '');
  return `${clean.slice(0,2)}-${clean.slice(2,10)}-${clean.slice(10)}`;
}

importGeneradores(process.argv[2] || 'scripts/migration/data/generadores.csv');
```

### 3.3 Orden de Importación
```bash
# 1. Generadores
npx ts-node scripts/migration/import-generadores.ts data/generadores.csv

# 2. Transportistas (incluye vehículos y choferes)
npx ts-node scripts/migration/import-transportistas.ts data/

# 3. Operadores
npx ts-node scripts/migration/import-operadores.ts data/operadores.csv

# 4. Validar migración
npx ts-node scripts/migration/validate-migration.ts
```

---

## FASE 4: Configuración de Usuarios

### 4.1 Usuario Admin DGFA
```typescript
// Actualizar password del admin existente
await prisma.usuario.update({
  where: { email: 'admin@dgfa.mendoza.gov.ar' },
  data: {
    password: await hashPassword('NuevoPasswordSeguro123!'),
    dosFaSecret: null, // Resetear 2FA para reconfigurar
    dosFaVerificado: false
  }
});
```

### 4.2 Habilitar 2FA para Admins
1. Login como admin
2. Ir a Configuración > Seguridad
3. Activar autenticación de dos factores
4. Escanear QR con Google Authenticator

### 4.3 Crear Usuarios por Empresa
Cada empresa importada tendrá un usuario con:
- Email de contacto como login
- Password temporal: `CambiarPassword123!`
- Rol según tipo (GENERADOR/TRANSPORTISTA/OPERADOR)
- Estado: activo y aprobado

---

## FASE 5: Configuración de Alertas

### 5.1 Reglas de Alerta Predeterminadas
```sql
-- Insertar reglas básicas
INSERT INTO "ReglaAlerta" (id, nombre, tipo, condicion, activa, "creadoPorId")
VALUES
  (gen_random_uuid(), 'Manifiesto próximo a vencer', 'VENCIMIENTO', '{"diasAntes": 7}', true, '<admin-id>'),
  (gen_random_uuid(), 'Viaje sin movimiento', 'INACTIVIDAD', '{"minutosMax": 30}', true, '<admin-id>'),
  (gen_random_uuid(), 'Desviación de ruta', 'DESVIO_RUTA', '{"metrosMax": 500}', true, '<admin-id>');
```

### 5.2 Configurar Notificaciones Push
1. Verificar VAPID keys en .env
2. Solicitar permiso de notificaciones en navegador
3. Probar envío de notificación de prueba

---

## FASE 6: Testing Pre-Producción

### 6.1 Checklist de Flujo Completo
- [ ] Login con usuario real
- [ ] Crear manifiesto borrador
- [ ] Aprobar manifiesto
- [ ] Asignar transporte (vehículo + chofer)
- [ ] Iniciar viaje desde app móvil
- [ ] Verificar tracking GPS en Centro de Control
- [ ] Registrar entrega
- [ ] Confirmar recepción
- [ ] Registrar tratamiento
- [ ] Verificar auditoría completa

### 6.2 Test de Carga
```bash
# Instalar artillery
npm install -g artillery

# Test básico: 50 usuarios, 100 requests cada uno
artillery quick --count 50 --num 100 https://sitrep.ultimamilla.com.ar/api/health
```

### 6.3 Verificar Integraciones
- [ ] WebSocket conecta y recibe actualizaciones
- [ ] Push notifications llegan a dispositivos
- [ ] Emails se envían correctamente
- [ ] PDF de manifiestos se genera

---

## FASE 7: Go-Live

### 7.1 Checklist Final
- [ ] Backup de base de datos realizado
- [ ] Variables de entorno de producción configuradas
- [ ] SSL/HTTPS funcionando
- [ ] Health checks respondiendo OK
- [ ] Logs configurados correctamente
- [ ] Monitoreo de errores activo

### 7.2 Comunicación a Usuarios
1. Enviar email con credenciales a cada empresa
2. Adjuntar manual de usuario (MANUAL_TUTORIAL.md)
3. Indicar canal de soporte

### 7.3 Soporte Inicial
- Primera semana: Soporte intensivo 8x5
- Segundo mes: Soporte regular
- Documentar incidencias frecuentes

---

## Comandos Útiles

```bash
# Estado del sistema
curl https://sitrep.ultimamilla.com.ar/api/health

# Logs en tiempo real
ssh root@23.105.176.45 "pm2 logs sitrep-backend --lines 100"

# Restart backend
ssh root@23.105.176.45 "pm2 restart sitrep-backend"

# Deploy frontend
rsync -avz frontend/dist/ root@23.105.176.45:/var/www/sitrep/

# Deploy backend
rsync -avz backend/dist/ root@23.105.176.45:/var/www/sitrep-backend/dist/
ssh root@23.105.176.45 "pm2 restart sitrep-backend"
```

---

## Contactos

| Rol | Nombre | Contacto |
|-----|--------|----------|
| Admin Sistema | TBD | admin@dgfa.mendoza.gov.ar |
| Soporte Técnico | TBD | soporte@... |
| Desarrollo | TBD | dev@... |

---

## Historial de Cambios

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-01-16 | 10.0 | Refactorización escalabilidad, plan unificado |
| 2026-01-15 | 9.0 | Centro de Control, Admin App tracking |
| 2026-01-14 | 8.0 | Sincronización APP ↔ WEB |

