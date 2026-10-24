# Publicación de espacios de trabajo por rol — 24/10/2026

**51e4271abefa35596ac3ded0057883b4766fde2d publicado en backend, web, app y manual de https://sitrep.ultimamilla.com.ar a las 12:07:22 Mendoza (2026-10-24T15:07:22.135Z).** Sustituye 75168a08. La publicación está completada; las pruebas funcionales detalladas en [el refactor](REFACTOR-ROLES-20261024.md) corresponden al preview.

## Cambios publicados

- Menús, títulos, destinos y permisos compartidos entre web y app. Inicio presenta una única lista de manifiestos pendientes y acciones de cada función, sin duplicar Actividad reciente.
- Generador, transportista y operador no acceden al directorio ni al módulo de Inspecciones. Abren su requerimiento publicado desde Avisos, responden y consultan la decisión. Los enlaces anteriores a casos concretos redirigen; el servidor conserva el aislamiento entre entidades.
- Empresas y establecimientos sólo aparece cuando existe acceso útil. La vista temporal explica sus límites; errores y listas vacías se distinguen.
- Ayuda en el encabezado, menú de cuenta completo, contexto visible y avisos en vivo que no presentan como nuevos los avisos históricos que aparecen al leer otros.
- Manual actualizado con el espacio por rol y la respuesta limitada a requerimientos.

## Verificación

Preview: **330 unitarias frontend, 212 backend y 20 controles HTTP PASS**, más recorridos reales en navegador web y app descritos en el refactor. Fuente del delta contrastada con los 59 archivos probados. No se presentan estos recorridos como pruebas sobre producción.

Publicación: compilación remota serial en el contenedor existente, **1 CPU / 2 GiB / swap adicional cero**, **2.528 archivos Git exactos** verificados antes y después. Backend, cliente Prisma, tipos, web y app PASS, sin OOM. API final de Ultima Milla. Paquetes: backend 425 archivos, web 521, app 202 y cliente Prisma 14.

Producción: **187/187 smoke, 9/9 externo y 8/8 PWA PASS**. Sólo GET de shell, rutas, chunks, manual, workers, health y autorización sin credenciales; hashes exactos comprobados. Incluye las rutas nuevas /requerimientos/:id en web y app. No hubo logins, presentación de respuestas, lectura autenticada de requerimientos ni mutaciones de negocio. Las solicitudes generan logs y contadores técnicos normales del servicio.

Dos workers SITREP online. **.env idéntico byte a byte, flags actuales conservados; CAP cerrado, correos/push apagados** en configuración, procesos y estado guardado. Dependencias, esquema, migraciones y Nginx sin cambios. Uploads, historiales y otros servicios conservados. No se ejecutó migración, seed, workflow ni push. Main permanece c8402190edfc36b5e5d0dee1337c24bd1689420d.

Manual **2026.24.1**, contenido exacto del commit; help-data.js y directorio.html actualizados, con revalidación de caché comprobada. SW raíz **trazabilidad-rrpp-v172**, app **20261024150317**. Las sesiones abiertas reciben la actualización por el mecanismo existente; no se borró almacenamiento del usuario.

## Respaldo y reversión vigente

- Backend: /var/www/sitrep-backend-releases/20261024-producto-51e4271a.
- Web/app/manual: /var/www/sitrep-releases/20261024-producto-51e4271a.
- Respaldo y evidencia privados: /var/backups/sitrep/20261024-producto-51e4271a.
- Reversión preparada a backend **75168a08** y frontend /var/www/sitrep-releases/20261024-producto-51e4271a-rollback; SW **trazabilidad-rrpp-v173**, app **20261024150633**. No ejecutada.

Se respaldaron configuración y PM2 en privado, se verificaron los árboles previos y se conservaron sus releases. No se tomó ni restauró backup de base porque no hay migración ni escritura de datos. Para revertir sólo esta publicación, desde su directorio privado: `node - rollback < publish-production.ts`. No usar reversiones históricas.

## Evidencias y límites

Workspace del hilo: roles-navigation-20261024/release, con source-proof.json, qa-summary.json, build.json, preflight.json, stage.json, deployment.json, postflight.json, smoke.json, external-smoke.json, pwa-smoke.json y release-result.json. Los secretos de respaldo permanecen sólo en el servidor.

El smoke confirma entrega y salud de la versión; no vuelve a certificar todas las operaciones del producto. **Android físico, GPS en campo, entrega externa de correos/push y carga sostenida siguen fuera de esta validación.** Runtime de pruebas cerrado; base artificial y evidencias conservadas. La documentación de cierre posterior no cambia el commit de producto publicado.
