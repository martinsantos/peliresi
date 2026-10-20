# Revisión de operación de manifiestos — 19/10/2026

Estado vigente: **`d372ce6e` publicado** en backend, web, app y manual de `sitrep.ultimamilla.com.ar`, el 19/10 a las 21:25:45 Mendoza, con relevos y GPS múltiple habilitados por el dueño. Backup verificado y migración aditiva aplicados; smoke no mutante 57/57, HTTPS externo 9/9 y PWA PASS. CAP cerrado, correos/push apagados, cuatro flags originales false y `main` intacto. Leer [configuración, incidentes, evidencias y contención preparada](DESPLIEGUE-RELEVOS-20261019.md). Las secciones de candidato/preparación de abajo conservan el registro previo a publicar; su pendiente de migración ya quedó resuelto. La unanimidad y las certificaciones de escuela siguen limitadas a CAP; este despliegue no amplía esas reglas a operación real.

## Recorrido que debe entender cada persona

1. **Propuesta:** generador, transporte u operador crea el manifiesto. Aparece arriba en la agenda de los tres, con número, fecha prevista y tres iconos de aprobación. Cada parte ve claramente si debe decidir o si está esperando a otra.
2. **Aprobación unánime:** una negativa detiene la propuesta y queda en el historial. Las tres aprobaciones habilitan **iniciar coordinación**, que avisa a los demás. Este evento no inicia GPS ni declara retiro físico.
3. **Retiro y tránsito:** el transporte confirma el retiro cuando recibe la carga. Ahí comienza el tiempo transcurrido y el GPS del manifiesto. Una empresa puede tener varios manifiestos activos; la app muestra cada viaje y permite elegirlo sin redirigir siempre a uno solo.
4. **Entrega y tratamiento:** el operador registra recepción, pesaje y tratamiento, resuelve las adendas y libera parcial o final cuando corresponde. El estado del manifiesto y las certificaciones no se infieren de leer un aviso.
5. **Avisos:** la campana conserva el historial. Una novedad dirigida a una parte debe mostrarse de forma visible con la app abierta. El push del sistema operativo y el correo sólo se ofrecen a cuentas verificadas, suscritas y con los canales habilitados; nunca se anuncian como entregados si VAPID o SMTP están apagados.

Las listas de web y app deben distinguir **por iniciar**, **en curso** y **terminados** con el mismo nombre y estado real. La agenda de portada es una vista compacta del trabajo pendiente, con búsqueda y filtros; el listado completo sigue siendo el lugar para explorar todo el historial.

**Alcance del candidato:** agenda compacta, filtros por fase en el listado completo, cola de varios viajes y pantalla **Cargas en este móvil** para seleccionar físicamente qué manifiestos comparten el GPS. El tiempo transcurrido sigue siendo informativo, sin plazos nuevos. Las pruebas del relevo y las de varias cargas se informan por separado abajo.

## Rotura y relevo en tránsito: decisión del dueño e implementación candidata

Se admite el relevo por un móvil de la misma empresa, por otra transportista registrada o por una empresa **externa eventual con identidad declarada y seguimiento**, según la respuesta del dueño. No se sustituye silenciosamente `transportistaId` ni la asignación firmada: cada tramo conserva los datos disponibles de transportista, móvil y chofer, quién declaró el traspaso de custodia, motivo, fecha/hora, ubicación y evidencia disponible. Un relevo no supone habilitación regulatoria de la empresa eventual ni reescribe autorizaciones previas.

**Decisión recibida el 19/10:** la transportista del manifiesto original define y confirma cada traspaso, sin aceptación obligatoria del reemplazo ni aprobación previa del operador/administrador. Si el reemplazo no está registrado, se tolera una declaración incompleta: empresa, CUIT, patente, chofer, documento y contacto son opcionales; se conserva lo que se pudo cargar, sin crear un actor ficticio ni marcarlo como habilitado. El motivo del traspaso y la autoría de origen sí quedan registrados.

