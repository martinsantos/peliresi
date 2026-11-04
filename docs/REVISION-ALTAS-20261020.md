# Revisión integral de altas — 20/10/2026

Producto de preview **`4b5c8bdd3380beb3bc03674d902a31ff0b91f76e`**, validado y **sin publicar**.

## Alcance y límites

Sólo preview `76.13.234.213`, contenedor propio `sitrep-qa-training-20261018`, esquema nuevo `actor_onboarding_20261020`. Checkout autorizado del traspaso, rama `codex/sitrep-training-20261018`, desde `bc33bfe3`. Candidato de preview; sin publicación ni conexión a producción. La última publicación documentada sigue siendo `c9cd877f`. `main` conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Sin push/workflows; commits `[skip ci]`.

CAP expirado, correo suprimido con cero intentos y cero fechas de envío, SMTP/VAPID/proveedores vacíos, push apagado. Cuatro flags originales y revisión de partes apagados, relevos/GPS múltiple conservados. Datos y archivos exclusivamente artificiales; todos los esquemas previos de QA protegidos por conteo y huella de sus filas. Sin resets ni cambios regulatorios, de autorización del backend o de históricos. La corrección de guardia de navegación PWA se limita a reflejar la autorización existente en web/backend.

## Cambios realizados

- **Borrador verificado:** Mi solicitud ofrece Continuar borrador para los tres roles con multirrol apagado; antes el botón quedaba dentro de ese flag.
- **Solicitud observada:** acceso Corregir datos y documentos; el formulario conserva las observaciones del servidor y permite corregir campos, reemplazar el documento rechazado y reenviar desde Resumen. Los controles de propietario/tipo/estado siguen antes de recuperar datos.
- **Después de aprobar:** Ingresar con mi cuenta cierra explícitamente el acceso limitado y lleva al login para renovar la sesión; el botón anterior enviaba a Dashboard y la guardia devolvía al mismo resultado. Una sesión ya operativa conserva su acceso directo sin cerrar sesión.
- **Rechazo definitivo:** conserva motivo y mensajes y explica consultar a administración. Se retira el enlace a una nueva solicitud que el backend no permite con la misma cuenta y los flags actuales. El envío de mensajes ya estaba bloqueado y sigue bloqueado; no se afirma corregir un permiso que ya funcionaba.
- **Avisos de alta:** campana, listado y toast resuelven la solicitud propia para el solicitante; la revisión de administración conserva su ruta. La etiqueta deja de decir Abrir manifiesto y abrir un aviso refresca la solicitud. PSIP, certificados y manifiestos preservan sus destinos.
- **PWA y administración de transporte:** se corrige la omisión de ADMIN_TRANSPORTISTA en la ruta de solicitudes. Coincide con web y con la autorización sectorial del backend, sin cambiar ésta; antes el enlace del menú volvía al inicio.
- **Encabezado:** nombre largo en el selector no aplasta el título. Se conserva el nombre completo accesible/en el menú.
- **Factura administrativa:** el tipo histórico FACTURA_LUZ activa la misma lectura eléctrica que FACTURA_ELECTRICA, conservando el tipo y original; ningún backfill. El alta de Operador ofrece Factura eléctrica opcional; Generador conserva sus marcadores de requisitos.
- **Documentos del operador:** nueva pestaña de su ficha con componentes existentes: originales, lectura eléctrica y revisión/reserva ATM por administración competente. Actor y otros sectores sólo consultan; endpoints, permisos y trazabilidad existentes.
- **Manual 2026.20.18:** misma guía y cuatro pasos, renderer conservado y dos reglas CSS para contener URLs largas sin alterar colores/tipografía. Se explican recuperación, corrección, resultado cerrado, avisos propios y documentos administrativos; captura actual de preview con procedencia verificable.

## Circuitos ensayados

Generador, transportista y operador: cuenta artificial → declaración completa → guardado/recarga → verificación consumida por interfaz real → login → recuperar borrador → documentos y ATM → presentar → administración sectorial observa y rechaza un adjunto → solicitante corrige campo y reemplaza el adjunto → vuelve a presentar → administración identifica/reserva pago y revisa documentos → aprueba → login nuevo → aviso de aprobación → resultado propio. Se contrasta en PostgreSQL cuenta habilitada/verificada, datos corregidos, flota y HP declarados, pago aplicado al trámite y ausencia de pagos TEF inventados.

Rechazo: tres roles, tres superficies, motivo e histórico visibles, sin acciones no permitidas; respuesta directa rechazada por API y sin actor habilitado.

Alta directa administrativa: generador/operador, originales de factura y ATM, ficha, evidencia eléctrica, reserva contra el original y aprobación del documento. En documentos de actor se conserva CONFIRMADO y el evento APROBADO; APLICADO corresponde al paso separado de aprobación de una solicitud. Transportista: archivo inválido después de guardar el actor, reemplazo y reintento sin crear otro actor. Licencia/flota: OCR nativo, confirmación humana, revisión administrativa y conservación de móviles/choferes.

## Validación

