# Revisión integral publicada — 21/10/2026

**Backend, web, `/app` y manual `13af2fb02e02d9fd39b2d4471bc40c2505c8f060` publicados** en `sitrep.ultimamilla.com.ar` el **21/10/2026 07:00:01 Mendoza**. Autorización expresa del dueño para este SHA, conservando flags, CAP cerrado y correos/push apagados; sin main, datos reales ni workflows. Los controles finales no mutantes pasaron.

Incluye la [revisión integral de circuitos y trece correcciones](REVISION-INTEGRAL-CIRCUITOS-20261020.md), y las [mejoras de altas de los tres actores](REVISION-ALTAS-20261020.md) previamente pendientes. Se publican los arreglos de formularios y acceso, avisos de agenda PSIP y eventuales, elegibilidad de correos, unidades de adendas, contexto por rol, documentos del transporte y navegación del manual. No se amplían permisos, cambian reglas regulatorias ni se habilitan funciones por este despliegue.

## Release y configuración

- Backend: `/var/www/sitrep-backend` → `/var/www/sitrep-backend-releases/20261021-circuitos-13af2fb0`.
- Web/app/manual: `/var/www/sitrep` → `/var/www/sitrep-releases/20261021-circuitos-13af2fb0`.
- `/release.json`: `source`, `backendSource` y `manualSource` corresponden al SHA autorizado; `RELEASE.json` del backend coincide.
- Manual **2026.20.20**, renderer **2026.20.6**, CSS **2026.20.5**. Todos sus archivos coinciden con el commit. Frente a c9cd877f, incluye el arreglo previo de desborde de URLs y el nuevo ajuste de navegación; el directorio conserva su HTML. Mismo diseño aprobado.
- SW raíz **v140**; app **20261021095619**. El fuente raíz conserva v127: sólo el artefacto transforma el identificador, con hashes antes/después. v139 estaba reservado para una reversión anterior. Activación explícita de la actualización y assets anteriores preservados; sin recarga global forzada.

`.env` idéntico byte por byte antes/después: SHA-256 **`618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`**. Comprobado en archivo, ambos workers y estado PM2 guardado:

- `UPLOADS_DIR=/var/lib/sitrep-uploads`, más el enlace histórico de uploads, conservados. Sin abrir/mover documentos de negocio.
- `TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z`; CAP continúa cerrado. Sin logins ni reactivación de alias.
- `DISABLE_EMAILS=true`, `PUSH_MANIFEST_NOTICES_ENABLED=false`, VAPID vacío y SMTP sin contraseña. No se enviaron correos/push ni se ensayaron proveedores.
- Enterprise, eventuales, adendas, revisión de partes y multirrol **false**; relevos/GPS múltiple **true**; demo frontend **false**. Sin flags nuevos ni cambio de entorno. Los ensayos con funciones habilitadas en QA no cambian esta decisión productiva.

Se recargó exclusivamente `sitrep-backend`. Workers **609582 / 609597**, online, un reinicio previsto cada uno (**31 → 32**). Verificación posterior **21/10/2026 07:00:29 Mendoza**: mismos PID/contadores, readiness/live/health correctos y configuración guardada. Otras aplicaciones y Nginx intactos.

## Preparación y respaldo

Auditoría privada **`/var/backups/sitrep/20261021-circuitos-13af2fb0/`**, directorio root 0700. Copias del `.env` y PM2 modo 0600, verificadas antes de activar. Release anterior conservado; inventarios de su backend e interfaz y copia de reversión verificados por hash.

**Sin migración:** `backend/prisma`, esquema, `package.json` y lockfile son idénticos a c9cd877f. No se ejecutaron Prisma migrate, seeds, backfill, restauraciones ni consultas de filas reales. No se hizo un nuevo dump de base porque esta publicación no ejecuta operaciones de base; el respaldo es de release/configuración y la reversión no requiere restaurar datos. No se reutilizó una migración de un despliegue anterior.

Build nuevo de **2.310 blobs exactos**, en preview aislado, fases seriales, **1 CPU / 2 GiB / swap cero**. Backend, tipos efectivos, web y app PASS. API incorporada en ambos paquetes: **`https://sitrep.ultimamilla.com.ar/api`**, con los flags productivos actuales. Los bundles `/api` de QA no se publicaron.

