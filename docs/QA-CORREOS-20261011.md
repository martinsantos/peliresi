# Correos SITREP — corte verificable del 11/10/2026

## Estado vigente — publicado y comprobado, correos apagados

Release `20261011-mail-safety-r1`, producto `dc7e521`, activada el 11/10 a
las 20:22:50 UTC. Repetición completa aprobada: 901 unit backend, 1380 frontend,
17 grupos DB/SMTP, ocho HTTP y 81 E2E. Binarios exactos publicados sin rebuild.
Comprobación adicional de URL final: 314 hashes, ocho rutas SPA, cuatro
fronteras 401 y 12 grupos browser públicos en escritorio/responsive/app.
Backup y versión anterior conservados; dos procesos online, email/push apagados.
Ver [cierre, capturas, rollback y límites](DEPLOY-CORREOS-20261011.md).
Las menciones «no publicado» siguientes son históricas del corte previo.

## Cierre ampliado — candidato 32e32c4, GO del bloque en QA

Producto `32e32c498bd3bb0afa0c7cdf14fcc22c070a852a` en
`codex/sitrep-mail-safety-20261011`.
[Corrida del candidato](https://github.com/martinsantos/peliresi/actions/runs/38165246711).
**SUCCESS**, finalizada 11/10/2026 a las 19:02:27 UTC (16:02:27 Mendoza).
**GO técnico de este bloque en QA, no autorización de entregas reales ni GO
global de toda la aplicación.** Este cierre sustituye los cortes históricos
conservados más abajo.
No publicación, migración ni activación de correo/push en producción.
No se tocó el formulario humano ni se abrió navegador/emulador/Docker local.

### Gates del candidato exacto

| Comprobación | Resultado |
|---|---|
| Unit backend completas | 901 aprobadas, 0 fallidas, 0 omitidas |
| TypeScript backend | Aprobado |
| PostgreSQL y SMTP loopback | 17 grupos aprobados; 52 mensajes capturados, 0 destinatarios externos |
| Migración SQL exacta | Aprobada; históricos conservados sin inferencia, CHECK válido y rollback total |
| Unit frontend completas | 1380 aprobadas, 0 fallidas, 0 omitidas |
| Builds web y `/app` | Ambos aprobados |
| HTTP real | Ocho grupos aprobados; ocho avisos de cuenta SUPRIMIDO, SMTP deshabilitado |
| E2E escritorio, web móvil y `/app` | 81/81 aprobados; 0 omitidos, 0 inesperados, 0 flaky; un worker, cero reintentos |
| Plantillas | 19 HTML/texto revisadas por E2E en las tres vistas |
| Cierre QA | runtime/server cerrados 19:02:21 UTC; PostgreSQL detenido; ambos jobs finalizados |

Artefactos backend del mismo run: `mail-qa-20261011/final-approved-backend/`
en el disco SDTERA; no reutilizar métricas de candidatos cancelados.
Artefactos frontend y HTTP del mismo run: `mail-qa-20261011/final-approved-browser/`.

### Revisión renderizada e interacción

Flujo: enlace de aviso → login real → destino autorizado → consulta de solicitud,
ticket, inspección o certificado. CAA incluye descarga del original; los casos
de soporte, inspecciones y manifiestos ejercitan sus acciones contra la API real.
Los 81 casos comprenden 39 de destinos/plantillas/denegación, 24 de soporte,
seis de intercambio de inspección, nueve de CAA y tres de ciclo de manifiesto.

| Control del lote de destinos | Resultado |
|---|---|
| Identidad de página | URL esperada y contenido específico comprobados; título del documento no es un gate separado |
| Pantalla no vacía | Contenido y controles esperados presentes |
| Overlay de error | Ausencia de `vite-error-overlay` comprobada |
| Consola | Sin `pageerror` ni errores de consola en destinos positivos; 403 del caso ajeno es negativo intencional |
| Interacción | Login real, enlace y resultado esperado; no sesiones inyectadas ni API de negocio interceptada |
| Capturas | Revisión directa de seis estados finales, descritos abajo |

Se inspeccionaron rechazo en escritorio/responsive/app y CAA de operador
responsive, transportista app y generador escritorio. Encabezado y salida
completos, sin «Enviada pendiente», sin controles administrativos en el perfil
del titular y sin recorte horizontal visible. Esto no certifica toda la UI.

Capturas en SDTERA, dentro de `final-approved-browser/e2e/`:

- `mail-e2e-mail-links-mail-d-32f3c-pplication-pending-rejected-web-desktop/application-pending-rejected.png`
- `mail-e2e-mail-links-mail-d-32f3c-pplication-pending-rejected-web-responsive/application-pending-rejected.png`
- `mail-e2e-mail-links-mail-d-32f3c-pplication-pending-rejected-app/application-pending-rejected.png`
- `mail-e2e-mail-links-mail-d-094e2--login-certificate-operador-web-responsive/certificate-operador.png`
- `mail-e2e-mail-links-mail-d-228a3-n-certificate-transportista-app/certificate-transportista.png`
- `mail-e2e-mail-links-mail-d-793c0-login-certificate-generador-web-desktop/certificate-generador.png`

Comandos del workflow: suites `npm test` con un worker, build backend, build
frontend y `vite build --config vite.config.app.ts`, HTTP mediante
`frontend/cloud-qa/account-mail-http.ts` y
`playwright test --config cloud-qa/mail.playwright.config.ts`.

### Alcance conectado y comprobaciones nuevas

- CAA oficial: carga del PDF y aviso al titular en la misma transacción.
  El propietario abre desde su bandeja y descarga el archivo original;
  las pruebas comparan SHA-256, incluidos anexos y distintos años, en los
  tres tipos de actor. El correo enlaza al perfil y no adjunta el certificado.
- Renovación de padrón: presentación avisa al revisor del sector y resolución
  al titular. Se comprueban aprobación/rechazo por HTTP, autoaprobación denegada,
  decisión repetida sin nuevos avisos y rollback conjunto.
- Manifiestos y alertas: los avisos confirmados pasan por un único relay;
  se elimina el digest paralelo del dispatcher de usuarios. Se revalida
  titular, cuenta, preferencia, fuente real y caso/regla vigente cuando aplica.
- Solicitante rechazado: consulta del resultado propio con sesión restringida,
  incluyendo recarga. No edición, mensajes ni acceso a manifiestos. Suspensión
  sigue bloqueando login, sesión previa y refresh.
- Recuperación: cupo separado de avisos operativos; ambos límites se mantienen.
  La prueba de DB/SMTP agota el cupo operativo y comprueba recuperación válida,
  luego agotamiento del cupo de seguridad y ausencia de nuevos envíos.
- Externos: decisión humana aplicada, autorización individual por dirección
  exacta en Operaciones, independiente de las reglas y del interruptor general.
  Revocar antes de enviar suprime el digest; reautorizar no lo resucita. Una
  cuenta registrada nunca puede usar este canal para evitar sus restricciones,
  ni siquiera si se registró después de encolar. No se autorizó una dirección real.
- Migración: ensayo del SQL exacto sobre esquema sintético precolumna, conservación
  de cuenta histórica sin clasificación inferida, CHECK rechaza estado inválido;
  ambas pruebas revierten todos los cambios. No prueba restauración de un respaldo
  real de producción ni autoriza ejecutar la migración allí.

### Reproducciones y correcciones de esta ampliación

`38161687656` aprobó 69 E2E del lote inicial ampliado. La corrida posterior
`38162622626` aprobó 888 unit backend, 1376 frontend, 13 grupos DB/SMTP con
50 capturas y ocho grupos HTTP, pero **72/81 E2E**. Los nueve fallos eran una
expectativa incorrecta en la fixture de CAA: el nombre accesible de la región
era «Certificados ambientales oficiales», pero su texto visible es «Certificado
ambiental anual». DOM y captura mostraban los certificados. Se corrigió el test
para comprobar ambos nombres y ausencia de controles administrativos al titular,
sin cambiar el producto para satisfacer la expectativa ni omitir los casos.

La revisión directa de la captura de rechazo encontró «Enviada pendiente»
cuando no existía fecha de envío. Se corrigió el producto: fecha sólo si existe
y es válida, formateada en Mendoza, sin texto que sugiera un estado inexistente.
Cuatro unit y el E2E en las tres vistas cubren ausencia, fecha inválida y zona
horaria. La guía de revisión frontend exigió contrastar capturas además de
asserts; la de React orientó la derivación simple sin efectos ni nuevas consultas.

Corridas supersedidas fueron canceladas para evitar repetir trabajo obsoleto;
no se cuentan como aprobaciones completas ni como fallos de producto.
La decisión sobre externos se recibió durante QA y se incorporó al candidato
final, no sólo al documento.

### Entorno y límites

Chromium de GitHub Actions: escritorio 1440×900, web responsive y `/app`
360×800. Un worker, cero reintentos automáticos. Login y APIs reales con DB
sintética loopback, sin sesión inyectada ni interceptación de API de negocio.
Browser plugin no disponible; se usa Playwright cloud ya autorizado para no
consumir RAM local ni intervenir el formulario del usuario.

Separar este GO técnico del GO de entrega real: producción no se modifica.
Su archivo de entorno leído conserva correo apagado, familias/corte ausentes
y falta Reply-To. DNS público tiene SPF/DMARC; DKIM/alineación, buzones reales
y canario requieren configuración/autorización antes de activar. La lectura
del archivo no demuestra el entorno de cada proceso PM2 ni entregas históricas.

No se certifican Gmail/Outlook, enlaces nativos del APK, teléfonos físicos,
ni el circuito de nueva solicitud después de rechazo mediante este lote.
Nuevas reglas de discrepancias DDJJ/TEF necesitan fuente y criterio aprobado;
no se presentan como implementadas por disponer de plantilla.
Autorizaciones externas se gestionan por Operaciones; no se agregó un ABM
de esas autorizaciones en la interfaz. `ENVIADO` es aceptación SMTP, no
recepción, lectura ni notificación legal. Ver [operación segura](MAIL-OPERACION-SEGURA.md).

---

## Histórico: candidato 68d2ac5 — GO del bloque anterior en QA

Producto: `68d2ac5dab933bd0ae0c460d51562db391f7a294`.
Rama: `codex/sitrep-mail-safety-20261011`.
[Corrida final](https://github.com/martinsantos/peliresi/actions/runs/38158621314).
**SUCCESS**, finalizada 11/10 a las 17:29:03 UTC (14:29:03 Mendoza).
**GO de este bloque en QA; NO-GO global para activar toda la matriz de correos.**
Este bloque reemplaza el estado del corte histórico conservado más abajo.
No se publicó este candidato. Última versión de producción registrada:
`20261011-license-ocr-r1`; esta tanda no la modifica ni revalida todo su estado.
No se activó correo ni push real; ningún formulario humano fue tocado.

### Decisión del usuario aplicada

Pendientes con correo verificado reciben observaciones propias; suspendidos no.
La migración **aditiva** `20261011190000_account_pending_mail` incorpora
`usuarios.motivoInactividad`: alta pública `PENDIENTE_APROBACION`, suspensión
administrativa `SUSPENDIDA`, aprobación/reactivación limpia el motivo.
Los históricos NULL no se reclasifican por inferencia ni reciben estos avisos.
No se aplicó la migración a producción.

El relay exige verificación, preferencia habilitada, trámite propio elegible y
familia habilitada. Revalida antes de entregar: suspender, desverificar, cambiar
correo o quitar permisos puede suprimir una fila previamente pendiente.
Suspender también bloquea login, refresh y una sesión restringida previa.

Los avisos críticos del acto de cambio de cuenta son una familia independiente,
`cuentas`, apagada por defecto. Avisar la suspensión al correo previamente
verificado no habilita posteriores avisos operativos al suspendido.

### Cambios adicionales

- Siete eventos de cuenta registrados en la misma transacción de negocio:
  creación, habilitación, suspensión, baja, cambio de rol, correo y contraseña.
  Cambiar sólo teléfono no genera correo. Sin claves ni tokens secretos.
- 19 plantillas HTML/texto: las 12 existentes y siete eventos de cuenta.
  Enlaces restringidos al origen, contenido escapado y sin adjuntos sensibles.
- Corregido el destino tras login de un inspector con rol base de actor.
- Los E2E reprodujeron 403 en solicitantes pendientes: la interfaz iniciaba
  servicios de avisos/manifiestos sin permiso. Ahora la sesión restringida no
  inicia esos servicios ni muestra menús operativos inaccesibles; conserva
  solicitud, marca SITREP y salida.

### Evidencia actual

| Comprobación | Resultado del candidato |
|---|---|
| Unit backend completas | 849 aprobadas; 0 fallidas y 0 omitidas |
| TypeScript backend | Aprobado |
| PostgreSQL + SMTP loopback | Nueve grupos aprobados; 44 mensajes capturados dentro de la VM |
| Destinatarios externos | 0 |
| Concurrencia | Dos procesos; una nueva pasada no duplica filas tomadas |
| Rollback | Revierten juntos modificación de cuenta y aviso; una notificación revertida tampoco se despacha |
| Unit frontend completas | 1373 aprobadas; 0 fallidas y 0 omitidas |
| Builds web y app | Ambos aprobados |
| HTTP real de cuentas, observación y suspensión | Seis grupos aprobados; ocho avisos de cuenta terminales SUPRIMIDO |
| E2E escritorio, web móvil y `/app` | 57/57 aprobados; 0 omitidos, 0 fallidos y 0 flaky |
| Cierre QA | runtime/server cerrados a las 17:28:57 UTC; PostgreSQL detenido; workflow finalizado |

Pruebas antes/después: `38151931884` tuvo 21/24 E2E (destino de inspector),
reparados en `38152599628` con 24/24. Las corridas `38153383947` y `38153506616`
fallaron por tres dobles unitarios antiguos incompletos; no se contaron como GO.
`38154113734` aprobó 847 unit backend, 1360 frontend, HTTP y nueve grupos de
integración, pero **54/57 E2E**: tres fallos por esos 403 de sesión pendiente.
Se corrigió el producto y se añadieron pruebas de servicios y navegación
restringidos. Corridas supersedidas canceladas no cuentan como éxitos.

`38155938709` confirmó 849 backend, 1366 frontend y seis grupos HTTP, pero
54/57 E2E. La aserción de vista restringida detectó la causa restante:
`authService.login` descartaba `restricted` y `solicitudId` del servidor.
El nuevo candidato conserva esos campos y restaura la restricción tras recarga
sólo después de validar la sesión con el backend. Cinco unit nuevas y el mismo
E2E ampliado cubren el contrato y la reapertura; no se relajaron expectativas.

`38157429619` aprobó 849 backend, 1371 frontend, nueve grupos DB/SMTP, seis
grupos HTTP y **57/57 E2E sin omitidos ni flaky**. Terminó 17:08:19 UTC.
La revisión visual posterior encontró un desplazamiento automático que cortaba
el encabezado móvil: el panel de mensajes llamaba a scrollIntoView sobre toda
la página. `68d2ac5` limita el scroll al contenedor de mensajes y añade dos unit
y comprobaciones E2E de título/salida completamente dentro del viewport.
Por eso el primer verde funcional no se presentó como aprobación visual final.
La repetición `38158621314` aprobó el conjunto completo: 27 casos de correos/
destinos/plantillas, 24 de soporte y seis de intercambio de inspección. Las
19 plantillas se verifican en cada uno de los tres proyectos de navegador.

Los E2E usan login y APIs reales de base sintética: no inyectan sesiones ni
interceptan respuestas de negocio. Las fixtures no prueban por sí mismas todos
los productores de la matriz. `/app` es web de la app, no una prueba del APK.

### Revisión visual y recursos

Chromium verifica plantillas en tres tamaños, CTA de al menos 44 px, ausencia
de desborde y destinos autenticados. Inspección visual directa hasta este corte:
plantilla observada móvil, cambio de contraseña móvil, suspensión escritorio,
ticket del solicitante escritorio, inspección del inspector móvil y solicitud
pendiente en los tres tamaños. En esta última se detectó el scroll ya descrito.
Se revisaron nuevamente las tres capturas finales: encabezado y salida completos,
observación legible, sin menús sin permiso ni desborde horizontal en esos estados.

- [Solicitud final en app](</Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/peliresi/tmp/sitrep-go-evidence-20261003/mail-qa-20261011/final-visual-browser/e2e/mail-e2e-mail-links-mail-d-82037-s-login-application-pending-app/application-pending.png>)
- [Solicitud final en web móvil](</Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/peliresi/tmp/sitrep-go-evidence-20261003/mail-qa-20261011/final-visual-browser/e2e/mail-e2e-mail-links-mail-d-82037-s-login-application-pending-web-responsive/application-pending.png>)
- [Solicitud final en escritorio](</Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/peliresi/tmp/sitrep-go-evidence-20261003/mail-qa-20261011/final-visual-browser/e2e/mail-e2e-mail-links-mail-d-82037-s-login-application-pending-web-desktop/application-pending.png>)

Las guías de depuración frontend, rendimiento React y revisión de interfaz
orientaron quitar servicios y navegación sin permiso, manteniendo SITREP;
no fue un rediseño global ni se certificó toda la UI.

No Docker, navegador, emulador ni dependencias nuevas locales. Pruebas pesadas
secuenciales en la nube, un worker de navegador. Evidencia en disco externo:
`tmp/sitrep-go-evidence-20261003/mail-qa-20261011/final-visual-backend/` y
`final-visual-browser/`: JSON unit/integración/HTTP/E2E/cierre y capturas.
Las corridas previas se conservan en `pending-policy-browser/`,
`validated-candidate-browser/` y `final-policy-browser/`.

### Pendientes reales para toda la matriz

1. Rechazo del solicitante inactivo: necesita consultar el resultado sin acceso
   operativo; `RECHAZADA` no entra en la excepción de avisos actuales.
2. Conciliar productores/destinatarios de modificaciones de padrón, CAA,
   DDJJ/TEF y vencimientos específicos. Plantilla no equivale a evento conectado.
3. Uniformidad de verificación/preferencias en dispatchers legados de alertas
   y manifiestos; no inferirla desde el nuevo relay.
4. Conciliar cuentas históricas, remitente/Reply-To, SPF/DKIM/DMARC y familias;
   autorizar canario y comprobar recepción real. Gmail/Outlook, asociación de
   enlaces APK y teléfonos físicos no están certificados por este lote.
5. Publicar con respaldo, migración y rollback verificados; habilitación de
   envíos separada. Ninguna de las dos acciones se ejecutó en esta tanda.
   La QA usa el esquema sintético generado por Prisma; no constituye prueba
   de aplicar la migración sobre la base histórica de producción.

`ENVIADO` significa aceptación SMTP, no entrega, lectura ni notificación legal.
Límite diario conservador por filas, no cuota SMTP exacta entre procesos.
Resultados ambiguos requieren revisión; no existe promesa de entrega
exactamente una vez ante cualquier caída del proveedor.

Ver [operación segura](MAIL-OPERACION-SEGURA.md) y
[backlog actualizado](BACKLOG-CORREOS-PRODUCCION-20261013.md).

---

## Corte histórico eb33b58 — no describe el candidato actual

Conservado como evidencia del primer lote; sus pendientes, ausencia de E2E y
ausencia de cambios de esquema/frontend quedan sustituidos por el bloque anterior.

## Resultado

Implementación funcional, no sólo backlog. **GO del lote de seguridad y
plantillas en QA. NO-GO todavía para habilitar correo real de toda la matriz.**
No publicación de este lote ni cambios de configuración en producción.

Producto probado: `eb33b582d6019b043014641f87a3558d02823a03`.
Rama: `codex/sitrep-mail-safety-20261011`.
Corrida: https://github.com/martinsantos/peliresi/actions/runs/38150666287
Terminó 11/10 a las 15:18:59 UTC (12:18:59 Mendoza), en 1 min 21 s.

| Gate | Resultado real |
|---|---|
| Unit backend completas | 820 aprobadas, 0 fallidas, 0 omitidas |
| TypeScript backend | Aprobado |
| PostgreSQL + SMTP loopback | Seis grupos aprobados; 36 mensajes capturados dentro de la VM |
| Destinatarios externos | 0 |
| Concurrencia | Dos procesos independientes: 20 reintentos, 10 entradas de digest y 3 avisos confirmados, sin repetición en nueva pasada |
| Rollback | Notificación revertida no genera entrada de correo |
| Historial | Fallido antiguo intacto; suprimidos nunca liberados |
| Plantillas | 12 HTML + 12 versiones de texto + índice, con datos ficticios |

La prueba primero reprodujo los tres casos inseguros en `38149176120`.
Las corridas intermedias sin `pdftotext` no se contaron como suites aprobadas;
la dependencia fue instalada sólo en la VM y se repitió la suite completa.

## Cambios de producto

- Corte de activación obligatorio y supresión terminal, sin estados de envío falsos.
- Acuse SMTP comprobado; ambigüedad de transporte/persistencia no reintenta a ciegas.
- Toma exclusiva de filas y reintento de digest conservando su agrupación.
- Plantillas breves, escapadas y versionadas; texto plano, enlaces restringidos
  al origen, tokens codificados, remitente configurable y TLS para SMTP remoto.
- Relay optativo de avisos internos confirmados: solicitudes, soporte e
  inspecciones. Identificador persistente para deduplicación y activación por
  familia, deshabilitada por defecto. Sin contenido privado de notas/adjuntos.
- Exclusión de indicadores de revisión/prueba, manifiestos demo y actas de
  capacitación reconocidas. Preferencias y verificación de correo respetadas
  en el nuevo relay.

No cambia esquema de base, archivos frontend, formularios abiertos ni sesiones.
No Docker, instalación de dependencias, navegador o emulador local. VM y
contenedores cerrados por el workflow; artefactos pequeños en disco externo.

## Límites y pendientes antes del GO de correo externo

1. Decisión solicitada: correos para solicitantes verificados aún no aprobados.
   `activo=false` también se usa en suspensiones; el relay los suprime hasta
   diferenciar esos estados sin abrir una excepción insegura.
2. Completar conexiones faltantes de la matriz (baja/cambio de cuenta,
   modificaciones de padrón, CAA, actuaciones y vencimientos específicos).
   La existencia de una plantilla no demuestra que su evento esté conectado.
3. Ejecutar HTTP/E2E de cada flujo emisor y navegación autenticada desde
   enlaces en web/app; revisar HTML en clientes de correo reales. Este lote
   no repitió E2E web/APK ni certifica recepción visual en Gmail/Outlook.
4. Aprobar remitente/Reply-To, DNS SPF/DKIM/DMARC, familias/frecuencia y canario;
   inventariar cola histórica. ENVIADO previo a la corrección no se reinterpreta
   como evidencia de entrega. No se borró ni reemitió nada de producción.
5. Revisar gates para publicación reversible. Correo permanece apagado hasta
   autorización específica de habilitación y prueba canario.

Inventario y criterios completos: [backlog de correos](BACKLOG-CORREOS-PRODUCCION-20261013.md).

## Evidencia guardada

`/Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/peliresi/tmp/sitrep-go-evidence-20261003/mail-qa-20261011/final/`

- `sitrep-mail-unit.json`
- `sitrep-mail-integration.json`
- `sitrep-mail-templates/index.html` y variantes HTML/texto.

No activar automáticamente `EMAIL_NOTIFICATION_FAMILIES` ni elegir una fecha
histórica para `EMAIL_DELIVERY_NOT_BEFORE`. No reutilizar credenciales o
destinatarios QA para producción. Mantener `DISABLE_EMAILS=true`.
