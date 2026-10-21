# Certificaciones parciales y finales — revisión en preview, 21/10/2026

## Estado y alcance

**Candidato probado, sin publicar.** Trabajo sobre `codex/sitrep-training-20261018`, desde `603d970d892dc9ac0eacf4ed700f2475216ff94f`, exclusivamente en `sitrep-production-source-20261001`. Producción no se consultó ni modificó. Última publicación documentada previamente: `66a1c29e`; este informe no vuelve a verificarla.

Pedido cubierto: el operador emite una certificación parcial o final, las partes vinculadas reciben su aviso en la campana y descargan el mismo documento, desde web y app, fuera de CAP. Datos artificiales en esquema propio del preview; CAP cerrado y correo/push apagados. No se modificaron reglas regulatorias, habilitaciones, cuentas ni históricos reales.

## Resultado para el usuario

1. El operador abre el manifiesto → **Certificaciones**. Se muestran parcial y final, disponibilidad, documentos emitidos y descargas.
2. Con recepción, pesaje y tratamiento registrados, puede emitir una **parcial**. Cantidades pendientes y método vienen precargados; revisa, dibuja su firma y publica. Puede dejar vacío un residuo que no incluya en ese parcial.
3. Generador y transporte activos reciben un aviso propio: **Certificación parcial disponible**. El enlace abre exactamente ese certificado dentro del mismo manifiesto, con la ruta correcta de web o `/app`.
4. Después del cierre y con las adendas resueltas, el operador puede emitir la **final total**. Incluye el total recibido; no suma nuevamente los parciales. Cerrar tratamiento no publica automáticamente esta final.
5. Las otras partes reciben el aviso final y descargan exactamente el PDF conservado por el operador. No deben compartir cuentas, enviar el archivo por fuera ni regenerarlo. Leer el aviso no significa aprobar nada.

En in situ se avisa al generador vinculado; no se inventa un transportista. Administración puede consultar según su alcance, pero no firmar por el operador.

## Qué se corrigió e incorporó

- El circuito firmado explícito existía en CAP; el ordinario tenía una descarga final generada a demanda. Se incorporó emisión ordinaria independiente con firma manuscrita, número, fecha, cantidades, método, autor y PDF conservado. Las descargas históricas permanecen hasta que se emita una certificación nueva en ese expediente.
- La campana podía mostrar el aviso emergente mientras la bandeja abierta conservaba su lista anterior. El poller ahora invalida bandeja y contador al recibir novedades, sin un bucle de consultas ni marcar avisos como leídos.
- Los avisos incluyen el ID del documento; la navegación conserva `/app`, posiciona y destaca el certificado correcto. No confía en una URL arbitraria recibida.
- Se reutilizó la tarjeta de Certificaciones, su icono y los componentes existentes. El formulario conserva la carga si falla, evita doble envío y reintenta la misma solicitud sin duplicar documentos o avisos.
- El PDF lleva C3, firma, snapshot de las partes y cantidades, referencias a parciales/adendas y huella de firma. Los datos de QA llevan **DATOS ARTIFICIALES · SIN VALIDEZ OFICIAL**.
- La revisión visual detectó una etiqueta imprecisa: un parcial no puede llamar “resueltas” a todas sus adendas vinculadas. El PDF parcial dice **Adendas vinculadas**; el final, que exige resolución, dice **Adendas resueltas**. Ambos textos se verificaron extrayendo el PDF generado.

## Integridad y permisos

Emite sólo el OPERADOR activo vinculado y desde su cuenta normal: no administración, suplantación ni sesión restringida. Cada lectura y descarga comprueba el alcance del manifiesto y la pertenencia del documento. Un actor ajeno recibe 404.

Los parciales acumulados no exceden el pesaje recibido. No se reemplaza un pesaje faltante por la cantidad declarada. El final requiere TRATADO, todos los residuos y exactamente su total recibido; pendientes, observadas y rechazadas bloquean la final. No hay edición ni eliminación de certificados emitidos.

