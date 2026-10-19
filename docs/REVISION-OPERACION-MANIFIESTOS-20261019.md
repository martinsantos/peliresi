# Revisión de operación de manifiestos — 19/10/2026

Estado: trabajo en la rama de capacitación, sin publicación ni cambio de `main`. El relevo tiene implementación candidata y se valida en el preview; sigue apagado para operación real. La entrega externa de avisos conserva sus restricciones.

## Recorrido que debe entender cada persona

1. **Propuesta:** generador, transporte u operador crea el manifiesto. Aparece arriba en la agenda de los tres, con número, fecha prevista y tres iconos de aprobación. Cada parte ve claramente si debe decidir o si está esperando a otra.
2. **Aprobación unánime:** una negativa detiene la propuesta y queda en el historial. Las tres aprobaciones habilitan **iniciar coordinación**, que avisa a los demás. Este evento no inicia GPS ni declara retiro físico.
3. **Retiro y tránsito:** el transporte confirma el retiro cuando recibe la carga. Ahí comienza el tiempo transcurrido y el GPS del manifiesto. Una empresa puede tener varios manifiestos activos; la app muestra cada viaje y permite elegirlo sin redirigir siempre a uno solo.
4. **Entrega y tratamiento:** el operador registra recepción, pesaje y tratamiento, resuelve las adendas y libera parcial o final cuando corresponde. El estado del manifiesto y las certificaciones no se infieren de leer un aviso.
5. **Avisos:** la campana conserva el historial. Una novedad dirigida a una parte debe mostrarse de forma visible con la app abierta. El push del sistema operativo y el correo sólo se ofrecen a cuentas verificadas, suscritas y con los canales habilitados; nunca se anuncian como entregados si VAPID o SMTP están apagados.

Las listas de web y app deben distinguir **por iniciar**, **en curso** y **terminados** con el mismo nombre y estado real. La agenda de portada es una vista compacta del trabajo pendiente, con búsqueda y filtros; el listado completo sigue siendo el lugar para explorar todo el historial.

**Alcance validado en este corte:** la app deja elegir entre varios viajes activos y muestra su tiempo transcurrido. El relevo ya tiene un recorrido de aceptación real de API y navegador en web/app. El GPS simultáneo de varias cargas está en desarrollo separado: las pruebas del relevo no acreditan todavía esa capacidad.

## Rotura y relevo en tránsito: decisión del dueño e implementación candidata

Se admite el relevo por un móvil de la misma empresa, por otra transportista registrada o por una empresa **externa eventual con identidad declarada y seguimiento**, según la respuesta del dueño. No se sustituye silenciosamente `transportistaId` ni la asignación firmada: cada tramo conserva los datos disponibles de transportista, móvil y chofer, quién declaró el traspaso de custodia, motivo, fecha/hora, ubicación y evidencia disponible. Un relevo no supone habilitación regulatoria de la empresa eventual ni reescribe autorizaciones previas.

**Decisión recibida el 19/10:** la transportista del manifiesto original define y confirma cada traspaso, sin aceptación obligatoria del reemplazo ni aprobación previa del operador/administrador. Si el reemplazo no está registrado, se tolera una declaración incompleta: empresa, CUIT, patente, chofer, documento y contacto son opcionales; se conserva lo que se pudo cargar, sin crear un actor ficticio ni marcarlo como habilitado. El motivo del traspaso y la autoría de origen sí quedan registrados.

El modelo de datos debe separar el manifiesto de sus **tramos de transporte**. Un único tramo está activo por manifiesto; varios manifiestos pueden estar simultáneamente en el mismo vehículo. El GPS debe quedar atribuido al tramo y al dispositivo/cuenta que lo emitió. Al relevar, se cierra el tramo anterior y se abre uno nuevo en una transacción, con aviso a generador, operador, transporte previo, nuevo transporte si tiene cuenta y centro de control. El C3 muestra tanto el tramo vigente como los anteriores y señala las lagunas sin cobertura.

Para un externo sin cuenta se guarda la identidad disponible y se entrega un enlace/QR firmado, revocable y limitado al GPS de ese tramo durante un máximo de 24 horas. No es una cuenta de usuario ni permite aprobar, firmar, consultar el expediente completo o modificar la carga. El portador toca **Compartir ubicación**, permite GPS y mantiene esa pantalla abierta. El emisor se registra como acceso delegado del tramo; no se afirma verificar la identidad personal de quien sostiene el teléfono. La transportista de origen conserva la confirmación de entrega. Un nuevo relevo, la entrega o la revocación invalidan el enlace anterior también entre workers.

Una transportista registrada de reemplazo ve **Relevos a mi cargo** en su perfil y puede abrir ese mismo seguimiento limitado. Recibe un aviso dirigido al perfil; no obtiene por ese enlace acceso al expediente completo. La de origen puede renovar o revocar el acceso. Generador, operador y C3 reciben aviso interno del cambio.

