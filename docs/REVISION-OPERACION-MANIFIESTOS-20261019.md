# Revisión de operación de manifiestos — 19/10/2026

Estado: trabajo en la rama de capacitación, sin publicación ni cambio de `main`. Esta nota fija el recorrido y sus criterios de aceptación; no declara habilitado el relevo de transporte ni la entrega externa de avisos.

## Recorrido que debe entender cada persona

1. **Propuesta:** generador, transporte u operador crea el manifiesto. Aparece arriba en la agenda de los tres, con número, fecha prevista y tres iconos de aprobación. Cada parte ve claramente si debe decidir o si está esperando a otra.
2. **Aprobación unánime:** una negativa detiene la propuesta y queda en el historial. Las tres aprobaciones habilitan **iniciar coordinación**, que avisa a los demás. Este evento no inicia GPS ni declara retiro físico.
3. **Retiro y tránsito:** el transporte confirma el retiro cuando recibe la carga. Ahí comienza el tiempo transcurrido y el GPS del manifiesto. Una empresa puede tener varios manifiestos activos; la app muestra cada viaje y permite elegirlo sin redirigir siempre a uno solo.
4. **Entrega y tratamiento:** el operador registra recepción, pesaje y tratamiento, resuelve las adendas y libera parcial o final cuando corresponde. El estado del manifiesto y las certificaciones no se infieren de leer un aviso.
5. **Avisos:** la campana conserva el historial. Una novedad dirigida a una parte debe mostrarse de forma visible con la app abierta. El push del sistema operativo y el correo sólo se ofrecen a cuentas verificadas, suscritas y con los canales habilitados; nunca se anuncian como entregados si VAPID o SMTP están apagados.

Las listas de web y app deben distinguir **por iniciar**, **en curso** y **terminados** con el mismo nombre y estado real. La agenda de portada es una vista compacta del trabajo pendiente, con búsqueda y filtros; el listado completo sigue siendo el lugar para explorar todo el historial.

## Rotura y relevo en tránsito: diseño pendiente de implementación

Se admite el relevo por un móvil de la misma empresa, por otra transportista registrada o por una empresa **externa eventual con identidad declarada y seguimiento**, según la respuesta del dueño. No se sustituye silenciosamente `transportistaId` ni la asignación firmada: cada tramo conserva transportista, móvil, chofer, quién declaró la entrega de custodia, quién la aceptó, motivo, fecha/hora, ubicación y evidencia disponible. Un relevo no supone habilitación regulatoria de la empresa eventual ni reescribe autorizaciones previas.

El modelo de datos debe separar el manifiesto de sus **tramos de transporte**. Un único tramo está activo por manifiesto; varios manifiestos pueden estar simultáneamente en el mismo vehículo. El GPS debe quedar atribuido al tramo y al dispositivo/cuenta que lo emitió. Al relevar, se cierra el tramo anterior y se abre uno nuevo en una transacción, con aviso a generador, operador, transporte previo, nuevo transporte si tiene cuenta y centro de control. El C3 muestra tanto el tramo vigente como los anteriores y señala las lagunas sin cobertura.

Para un externo sin cuenta se guarda identidad declarada de empresa, móvil, chofer, contacto y vínculo con el manifiesto. El GPS continuo requiere un emisor autenticado y vinculado sólo a ese tramo; declarar un número de teléfono o cargar una posición manual no equivale a seguimiento en vivo. Se debe definir y probar la incorporación limitada del emisor antes de anunciar GPS externo disponible. La falta de CUIT o padrón no se tapa con un actor comodín ni se convierte en permiso operativo automático.

**Puntos de integración actuales:** `transportistaId` y `asignacionTransporte` describen el vínculo y la selección originales. `applyRoleFilter`/`canAccessManifiesto`, `/ubicacion` y `/confirmar-entrega` usan ese único transportista; el C3 recibe puntos GPS sólo por `manifiestoId`. Por eso cambiar una tarjeta en la app no resuelve el relevo: hay que introducir tramo vigente e histórico, autorización del emisor y atribución del GPS en backend, consultas, C3 y documentos, manteniendo legibles los manifiestos anteriores sin migrarlos a un transportista ficticio.

## Casos que bloquearán la publicación del relevo

- Dos retiros o dos relevos concurrentes no pueden crear dos tramos activos ni perder un evento.
- Un transportista ajeno no puede leer, aceptar, cerrar ni enviar GPS para un tramo que no le pertenece. El transportista anterior deja de poder informar nuevas posiciones tras el relevo, pero conserva el historial que le corresponde.
- El relevo conserva las aprobaciones originales y las cantidades; no se usa para modificar carga, generador, operador o reglas de compatibilidad.
- Una empresa externa eventual queda identificada como declarada, no como habilitada. La vista y los documentos distinguen ambas condiciones.
- Mismo móvil con varios manifiestos: cada posición recibida debe quedar atribuida explícitamente a cada manifiesto/tramo que se está transportando. No basta con abrir una sola pantalla y asumir cobertura de los demás.
- Sin conexión: se muestra qué tramo carece de GPS reciente. El sistema no inventa puntos ni continuidad.
- Web, app y C3 muestran el mismo responsable vigente, la secuencia de custodia y los avisos de cambio.

Antes de implementar esa capacidad se necesita resolver D04 (quién declara y acepta custodia por cada parte) y D10 (compatibilidad móvil/carga) de `BACKLOG-MANIFIESTOS-V2-20261014.md` con pruebas sobre datos artificiales. Hasta entonces el incidente de rotura registra el hecho, pero no ejecuta un relevo ni garantiza seguimiento del reemplazo.

## Verificación de este corte

En el preview aislado, con un solo worker, 1 CPU y 2 GiB, las suites completas cerraron en backend 1148/1148 y frontend 1587/1587 con `ACTOR_MULTIROLE_ENABLED=false` y los cuatro flags Vite en `false`. Luego de dos ajustes puntuales pasaron 90 pruebas backend y 10 frontend dirigidas; TypeScript de ambas aplicaciones y los builds web y `/app` también pasaron. El primer pase, sin fijar esos flags, expuso pruebas dependientes del entorno y una expectativa antigua del cache del manual; no corresponde usarlo como resultado del corte configurado.

Estas verificaciones no incluyen un recorrido E2E con navegador del relevo ni GPS simultáneo. No se hizo despliegue, migración ni cambio de configuración en producción.
