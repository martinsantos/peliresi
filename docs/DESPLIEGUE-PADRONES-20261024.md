# Publicación de padrones y continuidad de navegación — 24/10/2026

**7af655f767595efc2ee2cbac0ad098ce1873260b publicado en backend, web, app y manual de https://sitrep.ultimamilla.com.ar a las 17:52:58 Mendoza (2026-10-24T20:52:58.628Z).** Sustituye 51e4271abefa35596ac3ded0057883b4766fde2d.

Incluye la tanda de [claridad de recorridos](CLARIDAD-RECORRIDOS-20261024.md) y la de [padrones/altas](REVISION-ESPACIOS-POR-ROL-20261024.md): navegación coherente por rol, Inicio compacto, Listado/Programados separados, regreso al origen, padrones con acciones/filtros comunes, altas con título y regreso identificados. Estado O/T consulta el padrón completo; los filtros que sólo afectan a la página se identifican expresamente. El manual incorpora guías y capturas sintéticas. El backend se recompila desde el commit autorizado, sin diferencias de código frente a la versión previa.

## Verificación

Preview: **463 pruebas frontend, 13 repetidas finales y 20 HTTP PASS**, más recorridos de los cuatro roles en web/app. Estas pruebas funcionales pertenecen al entorno sintético y no se vuelven a atribuir a producción. Fuente contrastada con los 51 archivos del delta probado.

Build remoto serial en el contenedor existente, 1 CPU / 2 GiB / swap adicional cero: **2538 archivos Git exactos**, backend/Prisma/tipos/web/app PASS. API de Ultima Milla, sin Docker, emulador ni builds pesados en la Mac. No se ejecutaron workflows.

Producción: **216/216 smoke, 9/9 externo y 8/8 PWA PASS**. Sólo GET de shells, rutas, chunks exactos, manual/capturas, workers, health y autorización sin credenciales. Incluye los tres padrones/altas en web y app y las guías padrones-administrativos/navegacion-por-rol. Sin logins, respuestas, altas ni cambios de negocio. Los GET generan los logs y contadores técnicos normales del servicio.

Dos workers online. **.env idéntico byte a byte y flags conservados; CAP cerrado, correos/push apagados** en configuración, procesos y estado guardado. Dependencias, esquema/migraciones, Nginx, uploads y otros servicios conservados. Sin main, push, seed ni migración.

Manual **2026.24.1**, contenido exacto de 7af655f767595efc2ee2cbac0ad098ce1873260b. SW **trazabilidad-rrpp-v174**, app **20261024204815**. Se utiliza la actualización existente, sin borrar sesiones o borradores del navegador.

## Respaldo y reversión

- Backend: /var/www/sitrep-backend-releases/20261024-producto-7af655f7.
- Web/app/manual: /var/www/sitrep-releases/20261024-producto-7af655f7.
- Respaldo y evidencia privados: /var/backups/sitrep/20261024-producto-7af655f7.
- Reversión preparada a backend **51e4271a** y frontend /var/www/sitrep-releases/20261024-producto-7af655f7-rollback; SW **trazabilidad-rrpp-v175**, app **20261024205017**. No ejecutada.

Configuración y PM2 respaldados en privado; árboles previos verificados y releases conservados. No se tomó/restauró backup de base: no hay migración ni escritura de datos. Para revertir sólo esta publicación, desde su directorio privado: `node - rollback < publish-production.ts`. No usar reversiones históricas.

## Evidencias y límites

Workspace del hilo: role-workspaces-20261024/release, con source-proof.json, qa-summary.json, build.json, preflight.json, stage.json, deployment.json, postflight.json, smoke.json, external-smoke.json, pwa-smoke.json y release-result.json. Secretos de respaldo sólo en el servidor.

El smoke confirma entrega y salud; no equivale a certificación exhaustiva del producto. Siguen pendientes los filtros globales restantes y su continuidad entre fichas, revisión profunda de ABM/fichas/reportes, accesibilidad integral, Android físico/GPS de campo y carga sostenida. Correo/push externos no se prueban mientras permanezcan apagados. Runtime sintético cerrado; base y evidencia conservadas. La documentación de cierre posterior no modifica el commit de producto publicado.
