# Concurrencia operativa — revisión del 23/10/2026

**No corresponde declarar el circuito cerrado para cientos de acciones simultáneas.** Las ráfagas de 50, 100 y 200 solicitudes mixtas terminaron correctamente, pero la revisión dirigida reprodujo **cuatro problemas de exactitud o admisión**: vehículo incorrecto en Monitor, incidentes duplicados, pérdida del punto más reciente al consultar un viaje largo y bloqueo de usuarios válidos que comparten IP. Hay además tres riesgos por código que todavía requieren un ensayo específico.

Esta tanda **diagnostica; no corrige esos cuatro problemas**. Los cambios de identidad, PDF y ayuda realizados en paralelo se documentan en [Producto, identidad y ayuda](PRODUCTO-IDENTIDAD-AYUDA-20261023.md). No se modificaron reglas regulatorias, permisos ni históricos para esta auditoría. No se accedió a producción ni se modificó main; **CAP cerrado, correos/push apagados, cero envíos externos**.

## Alcance y evidencia

- Checkout `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`, base `df55126b5b4135e982d0e18ed59d167bc5b8244c` más los cambios de esta revisión. El cierre posterior incorpora este documento y el diagnóstico reproducible.
- TypeScript, Express/Prisma/PostgreSQL; React/TanStack Query para web y `/app`. Los comandos de pruebas existentes son Vitest (`npm test`), TypeScript/build y Playwright. No se ejecutó otra suite completa de unitarias por este diagnóstico; la validación de identidad tiene su propio alcance y resultados.
- Preview remoto aislado, **1 CPU / 2 GiB / sin swap adicional / un worker**. Un proceso de API. Base y actores artificiales, esquema `proposal_operations_20261021`; sin cargar datos productivos.
- Nuevo guion: `frontend/cloud-qa/concurrency-product-review.ts`. Se ejecuta en el contenedor de QA con el runner `.product-ux-runner.ts concurrency-review proposals`, bajo el bloqueo exclusivo `.qa-heavy.lock`. El guion verifica las guardas del proceso y de la base antes de comenzar. No debe ejecutarse contra otra URL/base.
- Ocho perfiles en las operaciones mixtas y un transportista ajeno para comprobar aislamiento. Son sesiones reutilizadas, **no cientos de personas o dispositivos independientes**.
- Por ejecución se prepararon 121 manifiestos artificiales, 20 adendas y 20 propuestas nuevas. Las mediciones usan las API reales, salvo la carrera expresamente identificada del suscriptor compilado. La preparación de viajes y los 501 puntos se insertan directamente en la base artificial; no forman parte de la latencia HTTP medida.
- Escáner estático de complejidad y revisión manual de rutas calientes. Sus coincidencias son pistas, no errores confirmados: artefactos `refinement/complexity-backend-product.json` y `refinement/complexity-frontend-product.json`.

Evidencia local conservada bajo `test-results-product-ux-20261023/proposals/`:

| Ensayo | Archivo | Resultado |
|---|---|---|
| Inicial, 12:53 Mendoza | `concurrency-review-d22025fd-b5eb-4658-94e1-5460efa09868.json` | 10 comprobaciones PASS / 3 FAIL |
| Ampliado, 12:59–13:00 Mendoza | `concurrency-review-f8e1e1ea-8e98-4a7c-85d3-7fb75ebded09.json` | **9 comprobaciones PASS / 4 FAIL**, 13 en total |

El primer ensayo comprobaba un solo vehículo cuyo resultado coincidió con el primero de la empresa. Esa cobertura insuficiente dio PASS. El segundo usa **dos viajes simultáneos de la misma empresa con vehículos diferentes** y reproduce el defecto. Se conservan ambos resultados; no se reemplazó una expectativa de producto para hacer pasar el test.

## Lo que sí respondió correctamente

En ambos ensayos, las ráfagas se lanzaron con `Promise.all`, una tanda a la vez. La de 200 contiene 100 escrituras GPS, 50 lecturas de avisos, 20 lecturas de Monitor, 15 aprobaciones y 15 revisiones de adenda. La prueba de red compartida es un experimento separado, sin elevar ni quitar el limitador.

