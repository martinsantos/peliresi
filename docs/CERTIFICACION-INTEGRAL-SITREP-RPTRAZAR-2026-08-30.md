# Certificación integral SITREP / RPTRAZAR para capacitación

> **Informe intermedio superado.** El acceso gubernamental fue restablecido, las migraciones y el despliegue se completaron, y RPTRAZAR aprobó las pruebas finales. Consulte el [informe de certificación final](./CERTIFICACION-FINAL-SITREP-RPTRAZAR-2026-08-30.md), que prevalece sobre este registro histórico.

Fecha de ejecución: 30 de agosto de 2026
Objetivo: verificar código, migraciones, despliegues, web, PWA, API, autenticación, roles, impersonación y workflow sin enviar correos a usuarios finales ni modificar credenciales.

## Dictamen ejecutivo

| Entorno | Dictamen | Uso recomendado |
|---|---|---|
| `https://sitrep.ultimamilla.com.ar/` | **APTO para capacitación** | Entorno principal del curso |
| `https://rptrazar.mendoza.gov.ar/` | **NO APTO / NO ESPEJADO** | No usar hasta respaldar, migrar y desplegar la misma release |

SITREP quedó respaldado, migrado y validado después del despliegue. RPTRAZAR responde en web y API, pero mantiene una versión anterior de frontend, backend, permisos y esquema de base. El nodo productivo gubernamental rechaza la conexión SSH y la VIP no autoriza la clave de despliegue; por seguridad no se forzó ningún acceso alternativo.

## Estado del código local

- Rama: `codex/sitrep-hardening-snapshot-20260729`.
- HEAD: `9ffc7b9e4d5a67900ad5a16ca19f5a0d0ff1b58d`.
- El WIP continúa sin commit y con cambios locales amplios. No se descartó ni sobrescribió ningún archivo.
- Prisma contiene 15 migraciones, incluida `20260825090000_add_international_treatment`.
- No existen dos repositorios Git independientes: hay una sola base de código y dos despliegues que deberían publicar la misma release.

## Baseline local

| Componente | Resultado |
|---|---|
| Backend unit/integration | 36 archivos, 296/296 pruebas aprobadas |
| Backend build | Aprobado |
| Frontend unit | 14 archivos, 91/91 pruebas aprobadas |
| Frontend web build | Aprobado |
| Frontend PWA build | Aprobado |

Advertencias no bloqueantes: `browserslist` desactualizado y avisos de imports dinámicos sin división efectiva de chunk.

## SITREP — evidencia de aprobación

### Respaldo y migraciones

- Backup PostgreSQL validado: `/opt/directus-backups/sitrep-pre-migration-20260830-175000.dump`.
- SHA-256: `3f82fe3324f9359bf41b222075a33ad22bac40244661a49d0b12e980832a384f`.
- Backup de entorno: `/opt/directus-backups/sitrep-pre-migration-20260830-175000.env`.
- Release backend activa: `/var/www/sitrep-backend-release-candidates/20260830-180000-goal`.
- Estado Prisma posterior: **15 migraciones encontradas; esquema actualizado**.
- Migración aplicada: `20260825090000_add_international_treatment`.
- Despliegue realizado con `pm2 reload`; las dos instancias quedaron `online`.
- Release anterior conservada para rollback.

### Controles operativos

- `GET https://sitrep.ultimamilla.com.ar/api/health`: `200`, base conectada.
- `DISABLE_EMAILS=true` verificado en el entorno activo.
- `FILE_SCAN_MODE=required` verificado.
- ClamAV disponible en `/usr/bin/clamscan`.
- Almacenamiento privado disponible en `/var/lib/sitrep-uploads`, fuera del webroot.
- No se ejecutaron pruebas que envíen correo, push o avisos a usuarios finales.

### Paridad del artefacto

- `frontend/dist/index.html` coincide byte a byte con `/var/www/sitrep/index.html`.
- `frontend/dist-app/app.html` coincide byte a byte con `/var/www/sitrep/app/app.html`.
- El service worker sólo difiere por la versión temporal inyectada durante cada build; el código funcional coincide.

### Pruebas remotas