El modelo de datos debe separar el manifiesto de sus **tramos de transporte**. Un único tramo está activo por manifiesto; varios manifiestos pueden estar simultáneamente en el mismo vehículo. El GPS debe quedar atribuido al tramo y al dispositivo/cuenta que lo emitió. Al relevar, se cierra el tramo anterior y se abre uno nuevo en una transacción, con aviso a generador, operador, transporte previo, nuevo transporte si tiene cuenta y centro de control. El C3 muestra tanto el tramo vigente como los anteriores y señala las lagunas sin cobertura.

Para un externo sin cuenta se guarda la identidad disponible y se entrega un enlace/QR firmado, revocable y limitado al GPS de ese tramo durante un máximo de 24 horas. No es una cuenta de usuario ni permite aprobar, firmar, consultar el expediente completo o modificar la carga. El portador toca **Compartir ubicación**, permite GPS y mantiene esa pantalla abierta. El emisor se registra como acceso delegado del tramo; no se afirma verificar la identidad personal de quien sostiene el teléfono. La transportista de origen conserva la confirmación de entrega. Un nuevo relevo, la entrega, la cancelación, una reversión fuera de tránsito o la revocación invalidan el enlace anterior también entre workers. Volver a retirar después de una reversión no revive un acceso anterior; los permisos y las transiciones de cancelación/reversión existentes no cambian.

Una transportista registrada de reemplazo ve **Relevos a mi cargo** en su perfil y puede abrir ese mismo seguimiento limitado. Recibe un aviso dirigido al perfil; no obtiene por ese enlace acceso al expediente completo. La de origen puede renovar o revocar el acceso. Generador, operador y C3 reciben aviso interno del cambio.

**Integración:** `transportistaId`, `asignacionTransporte` y las aprobaciones siguen describiendo el acuerdo original. La tabla aditiva `tramos_transporte` conserva la secuencia de custodia; `tracking_gps.tramoId` y `emisor` atribuyen las nuevas posiciones. Los puntos históricos sin tramo siguen siendo históricos del transporte original, sin reescribirlos. GPS, relevo y entrega se serializan sobre el mismo manifiesto, además de la restricción de un único tramo activo. C3 muestra la empresa actual y los tramos anteriores; espera el primer GPS del reemplazo antes de usarlo como ubicación actual. El mapa del expediente separa las líneas de cada tramo.

## Casos que bloquearán la publicación del relevo

- Dos retiros o dos relevos concurrentes no pueden crear dos tramos activos ni perder un evento.
- Un transportista ajeno no puede leer, aceptar, cerrar ni enviar GPS para un tramo que no le pertenece. El transportista anterior deja de poder informar nuevas posiciones tras el relevo, pero conserva el historial que le corresponde.
- El relevo conserva las aprobaciones originales y las cantidades; no se usa para modificar carga, generador, operador o reglas de compatibilidad.
- Una empresa externa eventual queda identificada como declarada, no como habilitada. La vista distingue ambas condiciones y no presenta el registro como una habilitación; los documentos originales conservan el acuerdo firmado.
- Mismo móvil con varios manifiestos: cada posición recibida debe quedar atribuida explícitamente a cada manifiesto/tramo que se está transportando. No basta con abrir una sola pantalla y asumir cobertura de los demás.
- Sin conexión: se muestra qué tramo carece de GPS reciente. El sistema no inventa puntos ni continuidad.
- Web, app y C3 muestran el mismo responsable vigente, la secuencia de custodia y los avisos de cambio.

D04 queda precisada para esta capacidad por la decisión de arriba. D10 (compatibilidad y reparto móvil/carga) sigue pendiente: una selección registrada o una declaración eventual no certifican capacidad, habilitación ni aptitud. `MANIFEST_TRANSPORT_HANDOFF_ENABLED`, `TRANSPORT_MULTI_GPS_ENABLED` y sus pares Vite son opt-in, apagados por defecto; CAP autenticado puede ensayarlos en su esquema aislado. Publicar este backend requiere la migración aditiva `20261019180000_transport_handoffs`, también en el esquema CAP, incluso si se mantienen los flags apagados, porque C3 consulta los tramos. Nada de eso se aplicó a producción.

## Varias cargas y avisos