| Ráfaga | Primer ensayo: total | Segundo ensayo: total | Respuestas HTTP |
|---|---:|---:|---|
| 50 simultáneas | 746 ms | 1.415 ms | 50/50 con 200 en ambos |
| 100 simultáneas | 1.197 ms | 3.979 ms | 100/100 con 200 en ambos |
| 200 simultáneas | 2.348 ms | 6.465 ms | 200/200 con 200 en ambos |

Para la tanda de 200, p95 medido por grupo:

| Acción | Primer ensayo | Segundo ensayo |
|---|---:|---:|
| GPS | 1.179 ms | 4.169 ms |
| Avisos | 1.255 ms | 3.600 ms |
| Aprobación | 1.987 ms | 5.376 ms |
| Adenda | 1.990 ms | 5.317 ms |
| Monitor | 2.314 ms | 6.252 ms |

**No es una comparación controlada de rendimiento.** El segundo ensayo reutiliza la base con más registros y no se aislaron cachés, presión de memoria ni todos los factores de carga. La variación obliga a medir con una base y condiciones repetibles; no permite atribuir por sí sola una regresión ni proyectar capacidad productiva.

Las nueve comprobaciones satisfactorias del ensayo ampliado son:

1. Ráfaga de 50 operaciones sin errores HTTP.
2. Ráfaga de 100 operaciones sin errores HTTP.
3. Ráfaga de 200 operaciones sin errores HTTP.
4. Cinco PDF generados durante GPS/Monitor: HTTP 200, firma `%PDF-` y tamaño mayor a 1.000 bytes. La validez visual de sus páginas pertenece a la revisión PDF separada.
5. Cada punto GPS reconocido en las ráfagas quedó persistido; la última posición llegó a la respuesta de Monitor.
6. Un transportista ajeno no pudo escribir ni leer el viaje artificial: ambos pedidos devolvieron 404.
7. Veinte reintentos simultáneos de aprobación dejaron un solo evento de decisión y ninguna combinación duplicada destinatario/fase en los avisos de ese manifiesto.
8. Dos decisiones distintas sobre la misma versión de adenda dieron **un 200 y un 409**, con incremento de una sola versión.
9. Manifiesto histórico artificial intacto, CAP rechazado con 403, cola de correo sin trabajo activo/intentos/envíos y health final conectado.

Hay protecciones reales que deben conservarse: bloqueo por manifiesto en `backend/src/controllers/manifest-proposal.controller.ts:54`, avisos transaccionales con IDs estables y `skipDuplicates` en `backend/src/services/manifestProposal.service.ts:33`, y comprobación de versión en `backend/src/controllers/manifiesto-adenda.controller.ts:178`. El GPS valida estado y titularidad dentro de una transacción con bloqueo compartido en `backend/src/controllers/manifiesto-gps.controller.ts:108`. Que estas guardas pasen no acredita automáticamente todos los demás emisores o transiciones.

## Cuatro fallos reproducidos

### P1 — Monitor puede mostrar la patente de otro viaje

**Evidencia:** dos propuestas de la misma transportista se firmaron, coordinaron y retiraron mediante la API. La asignada a `QA002ZZ` mostró `QA002ZZ`; la asignada a `QA0001` también mostró `QA002ZZ`. Son matrículas artificiales.

**Origen:** `backend/src/controllers/monitor.controller.ts:238` selecciona `transportista.vehiculos` y `choferes` activos con `take: 1` (líneas 248–249). El JSON utiliza ese primer elemento (líneas 415–420), sin resolver la asignación propia del manifiesto. Tampoco incorpora los tramos de relevo en esa selección. `tracking.controller.ts:234` sí distingue el tramo activo y sus posiciones, por lo que Monitor y Centro de Control pueden describir distinto el transporte de la misma carga.

**Impacto:** el popup de la oficina puede atribuir una posición real al vehículo equivocado. No es necesario saturar el servidor: ocurre con dos viajes normales. El defecto de patente se reprodujo; chofer y relevos son consecuencias del código a cubrir específicamente, no nuevos ensayos ya aprobados.

**Corrección propuesta:** resolver vehículo/chofer desde la asignación persistida del manifiesto y el tramo vigente; reutilizar un contrato común de proyección para Monitor y Centro de Control. No inferir la asignación por el orden de los vehículos de una empresa ni reescribir documentos firmados. Los registros sin información deben indicar que falta, sin inventarla.

