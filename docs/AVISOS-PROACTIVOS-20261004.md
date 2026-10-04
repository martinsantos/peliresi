# Avisos proactivos: primer tramo candidato y plan operativo

## Primer tramo implementado, pendiente de certificación y publicación

`seguimientoCierre.job.ts` evalúa diariamente a las 08:00 de Mendoza los manifiestos RECIBIDO/EN_TRATAMIENTO. Crea un aviso interno NORMAL para el operador responsable activo, con fecha de evaluación, tiempo real desde recepción y enlace al manifiesto. No califica mora ni infracción. La clave objeto+destinatario+estado+versión evita avisos nuevos en cada repetición y conserva la lectura. Se pagina en lotes de 100 y solo programa el proceso designado del clúster, sin barrido al arrancar.

La bandeja existente de web/app distingue el registro histórico de la acción correspondiente al estado actual retornado por la API. Leer no completa trabajo; TRATADO/CANCELADO muestran seguimiento finalizado. Un cambio concurrente posterior a la lectura del evaluador puede dejar un aviso histórico, por lo que no se certifica exclusión transaccional del cierre concurrente. No se invocan proveedores de correo/push. Esta entrega no implementa escalamiento, posposición auditada, DDJJ, conciliación TEF ni un contador nuevo de pendientes.

## Objetivo

Una situación verificable debe producir una tarea para quien puede resolverla, sin esperar a que visite Monitor. No son predicciones delictivas, sanciones ni notificaciones legales fehacientes.

## Infraestructura real y límites

- `jobs/vencimiento.job.ts`: evaluación diaria de habilitaciones de transporte, vehículos y conductores próximos a vencer. No cubre DDJJ ni todos los vencimientos ya ocurridos.
- `jobs/recordatorio.job.ts`: recordatorios de retiro, con búsqueda de notificaciones existentes para evitar repetición.
- `subscribers/alerta.subscriber.ts`: eventos de anomalías y vencimientos, notificaciones persistidas y reglas. TIEMPO_EXCESIVO y VENCIMIENTO_PROXIMO actualmente notifican a administradores; no constituyen un flujo completo de pendientes del actor.
- `DeclaracionJurada`: año, presentación y fecha de presentación, pero no vencimiento. `PagoTEF`: monto, pago y referencias administrativas; no es por sí solo una medición física comparable.
- `ComparacionInspeccion`: declarado, observado, resultado, evidencia y verificador. DIFIERE no implica infracción probada.

## Reglas y destinos

| Situación | Evidencia necesaria | Destinatario y acción | Condición de resolución |
|---|---|---|---|
| Manifiesto recibido/en tratamiento sin cierre | Estado y fecha real de recepción/inicio; umbral operativo aprobado por modalidad | Operador: abrir manifiesto, completar tratamiento/cierre o registrar motivo. Jefatura: revisar casos escalados | Cambio real de estado o decisión registrada; leer el aviso no resuelve el caso |
| Retiro programado pendiente | Fecha programada y estado vigente | Transportista: confirmar retiro o informar impedimento; generador: ver situación de su envío | Retiro, reprogramación o cancelación válidos |
| DDJJ pendiente o próxima al vencimiento | Obligación aplicable, período y calendario aprobado; presentación real | Actor obligado: abrir DDJJ del período; administrador competente: seguimiento | Presentación registrada o dispensa documentada |
| Diferencia declarado/recibido | Misma corriente, período, unidad y magnitud; registros completos y tolerancia aprobada | Operador/generador: revisar pesaje o declaración. Inspector: revisar evidencia | Corrección o aceptación justificada y auditada |
| Posible efecto sobre TEF | Variables y fórmula TEF versionadas para el período, más mediciones comparables | Administrador competente: revisar cálculo y antecedentes; actor: aportar información | Revisión fiscal registrada. No recalcular deuda ni modificar liquidación automáticamente |
| Inspección con DIFIERE sin resolver | Comparación verificada, evidencia y expediente vigente | Inspector/jefatura: revisar o requerir aclaración; actor solo si existe actuación que le corresponda | Actuación o comparación resuelta con autor y motivo |
| GPS atrasado / posible desvío | Última observación, precisión, antigüedad y corredor aprobado | Transportista: comprobar seguimiento; control: revisar situación | Observación fiable o revisión. Falta de GPS no prueba desvío |

Sin umbral/calendario/tolerancia aprobados: mostrar el dato neutral (por ejemplo, «recibido hace N días»), no etiquetar incumplimiento. No comparar kg con litros ni convertir sin densidad acreditada. Datos ausentes producen «no evaluable», no cero ni «todo bien».

## Un sistema, no otra pantalla

1. Evaluador del servidor por eventos y barrido periódico para detectar también casos sin actividad. Ejecución única en clúster; reintentos seguros.
2. Caso persistente con regla/version, objeto, período, evidencia, responsable y timestamps. Clave única regla+objeto+período para idempotencia; actualización del mismo caso, no avisos nuevos en cada barrido.
3. Bandeja existente de Avisos, acceso al objeto y un solo bloque de pendientes en su ficha. Inicio de web/app prioriza «qué tengo que hacer»; Monitor y Centro de Control agregan los mismos casos autorizados, no contadores independientes.
4. Separar leído, tomado/en revisión, pospuesto con motivo, resuelto y descartado justificado. Resolución por condición de negocio o revisión auditada, nunca por simple clic en leído. Una regla reactivada deja historial.
5. Actor ve solo lo propio; inspector/administrador según alcance vigente. Administrador sectorial puede leer otras categorías, no modificarlas. Permisos también en API, no solo ocultando botones.
6. Correo y push permanecen apagados. El servidor puede crear avisos sin que el usuario abra la app; una app cerrada no puede garantizar aviso inmediato sin un canal push autorizado. Offline muestra última sincronización y pendientes locales, no «al día» ficticio; reconcilia al reconectar.

## Información territorial útil

Permite sugerir sedes declaradas, mostrar origen/destino, agrupar pendientes por zona y asistir planificación de visitas. Guardar origen de coordenada, precisión, antigüedad y sede. Ubicación declarada, observada y última señal son cosas distintas. Proximidad propone candidatos para revisión, no atribuye automáticamente responsabilidad sobre un hallazgo. No registrar GPS fuera del viaje/inspección habilitados ni exponer domicilios a roles sin permiso.

## Entrega por tandas y pruebas exigidas

Primera tanda: seguimiento de cierre y reparto al responsable usando tiempos reales, sin umbral sancionatorio inventado. Luego calendario DDJJ aprobado; después conciliación de mediciones y TEF versionado; por último reglas territoriales con calidad de GPS.

Pruebas: frontera exacta del umbral y zona horaria Mendoza; cambio/cancelación durante evaluación; dos trabajadores simultáneos; reintentos sin duplicados; dato faltante/unidad incompatible; permisos cruzados; leído no resuelto; cierre elimina pendiente; auditoría de descarte; app offline y reconexión; enlace al objeto existente; contador conciliado con bandeja; cero envíos externos. E2E con cuentas sintéticas y objetos reales de QA, sin interceptar API de negocio.

Pendiente de decisión antes de automatizar esas clasificaciones: plazos operativos por estado/modalidad, calendario DDJJ y tolerancias/fórmulas TEF del período. No se activan canales externos por este documento.
