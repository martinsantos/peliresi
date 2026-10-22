# Continuidad del plan y activación de circuitos — 22/10/2026

Estado: **en ejecución**. El dueño autorizó continuar el refactor, validar y publicar las tandas pendientes. Después confirmó **autorizar las adendas por los cuatro roles, sin cambiar cuentas**. CAP permanece cerrado y los correos/push externos apagados. No se trabaja en main ni con datos de negocio reales.

## Inventario confirmado

Producción inspeccionada en lectura el 22/10/2026 09:22 Mendoza: **86a9b790**, backend/web/app/manual. Propuestas de tres partes, certificados, relevos y GPS múltiple habilitados. Eventuales, adendas y revisión posterior apagados. Dos workers online, canales apagados y CAP cerrado.

| Tanda | Estado al retomar | Acción de esta revisión |
| --- | --- | --- |
| Agenda completa, pendientes de certificado y continuidad de altas | `5080ee82`, probado sólo en preview | Integrar, verificar con los circuitos activos y publicar con respaldo previo a la migración de borradores. |
| Eventual v2 | Código publicado, flag apagado | Repetir creación por participantes, aprobaciones, rechazo, hechos, diferencias, avisos y antecedentes PSIP fuera de CAP; habilitar tras validación. |
| Adendas y hallazgos | Código publicado, flags apagados; autoridades individuales sin configurar | Implementar la política por rol autorizada, verificar partes/autoridades/avisos/versiones y habilitar tras validación. |
| Propuestas, certificados, relevo y GPS múltiple | Publicados y habilitados | Conservar flags y guardas; probar integración afectada, sin reescribir históricos. |
| Manual | Producción 2026.21.5; candidato 2026.22.1 | Actualizar autoridades y disponibilidad, conservar renderer/CSS, comprobar web/app. |
| Correos y push externos | Apagados | Mantener apagados. Sólo intenciones y contenido simulado, sin entregas. |
| Enterprise y multirol | Apagados | Conservar configuración. No son requisito de los circuitos aprobados en esta tanda. |

## Política aprobada y límites

`MANIFEST_REVIEW_AUTHORITY_BY_ROLE=true` selecciona autoridades por su rol actual, sin alterar cuentas. Para adendas ordinarias: ADMIN, ADMIN_GENERADOR, ADMIN_OPERADOR y ADMIN_TRANSPORTISTA activos. Para revisión administrativa de eventuales: ADMIN, conservando el límite de roles de la especificación v2. No permite autoaprobación, suplantación ni sesiones restringidas. El cambio de rol o la desactivación revoca el permiso en el servidor. CAP conserva su ámbito aislado.

Con el flag ausente o false se mantiene la lista explícita `MANIFEST_EXCEPTIONAL_REVIEWERS`. La política de destinatarios coincide con la política de autorización. Si no hay autoridad activa para una corriente nueva, la decisión se rechaza con error recuperable y se conserva el motivo; no se registra una aprobación parcial ni se omite el aviso.

La aprobación tripartita ordinaria, las aprobaciones de participantes del eventual y la revisión individual de adendas son contratos diferentes. Revisar una adenda no modifica habilitaciones, declaración original ni hechos físicos y no acredita unanimidad. El eventual sigue sin número oficial y permite datos externos incompletos según la especificación aprobada.

## Ejecución y evidencia

Único checkout activo y rama `codex/sitrep-training-20261018`. QA remota en `76.13.234.213`, contenedor `sitrep-qa-training-20261018`, esquema nuevo `reactivation_20261022`; datos artificiales. Una tarea pesada por vez, un worker, 1 CPU/2 GiB/swap cero. Evidencia local ignorada: `test-results-reactivation-20261022/`.

La prueba inicial de la nueva selección de autoridades dio **1 PASS / 7 FAIL** antes del cambio. Se conserva `authority-before.json`. La regresión dirigida posterior pasó **57/57**. Suites completas del candidato: **1.481/1.481 backend y 1.811/1.811 frontend**, cero omitidos. Backend/tipos/builds web y app PASS. Continuidad: **32/32 E2E** en escritorio, web angosta y app. HTTP: **10 grupos de adendas, 6 de autoridades y 11 de eventuales**, todos PASS. Manual final 7/7; lint de nueve archivos sin errores, 15 advertencias. Se corrigieron dos guardas de los tests que sólo aceptaban los nombres de previews anteriores; se admite expresamente el esquema artificial nuevo, conservando las expectativas funcionales y los controles de aislamiento. Los 30 recorridos específicos de eventuales/adendas/autoridades, la auditoría final y la publicación siguen en ejecución; este documento no acredita todavía un despliegue.

Publicación: backup verificado antes de `20261022130000_actor_form_drafts`, preservación de `${UPLOADS_DIR}-private-drafts`, build con API final, versiones nuevas de SW, enlaces de release y smoke no mutante. Reversión sin restaurar base ni borrar borradores, documentos, antecedentes o aprobaciones; conservar backend capaz de interpretar los nuevos registros.