| Verificación final | Resultado | Alcance |
| --- | --- | --- |
| Backend dirigido | **169/169** | Pagos, OCR eléctrico, revisión documental, requisitos y certificados de actor. |
| Frontend dirigido | **312/312** | Altas, recuperación/corrección, avisos, rutas por rol, documentos y componentes relacionados. |
| Altas públicas | **18/18** | Tres roles × aprobación/corrección o rechazo × web, web móvil y app. |
| Altas administrativas directas | **6/6** | Generador y Operador × tres superficies; originales, OCR, reserva y revisión ATM. |
| Pagos y electricidad en navegador | **12/12** | Identidad del pago, otra foto/alta, evidencia eléctrica y manual. |
| Regresión de recibos/adjuntos | **18/18** | Recuperación, doble presentación y archivo inválido con reintento sin duplicar actor. |
| Regresión de flota | **3/3** | Alta de Transportista, OCR nativo de licencia, confirmación y revisión de móviles/choferes. |
| Manual en navegador | **3/3** | Guía real, cuatro imágenes originales, botones completos en viewport y sin peticiones de negocio. |
| Manual y sincronización | **25/25** | Contenido, procedencia, conservación de originales y copia exacta del manual final. |
| API/OCR nativo | **11 grupos** | Concurrencia, identidad del pago, sustitución/retiro, legado, once emisores y PDF híbrido. |
| Auditoría final | **11 grupos** | Datos conservados, documentos, cuentas, colas, procesos, fuentes y consola. |
| TypeScript/backend/build web/build app/lint crítico | **PASS** | Ejecución serial sobre los insumos finales de producto. |
| Diff Prisma | **Vacío** | Esquema propio contra el modelo canónico; no se agrega migración fuente. |

Total navegador **60/60**, sin omitidos, reintentos, flaky ni errores de teardown en los seis reportes aceptados. Se instrumentaron **81 páginas/contextos**: cero errores no controlados o respuestas HTTP inesperadas. Se conservan seis respuestas negativas esperadas de los casos que prueban rechazos; las advertencias de SW bloqueado se documentan como límite del arnés, no como certificación de PWA.

ATM: otra imagen del mismo pago, otro CUIT/período/alta o documento de actor no evaden la identidad reservada; transacción/control también impiden cambiar sólo el ID. Dos reservas concurrentes dejan exactamente una confirmada y la otra en 409, sin filtrar el titular anterior. Se ensaya conciliación de aprobados históricos artificiales sin modificar decisiones ni originales. **Esto no verifica acreditación ante ATM.**

La auditoría conservó **175 tablas previas de QA** por conteo y hash completo. En el esquema nuevo quedan 71 solicitudes artificiales aprobadas acumuladas, 9 aprobadas y 9 rechazadas del último recorrido público aceptado, 577 adjuntos de solicitudes, 33 facturas eléctricas de solicitudes y 19 facturas administrativas acumuladas; las repeticiones no se borraron. Los **311 correos están SUPRIMIDO, con cero intentos y cero fechas de envío**; no se creó ningún pago TEF. Se verificaron CAP vencido y proveedores/flags efectivos de los procesos antes de cerrarlos.

Los builds finales usan **2.277 archivos fuente** y API local `/api`. Los **46 blobs cambiados** del commit de producto coinciden por SHA-256 con el manifiesto aceptado. El runtime backend/frontend coincide con el snapshot de build v8; el manual final, sincronizado después de generar su captura, coincide byte por byte con sus fuentes. `manual.js` y ambos lockfiles mantienen sus hashes anteriores; el diff CSS se limita a contener palabras/URLs largas y lleva su propia versión de caché.


## Evidencia y reproducción

Artefactos locales ignorados `test-results-actor-onboarding-20261020/`; remotos `/opt/sitrep-qa-enterprise-20261016/source/.qa-actor-onboarding-20261020/`. Los reportes finales son `backend-administrative.json`, `frontend-entry-final.json`, `browser-entry-final.json`, `admin-entry-final.json`, `payment-final.json`, `receipts-final.json`, `fleet-final.json`, `onboarding-manual-browser.json`, `manual-contained.log`, `payment-electricity-integration.json`, `audit.json` y `browser-console-summary.json`. La copia filtrada local está en `accepted-evidence/`; hashes de producto/commit en `committed-product-proof.json`, cierre en `closure.json`/`container-closed.json` y límites en `resources-before-close.txt`/`close-result.json`. Manifiestos de fuentes SHA-256 y builds v8, backend real en loopback 3037, web/app/manual 4177, API `/api`. No son paquetes para producción.

Playwright instalado se usó porque el runtime del plugin Browser no estaba disponible. Proyectos: Chromium escritorio 1440×900, web móvil 360×800 y `/app` 360×800, un worker, cero reintentos. Sensores/dispositivo Android físico y navegadores iOS/Safari no certificados. Los avisos de SW bloqueado por Playwright son propios de ese aislamiento, no prueba de instalación/offline real.