**Complejidad:** actualmente O(T) filas de viajes más residuos y hasta 30 puntos por viaje, pero con asociación incorrecta. La propuesta mantiene O(T + puntos retornados), con selección relacional por identificador; no requiere buscar toda la flota para cada fila. **Riesgo de cambio medio:** compatibilidad de manifiestos históricos y relevos.

**Aceptación pendiente:** dos vehículos/choferes de la misma empresa, relevo a empresa registrada, relevo eventual y viaje antiguo sin asignación; comparar detalle, popup, Monitor, Centro de Control y documento sin alterar el histórico. Probar los cambios de tramo mientras llegan puntos del transporte anterior.

### P1 — La misma alerta concurrente genera veinte incidentes

**Evidencia:** veinte invocaciones simultáneas del suscriptor compilado con el mismo evento artificial `TIEMPO_EXCESIVO` generaron **20 filas INCIDENTE**, cuando su propia ventana de deduplicación esperaba una. Se reprodujo en ambos ensayos. Esta parte se ejecuta contra la base real del preview, directamente en el suscriptor; no se afirma que fueron veinte sensores o veinte peticiones HTTP.

**Origen:** `backend/src/subscribers/eventoManifiesto.subscriber.ts:6` busca un incidente reciente y luego hace `create` fuera de una exclusión atómica. Todos los concurrentes pueden leer “no existe” antes de que cualquiera cree la fila. La ventana declarada es de 30 minutos.

**Impacto:** ruido en cronología y posible trabajo repetido en consumidores posteriores. No se midió entrega de veinte correos ni de veinte push, que permanecen apagados.

**Corrección propuesta:** conservar la semántica de la ventana de 30 minutos, serializando comprobación e inserción por manifiesto/tipo de incidente dentro de la base, o mediante una identidad persistida equivalente. Un mutex en memoria no alcanza para varios procesos. No colapsar incidentes diferentes por compartir texto.

**Complejidad:** N invocaciones hacen N lecturas y hasta N escrituras hoy; con exclusión atómica siguen siendo O(N) comprobaciones, pero una sola escritura válida por evento/ventana. Es un problema de atomicidad, no una mejora asintótica. **Riesgo medio:** definir correctamente la identidad sin suprimir un nuevo incidente legítimo.

**Aceptación pendiente:** 20/100 reintentos simultáneos desde dos procesos, evento diferente y otro manifiesto en paralelo, límite temporal antes/después de 30 minutos, y reintento tras caída del consumidor. Verificar filas y avisos, además del código HTTP.

### P1 — El viaje de más de 500 puntos pierde su posición más reciente en la consulta

**Evidencia:** se guardaron 501 observaciones artificiales ordenadas en un viaje. `GET /manifiestos/:id/viaje-actual` devolvió 500 y **no incluyó el último punto**. Las 501 observaciones seguían en la base: es una pérdida de visibilidad, no borrado de datos.

**Origen:** `backend/src/controllers/manifiesto-gps.controller.ts:192` usa orden ascendente y `take: 500`; devuelve los primeros puntos para siempre. Esto se distingue de Monitor-live, que consulta los últimos 30 y sí pasó la comprobación de posición reciente en las ráfagas.

**Impacto:** el usuario puede ver un recorrido desactualizado aunque el servidor continúe recibiendo GPS. A una muestra cada 30 segundos, 500 intervalos equivalen aproximadamente a cuatro horas y diez minutos; la prueba verifica 501 observaciones, no la duración real de un viaje.

**Corrección propuesta:** para “viaje actual”, recuperar una ventana de puntos recientes y entregarla en orden cronológico; explicitar que es una ventana. Para historial completo, paginar por cursor estable y fecha/ID, o dar una ruta resumida que preserve inicio, final y puntos significativos. No quitar el límite cargando todo el viaje en memoria.

**Complejidad:** con índice adecuado, consulta de ventana O(log P + K), K=500, tanto antes como después; cambia qué ventana es correcta. Historial paginado O(P) total y O(K) memoria por página. **Riesgo bajo/medio:** contrato de orden, mapas y cambios de tramo.

**Aceptación pendiente:** 0/1/499/500/501/muchos puntos, marcas temporales empatadas, carga incremental sin duplicados, desconexión/reconexión y relevo. Última posición idéntica entre detalle, app, Monitor y Centro de Control cuando corresponda al mismo tramo.