Una cuenta transportista entra a **Mis viajes → Cargas en este móvil**, marca únicamente las cargas que lleva ese vehículo y toca **Iniciar GPS**. Un solo captor geográfico envía la misma observación reciente a cada manifiesto original o relevo registrado seleccionado. Las selecciones se conservan al buscar otro número; cambiar de cuenta las borra y corta el captor. No hay selección automática ni atribución por pertenecer a la misma empresa.

Cada carga muestra su propia recepción GPS. Los envíos son secuenciales y no se reproducen coordenadas de más de un minuto como si fueran actuales. Al entregar una carga se espera sólo su envío pendiente, se confirma esa entrega y las restantes siguen. Un relevo o pérdida de acceso bloquea sólo el emisor de esa carga, con un mensaje para resolverlo. No hay transmisión prometida con la pantalla cerrada ni un nuevo plazo operativo. El externo sin cuenta conserva un acceso limitado por tramo; la selección de varias cargas corresponde a una cuenta transportista registrada.

La campana sigue siendo la historia persistente. Adenda creada/resuelta y relevo crean avisos para sus partes en la misma transacción de negocio. El push de esos avisos se intenta **después del commit**, únicamente para IDs nuevos, destinatario activo y verificado y recurso que todavía le corresponda; no se copian motivos o notas libres a la pantalla bloqueada. Es un canal de mejor esfuerzo: una interrupción del proceso puede perder ese intento, sin perder el aviso interno. El correo usa la cola durable existente, la familia `manifiestos`, el corte temporal y la preferencia de email, con reevaluación de cuenta/recurso antes de enviar. Los reemplazos registrados reciben un enlace a su perfil limitado, nunca al expediente original por vía de un aviso.

En **Avisos → Activar avisos del teléfono** se solicita permiso con una acción explícita. Una autorización local no se presenta como suscripción confirmada si falla el registro en el servidor. Web y app eligen el service worker de su ámbito exacto; tocar un push web no desvía la ventana del chofer en la app. CAP no solicita este canal. `PUSH_MANIFEST_NOTICES_ENABLED` queda apagado por defecto y no habilita VAPID ni SMTP por sí solo. Las tres aprobaciones siguen siendo una capacidad de CAP; este cambio no extiende esa regla a la operación real.

## Preparación para una publicación futura y reversión

Este es un candidato local, sin publicación ni integración en `main`. Para una entrega operativa se debe aprobar expresamente el alcance, confirmar versión/configuración activas en lectura y preparar artefactos con el dominio y flags elegidos. Antes del backend nuevo: respaldo verificado y migración aditiva en los esquemas correspondientes; sin seeds ni restablecer cuentas CAP. No repetir las doce migraciones históricas del despliegue de `1ab057a`. SMTP, VAPID, preferencias y permisos físicos requieren aceptación propia; las pruebas desconectadas no acreditan entrega real.

La reversión conserva tablas, eventos y GPS. Si ya existen relevos activos, **no volver a un backend que ignore tramos**, porque volvería a aceptar posiciones del transporte original y presentaría una responsabilidad incorrecta en C3. Se puede deshabilitar la creación de nuevos relevos manteniendo la lectura y el seguimiento de los existentes. Como referencia de código, `81c20f1d` conserva custodia/GPS por tramo antes de la pantalla de varias cargas; volver a esa interfaz detiene la sesión de GPS simultáneo y exige organizar el seguimiento de las cargas restantes. Los enlaces y releases concretos para un rollback se fijarán al preparar la entrega; hoy no existe un release desplegado de estos commits. No restaurar una base antigua para deshacer una interfaz.

## Verificación del relevo antes del GPS simultáneo (`81c20f1d`)

Todo se ejecutó en el contenedor propio del preview `76.13.234.213`, de forma serial, un worker, 1 CPU, 2 GiB y swap cero, con base sintética y proveedores externos desconectados. El relevo se habilitó sólo en ese proceso y sus builds de QA; los otros cuatro flags permanecieron apagados.