Para reproducir, reutilizar el arnés local ignorado `runner.ts`/`.actor-onboarding-runner.ts` y sus guardas: fases backend/frontend → tipos/build web/app → inicio propio → altas administrativas/públicas → manual final → API/OCR → pagos/recibos/flota → lint/diff/auditoría → cierre. No ejecutar `prepare`, `seed` ni `db push` otra vez sobre el esquema existente. El fixture crea un esquema nuevo sólo si no existe; no se usa contra `public`, CAP ni producción. Las credenciales artificiales y tokens de comprobación quedan fuera de este informe.

Los correos siguen apagados: se introduce un comprobante de verificación sintético sólo en la nueva cuenta artificial y se lo consume por la página/controlador reales. No se marca emailVerified directamente ni se prueba entrega SMTP. No se habilita CAP ni se salta autenticación operativa.

OCR: once encabezados de distribuidoras y un PDF híbrido artificiales; no certifica todas las facturas reales o históricas. Tarifa/kWh/kW no equivalen a potencia instalada HP. El criterio para incorporar categoría eléctrica al test y la conciliación fiscal de la fórmula R siguen pendientes; no se cambian reglas, importes ni se acredita pago ante ATM.

### Incidencias conservadas

Se conserva el rojo original del borrador sin entrada, el título recortado en Notificaciones y las primeras pasadas. El verificador ya continuaba correctamente al formulario; se corrigió esa expectativa inicial del ensayo. El retorno a login con sesión abierta se sustituyó por salida real; el token acotado del wizard no se confunde con una sesión AuthContext. El primer ensayo de alta administrativa esperaba APLICADO al revisar un documento: se corrigió la expectativa a CONFIRMADO más el evento APROBADO, reservando APLICADO para aprobar una solicitud; no se alteró el estado de producto para satisfacer la prueba. Un cambio de versión del arnés apuntó a src-v7 y produjo cero tests: se conservó como FAILED, se corrigió a src-v6 y se agregó preflight de existencia antes de la pasada efectiva. La auditoría inicial mezcló por prefijo de nombre el lote con verificación y la regresión de flota QA alta integral, que no verifica correo: la auditoría final usa los nueve IDs aprobados y los nueve rechazados de los artefactos de cada caso aceptado, sin editar datos para satisfacerla. Las repeticiones usan nuevas identidades artificiales sin borrar casos anteriores. Se preservan los errores de preparación/mocks/JSX corregidos antes de los builds aceptados, sin relajar requisitos funcionales o geometría. La medición contra el viewport visual encontró un desborde real del manual: una URL hacía crecer innerWidth a 481 px aunque el teléfono mostraba 360, recortando Siguiente paso. Se contienen las columnas del texto y se habilita el corte de palabras largas; CSS v2026.20.5, mismos colores/tipos, renderer v2026.20.4 sin cambios. La guía se ensaya por su índice real, esperando fuentes e imagen precedente, en lugar de un scroll DOM que competía con imágenes tardías; no cambió el renderer. Se actualizó la expectativa de caché de la prueba heredada PSIP de manual 17 a 18. Las regresiones anónimas de adjuntos y flota se repiten con el mismo aislamiento de proveedores y captura de consola de las nuevas pruebas, preservando su primera pasada.

## Cosas que no se tocaron y riesgos

Producción, `main`, registros reales de operación, históricos previos de QA, obligaciones/documentos requeridos, autorización del backend, fórmulas y montos TEF, canales y flags. No migración fuente nueva. Se conservan originales, reservas y evidencias. La revisión es de estos recorridos; no son suites unitarias globales ni un GO global. Una publicación requiere autorización nueva, recompilar con dominio final y versionado de SW de release; no desplegar los bundles QA.

## Cierre y continuación

Producto probado **`4b5c8bdd3380beb3bc03674d902a31ff0b91f76e`** (`4b5c8bdd`), commit **`[skip ci]`**, sólo local en la rama de trabajo. La actualización de este informe y de los puntos de entrada queda en un segundo commit documental, también `[skip ci]`. Ningún push, workflow, integración a `main` ni publicación.

API/estático propios cerrados con comprobación de identidad de PID, sin SIGKILL; PostgreSQL detenido correctamente antes del contenedor. Contenedor detenido **20/10/2026 20:48:11 Mendoza**, **`Running=false`, `Pid=0`, `OOMKilled=false`**. Imagen, base, todos los casos y evidencias conservados. No hay preview servido al cierre; debe abrirse nuevamente bajo los mismos límites para otra revisión.

Recursos efectivos: **1 CPU, 2.147.483.648 bytes, swap cero, un worker y una suite a la vez**. `memory.events` final: `max=5970`, `oom=0`, `oom_kill=0`, `oom_group_kill=0`. Hubo presión/reclamación de memoria en builds dentro del límite; no se aumentó el presupuesto. El máximo contable del cgroup fue 2.147.487.744 bytes. El exit 143 del contenedor corresponde a su parada explícita después de cerrar los servicios, sin OOM.

Sigue pendiente la decisión fiscal para usar la categoría eléctrica como variable del test y conciliar R; este cierre no fija esa regla. También sigue pendiente habilitar expresamente la entrega de correo si se pretende probar o usar altas públicas reales con verificación/recuperación. Este turno no autoriza ninguna de esas activaciones ni un despliegue.