La transacción bloquea la fila del manifiesto, compartiendo el bloqueo con adendas. Persiste documento, evento y avisos juntos. ID de solicitud y huella del contenido permiten reintentos idénticos; contenido diferente con el mismo ID se rechaza. Hay una única final por manifiesto. Dos parciales concurrentes no pueden exceder el total.

Después de emitir se bloquea la reversión de estado que alteraría el expediente firmado. Después de la final se bloquean nuevas adendas y revisiones, incluso si se apaga la emisión. Desactivar el flag no quita acceso a documentos ya emitidos ni degrada estas guardas.

Las cantidades certificadas son los **pesajes recibidos registrados en el manifiesto**. Una adenda aprobada no reescribe automáticamente esos pesajes, agrega residuos al original ni amplía corrientes Y habilitadas. Esta entrega no transforma la firma manuscrita en firma digital criptográfica ni valida una habilitación regulatoria.

## Pruebas y evidencia

QA en `76.13.234.213`, contenedor `sitrep-qa-training-20261018`, esquema nuevo `manifest_certificates_20261021` de la base artificial `sitrep_night_qa_20260926`. Sólo loopback: backend 3037 y web/app 4177. Fases seriales con lock, un worker, **1 CPU / 2 GiB / swap 0**. Sin Docker, instalaciones, builds o suites pesadas en la Mac.

| Verificación | Resultado y revisión cubierta |
|---|---|
| Suite completa backend | **1456/1456**, antes de los últimos ajustes de texto del aviso/PDF |
| Suite completa frontend | **1801/1801**, antes del ajuste final del refresco de bandeja y navegación al documento |
| Regresión final backend | **95/95**, repetida sobre el código final del PDF |
| Regresión final frontend | **127/127**, después de los ajustes de bandeja/navegación; producto de interfaz sin cambios posteriores |
| API con base y controladores reales | **6 grupos PASS**, emisión, permisos, concurrencia, pesajes, adendas, avisos, in situ e históricos |
| Emisión apagada | **1 grupo PASS**, lectura/descarga idéntica y guardas persistidas; emisión nueva 409 |
| PDF parcial/final y adendas | **1 grupo PASS**, dos PDF generados y texto extraído para evitar una afirmación falsa de resolución |
| Navegador | **6/6 casos únicos**: recorrido entre tres cuentas y manual en tres superficies; dos ejecuciones completas, sin retries/flaky/skips |
| Manual con capturas finales | **6/6 unit + 3/3 navegador**, repetición del subconjunto manual, no tres casos únicos adicionales |
| Compilación | Prisma generate, TypeScript backend y frontend PASS; builds web y app seriales PASS |
| Migración | SQL aditivo exacto sobre esquema baseline en preview; diff Prisma vacío PASS |
| Lint dirigido | 0 errores; 1 advertencia `no-explicit-any` en el catch existente de TrainingCertificates |
| Aislamiento/canales | **475 tablas previas intactas** por conteo/hash; cuatro alias CAP 403; 55 sobres de correo simulados, cero cola activa/intentos/envíos; proveedores apagados |

El recorrido E2E usa tres sesiones reales e independientes (operador, generador, transporte). El operador firma parcial 4 kg y final 10 kg; las otras cuentas, con la bandeja ya abierta, reciben cada aviso sin recargar, siguen el vínculo y descargan el documento. Los SHA-256 descargados por las tres cuentas coinciden con el persistido en backend. Se comprueba ausencia de controles de emisión en las contrapartes, errores de consola, overlays y desbordamiento horizontal.

Superficies: web 1440×900, web angosta 360×844 en el recorrido (360×800 para el manual) y `/app` 390×844. Son pruebas Chromium con vistas móviles; **no certifican teléfonos físicos, GPS, notificación con la app cerrada ni entrega externa de email/push**. El poller ordinario puede tardar hasta su siguiente consulta de 30 segundos; la prueba espera ese intervalo sin recarga manual.

La API prueba además parciales 4+6, rechazo de excedente 7, tres reintentos concurrentes con resultados 201/200/200, dos finales concurrentes 201/409, dos parciales independientes de 6 con resultados 201/409, adenda pendiente/observada y posterior aprobación, impedimento de descarga final prematura, acceso cruzado negado y preservación del PDF histórico.

