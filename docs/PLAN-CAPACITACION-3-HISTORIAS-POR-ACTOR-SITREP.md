# Plan de capacitación SITREP — tres historias por actor

> **Actualización 16/09/2026.** Este documento conserva contexto histórico, pero las referencias a fixtures `CAP-*` están obsoletas: la validación de padrón confirmó que no hay manifiestos con ese prefijo. Para la capacitación usar el [manual publicado](https://sitrep.ultimamilla.com.ar/manual/#capacitacion), filtrar un registro existente por estado y mantener la sesión en modo lectura.

## Veredicto

La información cargada alcanza para una demostración **narrada y de solo lectura**: la instalación tiene actores reales y manifiestos existentes en los estados requeridos para explicar el workflow.

No recomiendo ejecutar mañana la secuencia completa sobre esos registros en producción. Cada transición puede crear avisos in-app, Push y eventualmente correo; además el SMTP de SITREP está actualmente habilitado (`DISABLE_EMAILS=false`).

La opción más segura es:

1. usar los `CAP-*` existentes para mostrar cada estado y pantalla;
2. narrar las tres historias como un recorrido coordinado;
3. ejecutar transiciones reales únicamente en preproducción/sandbox con SMTP, Push y alertas aislados.

## Documentación encontrada

- Manual publicado: https://sitrep.ultimamilla.com.ar/manual/
- Casos de uso resumidos en `README.md` (CU-A, CU-G, CU-T y CU-O).
- Casos de uso detallados en `docs/manual/index.html`.
- Flujo de estados documentado: `BORRADOR → APROBADO → EN_TRANSITO → ENTREGADO → RECIBIDO → EN_TRATAMIENTO → TRATADO`.
- Excepciones: `RECHAZADO`, `CANCELADO`, incidentes y anomalías GPS.

Para la capacitación se debe usar el manual publicado y este plan; los PDF/MD legacy que apuntan a `/demo-app` no deben distribuirse.

**Nota de numeración:** el `README.md` conserva un resumen histórico y no enumera todos los casos. Cuando hay diferencia, la fuente de verdad es el título y el flujo del manual detallado (por ejemplo, en el manual actual la firma es CU-G02 y la descarga PDF es CU-G07).

## Datos de demostración

No se crearán filas nuevas ni se modificarán usuarios reales. Para cada historia se elige un registro `CAP-*` o un manifiesto existente desde el listado, sin ejecutar una acción de transición.

Al seleccionar actores, usar los datos que ya aparecen en los catálogos de SITREP; no copiar CUIT, domicilios ni correos a una planilla nueva.

## Tres escenarios narrativos

### Historia 1 — Ruta completa de traslado

**Objetivo:** mostrar el ciclo completo desde la generación hasta el certificado.

`BORRADOR → APROBADO → EN_TRANSITO → ENTREGADO → RECIBIDO → EN_TRATAMIENTO → TRATADO`

### Historia 2 — Tratamiento in situ

**Objetivo:** mostrar que no todos los manifiestos requieren transporte.

`BORRADOR → APROBADO → RECIBIDO (in situ) → EN_TRATAMIENTO → TRATADO`

### Historia 3 — Incidente y rechazo controlado

**Objetivo:** mostrar trazabilidad de una excepción sin forzar una corrección destructiva.

`BORRADOR → APROBADO → EN_TRANSITO → incidente → ENTREGADO → RECHAZADO`

## Tres historias de Ivana — administradora de generadores

### Ivana-1 · Crear y aprobar una ruta completa

1. Entrar en https://sitrep.ultimamilla.com.ar/login.
2. Abrir https://sitrep.ultimamilla.com.ar/manifiestos/nuevo.
3. Seleccionar un generador real del catálogo y cargar un residuo habilitado.
4. Asignar transportista y operador existentes.
5. Guardar el manifiesto como `BORRADOR`.
6. Revisar detalle, residuos, actores y fecha estimada.
7. Ejecutar **Firmar/Aprobar** — en una demostración real, sólo sobre sandbox.
8. Mostrar el estado `APROBADO`, PDF y timeline.

Casos de uso: CU-G01, CU-G02, CU-G03, CU-G04, CU-G07.

### Ivana-2 · Solicitar tratamiento in situ

1. Crear un manifiesto con modalidad `IN_SITU`.
2. Seleccionar generador y operador habilitado; no asignar transporte.
3. Explicar que la aprobación dispara una recepción in situ, no un viaje.
4. Mostrar la pantalla de detalle en `APROBADO` y el historial esperado.
5. Entregar el control a Marcia para `recepcion-insitu`.

Casos de uso: CU-G01, CU-G02, CU-G04, CU-G08.

### Ivana-3 · Consultar rechazo e incidente

1. Abrir un `CAP-*` o un manifiesto existente en `RECHAZADO`.
2. Revisar motivo, actor que rechazó y timeline.
3. Abrir https://sitrep.ultimamilla.com.ar/reportes.
4. Mostrar cómo el generador consulta estado, PDF y auditoría sin editar un registro terminal.
5. Comparar con un caso `CANCELADO`, sin cancelar nada durante la clase.

Casos de uso: CU-G03, CU-G04, CU-G06, CU-G07, CU-G10, CU-G11.

## Tres historias de Santiago — ADMIN raíz con alcance de transporte

### Santiago-1 · Retiro, viaje y entrega

1. Entrar en https://sitrep.ultimamilla.com.ar/admin/usuarios o iniciar sesión como ADMIN.
2. Impersonar un transportista de prueba sólo para mostrar la vista del rol.
3. Abrir https://sitrep.ultimamilla.com.ar/manifiestos.
4. En un `APROBADO`, mostrar **Confirmar retiro** → `EN_TRANSITO`.
5. Mostrar https://sitrep.ultimamilla.com.ar/centro-control y el mapa.
6. Mostrar en la PWA https://sitrep.ultimamilla.com.ar/app/transporte/perfil.
7. En sandbox, ejecutar **Confirmar entrega** → `ENTREGADO`.

Casos de uso: CU-T01, CU-T02, CU-T03, CU-T06, CU-T08, CU-T09.

### Santiago-2 · Transporte sin viaje: in situ

1. Abrir el caso `IN_SITU` aprobado.
2. Explicar que no aparece un viaje porque no existe transportista asociado.
3. Mostrar Centro de Control, reportes y auditoría como ADMIN raíz.
4. Impersonar un perfil operativo sólo para comparar menús, sin ejecutar acciones.

Casos de uso: CU-A02, CU-A08, CU-A09, CU-A10, CU-A16, CU-T08.

### Santiago-3 · Incidente durante el traslado

1. Abrir un caso `EN_TRANSITO` de solo lectura.
2. Mostrar dónde se registra un incidente (`/manifiestos/{id}/incidente`).
3. Explicar pausa, reanudación, anomalía GPS y desvío de ruta.
4. Mostrar https://sitrep.ultimamilla.com.ar/alertas y el timeline.
5. No generar el incidente en producción; usar captura/manual o sandbox aislado.

Casos de uso: CU-T03, CU-T04, CU-T05, CU-T10, CU-A08, CU-A15.

## Tres historias de Marcia — administradora de operadores

### Marcia-1 · Recepción, pesaje y tratamiento

1. Entrar en https://sitrep.ultimamilla.com.ar/login o en https://sitrep.ultimamilla.com.ar/app/login.
2. Abrir un manifiesto `ENTREGADO`.
3. Ejecutar en sandbox **Confirmar recepción** → `RECIBIDO`.
4. Registrar pesaje real en `/manifiestos/{id}/pesaje`.
5. Iniciar tratamiento → `EN_TRATAMIENTO`.
6. Cerrar manifiesto → `TRATADO`.
7. Descargar certificado desde el detalle.

Casos de uso: CU-O01, CU-O02, CU-O03, CU-O06, CU-O07, CU-O08, CU-O09, CU-O10.

### Marcia-2 · Tratamiento in situ

1. Abrir un manifiesto `APROBADO` con modalidad `IN_SITU`.
2. Mostrar la acción **Recepción in situ** (`/manifiestos/{id}/recepcion-insitu`).
3. Explicar que salta la etapa de transporte y deja el manifiesto en `RECIBIDO`.
4. Continuar con pesaje opcional, tratamiento y cierre en sandbox.
5. Mostrar certificado y timeline.

Casos de uso: CU-O01, CU-O02, CU-O06, CU-O07, CU-O08.

### Marcia-3 · Diferencia de peso y rechazo

1. Abrir un caso `ENTREGADO` o `RECIBIDO` de lectura.
2. Mostrar el modal de pesaje y la diferencia entre peso declarado y real.
3. Explicar que una diferencia puede generar alerta y auditoría.
4. Mostrar la acción **Rechazar carga** (`/manifiestos/{id}/rechazar`) sin ejecutarla en producción.
5. Consultar alertas, timeline y reportes del operador.

Casos de uso: CU-O03, CU-O04, CU-O05, CU-O09, CU-O10, CU-O11.

## Qué sí está listo para mostrar

- Roles y menús de Ivana, Santiago y Marcia.
- Dashboard, listado, detalle, timeline, reportes y centro de control.
- Acciones visibles por rol y restricciones de administración global.
- Estados reales de los nueve fixtures `CAP-*`.
- Push dirigido a un usuario suscripto, probado con Marcia.

## Qué no conviene prometer como demostración real mañana

- QR físico: el parser desplegado no es consistente con todos los payloads actuales.
- GPS real: depende de permisos del teléfono y conectividad; usar mapa/capturas o sandbox.
- Correos: SMTP está habilitado y una transición puede crear cola/envío.
- Reproducción completa en producción: no hay rollback transaccional de todo el workflow.
- Multirol simultáneo: Santiago se representa como `ADMIN` raíz con alcance transporte; el modelo no guarda dos roles primarios.

## Mejor formato de capacitación

### Bloque 1 — relato guiado (15 minutos)

Usar Historia 1 y mostrar una pantalla por estado, sin mutar datos. El instructor explica quién actúa y qué evidencia queda.

### Bloque 2 — rotación por administración (30 minutos)

Cada responsable abre su dashboard, lista de manifiestos, detalle, alertas, reportes y menú de administración. Se usa impersonación sólo para comparar vistas.

### Bloque 3 — laboratorio aislado (30 minutos)

Ejecutar el flujo completo sobre tres registros CAP de preproducción con SMTP, Push y correos desactivados. Tomar capturas de cada transición.

### Bloque 4 — cierre (10 minutos)

Revisar timeline, auditoría, certificado, reportes y criterios de escalamiento.

## Criterio de viabilidad

| Modalidad | Viable mañana | Observación |
|---|---:|---|
| Demostración narrada/read-only en SITREP | Sí | No genera avisos ni cambia datos |
| Recorrido web + PWA con usuarios reales | Sí | Usar vistas y registros existentes |
| Workflow completo mutante en SITREP | No recomendado | SMTP y Push pueden dispararse |
| Workflow completo en preproducción aislada | Sí | Requiere fixture CAP y canales apagados |