- Backend completo: **1165/1165**, 110 archivos. Tipado backend y builds Vite web y `/app` correctos. El comando inicial de tipos frontend apuntaba al `tsconfig.json` contenedor (sin archivos); no acredita el tipado de la app. En la validación conjunta se corrigió a `tsc --noEmit -p tsconfig.app.json` y pasó.
- API real: **16 grupos de comprobaciones correctos**, incluidos permisos de origen/reemplazo/ajeno, externo sin datos, asignación y aprobaciones intactas, reintentos idempotentes, relevos concurrentes, avisos transaccionales, GPS atribuido al tramo, revocación/renovación/expiración, instructor suspendido, entrega y historial propio. Un token de seguimiento no autentica como usuario.
- Navegador real: **2/2**, web y app, con cuatro contextos sintéticos. Traspaso externo desde el formulario, GPS limitado aun con una sesión de usuario vieja, C3 sin reutilizar posiciones previas, relevo registrado con móvil/chofer del catálogo, revocación del enlace anterior y entrega desde la pantalla del transporte original. GPS emulado, sin certificar sensores físicos, segundo plano ni Android.
- Migración aditiva ensayada en un esquema sintético independiente: impide dos tramos activos y borrar un tramo con GPS. El preview antiguo no tenía historia Prisma y `migrate deploy` devolvió P3005; no se falseó una línea de base ni se reseteó. Sólo allí se aplicó el SQL aditivo y se hizo el ensayo separado.
- Frontend completo más reciente: **1593/1594**; único fallo: las dos capturas nuevas del manual estaban bajo `screenshots/app/` y el contrato exige `desktop/` o `mobile/`. Se movieron a `mobile/`, conservando bytes y expectativas: manual **8/8** y contenido/procedencia **14/14** después de la corrección. El primer pase había expuesto cinco montajes con un hook de consulta cuando el flag estaba apagado; se corrigió el límite del componente y su control dirigido pasó. No se presenta ese pase como una suite completa final sin fallos.
- Manual con el diseño existente, versión de datos **2026.20.10**: tres capturas sintéticas sin editar, hashes y procedencia en `transport-handoff-capture-provenance.json`. Evidencias privadas de QA en `.qa-handoff-20261019` del preview y `test-results-handoff-20261019` del checkout, fuera de Git.

Las pruebas conjuntas posteriores se registran a continuación. No se hizo despliegue, migración ni cambio de configuración en producción; los accesos de la demo siguen cerrados y SMTP/VAPID apagados. No hay un GO global.

## Validación conjunta del candidato final

Producto **`d372ce6e2c62b21dc97a8a42a72d84a6de4d707b`**, posterior a `81c20f1d`, en `codex/sitrep-training-20261018`, únicamente en el checkout activo. Commits locales `[skip ci]`, sin push ni workflows; `main` conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Los artefactos se construyeron en el preview con `NODE_ENV=production`, API relativa `/api`, demo apagado, los cuatro flags de funcionalidad originales apagados y los dos flags de transporte habilitados sólo para la aceptación sintética. El código por defecto conserva esos flags de transporte apagados. No es un artefacto listo para publicar sin elegir la configuración operativa.

| Comprobación | Resultado |
| --- | --- |
| Backend completo, con los siete flags operativos apagados | **1177/1177**, 112 archivos |
| Frontend completo final | **1615/1615**, 228 archivos |
| Tipado efectivo | Backend `tsc`; frontend `tsc --noEmit -p tsconfig.app.json`, ambos correctos |
| Builds definitivos | Web 31,73 s; app 32,08 s. SW raíz **v127**, app **20261019234114** |
| Relevo, API/DB real de QA | **18 grupos correctos**, repetidos con el backend final: incluyen cierre/revocación al cancelar y al revertir, sin reactivar el enlace después de otro retiro |
| Cargas simultáneas, API real de QA | **8 grupos correctos**, permisos y datos limitados incluidos |
| Relevo, navegador del build final | **2/2**, web/app: externo, registrado, GPS, C3, revocación, entrega e historial |
| Cargas simultáneas, navegador del build final | **2/2**, web/app: tres cargas, una entrega, un relevo posterior y la restante con GPS; búsqueda conserva selección, un solo captor y ayuda en el encabezado |
| Manual, navegador | **2/2**, tres guías en cada vista, imágenes cargadas, índice, navegación y recarga; cero peticiones de negocio |
| Manual, contenido y procedencia | **15/15**, capturas sintéticas originales y hashes correctos |
| Deshabilitación, API real de QA | **3/3** rutas de transporte devuelven 404 con los flags apagados; clave push no disponible |

