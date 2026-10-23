# Manifiestos: diagnóstico y visibilidad de las aprobaciones

Estado: cambios preparados, **pendientes de pruebas finales y publicación**.

## Caso informado

Se consultó exclusivamente el estado, modalidad, fecha y tipos de eventos del manifiesto 2026-000197 mediante una transacción de lectura. Está guardado como **IN_SITU / BORRADOR**, con CREACION y CERTIFICACION_OPERADOR_V1, sin PROPUESTA_PARTES_V1. No se modificó el registro.

Esto explica por qué no aparecen las tres aprobaciones ni sus avisos: el registro ingresó al circuito de tratamiento en origen. La evidencia no permite afirmar qué selección realizó la persona en el formulario. La interfaz anterior no explicaba suficientemente la diferencia, ni el paso que faltaba.

Se verificó por lectura que producción sigue en 6580c1ca, con propuestas habilitadas en configuración y ambos procesos. No era un flag apagado. CAP permanece cerrado, correos y push apagados.

## Cambios preparados

- Agenda: incluye borradores; conserva filtros por actor y paginación. Muestra generador, operador, partes pendientes y el contexto completo al posicionarse sobre la fila.
- Administración: Por aprobar reúne las decisiones pendientes de las partes. La sección destacada permite ir directamente a ellas sin atribuir al administrador una aprobación ajena.
- Formulario: Con traslado / En origen describen dónde ocurre el tratamiento. En origen advierte que no lleva transporte y queda pendiente de firma del generador. La confirmación distingue propuesta enviada de borrador creado.
- Detalle: modalidad visible y aviso del responsable del siguiente paso en borradores.
- Avisos: describen a las empresas participantes y, cuando coincide con la cuenta titular, a la empresa que propone. La recepción de un aviso refresca también la campana; acceso con acción específica al manifiesto. Sonido, correo y push no se activan.
- Manual: explica agenda, avisos y diferencia entre circuitos. No declara probado lo pendiente.

No cambia el acuerdo de tres partes ni sus bloqueos. El circuito in situ existente conserva firma y recepción. La consulta sobre exigir aprobación explícita previa de generador y operador en in situ sigue pendiente de respuesta; no se implementa esa nueva regla por inferencia.

## Verificación y bloqueo

La infraestructura preview se recuperó temporalmente. Se inició únicamente el contenedor de QA existente, con 1 CPU, 2 GiB y sin swap adicional, y se recuperó su PostgreSQL conservado, sin semillas ni migraciones.

La tanda anterior 185db0e2 alcanzó **138/139 unitarias**; una falló. El host volvió a dejar de responder por SSH antes de recuperar el diagnóstico completo. Debe conservarse y revisar el JSON remoto; no se considera esa tanda aprobada. Se hizo explícita la espera del resultado renderizado en la prueba de filtros de Antecedentes, pero todavía no se atribuye a ello la resolución del fallo remoto.

Los cambios de este documento tienen comprobación sintáctica local de 16 archivos TypeScript/TSX, sintaxis del manual y diff sin errores. **Esto no sustituye tipos, unitarias, E2E ni revisión visual.**

Se agregaron pruebas de borradores por actor, contexto y pendientes del administrador, contenido de avisos, refresco de campana y modalidad del formulario. El E2E preparado crea una propuesta real artificial desde generador y verifica aviso en sesión abierta, campana, enlace exacto, tareas de transporte/operador, seguimiento de administración y ausencia de inicio/retiro prematuros en web escritorio, web angosta y app. Sigue pendiente de ejecución.

No se publicó esta tanda, no se modificó main ni datos reales y no se enviaron correos o push.

## Reanudación

1. Recuperar diagnóstico de .qa-product-ux-20261023/proposals/ui-help-unit.json en el preview. Verificar procesos antes de iniciar otro trabajo.
2. Sincronizar una fuente única con su comprobación de integridad. El preview conserva 185db0e2: todavía no contiene estos cambios.
3. Ejecutar unitarias de agenda/propuestas/avisos y UI afectada, tipos, backend, builds web/app, manual y E2E con un trabajador. Revisar capturas y consola, no sólo el resultado del build.
4. Auditar tablas protegidas y ausencia de envíos. No usar los scripts de publicación frontend de 185db0e2 para afirmar que se publicó esta tanda: ahora hay cambios de backend.
5. Completar la publicación autorizada sólo con evidencia final, guardas y smoke no mutante. No ejecutar workflows ni hacer push.
