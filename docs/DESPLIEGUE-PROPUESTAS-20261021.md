# Propuestas de tres partes publicadas — 21/10/2026

**Backend, web, `/app` y manual `47ea8470f98faba50305643b0e4350b5a269ae85` publicados** en `sitrep.ultimamilla.com.ar` el **21/10/2026 08:31:08 Mendoza**. Autorización expresa del dueño para ese SHA y para habilitar las propuestas de tres partes. Sin main, datos reales, workflows ni apertura de CAP. Los controles finales no mutantes pasaron.

## Comportamiento y flags

Generador, transportista u operador pueden proponer un manifiesto ordinario FIJO con tres actores registrados y activos. Crear no aprueba automáticamente: cada parte debe decidir desde su cuenta; el generador firma. Con unanimidad se habilita iniciar coordinación y después el transporte confirma el retiro físico. El viaje/GPS comienza con ese retiro. Agenda y campana informan a las partes. Administración no reemplaza sus decisiones. Históricos e in situ conservan su contrato.

Se habilitaron **`MANIFEST_PROPOSALS_ENABLED=true` y `VITE_MANIFEST_PROPOSALS_ENABLED=true`**. Son independientes de eventuales, adendas y revisión posterior, cuyos flags siguen false. Enterprise/multirrol/demo false; relevos y GPS múltiple true. [Contrato, E2E y límites de la revisión](PROPUESTAS-OPERATIVAS-20261021.md).

El único cambio de `.env` es la línea del nuevo flag; se compararon todos los bytes restantes. SHA-256 anterior **`618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`**; nuevo **`97ef23d52f52f0f9b17ce26e467880670f264671c5a14acc8750feb94835d28f`**. Comprobado en archivo, ambos workers y configuración PM2 guardada:

- `UPLOADS_DIR=/var/lib/sitrep-uploads` y enlace histórico conservados; sin abrir ni mover documentos de negocio.
- `TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z`: **CAP cerrado**, sin logins ni reactivaciones.
- `DISABLE_EMAILS=true`, `PUSH_MANIFEST_NOTICES_ENABLED=false`, VAPID vacío y SMTP sin contraseña. No hubo pruebas de proveedores ni envíos.
- Identidad de base/JWT y los demás flags sin cambios. Sin lectura o mutación de filas reales en la validación.

## Release, build y respaldo

Backend: `/var/www/sitrep-backend-releases/20261021-propuestas-47ea8470`. Web/app/manual: `/var/www/sitrep-releases/20261021-propuestas-47ea8470`. Sus enlaces activos apuntan a esos directorios; `/release.json` y `RELEASE.json` identifican el commit autorizado.

Build nuevo de **2.327 blobs exactos**, serial en el preview, **1 CPU / 2 GiB / swap cero**. Backend, tipos, web y app PASS. API final en ambos paquetes: **`https://sitrep.ultimamilla.com.ar/api`**; propuestas true y demás flags productivos explícitos. Fuentes verificadas antes/después. No se desplegaron los bundles `/api` de QA.

**Sin migraciones ni cambios de dependencias** respecto de 13af2fb0: Prisma completo, esquema y lockfiles iguales. No se ejecutaron migrate, seeds, backfill, restauraciones ni consultas de negocio. No se hizo un nuevo dump de base: el respaldo es de aplicación/configuración, y este despliegue no ejecuta operaciones de base. Cliente Prisma generado y comparado con el esquema canónico; **230 dependencias runtime** verificadas en copia independiente, sin instalar en producción ni modificar el cliente anterior.

Auditoría privada: **`/var/backups/sitrep/20261021-propuestas-47ea8470/`**, root 0700. `.env` y PM2 previos respaldados en 0600 y verificados antes de activar. Release anterior conservado e inventariado, reversión preparada por hash. Archivos comprobados al preparar y antes de activar: **388 backend / 513 web-manual / 200 app / 14 cliente Prisma**.

