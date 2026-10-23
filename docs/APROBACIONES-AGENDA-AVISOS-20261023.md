# Manifiestos: diagnóstico y visibilidad de las aprobaciones

Estado: **119 unitarias dirigidas PASS; E2E, tipos/builds y publicación pendientes**. Producción sigue en 6580c1ca. No confundir las unitarias locales aisladas con el recorrido completo sobre preview.

## Caso informado

Se consultó exclusivamente el estado, modalidad, fecha y tipos de eventos del manifiesto 2026-000197 mediante una transacción de lectura. Está guardado como **IN_SITU / BORRADOR**, con CREACION y CERTIFICACION_OPERADOR_V1, sin PROPUESTA_PARTES_V1. No se modificó el registro.

El registro ingresó al circuito de tratamiento en origen y quedó fuera del mecanismo de propuesta. Es un incumplimiento de cobertura del requisito de aprobación explícita de todas las partes, no una justificación para dar el producto por validado. La evidencia no permite afirmar qué selección hizo la persona en el formulario. No se inventan aprobaciones ni se modifica este registro real.

Se verificó por lectura que producción sigue en 6580c1ca, con propuestas habilitadas en configuración y ambos procesos. No era un flag apagado. CAP permanece cerrado, correos y push apagados.

## Cambios preparados

- Agenda: incluye borradores; conserva filtros por actor y paginación. Muestra generador, operador, partes pendientes y el contexto completo al posicionarse sobre la fila.
- Administración: Por aprobar reúne las decisiones pendientes de las partes. La sección destacada permite ir directamente a ellas sin atribuir al administrador una aprobación ajena.
- Formulario: cambiar a En origen después de elegir transporte exige confirmar que se lo quita, con vehículo y chofer. Cancelar conserva las tres asignaciones. Crear con propuestas habilitadas siempre queda pendiente de aprobación, también en origen.
- Detalle y agenda: no muestran Listo para iniciar ni ofrecen coordinación si falta una decisión, aunque el estado almacenado diga APROBADO. Íconos verdes sólo para la parte que aprobó; grises para pendientes, sin círculos ni tildes redundantes. Las etiquetas conservan accesibilidad.
- Avisos: describen a las empresas participantes y, cuando coincide con la cuenta titular, a la empresa que propone. La recepción de un aviso refresca también la campana; acceso con acción específica al manifiesto. Sonido, correo y push no se activan.
- Manual: explica agenda, avisos y diferencia entre circuitos. No declara probado lo pendiente.

## Contrato de aceptación

- Generador, transporte y operador asignados: tres decisiones explícitas, tres destinatarios de avisos, tres íconos. Crear no aprueba; tampoco leer avisos o entrar como administrador.
- Ninguna modalidad habilita saltar las decisiones de actores vinculados. Para tratamiento sin transporte, el usuario confirmó previamente aprobación explícita de generador y operador: se implementan ambas y se bloquea la recepción hasta el acuerdo y el inicio de coordinación. No se crea un transporte ficticio.
- El cambio de modalidad no puede quitar al transportista elegido silenciosamente. Un acuerdo persistido no puede cambiar sus partes o modalidad para reducir las aprobaciones exigidas.
- Cada aprobación, unanimidad, rechazo e inicio registra su autor y avisa a las partes. Reintentos no duplican decisiones ni avisos. Se bloquea cualquier comienzo prematuro desde la API, no sólo desde los botones.
- CAP cerrado y canales externos apagados. Las pruebas no envían correo ni push.

La historia Git muestra que 930d3e6a (18/10) y d372ce6e (19/10) restringían las propuestas a FIJO; 47ea8470 (21/10) mantuvo esa condición al llevarlas al circuito operativo. El plan de esa promoción dejó in situ con el contrato anterior. No se halló una reversión posterior de esa variante: faltó cubrirla en implementación y aceptación. Esa diferencia técnica no reduce el requisito del usuario.

Los registros históricos sin marcador conservan sus eventos y contrato; **el caso real 2026-000197 no fue convertido ni corregido**. La nueva regla se prepara para nuevas propuestas, sin mutaciones sobre datos reales.

## Verificación y bloqueo

La infraestructura preview se recuperó temporalmente. Se inició únicamente el contenedor de QA existente, con 1 CPU, 2 GiB y sin swap adicional, y se recuperó su PostgreSQL conservado, sin semillas ni migraciones.

La tanda anterior 185db0e2 alcanzó **138/139 unitarias**; una falló. El host volvió a dejar de responder por SSH antes de recuperar el diagnóstico completo. Debe conservarse y revisar el JSON remoto; no se considera esa tanda aprobada. Se hizo explícita la espera del resultado renderizado en la prueba de filtros de Antecedentes, pero todavía no se atribuye a ello la resolución del fallo remoto.

Comprobaciones nuevas, ligeras y aisladas con dependencias existentes (un worker, heap de 256 MiB, sin navegador, base ni red):

- 50/50 backend: seis órdenes de aprobación, destinatarios y enlace de los avisos en cada etapa, idempotencia, firma, bloqueo de inicio/recepción y lectura coherente de agenda/detalle.
- 69/69 frontend y manual, en siete archivos: íconos, acciones, conservación de transporte, aprobación en origen, agenda, campana y documentación. Hubo una aserción textual desactualizada del manual: se conservó el contrato histórico explícito, se corrigió el texto y se repitió la suite afectada.
- Sintaxis de 21 archivos TS/TSX/MTS sin errores. No se ejecutaron instalaciones ni copias de dependencias.

Estas pruebas **no sustituyen tipos, builds, E2E, revisión visual ni persistencia/concurrencia reales**. El runner local .approval-unit-local.config.mts se conserva como auxiliar reproducible; el control local bloqueó su eliminación, sin impacto en producto ni necesidad de borrarlo para continuar.

Se agregaron pruebas de borradores por actor, contexto y pendientes del administrador, contenido de avisos, refresco de campana y modalidad del formulario. El E2E preparado crea propuestas artificiales desde los tres actores, abre los tres avisos de campana, comprueba 0/3 → 1/3 → 2/3 → 3/3 e íconos en sesiones separadas y coordina/retiro. Se agregan creación y recepción en origen por ambas partes. También se conserva el escenario de aviso en sesión abierta y seguimiento administrativo. Las tres superficies son escritorio, web angosta y app. Todo esto sigue pendiente de ejecución.

No se publicó esta tanda, no se modificó main ni datos reales y no se enviaron correos o push.

## Reanudación

1. Recuperar diagnóstico de .qa-product-ux-20261023/proposals/ui-help-unit.json en el preview. Verificar procesos antes de iniciar otro trabajo.
2. Sincronizar una fuente única con su comprobación de integridad. El preview conserva 185db0e2: todavía no contiene estos cambios.
3. Ejecutar unitarias de agenda/propuestas/avisos y UI afectada, tipos, backend, builds web/app, manual y E2E ui-help-browser + proposal-browser con un trabajador. Revisar capturas y consola, no sólo el resultado del build.
4. Auditar tablas protegidas y ausencia de envíos. No usar los scripts de publicación frontend de 185db0e2 para afirmar que se publicó esta tanda: ahora hay cambios de backend.
5. Completar la publicación autorizada sólo con evidencia final, guardas y smoke no mutante. No ejecutar workflows ni hacer push.