### P1 — Una red compartida agota el cupo de todos sus usuarios

**Evidencia:** 700 lecturas válidas de avisos desde ocho perfiles y una misma IP, en siete tandas de 100, devolvieron **600 HTTP 200 y 100 HTTP 429**. El segundo ensayo duró 6.271 ms. No son 700 peticiones simultáneas ni un fallo del mecanismo antiabuso: el limitador hizo lo configurado y reveló una incompatibilidad con ese patrón de uso compartido.

**Origen:** `backend/src/index.ts:71` aplica 600 solicitudes/minuto/IP a toda `/api/`, antes de las rutas autenticadas. No especifica un almacén compartido entre procesos. Los limitadores de login son separados y no son lo que se evaluó aquí.

**Impacto:** una oficina, capacitación o red móvil compartida puede sumar consultas de campana, mapas, formularios y GPS en un mismo cupo. Un usuario recibe el bloqueo por la actividad de otros, aun con credenciales correctas. Los límites independientes en memoria requieren revisión adicional en el cluster; no se ensayó su comportamiento en PM2.

**Corrección propuesta:** diseñar presupuestos diferenciados después de autenticar identidad/alcance, con protección IP de borde conservada; separar escritura GPS, lecturas repetidas y acciones de negocio. Usar contadores coherentes entre procesos y respuesta/reintento visible que no pierda un formulario. Evitar resolverlo quitando el control o aumentando el número sin medir.

**Complejidad:** admisión O(1) por petición hoy; objetivo O(1) por contador, con costo de coordinación compartida. **Riesgo medio/alto:** no debilitar protección frente a abuso ni confiar sin validación en una cabecera de proxy.

**Aceptación pendiente:** cientos de identidades en una IP, usuario abusivo aislado, usuario con varias pestañas, IPv4/IPv6, múltiples workers y configuración real del proxy; presupuesto GPS y recuperación tras 429. Este ensayo simula IPs mediante `X-Forwarded-For` en el preview; **no certifica la configuración del proxy productivo**.

## Riesgos por código, todavía sin reproducción específica

### P1 — Aviso posterior al commit puede perderse ante una caída

`backend/src/controllers/manifiesto-workflow.controller.ts:217` responde éxito y después emite el evento de cambio de estado (línea 222). `backend/src/services/domainEvent.service.ts:73` usa EventEmitter y `setImmediate`; un error del consumidor se registra, sin reintento durable en ese bus. `backend/src/subscribers/alerta.subscriber.ts:155` deriva desde allí a la notificación de cambio.

Una caída entre el commit y la persistencia del aviso deja una ventana de pérdida. **No se provocó una caída en este ensayo y no se demostró un aviso perdido.** Tampoco se extiende esta conclusión a los avisos de propuestas/adendas persistidos transaccionalmente ni a todo el sistema de correo, que ya tiene cola.

Propuesta: outbox transaccional para eventos todavía volátiles, consumidores idempotentes y reintentos observables. O(E) publicaciones pasa a O(E) inserciones y procesamiento, con costo constante durable por evento. Riesgo medio: evitar doble publicación al convivir ambos caminos. Ensayo necesario: detener el proceso justo después del commit, reiniciar dos consumidores y verificar una sola notificación recuperada, con correo/push simulados y nunca enviados.

### P1 — GPS encolado sin hora de observación puede parecer actual

`frontend/src-v6/hooks/useGPSTracking.ts:30` guarda puntos pendientes sin `observedAt`; el envío de la línea 87 no transmite la hora del sensor. Se restaura y vacía la cola en la línea 157. La inserción de `backend/src/controllers/manifiesto-gps.controller.ts:120` usa la marca temporal por defecto de persistencia. El intervalo asíncrono de la línea 291 puede solaparse si un envío/vaciado tarda más de 30 segundos. `uploadsRef` permite drenar al detenerse, pero no constituye exclusión entre intervalos.

Esto requiere probar que una reconexión no convierte un punto viejo en “ubicación actual”, ni duplica el vaciado. **No se simuló aquí esa interrupción de red ni se usó un Android físico.** `useFleetGps.ts:33` sí tiene exclusión por ciclo y comprobación de antigüedad, de modo que hay comportamientos distintos entre caminos GPS.

