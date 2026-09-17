# Certificación del lote demo de capacitación — 17/09/2026

## Alcance corregido

- Aplicación: `https://sitrep.ultimamilla.com.ar/`
- Base existente: `trazabilidad_rrpp`
- Lote sintético y reversible: `DEMO-CAP-20260917-P`
- No existe una aplicación, URL, backend ni base de datos demo separados para este lote.
- No se modificaron usuarios, contraseñas, roles ni preferencias de comunicación.
- No se reinició el VPS ni el servicio productivo.

## Implementación

El lote fue agregado de forma aditiva a SITREP mediante
`backend/prisma/seed-production-training-demo.ts`. Reutiliza actores ya existentes,
incluido Alfa Service y los actores de demostración del sistema. Cada manifiesto:

- lleva el prefijo visible `DEMO-CAP-20260917-P`;
- está marcado con `isDemoData=true`;
- declara en observaciones que contiene datos sintéticos de capacitación;
- tiene residuos, eventos, fechas y, cuando corresponde, recorrido GPS coherentes;
- no dispara controladores de dominio, notificaciones, correo ni push.

## Resultado certificado

- Total: 36 manifiestos.
- Distribución: 3 BORRADOR, 4 APROBADO, 4 EN_TRANSITO, 4 ENTREGADO,
  5 RECIBIDO, 5 EN_TRATAMIENTO, 8 TRATADO, 2 RECHAZADO y 1 CANCELADO.
- Participación de Alfa: 24 como generador, 18 como transportista y 24 como operador.
  La superposición es deliberada y valida que un mismo actor pueda intervenir en
  más de un rol.
- Todos los números son únicos, las cantidades son positivas y las relaciones con
  generador, transportista y operador están completas.
- Eventos y puntos GPS del lote conservan la marca de dato demo.

## Salvaguardas verificadas

Los contadores de comunicación se midieron antes y después de la carga y no
cambiaron:

| Recurso | Antes | Después |
|---|---:|---:|
| Cola de correo | 1733 | 1733 |
| Notificaciones | 751565 | 751565 |
| Suscripciones push | 6 | 6 |

Además, no existe ninguna notificación asociada a los 36 manifiestos ni ningún
correo en cola cuyo asunto o cuerpo contenga el prefijo del lote.

## Pruebas realizadas

- Verificador de integridad: `backend/prisma/verify-production-training-demo.ts`.
- Conteo y distribución exactos: aprobados.
- Unicidad, relaciones, cantidades y marcas demo: aprobadas.
- Alfa en los tres roles previstos: aprobado.
- Ausencia de comunicaciones del lote: aprobada.
- Salud de la API principal: HTTP 200.
- Consulta pública de `DEMO-CAP-20260917-P017` desde la API principal: aprobada.
- Servicio productivo: dos instancias PM2 activas, sin reinicio durante la carga.
- Puerto del backend separado que se había creado por error: sin listener.

## Reversibilidad

`backend/prisma/rollback-production-training-demo.ts` elimina exclusivamente este
lote. Exige la base `trazabilidad_rrpp`, el prefijo certificado, exactamente 36
registros con todas las marcas de seguridad y la confirmación explícita
`YES_REMOVE_CERTIFIED_DEMO_BATCH`. El script quedó preparado pero no fue ejecutado.

Este conjunto sirve únicamente para capacitación funcional y demostración de los
últimos 30 días. No representa operaciones reales ni debe usarse para inferencias
regulatorias, productivas o de desempeño.

## Extensión: habilitaciones TEF sintéticas

El 17/09/2026 se agregaron dos habilitaciones TEF 2026 exclusivamente para los
actores del lote cuyo usuario conserva `esDemo=true`:

- 1 generador demo;
- 1 operador demo.

Ambas llevan la resolución visible
`DEMO-CAP-20260917-P · HABILITACIÓN SINTÉTICA`, fecha de pago sintética,
`habilitado=true` y referencia GEDO del lote. No se modificaron actores reales,
usuarios, contraseñas, roles ni credenciales.

La carga se realizó con
`backend/prisma/seed-production-training-habilitations.ts`. El verificador
`backend/prisma/verify-production-training-habilitations.ts` aprobó 9 de 9
controles: cantidad exacta, tipos de actor, estado habilitado y pagado, usuarios
demo, actores activos, pertenencia al lote y ausencia de correos o notificaciones
nuevos desde la creación. El rollback dedicado quedó disponible en
`backend/prisma/rollback-production-training-habilitations.ts`.

Al ejecutar la salvaguarda se detectaron 18 correos anteriores con el prefijo del
lote, todos en estado `SUPRIMIDO` y ninguno con fecha de envío, además de 108
notificaciones internas `ANOMALIA_DETECTADA`. Sus últimos timestamps preceden a
esta extensión, por lo que no fueron generados por las habilitaciones TEF. No se
envió ningún correo a destinatarios finales.