El primer pase de frontend de esta fase cerró 1604/1604. El build posterior detectó una llave faltante en la nueva vista que todavía no tenía una prueba de página; se corrigió y se agregó su recorrido de selección, búsqueda, entrega y cambio de cuenta. Los controles dirigidos posteriores cerraron 32/32 y 52/52. La inspección visual también detectó la ayuda flotante sobre una fila; pasó al encabezado y se repitió el navegador, sin editar sus capturas ni relajar los controles de GPS.

La revisión de cierres agregó cancelación y reversión a la revocación transaccional del GPS delegado. Backend completo y tipado repetidos sin fallos después de ese ajuste; la API comprobó los dos casos nuevos con los permisos de siempre.

El manual conserva **sin cambios de bytes** `manual.css` y `manual.js`, versión de datos **2026.20.11**. Agrega las guías de varias cargas, relevo y avisos, sin nuevas credenciales. `fleet-gps-capture-provenance.json` conserva los hashes de tres capturas del recorrido final; el recibo del relevo conserva sus tres capturas previas. GPS y mapas emulados, base sintética, SMTP/VAPID vacíos y ninguna entrega externa real.

Las pruebas no certifican Android, sensores físicos, GPS con la pantalla cerrada ni entrega a una casilla o proveedor push real. D10, los roles empresariales/multirrol apagados y la habilitación regulatoria de terceros no se dan por resueltos con esta interfaz. Las tres aprobaciones y las certificaciones escolares siguen dentro de CAP; no se amplían permisos operativos por ese motivo.

Evidencias: `.qa-handoff-20261019` en `/opt/sitrep-qa-enterprise-20261016/source` del preview y `test-results-handoff-20261019/` local, fuera de Git. Reportes finales `fleet-backend-unit-final.json`, `fleet-frontend-unit-final.json`, `handoff-http.json`, `fleet-http.json`, `handoff-browser.json`, `fleet-browser.json`, `operational-manual-browser.json` y `transport-default-off.json`. Las fuentes se contrastan por SHA-256 con `fleet-source-frozen-final.json`.

## Continuidad del preview

Sólo el contenedor propio `sitrep-qa-training-20261018`, con su límite de 1 CPU/2 GiB/swap cero; no copiar dependencias ni iniciar Docker en la Mac. Los procesos del backend/servidor estático se administran con `frontend/cloud-qa/start.ts` y `close.ts`, conservando `QA_ARTIFACTS=/work/sitrep/.qa-handoff-20261019`, los builds en `web` y `app` dentro de esa carpeta y el guard de `safety.ts`. Los archivos privados de fixture no se publican ni se incorporan a Git.

PostgreSQL de este gemelo usa `/tmp/sitrep-preview-run/pg-utf8-9`, usuario de SO `node`, base sintética `sitrep_night_qa_20260926` y loopback **55440**. Para retomarlo deben conservarse las opciones explícitas `-h 127.0.0.1 -p 55440 -k /tmp/sitrep-preview-run -c shared_buffers=32MB -c max_connections=20 -c work_mem=1MB`; un inicio sin ellas puede usar otro puerto o socket. No apuntar a ninguna base productiva ni aplicar una línea de base ficticia a Prisma.

Cierre confirmado: backend/servidor QA y PostgreSQL detenidos, contenedor `sitrep-qa-training-20261018` detenido, imagen y evidencia conservadas. Límites verificados: CPU `100000 100000`, memoria 2.147.483.648 bytes, swap cero; presión de memoria `max=259`, `oom=0`, `oom_kill=0`, sin ampliar límites. No quedó túnel ni servicio QA nuevo abierto.

Git emitió avisos de índice no monótono para un archivo auxiliar `._pack-…idx` en los metadatos compartidos del volumen SDTERA. Los comandos del checkout activo y la creación/lectura del commit terminaron correctamente; se conservaron los avisos en el registro local de QA y no se intentó reparar ni limpiar ese otro checkout o sus metadatos.