Cliente Prisma generado y verificado contra el mismo esquema canónico vigente, SHA-256 **`ecccd79b072a9da48b21a787a9bb903b20f0467a9bca6634a7b5d0b0d3afbf24`**; motor RHEL/OpenSSL y modelos de custodia, pagos y antecedentes conservados. **230 dependencias runtime** comprobadas contra el lockfile, en copia independiente; sin instalar en producción ni modificar el cliente anterior.

Archivos comprobados por SHA-256 al preparar y antes de activar: **386 backend / 513 web-manual / 200 app / 14 cliente Prisma**. Paquetes nuevos transferidos por SSH. Fuentes iguales antes/después; recursos sin OOM ni presión de memoria (`max/oom/oom_kill=0/0/0`).

## Smoke publicado, sin autenticación ni mutaciones

| Control | Resultado |
| --- | ---: |
| HTTPS desde servidor: shells, assets, rutas, manual, capturas, salud y protección de API | **120/120** |
| HTTPS externo y hashes de paquetes publicados | **9/9** |
| PWA: shell, JS/CSS/MIME, 404 de JS inexistente, asociación Android y SW explícito | **8/8** |
| Dos workers estables, entorno, CAP, canales, uploads y Nginx | **PASS** |

Se verificaron los chunks de usuarios/login, fichas de operador/transporte, altas, agenda/expediente PSIP, eventuales, adendas, avisos y cargas en curso en web/app. Manual completo por hash, guías y capturas nuevas servidas correctamente. Las API de inspecciones/antecedentes/intercambios, viajes/relevos, solicitudes y documentos de los tres actores devolvieron **401 sin token**, antes de consultar registros. Salud y requisitos públicos no consultan expedientes reales. **Cero logins, cargas de archivos o mutaciones de negocio en el smoke.**

Validación funcional previa: backend **1430/1430**, frontend **1781/1781**, **369 casos E2E únicos**, **78 grupos HTTP**, **107 variantes de correo simuladas**, auditoría **8/8**. Los E2E fueron consolidados entre builds con repetición de los afectados después de cada arreglo; no se presenta como una sola corrida global sobre el último build. En esta publicación se recompiló con API/flags finales y se verificaron artefactos/smoke; no se repitieron recorridos autenticados en producción. No certifica Android/iOS físico ni entrega real de correo/push.

## Reversión preparada, sin ejecutar

```sh
ssh root@23.105.176.45 'node /var/backups/sitrep/20261021-circuitos-13af2fb0/publish-production.js rollback'
```

Restaura backend **c9cd877f**, web/app y manual **2026.20.17** compatibles con el esquema actual. Usa el backend anterior conservado y `/var/www/sitrep-releases/20261021-circuitos-13af2fb0-rollback`, con assets de ambas versiones, SW raíz **v141** y app **20261021095850**. Verifica hashes, configuración, readiness y procesos; guarda PM2. No fue ejecutada ni se activó recuperación automática.

Esta reversión conserva esquema, informes, antecedentes PSIP, reservas ATM, tramos, uploads y registros nuevos. No restaura la base, borra evidencias ni vuelve a un backend anterior a esos controles. Retira las mejoras de comportamiento de 13af2fb0; los canales siguen apagados. Una futura publicación/migración requiere revisar de nuevo la compatibilidad, no reutilizar ciegamente este comando.

## Cierre

El primer lanzamiento de build no encontró un ejecutor `tsx`; no llegó a compilar. Se usó el Node 22 instalado con soporte de TypeScript y la compilación completa posterior pasó. Una comprobación auxiliar encontró `ps` ausente en la imagen; los límites se verificaron con cgroup y el cierre con Docker. Antes de ejecutar el verificador se corrigió un nombre de chunk que no existe como archivo independiente; se verificaron los chunks reales, sin cambiar producto. Estos intentos están conservados en evidencia. Preparación y publicación pasaron a la primera, sin rollback.

Preview detenido nuevamente **21/10/2026 06:57:26 Mendoza**, antes de activar producción: `Running=false/Pid=0/OOMKilled=false`, salida 143 por SIGTERM previsto. No se iniciaron API, PostgreSQL, servidores estáticos ni túneles para estos builds. Imagen/base artificial/evidencias conservadas.

Evidencia local ignorada: `test-results-deploy-13af2fb0/`. Artefactos preview: `/opt/sitrep-qa-enterprise-20261016/source/.qa-release-13af2fb0-20261021/`. [Resumen verificable](deployment-13af2fb0-20261021.json), con hashes de reportes. Rama `codex/sitrep-training-20261018`, checkout único; **main conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`**. Cierre documental `[skip ci]`; sin push ni workflows, producto/manual exactos al SHA autorizado.
