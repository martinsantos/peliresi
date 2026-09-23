# SITREP — cierre operativo para la capacitación (23/09/2026)

## Alcance y estado

Se trabajó exclusivamente sobre SITREP/RP Trazar. La web, la PWA y el manual quedaron publicados en `sitrep.ultimamilla.com.ar` y `rptrazar.mendoza.gov.ar`. El backend de Gobierno se actualizó con el módulo de Inspecciones; el backend público ya tenía ese módulo y no se reemplazó en esta entrega. No se enviaron correos. `DISABLE_EMAILS=true` permaneció activo en Gobierno.

Este cierre acredita una **capacitación con datos sintéticos**; no certifica que todo el sistema esté libre de defectos ni reemplaza una prueba presencial en Android con la conectividad real del lugar.

## Verificación realizada

- Frontend: 299 pruebas unitarias; backend: 237 pruebas. Builds de web, PWA y backend correctos. Suite Playwright local de Inspecciones: 44 aprobadas, 6 omitidas; comprobación Android UX: 6 aprobadas.
- En una **copia aislada** de la base Gobierno, E2E de roles ADMIN, GENERADOR, TRANSPORTISTA y OPERADOR: 36 aprobadas, 0 fallidas. Incluyó alta y ciclo completo de manifiesto, PDF/certificado y guardas negativas. La copia no alteró datos productivos.
- En el expediente sintético de Inspecciones del generador, se guardó un comentario y se adjuntó una imagen a `DOC-01` mediante el API productivo. La consulta devolvió la asociación y la descarga `image/png`; repetir la subida con el mismo identificador devolvió la misma evidencia. Tanto el acta como el informe técnico produjeron PDF. Esta prueba **sí modificó sólo ese expediente DEMO**.
- En ambos dominios, `check-frontend-surface.sh` pasó sus 13 controles, `check-pwa-offline.sh` pasó sus 9 controles y `check-operational-readiness.sh` pasó salud, disponibilidad, cabeceras y rate limit. La comprobación de proceso remoto del último script se omitió: no se definió `SSH_HOST` (Gobierno usa systemd, no PM2).
- El manual v2026.15, la ruta web/PWA, los service workers v63 y los manifiestos PWA responden en los dos dominios. `/api/inspecciones` responde `401` sin autenticación, como corresponde.
- Se verificó acceso de las tres cuentas de capacitación. No se imprimieron sus claves en salidas ni en el repositorio.

## Dataset de capacitación en Gobierno

Los manifiestos `CAP-20260923-0001` a `CAP-20260923-0009` existen, están marcados `isDemoData=true` y cubren los nueve estados del guion: BORRADOR, APROBADO, EN_TRANSITO, ENTREGADO, RECIBIDO, EN_TRATAMIENTO, TRATADO, RECHAZADO y CANCELADO. Hay cuentas escuela de generador, transportista y operador bajo `@rptrazar.mendoza.gov.ar`. La contraseña aleatoria reside **sólo** en `/home/ubuntu/sitrep-staging-20260923/training-access-20260923.txt` en la VPS, con permisos `0600`. El manual indica el uso de cada registro y exige comprobar sus estados antes del curso: los ejercicios los modificarán.

Tres expedientes sintéticos, todos inicialmente BORRADOR y ligados a esos actores:

| Actor | Acta DEMO | Expediente |
| --- | --- | --- |
| Generador | `DEMO-INS-GEN-20260923` | `https://rptrazar.mendoza.gov.ar/inspecciones/cmuegqikz00023gdmfzbocir2` |
| Transportista | `DEMO-INS-TRA-20260923` | `https://rptrazar.mendoza.gov.ar/inspecciones/cmuegqimd000t3gdme27wkpzx` |
| Operador | `DEMO-INS-OPE-20260923` | `https://rptrazar.mendoza.gov.ar/inspecciones/cmuegqina001k3gdmolxh5p0k` |

El primero ya contiene el comentario y la imagen de prueba asociados a `DOC-01`; los otros dos permanecen sin completar. En la PWA, cada ruta comienza con `/app/inspecciones/`. Los tres usan al administrador existente como inspector asignado; no se concedieron privilegios nuevos a las cuentas escuela. Cero correos con asunto CAP/DEMO en la cola al cierre.

## Respaldo y retorno

- Backup PostgreSQL previo a migraciones: `/home/ubuntu/sitrep-staging-20260923/sitrep-prod-pre-inspections.dump` (SHA-256 `bafb5f112f7ae1a1914b6cc9f255955846ba10f9a2c1f36df6cb1d3a142fd373`). La copia de trabajo sólo accesible por postgres quedó en `/tmp/sitrep-prod-pre-inspections-20260923.dump`.
- Backend anterior de Gobierno: `/home/ubuntu/sitrep-backend-rollback-20260923`; frontend anterior: `/var/www/sitrep-rollback-20260923`.
- Release público anterior: `/var/www/sitrep-releases/20260923-015043`; release nuevo: `/var/www/sitrep-releases/20260923-152500`.
- No restaurar el dump ni intercambiar directorios mientras haya usuarios operando sin un plan de reversión de datos. El esquema migrado y los expedientes creados hacen que un rollback de código no sea equivalente a uno de base.

## Riesgos y pendientes explícitos

1. La base Gobierno contenía 13 migraciones antiguas ausentes del checkout Git. Se preservaron en el candidato de despliegue y se aplicaron ocho migraciones nuevas de Inspecciones con el propietario PostgreSQL correcto. **Antes del siguiente despliegue de esquema**, reconciliar ese historial en el repositorio; no aplicar `migrate deploy` desde un checkout incompleto.
2. El servidor Gobierno no alcanzó el registro npm durante la instalación. Se usaron dependencias Linux de la misma versión/lockfile comprobado del servidor público. Conviene preparar un artefacto reproducible offline para la próxima entrega.
3. `DISABLE_EMAILS=true` demuestra que las pruebas no dispararon entregas; la configuración SMTP se verificó sin enviar mensajes. **No se acreditó la entregabilidad real**, por petición expresa de no enviar correos.
4. La PWA y los flujos móviles pasaron pruebas automatizadas, pero no se certificó el comportamiento de una app Android instalada en el dispositivo y la red concretos del curso. Hacer un ensayo breve con esos equipos antes de abrir la sala.
5. Las capturas del manual ilustran el flujo con datos de simulación. No presentarlas como fotografías de un caso real.

## Referencias

- Manual público: `https://sitrep.ultimamilla.com.ar/manual/`
- Manual Gobierno: `https://rptrazar.mendoza.gov.ar/manual/`
- Inspecciones Gobierno: `https://rptrazar.mendoza.gov.ar/inspecciones`
- PWA Gobierno: `https://rptrazar.mendoza.gov.ar/app/`
