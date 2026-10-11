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
- TOC y decodificación completa con `pg_restore` comprobadas; **no se hizo
  restauración real del respaldo en otra base**.
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
