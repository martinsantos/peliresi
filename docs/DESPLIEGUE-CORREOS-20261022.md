# Correos: publicación de 86a9b790 — 22/10/2026

**`86a9b790abc9a7b5a7aea00185bbfe83a10c233b` publicado en backend, web, `/app` y manual de `sitrep.ultimamilla.com.ar` el 22/10/2026 a las 07:01:00 Mendoza.** Autorización expresa del dueño. Smoke no mutante aprobado; main y datos de negocio sin cambios, sin workflows ni envíos.

## Cambios publicados

- La aprobación de adenda se presenta como **decisión individual**, sin atribuir unanimidad ni cierre documental.
- El correo de **comprobante repetido** explica la coincidencia del archivo y que no acredita un pago nuevo, con acceso al aviso correspondiente.
- **Tratamiento finalizado** distingue cierre operativo de firma/emisión expresa de nuevas certificaciones. Acceso histórico conservado.
- Manual **2026.21.5**, guía `correos-decisiones-documentos`, mismo renderer y CSS. [Correcciones, galería y validación funcional previa](CORREOS-CLARIDAD-20261021.md).

Los correos permanecen apagados. Esta publicación actualiza las plantillas; no activa entregas, modifica destinatarios ni cambia reglas de aprobación.

## Configuración y respaldo

El `.env` se conservó **byte a byte**, SHA-256 `c6ccba0f124f6048aa0f2b0d33d0aa9797a0c982a9d4a346798449cd2d72c2e6`, comprobado en archivo, dos workers y configuración PM2 guardada. Certificados/propuestas/relevos/GPS múltiple true; adendas/revisión/eventuales/enterprise/multirrol/demo false. Autoridades sin asignar, según decisión previa del dueño.

**CAP cerrado**, `DISABLE_EMAILS=true`, push de manifiestos false, VAPID vacío y SMTP sin contraseña. `UPLOADS_DIR=/var/lib/sitrep-uploads`, enlace histórico e identidades de base/JWT conservados; no se expusieron secretos.

Respaldo privado en `/var/backups/sitrep/20261022-correos-86a9b790/` (root 0700): `.env` y PM2 anteriores verificados, inventarios con hashes, artefactos y preparación de reversión. Releases anteriores preservadas; interfaz de reversión independiente. **Sin cambios de esquema/migraciones/dependencias; no se ejecutó migración, backup o restauración de base, ni consultas a registros reales.**

## Build y activación

**2.371 blobs exactos** del commit autorizado, contrastados antes/después. Preview remoto, serial/un worker/**1 CPU, 2 GiB, swap cero**. Cliente Prisma, compilador backend, tipos frontend y builds web/app PASS, API final `https://sitrep.ultimamilla.com.ar/api` y flags actuales en ambas superficies. Sin instalaciones productivas.

Paquetes SHA-256 verificados en preview, Mac, transferencia y extracción: **395 archivos backend, 516 web/manual, 200 app y 14 cliente Prisma**. **230 dependencias runtime** verificadas en copia independiente; esquema y migraciones idénticos a 19230380. Textos corregidos comprobados en el backend compilado; manual contrastado con Git.

Backend activo: `/var/www/sitrep-backend-releases/20261022-correos-86a9b790`. Web/app/manual: `/var/www/sitrep-releases/20261022-correos-86a9b790`. Activación mediante enlaces y recarga exclusiva de `sitrep-backend`. Nginx y demás procesos sin cambios; assets anteriores preservados.

SW raíz **v150**, app **20261022095612**, activación explícita. La fuente raíz conserva v127: el cambio de caché es una transformación del artefacto registrada por hash, no un cambio encubierto del commit. Se reservó v151 para reversión; v149 correspondía a la reversión anterior.

## Resultado y límites

| Comprobación no mutante | Resultado |
| --- | ---: |
| HTTPS en servidor: shells, chunks, manual, salud y autenticación | **139/139** |
| HTTPS externo y hashes publicados | **9/9** |
| PWA: shell, assets/MIME, 404, asociación y SW | **8/8** |
| Entorno, uploads, identidades, workers y PM2 guardado | **PASS** |

Incluye la guía nueva, versiones, certificados, avisos y barreras 401 sin token. Cero logins o mutaciones de validación. Dos workers estables al control final **07:01:45 Mendoza**, sin reinicios adicionales desde la activación. [Resumen y hashes verificables](deployment-86a9b790-20261022.json).

Validación funcional previa: **160 backend / 37 interfaz-manual / 15 E2E** en preview, y galería **180 escenarios / 9 grupos**. No se repitieron recorridos autenticados en producción. El smoke no certifica dispositivos físicos ni entrega SMTP/push.

Preview detenido **06:56:51 Mendoza**, antes de activar producción; sin OOM ni presión de memoria. No se iniciaron API, PostgreSQL, servidores web o túneles en esta publicación. Imagen, base artificial y evidencia preservadas. Evidencia local ignorada: `test-results-deploy-86a9b790/`.

## Reversión vigente, preparada sin ejecutar

```sh
ssh root@23.105.176.45 'node /var/backups/sitrep/20261022-correos-86a9b790/publish-production.js rollback'
```

Restaura **backend/web/app/manual 19230380**, que ya incluye los certificados y sus guardas, manteniendo **todos los flags actuales**. Interfaz preparada con SW raíz **v151** y app **20261022095932**; archivos y hashes verificados. Conserva la base y los documentos, y mantiene CAP y los canales cerrados. **Preparada, no ejecutada.**

Esta es la reversión correspondiente a la publicación de correos. La reversión de certificados documentada el 21/10 apagaba emisión y tiene otro alcance; no ejecutarla como sustituto de ésta.

Rama `codex/sitrep-training-20261018`, único checkout autorizado. Main `c8402190edfc36b5e5d0dee1337c24bd1689420d` intacto; cierre documental `[skip ci]`, sin push ni workflows. El producto publicado es exactamente 86a9b790.