**Integración:** `transportistaId`, `asignacionTransporte` y las aprobaciones siguen describiendo el acuerdo original. La tabla aditiva `tramos_transporte` conserva la secuencia de custodia; `tracking_gps.tramoId` y `emisor` atribuyen las nuevas posiciones. Los puntos históricos sin tramo siguen siendo históricos del transporte original, sin reescribirlos. GPS, relevo y entrega se serializan sobre el mismo manifiesto, además de la restricción de un único tramo activo. C3 muestra la empresa actual y los tramos anteriores; espera el primer GPS del reemplazo antes de usarlo como ubicación actual. El mapa del expediente separa las líneas de cada tramo.

## Casos que bloquearán la publicación del relevo

- Dos retiros o dos relevos concurrentes no pueden crear dos tramos activos ni perder un evento.
- Un transportista ajeno no puede leer, aceptar, cerrar ni enviar GPS para un tramo que no le pertenece. El transportista anterior deja de poder informar nuevas posiciones tras el relevo, pero conserva el historial que le corresponde.
- El relevo conserva las aprobaciones originales y las cantidades; no se usa para modificar carga, generador, operador o reglas de compatibilidad.
- Una empresa externa eventual queda identificada como declarada, no como habilitada. La vista y los documentos distinguen ambas condiciones.
- Mismo móvil con varios manifiestos: cada posición recibida debe quedar atribuida explícitamente a cada manifiesto/tramo que se está transportando. No basta con abrir una sola pantalla y asumir cobertura de los demás.
- Sin conexión: se muestra qué tramo carece de GPS reciente. El sistema no inventa puntos ni continuidad.
- Web, app y C3 muestran el mismo responsable vigente, la secuencia de custodia y los avisos de cambio.

D04 queda precisada para esta capacidad por la decisión de arriba. D10 (compatibilidad y reparto móvil/carga) sigue pendiente: una selección registrada o una declaración eventual no certifican capacidad, habilitación ni aptitud. El GPS simultáneo de varios manifiestos en un mismo teléfono sigue fuera de este corte. El nuevo flag `MANIFEST_TRANSPORT_HANDOFF_ENABLED` y su par Vite son opt-in, apagados por defecto; CAP autenticado puede ensayarlo en su esquema aislado. Publicar esta capacidad requiere la migración aditiva `20261019180000_transport_handoffs`, también en el esquema CAP, además del build y validación del candidato; nada de eso se aplicó a producción.

## Verificación de este corte

Todo se ejecutó en el contenedor propio del preview `76.13.234.213`, de forma serial, un worker, 1 CPU, 2 GiB y swap cero, con base sintética y proveedores externos desconectados. El relevo se habilitó sólo en ese proceso y sus builds de QA; los otros cuatro flags permanecieron apagados.

- Backend completo: **1165/1165**, 110 archivos. TypeScript backend/frontend y builds de producción web y `/app` correctos.
- API real: **16 grupos de comprobaciones correctos**, incluidos permisos de origen/reemplazo/ajeno, externo sin datos, asignación y aprobaciones intactas, reintentos idempotentes, relevos concurrentes, avisos transaccionales, GPS atribuido al tramo, revocación/renovación/expiración, instructor suspendido, entrega y historial propio. Un token de seguimiento no autentica como usuario.
- Navegador real: **2/2**, web y app, con cuatro contextos sintéticos. Traspaso externo desde el formulario, GPS limitado aun con una sesión de usuario vieja, C3 sin reutilizar posiciones previas, relevo registrado con móvil/chofer del catálogo, revocación del enlace anterior y entrega desde la pantalla del transporte original. GPS emulado, sin certificar sensores físicos, segundo plano ni Android.
- Migración aditiva ensayada en un esquema sintético independiente: impide dos tramos activos y borrar un tramo con GPS. El preview antiguo no tenía historia Prisma y `migrate deploy` devolvió P3005; no se falseó una línea de base ni se reseteó. Sólo allí se aplicó el SQL aditivo y se hizo el ensayo separado.
- Frontend completo más reciente: **1593/1594**; único fallo: las dos capturas nuevas del manual estaban bajo `screenshots/app/` y el contrato exige `desktop/` o `mobile/`. Se movieron a `mobile/`, conservando bytes y expectativas: manual **8/8** y contenido/procedencia **14/14** después de la corrección. El primer pase había expuesto cinco montajes con un hook de consulta cuando el flag estaba apagado; se corrigió el límite del componente y su control dirigido pasó. No se presenta ese pase como una suite completa final sin fallos.
- Manual con el diseño existente, versión de datos **2026.20.10**: tres capturas sintéticas sin editar, hashes y procedencia en `transport-handoff-capture-provenance.json`. Evidencias privadas de QA en `.qa-handoff-20261019` del preview y `test-results-handoff-20261019` del checkout, fuera de Git.

Queda pendiente la prueba de varias cargas simultáneas y la aceptación final conjunta. No se hizo despliegue, migración ni cambio de configuración en producción; los accesos de la demo siguen cerrados y SMTP/VAPID apagados. No hay un GO global.