Manual **2026.21.1**, renderer **2026.20.6**, CSS **2026.20.5**, directorio conservado y todos los archivos idénticos al commit. Nuevo recorrido `manifiestos-tres-partes` para las tres partes y administración.

SW raíz **v142** y app **20261021112835**. La fuente raíz conserva v127: sólo el artefacto cambia el identificador, con hashes antes/después. v141 estaba reservado para la reversión anterior. Assets anteriores y activación explícita conservados, sin recarga global forzada.

## Smoke y cierre

| Control no mutante | Resultado |
| --- | ---: |
| HTTPS desde servidor: shells, assets, manual, salud y protección de API | **131/131** |
| HTTPS externo y hashes de paquetes publicados | **9/9** |
| PWA: shell, JS/CSS/MIME, 404 de JS inexistente, asociación y SW | **8/8** |
| Dos workers estables, entorno, canales, uploads y Nginx | **PASS** |

Incluye rutas/chunks de creación, detalle, aprobaciones y agenda en web/app, guía nueva y protecciones de `/aprobaciones` y `/agenda-partes` con **401 sin token**, antes de acceder a registros. **Cero logins, cargas o mutaciones de negocio**. No se probaron recorridos autenticados productivos. Se recargó sólo `sitrep-backend`: workers **614483 / 614500**, reinicios previstos **32 → 33**. Estables a las **21/10/2026 08:31:25 Mendoza**. Otras aplicaciones y Nginx intactos.

Validación funcional previa: suites completas **1438/1438 backend y 1790/1790 frontend antes de los últimos ajustes**; finales dirigidos **33 backend, 65 interfaz/manual y 6 continuidad del chofer**; **12 E2E únicos** (v3 12/12; v4 móvil/app 8/8), **8 grupos HTTP + 1 con flag apagado**. **354 avisos de siete fases simulados**, cero intentos/envíos. No sumar ensayos repetidos ni afirmar suites globales posteriores al último ajuste. No certifica Android/iOS físico, GPS real ni entrega externa.

Preview detenido **21/10/2026 08:30:15 Mendoza**, antes de activar: `Running=false/Pid=0/OOMKilled=false`, salida 143 prevista. Builds con `max/oom/oom_kill=0/0/0`. No se iniciaron API, PostgreSQL, servidores estáticos ni túneles para esta publicación. Imagen, base artificial y evidencia conservadas. Preparación, build, verificación y publicación pasaron; no se ejecutó reversión.

## Reversión vigente, preparada sin ejecutar

```sh
ssh root@23.105.176.45 'node /var/backups/sitrep/20261021-propuestas-47ea8470/publish-production.js rollback'
```

**Conserva backend 47ea8470 y sus guardas sobre propuestas persistidas.** Apaga `MANIFEST_PROPOSALS_ENABLED`, restaura web/app/manual de **13af2fb0**, con assets compatibles, SW raíz **v143** y app **20261021113031**. Preserva los demás flags, CAP/canales cerrados, esquema, documentos e historial; no restaura base ni borra evidencias. Mientras está apagado, las propuestas pendientes quedan detenidas para revisión, sin permitir avances por rutas antiguas.

**No degradar el backend a 13af2fb0 ni ejecutar reversiones anteriores:** no contienen la protección de aprobaciones operativas ya persistidas. La recuperación verifica integridad/configuración y readiness, y guarda PM2. No hay recuperación automática que retire estas guardas.

Evidencia local ignorada: `test-results-deploy-47ea8470/`; artefactos preview: `/opt/sitrep-qa-enterprise-20261016/source/.qa-release-47ea8470-20261021/`. [Resumen verificable](deployment-47ea8470-20261021.json). Checkout único, rama `codex/sitrep-training-20261018`; **main conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`**. Cierre documental `[skip ci]`, sin push ni workflows; producto/manual publicados exactamente desde el commit autorizado.