Propuesta: identidad y hora de observación por muestra, hora de recepción separada, cola con un solo consumidor y deduplicación persistente; marcar antigüedad de manera visible sin modificar históricos. Procesar Q puntos sigue siendo O(Q), pero una vez y en orden definido. Riesgo medio/alto: compatibilidad de colas ya guardadas y reglas de reloj/desfase. Pruebas necesarias: sin red, reintento, red lenta mayor a 30 segundos, dos pestañas, reloj adelantado/atrasado, pausa, entrega y relevo durante el vaciado.

### P2 — Cada visor de Monitor recalcula grandes conjuntos

`backend/src/controllers/monitor.controller.ts:225` calcula estados globales; las líneas 238, 284 y 324–382 vuelven a cargar viajes, actores y agregados en cada pedido. `frontend/src-v6/pages/monitor/hooks/useWarRoomData.ts:12` consulta cada 15 segundos por visor. No se identificó una instantánea compartida que reúna esas lecturas entre usuarios.

Estimación de trabajo por actualización, sin afirmar un plan SQL medido: O(M + R + A + Rₜ + 30T), donde M son manifiestos examinados, R residuos agregados, A actores, T viajes activos y Rₜ sus residuos; los índices y planes reales cambian el costo efectivo. U visores multiplican las consultas similares. El segundo ensayo devolvió hasta 168.885 bytes por respuesta Monitor en la tanda de 200 y p95 6.252 ms. Es una señal para estudiar, **no una capacidad máxima demostrada**.

Propuesta: separar posiciones recientes de estadísticas lentas, compartir resultados con vencimiento e invalidación explícitos, devolver únicamente las capas/ventanas requeridas y no lanzar consultas idénticas mientras otra ya corre. Una agregación por intervalo reduce el trabajo de base de U × conjunto a un conjunto por intervalo; servir y transferir datos sigue costando O(U × tamaño de respuesta). Riesgo medio: frescura, permisos y contaminación de caché entre ámbitos. Medir primero con base fija, `EXPLAIN ANALYZE` sólo en preview, tamaño/latencia por capa, consultas SQL y memoria; después comparar implementación con el mismo conjunto y carga sostenida.

## Orden de trabajo para cerrar la brecha

1. Corregir la identidad del viaje en Monitor y la ventana GPS. Son defectos visibles de trazabilidad aunque haya poco tráfico.
2. Hacer atómica la deduplicación de incidentes y persistir los eventos que todavía dependen de memoria. Mantener la distinción entre eventos de negocio diferentes.
3. Dar admisión independiente a usuarios válidos y recuperación explícita al recibir 429, conservando protección de abuso.
4. Unificar la semántica GPS al reconectar y cambiar de tramo; después medir Monitor con datos fijos y carga sostenida, y reducir su trabajo repetido.
5. Repetir el ensayo corregido y añadir dos procesos, fallos/reinicio, latencia de red y pruebas de UI concurrente por rol en web/app. Definir junto con operación objetivos de frescura, latencia y recuperación antes de afirmar capacidad.

Las correcciones anteriores **están pendientes**, no incluidas como funcionalidad ya entregada ni publicadas. Este informe no autoriza despliegue, activación de correo/push ni pruebas con datos reales.

## Límites del resultado

- Estas ráfagas de segundos no son una prueba prolongada de cientos de usuarios, crecimiento de base, presión de conexiones ni fugas de memoria. No prueban estabilidad durante horas.
- No se probó PM2 en cluster, balanceador/proxy productivo, failover de PostgreSQL, caída entre commit y aviso ni reinicio durante carga.
- Se comprobó API→persistencia→respuesta de Monitor. No se hizo un ensayo visual de cientos de popups abiertos ni una prueba de todos los formularios al mismo tiempo. Las capturas/E2E web y app de identidad son una evidencia diferente.
- GPS sintético: Android real, radio móvil, ahorro de batería, PWA instalada y ejecución en segundo plano siguen pendientes hasta disponer del teléfono.
- Correo y push externos permanecieron apagados: no se afirma entrega en bandejas o teléfonos. CAP continuó cerrado y los cuatro accesos de capacitación rechazaron el login.
- No hay “GO global”, diseño perfecto ni funcionamiento al 100% deducibles de estos resultados. Hay evidencia concreta para una siguiente tanda pequeña y verificable.