Se conservaron los intentos fallidos: un mock unitario no preservaba `contextualClient` y dos solicitudes del harness usaban un nombre de campo incorrecto o carecían de fecha prevista. Se corrigieron las preparaciones, sin relajar expectativas del producto. Una fase simultánea fue rechazada por el lock; las pruebas no corrieron en paralelo.

Los builds de interfaz y el E2E final anteceden únicamente al último ajuste de etiqueta del PDF en backend. Después se recompiló backend/tipos y se repitieron la regresión de 95 tests, generación de ambos PDF, flag off y auditorías. Los snapshots de fuentes distinguen esas revisiones; no se presenta una suite global posterior a cada cambio.

Evidencia local ignorada: `test-results-manifest-certificates-20261021/evidence/`, recuperada del directorio remoto `.qa-manifest-certificates-20261021`. Incluye reportes JSON, logs, PDFs, capturas y snapshots SHA-256; no incluye secretos, base de datos ni paquetes para desplegar. Principales archivos: `certificate-http.json`, `certificate-*-checks.json`, `certificates-e2e-browser-final.json`, `frontend-final.json`, `backend-final.json`, `build-snapshot.json`, `backend-final-snapshot.json` y `manual-final-snapshot.json`.

## Manual

Manual **2026.21.4**, renderer **2026.20.6** y CSS **2026.20.5** conservados. Guía nueva **Certificaciones: emitir, recibir y descargar**, disponible para operador, generador, transportista y administración. Cinco pasos, dos capturas directas de QA con [procedencia](manual/certificate-capture-provenance.json). Se corrigieron las guías anteriores para no sugerir que cerrar el tratamiento publica automáticamente la final del circuito nuevo.

## Futura activación y reversión

**No se publicó ni habilitó en producción.** Flag nuevo `MANIFEST_CERTIFICATES_ENABLED` y su par de compilación `VITE_MANIFEST_CERTIFICATES_ENABLED`, ambos false por defecto, usados true sólo en QA. CAP, correos/push y las demás habilitaciones son independientes.

Migración nueva: `backend/prisma/migrations/20261021200000_manifest_certificates/migration.sql`. Crea `certificados_manifiesto`, índices, unicidad de final y relaciones con borrado restringido; no reescribe registros existentes. La futura publicación necesita autorización expresa, respaldo verificado antes de migrar, migración en los esquemas que use la aplicación, build con API del dominio final y versión de service worker. **No desplegar los bundles `/api` del preview.**

Una reversión posterior a emitir debe conservar la tabla, documentos, eventos y backend con las guardas. Apagar la emisión permite mantener descargas; no restaurar una base vieja ni volver a un backend que ignore certificados firmados. La reversión productiva actualmente documentada para 66a1c29e no se cambió en esta revisión.

## Cierre operativo

Runtime propio y PostgreSQL detenidos; contenedor cerrado el **21/10/2026 a las 20:09:40 Mendoza** (`Running=false`, `Pid=0`, `OOMKilled=false`). `memory.events` max/oom/oom_kill = 0; límites 1 CPU / 2147483648 bytes / swap 0. Imagen, base y evidencias preservadas. No se limpiaron recursos de otras tareas.

`main` conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`; cierre en la rama activa con `[skip ci]`, sin push ni workflows. La migración probada tiene SHA-256 `6530f972da7ef19ed9f20b3d66062cc14f974ba87b3f26ed43848f49aa1ed847`. Snapshot final de **1719 fuentes** verificado contra la compilación de cada componente y el manual; evidencia local conservada.

Archivo de evidencia recuperado: **13.241.167 bytes**, SHA-256 `d32a2bddf08e6cbea12480a7fe11ce8606ca7838a1aacee08c5978941ad01b1f`. `container-closed.json` se conserva además con el estado posterior a detener el contenedor.

Al preparar el commit se quitaron únicamente líneas vacías al final de siete archivos nuevos para dejar `git diff --check` limpio. No cambió ningún token de código. `eof-normalization.json` conserva hashes probado/commit y la comprobación exacta de equivalencia salvo esos saltos finales; no se repitieron suites por este ajuste de formato.
