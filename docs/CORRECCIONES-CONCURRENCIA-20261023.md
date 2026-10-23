# Correcciones de concurrencia — 23/10/2026

**Estado: cuatro defectos corregidos y verificados, exclusivamente en preview.** Base `09a5a015` en `codex/sitrep-training-20261018`. No publicado; producción y main intactos, CAP cerrado y correos/push apagados.

## Cambios

- Monitor toma patente y chofer de la asignación persistida o del relevo vigente. Un relevo sin primera señal GPS aparece sin posición; nunca hereda la del vehículo anterior. Los registros sin asignación no se completan por inferencia de la flota.
- Viaje actual devuelve una ventana de los últimos 500 puntos en orden estable por fecha e ID, con metadatos de recorte. El historial almacenado permanece completo.
- Incidencias GPS: comprobación e inserción transaccionales, bloqueo PostgreSQL por manifiesto/clase y ventana de 30 minutos medida con reloj de base, compartida entre procesos.
- Admisión: 600 solicitudes/minuto por persona autenticada y familia (lectura, GPS, acciones, documentos), sin multiplicar cupos por rol, pestaña o impersonación. Anónimos mantienen protección por IP; login conserva límites de fallos por cuenta/red. Contadores PostgreSQL atómicos; indisponibilidad devuelve 503. Liveness sigue independiente de la base.
- Web/app muestran tiempo de reintento y no repiten automáticamente escrituras. El formulario conserva datos. Una sesión ya verificada se conserva ante 429/503 temporales del perfil o renovación, sin conceder perfiles a partir de JWT sin validación ni cambiar el rechazo 401/403.
- Manual: contenido 2026.23.3, con guías de seguimiento y reintento; CSS y renderer conservados.

## Migración y operación

Nueva migración aditiva `20261023133000_shared_api_admission`: sólo tabla de metadatos `rate_limit_counters`, clave hash y vencimiento con precisión milisegundo/zona horaria. No altera usuarios, actores, manifiestos ni históricos. Debe aplicarse antes de arrancar el backend que la utiliza en cualquier publicación futura autorizada. La migración anterior de preferencia de enlaces sigue pendiente de producción.

La limpieza automática de claves abandonadas **no está incorporada**. El control PreToolUse bloqueó escribir la rutina tanto en SQL como mediante ORM, aunque la acción era sólo editar fuente y no ejecutar consultas. No se eludió el bloqueo ni se eliminó ningún registro. La expiración reinicia claves reutilizadas, pero IPs/identidades que nunca vuelvan dejan metadatos persistentes. Su depuración operativa sigue pendiente; no se afirma que el tamaño total de la tabla esté acotado.

## Validación final

Pruebas ejecutadas el 23/10/2026 sobre la base `09a5a015` más este cambio. Fuente verificada por SHA-256 antes de cada fase. Todas las tareas pesadas se ejecutaron serialmente en el preview `76.13.234.213`, contenedor `sitrep-qa-training-20261018`, con **1 CPU / 2 GiB / sin swap adicional / un worker de pruebas**. Para comprobar coordinación entre procesos se mantuvieron **dos API** dentro del mismo contenedor y límite total, no dos suites simultáneas.

| Comprobación | Resultado |
|---|---|
| Suite completa backend | **1.653/1.653 PASS**, cero omitidas |
| Regresión frontend dirigida, incluidas sesión, API, Monitor y manual | **132/132 PASS**, cero omitidas |
| Concurrencia de API/base/consumidores | **15/15 grupos PASS** |
| Navegador: escritorio, web móvil y `/app` | **12/12 casos únicos PASS** consolidados, cuatro por superficie |
| Compilación backend, tipos frontend y builds web/app | PASS |
| SQL real de la nueva migración en esquema artificial | PASS |
| Lint de 44 archivos frontend modificados desde la base productiva documentada | **0 errores / 68 advertencias** |
| Guardas finales y 64 tablas QA previamente protegidas | PASS; tablas intactas, cero intentos/envíos/cola activa |

No se volvió a ejecutar la suite completa frontend: las 132 pruebas cubren los módulos afectados. La validación completa anterior tiene su propio alcance en el informe de identidad.

### Evidencia de las correcciones

- **Monitor:** dos viajes simultáneos de la misma empresa muestran sus respectivas patentes y choferes. Relevo registrado y relevo eventual muestran vehículo/chofer del tramo vigente; antes de su primera señal no heredan la ubicación anterior. El transporte sustituido recibe 409 si intenta seguir enviando GPS. Las pruebas unitarias incluyen registros sin asignación y regresión de forecast.
- **Incidencias:** 100 invocaciones del suscriptor desde dos procesos independientes dejaron **una sola incidencia**. Clases y manifiestos distintos permanecen independientes; una repetición a 29 minutos se suprime y a 31 minutos crea otra. Un rollback permite reintentar sin perder el evento.
- **GPS:** recorridos con 0, 1, 499, 500, 501 y 1.201 muestras devuelven la ventana correspondiente y siempre incluyen el último punto. Se comprueban los 500 IDs exactos, orden estable incluso con fechas iguales y correspondencia de fecha/coordenadas con Monitor. El popup conserva su ventana visual de 30 puntos; no se la confunde con el endpoint de 500.
- **Red compartida:** **700/700 solicitudes válidas de ocho perfiles** desde una IP terminaron con 200. El ensayo separado de un actor que excede su cuota obtuvo 215 respuestas 429 entre 700 intentos, conservando 20/20 solicitudes de otra identidad y el envío GPS del primero. Se verifica que la cuota sea común a ambas API y que un descuento tardío por login exitoso no altere la ventana siguiente.
- **Carreras de negocio conservadas:** 20 aprobaciones repetidas dejan una decisión y un aviso por destinatario/fase. Dos decisiones distintas de una adenda sobre la misma versión devuelven un 200 y un 409. Cinco PDF se generaron mientras continuaban GPS/Monitor. El transportista ajeno no obtiene acceso al viaje.
- **Web/app:** los popups identifican los cuatro vehículos/tramos; el último punto del viaje largo llega a Monitor. Ante un 429 simulado en el primer envío, se conserva el formulario, se informa el tiempo de espera y no hay reenvío automático; el segundo envío explícito usa la API real y termina en 201. Ante 429/503 simulados del perfil al volver a la ventana, permanecen identidad, credenciales y texto; la siguiente validación real responde 200. La admisión real se prueba por separado en el ensayo HTTP.

