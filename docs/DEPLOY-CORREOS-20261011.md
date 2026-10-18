# SITREP — cierre de publicación de correos, 11/10/2026

**Publicado y comprobado: `20261011-mail-safety-r1`**, web, `/app` y backend.
Activación: 11/10/2026 20:22:50 UTC (17:22:50 Mendoza).
Los envíos reales de correo y push permanecen apagados. No se abrió ni modificó
el formulario del usuario, ni se utilizó su sesión.

## Candidato exacto y pruebas

Producto `dc7e521cf5beff87e7973e88e2ae9862919eb5f5`, rama
`codex/sitrep-mail-safety-20261011`. Sobre `32e32c4`, añade SW v112 y
congelación/empaquetado cloud; no cambia la lógica funcional del bloque de correos.
[Corrida completa aprobada](https://github.com/martinsantos/peliresi/actions/runs/38169607569).
Los binarios se congelaron antes del E2E y se publicaron sin reconstruirlos.

| Gate | Resultado |
|---|---|
| Unit backend | 901 aprobadas, 0 fallidas/omitidas |
| Unit frontend | 1380 aprobadas, 0 fallidas/omitidas |
| PostgreSQL / SMTP sintético | 17 grupos; 52 capturas loopback; 0 destinatarios externos |
| HTTP real en QA | 8 grupos aprobados |
| E2E autenticado en QA | 81/81; 0 fallidos/omitidos/flaky; un worker |
| TypeScript y builds web/app | Aprobados |
| Publicador | 10 pruebas aprobadas, incluida migración exacta y guardas de rollback |
| Archivos en HTTPS final | 314 nuevos/modificados, SHA-256 exacto y MIME JS/CSS correcto |
| Rutas SPA finales | 8 aprobadas, web y `/app` |
| Fronteras de acceso finales | 4 endpoints anónimos rechazados con 401 |
| Procesos / DB | 2 workers online; health local y HTTPS con DB conectada |

### Browser sobre la URL final

[Corrida de producción de sólo lectura](https://github.com/martinsantos/peliresi/actions/runs/38171987792),
**SUCCESS**, finalizada 20:24:28 UTC. Código de comprobación `5d961ed`, sin
diferencia de producto backend/frontend respecto del candidato publicado.

12 grupos aprobados en Chromium cloud: escritorio 1440×900, web responsive
360×800 y `/app` 360×800. Para cada vista:

- Login renderizado, título SITREP y control mostrar/ocultar contraseña.
- Entrada real desde «Probar» a los tres formularios: generador, transportista
  y operador. Wizard visible, ayuda abre/cierra, sin calculadora TEF pública
  ni desborde horizontal del documento.
- Acceso anónimo a Mi perfil redirige al login.
- Cero `pageerror` y cero assets fallidos registrados.

Se revisaron directamente tres capturas: login escritorio, transportista
responsive y generador `/app`. Encabezados completos y controles legibles;
la tira de pasos móvil conserva desplazamiento interno. No es una revisión
visual exhaustiva de todos los pasos ni una medición WCAG completa.

El probe bloquea service workers intencionalmente para mantener control de
red; las únicas advertencias registradas corresponden a ese bloqueo y al
callback de registro resultante. **No se certifica instalación/actualización
ni offline de PWA mediante esta corrida.** No hubo intentos de escritura
bloqueados (`blockedWrites=[]`), credenciales ni escrituras de negocio.

## Respaldo, migración y rollback

- Respaldo remoto: `/opt/sitrep-backups/sitrep-pre-mail-safety-20261011-r1.dump`.
- Tamaño: 22.655.026 bytes.
- SHA-256: `b63f90d2fb3fae54a3c0bc39466951fee18d6667a3538602d11e7c40eb4d88da`.
- TOC, decodificación y **restauración real comprobadas**: 52 tablas con conteos
  iguales al COPY del respaldo exacto. Base aislada `sitrep_restore_drill_20261011_mail`
  en la misma infraestructura privada, sin aplicación conectada ni envíos,
  una conexión; restauración y verificación en 8571 ms. Copia temporal eliminada
  tras validar OID y marca propia; respaldo original conserva su SHA-256.
  No se transfirieron datos a GitHub ni a la Mac. Esto valida DB, no recuperación
  de uploads ni del host completo. Recibo `mail-deployment-20261011/restore-drill.json`.
- Migración aditiva `20261011190000_account_pending_mail`: columna nullable
  `usuarios.motivoInactividad` y CHECK. Sin backfill ni reclasificación histórica.
  Ejecución transaccional con espera de lock acotada; registrada en Prisma con
  checksum `fe05a3faab8070d4646c19fdc40ac3ff7d4b6ee4ae82e2ac154c84f43fad843a`.
- Releases anteriores `20261011-license-ocr-r1` conservadas e inventarios
  comprobados sin alteración. Assets anteriores de PWA conservados.
- Activación por symlink y recarga escalonada PM2, dependencias compartidas,
  sin instalar paquetes ni compilar en producción.
- `.env`, uploads/data, assetlinks APK y configuración de proveedores sin cambios.

Rollback disponible en el publicador revisado `sitrep-cloud-qa-20261002/deploy-mail.ts`:
`node --experimental-strip-types deploy-mail.ts rollback`. Verifica versión
activa, respaldo e inventarios; restaura aliases y procesos de la release anterior.
Conserva datos y columna aditiva compatible; **no restaura destructivamente la DB**.
No se ejecutó rollback porque los gates posteriores aprobaron. Requiere revisión
si existen cambios posteriores o una nueva release.

## Correo apagado: evidencia y pendiente independiente

Se verificó `DISABLE_EMAILS=true` en ambos procesos efectivos, no sólo en el
archivo de configuración. VAPID vacío y endpoint push `enabled=false`.
Huella de configuración igual antes/después; blockchain conservado sin cambios.
Consulta agregada de `email_queue` a las 20:24:09 UTC: **0 filas con `sentAt`
en la última hora**. No se leyeron destinatarios ni cuerpos de mensajes.
Esto acredita estado y registro de la cola, no una auditoría de tráfico de red.

**GO de publicación de este candidato, no GO de entrega real de correos ni
certificación global de la aplicación.** Para enviar siguen pendientes
configuración operativa, Reply-To/DKIM/alineación y canario expresamente
autorizado. No se habilitaron destinatarios externos reales.

Los 81 E2E autenticados se ejecutaron contra DB sintética cloud; la comprobación
final de producción es pública y de sólo lectura. No se volvió a validar un APK
nativo, teléfono físico, GPS/cámara ni Gmail/Outlook en esta publicación.

## Evidencias y recursos

En disco externo, bajo `peliresi/tmp/sitrep-go-evidence-20261003/`:

- `mail-release-38169607569/backend/` y `browser/`: resultados y binarios exactos.
- `mail-deployment-20261011/`: hashes, inventarios, recibos backup/activación/schema
  y comprobación HTTPS.
- `mail-deployment-20261011/public-browser/`: `result.json` y 12 capturas finales.

QA/browser/build sólo en GitHub Actions, un navegador y ejecución secuencial.
No Docker, emulador, navegador ni instalaciones locales. Corridas cloud cerradas.

## Ampliación de cierre — 11/10, posterior a la publicación

Sin cambios de producto ni otro despliegue. [Primera corrida adicional](https://github.com/martinsantos/peliresi/actions/runs/38175243442):
sesiones autenticadas de producción aprobadas en escritorio 1440×900,
responsive 360×900 y `/app` 360×900. Cuenta temporal GENERADOR sin actor:
ingreso real, identidad, lista propia vacía, recarga, cierre y redirección de
ruta protegida. Cero `pageerror` y escrituras de negocio. Capturas revisadas
de dashboard escritorio/app y lista responsive: contenido y controles visibles,
sin superposiciones bloqueantes; placeholder de búsqueda largo recortado dentro
del input en 360 px. No certifica otros roles ni todo el diseño.

Esa corrida **falló antes de las pruebas Android**, porque la VM no tenía permiso
KVM. Se restauró el paso de aceleración que ya usa `certification-tests.yml`;
32 pruebas de políticas aprobadas. No se cambió el producto ni se relajó una
expectativa. Repetición [38176873459](https://github.com/martinsantos/peliresi/actions/runs/38176873459)
con commit QA `008fab44dc9f7170f5acb9ab55b000adbe0ad3c3`: APK original **9/9**,
Android sintético **14/17**. Faltaba `build-frozen.json` requerido por integridad
del icono y falló una lectura ADB del teclado; el último gate falló por dependencia
del primero. Se agregó el paso de congelación existente, y un buffer acotado de
4 MB con diagnóstico del error ADB, sin retirar expectativas ni ampliar el tiempo
del gate. Repetición `38178366785`, commit QA `2f3ca5156c0dbe3416a4adcaf9ac173cb4786f3e`,
**SUCCESS**: Android sintético **17/17**, APK original **9/9**, sesiones
autenticadas de producción **3/3** (escritorio, responsive, app), cero escrituras
de negocio. JSON descargados y revisados en `final-go-evidence-38178366785`.
Capturas de recuperación del borrador Android y relanzamiento autenticado del APK
revisadas: contenido conservado y controles visibles. Cuenta QA desactivada,
tokens retirados y secreto temporal eliminado, ausencia confirmada. No certifica
teléfonos físicos ni todos los roles de producción. Producto sin cambios respecto
de lo publicado.

### Canario autorizado: bloqueo real de transporte

Usuario autorizó un único correo a `santosma@gmail.com`. Intento aislado
21:37:46 UTC con plantilla publicada, recibo exclusivo antirreintento y 6 pruebas
del ejecutor aprobadas. **No hubo aceptación SMTP**: error ETLS al STARTTLS,
respuesta `454 4.7.0 TLS not available due to local problem`.
Una verificación posterior sin envío reprodujo el error. Postfix referencia
`/etc/ssl/certs/ssl-cert-snakeoil.pem` y `/etc/ssl/private/ssl-cert-snakeoil.key`,
ambos inexistentes; su log confirma que deshabilita TLS por certificado ausente.
Gmail no encontró el Message-ID exacto en la consulta posterior al intento.

El usuario autorizó expresamente reparar TLS del servicio compartido con respaldo.
Se encontró además un mapa SNI compilado con certificado antiguo vencido.
La primera corrección y el primer reemplazo incremental no pasaron la verificación;
ambos hicieron rollback. Respaldos conservados, sin cambiar otros dominios.

**Reparación final aprobada 21:59:07 UTC**. Respaldo completo de configuración
SMTP, mapa fuente/compilado y renovación en `/opt/sitrep-backups/postfix-tls-20261011-r3`.
Certificado Let's Encrypt vigente de `umbot.com.ar` (hasta 24/11/2026); clave
correspondiente verificada. Sólo dos parámetros de certificado y dos entradas SNI
`umbot.com.ar`/`www.umbot.com.ar` actualizados. Otras cinco entradas compiladas
idénticas. TLS verificado con cadena y hostname, ambos SNI y certificado por defecto.
Hook de renovación configurado y probado idempotentemente; ignora otros certificados.
No flush de colas, cambio de política de relay, recarga de SITREP ni cambio de `.env`.

El journal confirmó que el intento inicial terminó con `ehlo=1 starttls=0/1
commands=1/2`, antes de MAIL/RCPT/DATA. Se conservó su recibo, y se completó
**un único correo aceptado** con recibo exclusivo `mail-canary-20261011-santosma-r2.json`:
22:00:20 UTC, cola `A5DEB3E64844`, un destinatario, sin CC/BCC. Verificación TLS
estricta con nombre `umbot.com.ar`; no se desactivó validación de certificados.

**Gmail confirmó recepción pero en SPAM**, no Inbox. Message-ID
`sitrep-canary-20261011-mail-safety-r1@ultimamilla.com.ar`. SPF y DMARC pasan;
no existe encabezado DKIM-Signature. No se movió el correo ni se marcó leído.
No atribuir Spam exclusivamente a DKIM: reputación y otras señales no están
diagnosticadas. No se autorizaron ni enviaron más canarios.

Correos/push de SITREP siguen apagados. La conexión automática publicada todavía
usa `SMTP_HOST=127.0.0.1` sin nombre TLS: `verify()` falla por hostname del
certificado. El canario aislado configuró explícitamente ese nombre; **no demuestra
que el cliente automático esté listo**. Antes de activarlo se debe soportar y
configurar el nombre TLS correcto, revisar TLS de salida del relay (política
actual vacía), DKIM, Reply-To y entrega a Inbox. No hay GO de correo automático.
