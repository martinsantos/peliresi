# Corte de inspecciones: auditoría de dependencias y bloqueos de publicación

## Estado

Los PR #43 (publicador), #42 (pruebas) y #41 (inspecciones) se integraron mediante merges normales. El candidato resultante es `eff2002af00668204dc5c085f57feb2e3ada6a43`.

**No está publicado.** El CI [41834437337](https://github.com/martinsantos/peliresi/actions/runs/41834437337) falló en las auditorías de dependencias, antes de ejecutar las demás validaciones. No se ejecutaron preflight, prepare ni publish para este corte. No se modificaron producción, datos, flags, CAP, correos, push ni servicios de capacitación.

La composición inicial reconocida por el publicador continúa siendo web/app `3245f36573a6b18a74d26887cdaa34e453d19d9e`, backend/manual `6bc08a7c43fa35a22f32e24b35fedd440250d652`. No interpretar el merge en main como revisión activa del servicio.

## Corrección propuesta en este PR

- Backend: parches de body-parser, ip-address, proxy-addr, qs, multer, sharp y zod; Nodemailer pasa de 9.1.1 a 10.3.1. Express continúa en 4.22.3 y Prisma no cambia.
- Frontend: Axios 1.21.0, DOMPurify 3.4.17 y follow-redirects 1.16.2.
- Lockfiles regenerados en el laboratorio aislado. No se usó `npm audit fix --force` ni se redujo el umbral de auditoría.
- Pruebas de actores y PSIP: completar las consultas de empresa de los dobles de transacción; comprobar los bloqueos de solicitud y persona; verificar que una falla de vinculación no se confirme como alta exitosa. La lógica de producto no cambia.
- Audio de inspecciones: abrir explícitamente el expediente, usar el regreso vigente y conservar las comprobaciones de micrófono, recuperación, cola de evidencia y salida bloqueada durante la grabación. Los paneles independientes de mapa/firma/entrega quedan simulados, como en las otras pruebas de persistencia.
- Regresión de Nodemailer real con transporte en memoria: destinatario, Reply-To, HTML, texto y enlaces se conservan en el MIME. No usa SMTP ni envía mensajes.

Auditoría posterior: frontend **0 vulnerabilidades**; backend **0 críticas, 0 altas y 3 moderadas**, estas últimas en la cadena swagger-jsdoc → glob → minimatch. Las moderadas siguen pendientes y no equivalen a vulnerabilidades corregidas. El umbral exigido por CI es `--audit-level=high`.

## Bloqueos restantes — no publicar este PR por sí solo

1. **Dependencias del publicador.** La sección 4.1.2 del runbook y `compatible()` exigen que `backend/package.json` y `backend/package-lock.json` sean idénticos al runtime activo. Este PR los cambia y será rechazado correctamente. Se necesita una revisión separada del publicador y aprobación del dueño: dependencias completas propias del candidato, instaladas desde el lockfile revisado, empaquetadas y verificadas por hashes; nunca actualizar el `node_modules` activo. Preparación sin efectos sobre el servicio y rollback que conserva sus dependencias anteriores. No se implementó ni autorizó aquí esa excepción.
2. **Lint del frontend.** Con el código del candidato, `npm run lint` reportó **30 errores y 1.964 advertencias** (límite actual: 596 advertencias). `npm run lint:critical` reportó **1 error y 58 advertencias** (límite: cero). No se modificaron reglas, exclusiones ni presupuestos. Hace falta un PR de corrección antes de un CI verde; este documento no autoriza ignorar resultados ni aumentar límites.
3. **Corte y autorización.** Después de resolver los bloqueos: CI de main en verde, preflight contra la composición verificada, autorización del SHA exacto, prepare, revisión del recibo y BUNDLE_SHA por el dueño, y publish con respaldo y smoke no mutante. No aplicar migraciones ni editar el runtime a mano.

## Evidencia y límites

QA remota en una carpeta independiente, 1 CPU, 2 GiB, sin swap adicional y un worker. Pruebas sin red y sin credenciales de producción. Node 20.19.6 obtenido del origen oficial y verificado contra SHA-256; no se instaló en el host. El modelo OCR público se descargó sólo a QA y se validó contra los bytes y SHA-256 fijados por el código para permitir la compilación offline.

Resultados:

- Backend, suite completa final con Node 20.19.6: **2.645/2.645**, tipos y build aprobados. Las ejecuciones anteriores con fallos se conservan como evidencia, no se suman como pruebas adicionales.
- Frontend, suite completa inicial con Node 22: **4.140/4.145**; cinco fallos concentrados en el archivo de audio desactualizado. Tras corregirlo, **26/26** regresiones con Node 20.19.6: cinco de audio y 21 de guardado/teclado ya existentes. No se presenta esta repetición dirigida como otra suite completa.
- Builds web y app con Node 20.19.6: aprobados. Conservan advertencias de tamaño de chunks; no son errores de compilación.
- Lint: bloqueado según los resultados de la sección anterior. No hay CI verde del corte ni autorización implícita de publicación.

Las pruebas unitarias y compilaciones no equivalen a una validación en producción ni en Android físico.