Las ráfagas de 50, 100 y 200 acciones mixtas terminaron sin errores en **1,304 / 2,092 / 4,244 segundos**, respectivamente. La tanda de 200 contiene 100 escrituras GPS, 50 lecturas de avisos, 20 de Monitor, 15 aprobaciones y 15 revisiones de adenda. Son ocho sesiones reutilizadas; no representan 200 dispositivos. No es una comparación controlada con el diagnóstico anterior ni acredita carga sostenida. Contenedor al cierre de pruebas: `oom=0`, `oom_kill=0`; el contador `memory.events.max` pasó de 11.544 a 12.147 (hubo presión contra el límite, sin OOM).

### Incidencias durante la validación

1. Primera regresión frontend: 129/130 PASS. El mensaje de espera ocultaba el motivo de rechazo del login; se corrigió el producto para conservar el mensaje de cuenta/red y añadir el reintento. Resultado final 132/132, con dos casos adicionales.
2. Primer intento de migración: abortado antes de cambios porque el directorio nuevo estaba ignorado por Git y no había llegado al preview. Se incorporó explícitamente el SQL, se sincronizó y se ejecutó la migración aditiva real en transacción, exclusivamente en `proposal_operations_20261021`.
3. Primer E2E: nueve PASS y tres fallos del caso de viaje largo. El fixture calculaba latitud como `-32.878800000000005` y PostgreSQL/API la devolvían como `-32.87880000000001`. Se corrigió la referencia de prueba para comparar **exactamente** Monitor con el dato persistido, manteniendo los 500 IDs, ID final y fecha exactos. No se añadieron tolerancias ni cambios de producto. Se repitieron sólo esos tres casos: 3/3 PASS. Los intentos fallidos se conservan y las repeticiones no se suman como casos únicos.
4. La revisión independiente detectó una sustitución accidental en forecast y la pérdida de sesión ante rechazos temporales. Se corrigieron antes de las pruebas finales; cubiertos por la suite backend y los casos de sesión/navegador.

### Archivos de evidencia

En `test-results-product-ux-20261023/proposals/` (artefactos locales ignorados por Git):

- `concurrency-backend.json`, `concurrency-frontend.json` y versiones `.before-*`: resultados unitarios.
- `concurrency-review-3bbc68ef-0e12-45a8-b635-fba6587adcd2.json`: 15 grupos, latencias y detalle de concurrencia.
- `concurrency-e2e.json` y `concurrency-e2e/`: primer intento, nueve casos aprobados y tres fallidos.
- `concurrency-e2e-gps-verified.json` y su carpeta: tres casos GPS corregidos, cero reintentos automáticos.
- `concurrency-migrate-result.json`, `*-build-result.json`, `frontend-types-result.json`, `changed-lint.json`: migración/build/tipos/lint.
- `proposal-audit.json`, `protected-refinement-audit.json`, `refinement-audit-result.json`: CAP cerrado, cero entregas y 64 tablas intactas.
- `concurrency-final-summary.json`: resumen consolidado y lectura de límites/recursos. Fuente local en `../source-proof.json`; manifiesto final en `../concurrency-source-proof-final.json`.

Revisión visual directa de popup del relevo eventual en app, último punto en escritorio y aviso de reintento en web móvil: contenido legible, dentro del ancho y formulario preservado. El mapa base se simula en QA para no depender de teselas externas; no valida al proveedor cartográfico ni sensores físicos. Esta revisión no declara perfecta toda la interfaz: por ejemplo, el panel de eventos de Monitor aún expone etiquetas técnicas de eventos nuevos y debe simplificarse en una tanda de UI específica.

## Estado entregado y siguiente publicación

Preview activo mediante túnel privado en **http://127.0.0.1:4177**. No se desplegó, reinició ni inspeccionó producción en esta tanda; publicación documentada sigue en `a7f20d2f`. Main permanece `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Sin push ni workflows. CAP cerrado, correos/push apagados y sólo actores/datos artificiales.

El commit de cierre usa `[skip ci]`. Antes de una futura publicación deben resolverse el mantenimiento de contadores señalado arriba y las dos migraciones pendientes en el orden normal, con backup y autorización de despliegue. Recompilar con la URL final: los bundles de QA usan `/api` y no se publican. No se incorpora ni ejecuta rollback de la base ni eliminación de datos.

## Límites y pendientes independientes

La tanda corrige los cuatro defectos reproducidos; no constituye validación de capacidad productiva sostenida. Siguen pendientes los riesgos de durabilidad del bus de eventos ante caída, hora de observación/reconexión del GPS y optimización de agregados Monitor, detallados en `CONCURRENCIA-OPERATIVA-20261023.md`. Android físico, GPS de sensores, PWA en segundo plano, proxy productivo y entrega externa no se certifican.