| Suite | Resultado |
|---|---|
| E2E integral previo a migración | 17/17 |
| Health/auth/documentos posterior a migración | 11/11 |
| Crawl postmigración web/PWA, contratos, roles e impersonación | 7/7 |
| Contrato explícito de paridad de release | 2/2 |
| Sonda sectorial no mutante de Ivana, Santiago y Marcia | 46 controles aprobados |

La sonda sectorial confirmó:

- cuentas presentes y activas;
- impersonación desde el ADMIN raíz;
- perfiles `ADMIN_GENERADOR`, `ADMIN` y `ADMIN_OPERADOR` correctos;
- dashboard, manifiestos, notificaciones, alertas, centro de control y catálogos accesibles;
- autorización del tramo correcto del workflow para cada sector;
- rechazo por estado `CANCELADO` con `400`, sin alterar el manifiesto.

## RPTRAZAR — evidencia de no conformidad

### Lo que sí responde

- `GET https://rptrazar.mendoza.gov.ar/api/health`: `200`, base conectada.
- Login con la credencial histórica del entorno: operativo.
- Auditoría visual multirresolución del shell: 0 desbordes detectados.
- Los activos públicos básicos de web y PWA responden.

### Fallas confirmadas

- E2E integral: **13/17 aprobadas; 4 fallidas**.
- Crawl web: **69 incidencias** (`403`, `408`, recursos fallidos y errores de consola).
- Crawl PWA: **37 incidencias** (`403` y recursos fallidos).
- Impersonación general: no aparece un usuario activo de Generador como destino.
- Administradores sectoriales: Ivana no aparece como destino impersonable.
- La sonda sectorial se detiene porque el ADMIN raíz no puede consultar usuarios activos.
- Contrato de release: **1/2**; `GET /api/catalogos/entidades-exteriores` responde `500`.
- Los hashes de `index.html` y `app.html` difieren de SITREP, confirmando que los artefactos no son espejo.
- La credencial vigente acordada para el ADMIN de SITREP no está sincronizada en Gobierno.

### Bloqueo SSH seguro

- El host configurado `192.168.205.197:22` rechaza la conexión.
- La VIP `192.168.204.228:22` acepta TCP y su huella Ed25519 coincide con la entrada histórica guardada para esa IP: `SHA256:IrlCI37BETlLo2KgmAq1VKXDE6vRNNRpHe9Y3oQ/wtg`.
- La conexión directa a la VIP con verificación estricta es rechazada con `Permission denied (publickey)`; no es el acceso autorizado al nodo aplicativo.
- El nombre `rptrazar.mendoza.gov.ar` conserva otra clave histórica en `known_hosts`, por lo que no se reemplazó ni se omitió esa verificación.

Por este bloqueo no fue posible, de forma segura:

- respaldar la base y el `.env` gubernamentales;
- confirmar la política SMTP activa;
- consultar `prisma migrate status` dentro del servidor;
- aplicar migraciones;
- desplegar la release validada;
- ejecutar el E2E final posterior al despliegue.

## Acción requerida del sysadmin de Gobierno

1. Restaurar SSH en el nodo productivo `192.168.205.197:22`, o informar el nuevo nodo/usuario/clave de despliegue autorizado detrás de la VIP.
2. No reiniciar, actualizar kernel/libc ni cambiar paquetes del sistema para esta intervención.
3. Una vez verificada la identidad: respaldar PostgreSQL y `.env`, validar rollback, confirmar correo desactivado, aplicar las 15 migraciones, desplegar la misma release de SITREP con recarga sin downtime y repetir todas las sondas.

## Criterio para la capacitación

- Usar exclusivamente `https://sitrep.ultimamilla.com.ar/` y `https://sitrep.ultimamilla.com.ar/app/`.
- Mantener RPTRAZAR fuera del curso hasta completar el procedimiento anterior.
- SMTP real, cámara QR física y GPS físico siguen fuera de esta certificación; no afectan la capacitación de escritorio ya validada.
- No se almacenan credenciales en este informe.

## Cambios realizados al arnés de prueba

- Playwright admite canal de navegador mediante `PLAYWRIGHT_BROWSER_CHANNEL`.
- Las credenciales E2E se reciben sólo por variables de entorno.
- Se agregó `frontend/e2e/release-parity.spec.ts` para detectar desalineación de backend y activos.
- La sonda sectorial fue corregida para probar el tramo correspondiente a cada rol sin realizar mutaciones.
