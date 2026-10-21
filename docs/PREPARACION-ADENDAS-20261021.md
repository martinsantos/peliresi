# Preparación de db68b24e — pendiente de resolver autoridades

**No publicado. Producción continúa en 47ea8470.** El dueño autorizó publicar `db68b24e4b4a4e04ec5a1bae308d1bd1a41deab8` en backend, web, app y manual, habilitar adendas y verificar la autoridad, manteniendo CAP cerrado y correos/push apagados. La inspección en lectura encontró `MANIFEST_EXCEPTIONAL_REVIEWERS` vacío.

Consultado por esa designación, indicó los administradores de Generadores, Operadores y Transporte, además del Super Admin. La comprobación detectó dos impedimentos concretos:

- Este commit sólo admite el rol **ADMIN** para autoridad designada: `exceptionalDesignatedReviewer` en `backend/src/controllers/manifiesto-excepcional.controller.ts` y el filtro de destinatarios de `backend/src/services/postFactoNotice.service.ts` excluyen a los administradores sectoriales, aunque se agreguen sus IDs al `.env`.
- Consulta limitada y de sólo lectura de identidades/roles activos: **0 ADMIN_GENERADOR, 0 ADMIN_OPERADOR, 1 ADMIN_TRANSPORTISTA y 8 ADMIN**. Estos conteos no identifican por sí solos una cuenta de Super Admin ni autorizan seleccionar todos los ADMIN. No se consultaron manifiestos, documentos, historiales ni otros registros de negocio. No se crearon, activaron o modificaron cuentas/permisos.

Quedó pendiente la respuesta a dos alternativas: preparar y probar en preview un nuevo commit que soporte los cuatro roles, sin crear/activar cuentas; o publicar exactamente db68b24e con una cuenta ADMIN indicada explícitamente por correo/ID. **No sustituir silenciosamente el commit ni cambiar roles de usuarios para superar el bloqueo.** Un commit corregido requiere validación y autorización de publicación para ese SHA. Las cuentas sectoriales ausentes necesitan una decisión propia; no se infiere su alta o activación.

## Preparación terminada

- Checkout autorizado y rama `codex/sitrep-training-20261018` verificados limpios sobre db68b24e al comenzar. Main permanece `c8402190edfc36b5e5d0dee1337c24bd1689420d`.
- **2.339 blobs exactos** verificados antes y después. Backend, tipos de frontend, web y app compilados en serie en el preview, **1 CPU / 2 GiB / swap cero**. Sin OOM ni eventos de presión.
- API final `https://sitrep.ultimamilla.com.ar/api`; adendas, revisión de partes, propuestas, relevos y GPS múltiple true en estos artefactos; los restantes flags de producto false. CAP, correo y push apagados en el entorno de build.
- Manual **2026.21.2**, todos sus archivos comprobados contra Git; renderer/CSS conservados. SW de artefacto raíz **v144**, app **20261021124024**. El SW de la fuente no se modificó.
- Paquetes verificados: **388 archivos backend, 513 web/manual, 200 app, 14 cliente Prisma**. Cliente generado y comparado con esquema canónico. Sin cambios en Prisma, migraciones, lockfiles ni workflows respecto del release activo; no corresponde migración.
- API/PostgreSQL del preview no se iniciaron. Contenedor detenido el **21/10/2026 09:44:13 Mendoza**, sin OOM; fuentes, artefactos, imagen y base artificial conservados.

La compilación tuvo un primer intento de lanzamiento sin iniciar tareas porque no existe `backend/node_modules/.bin/tsx` en el contenedor. Se usó el Node 22 ya instalado con soporte TypeScript y la compilación completa pasó. Un control de procesos inline fue rechazado por el hook como supuesto REPL; el mismo control se ejecutó después mediante archivo no interactivo, como exige el hook. Ninguno modificó producto ni base. Vite mantiene advertencias conocidas de tamaño de chunks y salida externa.

## Estado productivo y próximo paso

Sólo lecturas: release/symlinks, entorno filtrado, estado de workers, salud pública y metadatos mínimos de las autoridades solicitadas en transacción `READ ONLY`. Salud **3/3** del release activo; **no es smoke de db68b24e**. Entorno sin cambios, SHA-256 `97ef23d52f52f0f9b17ce26e467880670f264671c5a14acc8750feb94835d28f`; adendas/revisión false, propuestas/relevos/GPS múltiple true, CAP/canales cerrados.

No se transfirieron paquetes a producción, no se prepararon directorios activos, respaldos nuevos o enlaces allí, ni se recargó PM2. La [reversión vigente de 47ea8470](DESPLIEGUE-PROPUESTAS-20261021.md) sigue siendo la única validada. El script local adaptado para db68b24e es **preparación sin ejecutar**: exige selección explícita y válida, nuevo preflight, respaldo verificado, staging, activación y smoke. Su intención es conservar backend con guardas persistidas, volver a la interfaz/manual previos y apagar sólo adendas/revisión, preservando propuestas; todavía no hay release de rollback construido en producción.

Artefactos: `/opt/sitrep-qa-enterprise-20261016/source/.qa-release-db68b24e-20261021/`. Scripts y evidencia local ignorada: `test-results-deploy-db68b24e/`; `authority-candidates.json` contiene sólo IDs/roles y quedó privado (0600). Nunca copiar la cuenta QA. Al retomar, verificar de nuevo release/entorno/autoridades y resolver la respuesta pendiente antes de cualquier activación. **Sin push ni workflows.**

[Resumen y hashes](preparation-db68b24e-20261021.json). Este documento registra una preparación; no afirma publicación, smoke del candidato ni soporte de autoridades sectoriales.
