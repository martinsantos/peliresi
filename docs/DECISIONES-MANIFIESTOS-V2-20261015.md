# Manifiestos V2 — segunda respuesta del usuario y revisión multirol

Fuente: respuesta directa del usuario del 15/10 a los siete grupos. Complementa las respuestas previas de Santiago/DGFA; no se atribuye a DGFA una nueva acta. **Definición y diagnóstico de código, sin implementación, publicación ni envíos en esta tanda.** Prevalece en los puntos actualizados sobre los pendientes anteriores. No altera manifiestos ni evidencia histórica de QA.

## 1. Revisión entre partes y antecedentes

- Las partes revisan entre sí: lo propuesto/comentado requiere aprobación de la contraparte; registrar un comentario no representa esa aprobación.
- Una aprobación post facto que incorpora una nueva corriente Y deja comunicación a la autoridad, con manifiesto, versión, corriente y responsables. Comunicar no equivale a que la autoridad la haya aprobado ni a modificar automáticamente la habilitación.
- Falta de aprobación o rechazo conserva el antecedente. Una nueva petición debe poder encontrarlo y vincularlo, sin borrarlo, copiar una aprobación vieja ni prejuzgar el nuevo pedido.
- La empresa puede participar en más de un rol. Deben distinguirse cuenta/persona, empresa, rol representado y decisión sobre una versión.
- Queda por precisar qué contrapartes deben responder cuando hay tres participantes o la misma empresa representa ambos lados. No convertir un clic en varias aprobaciones ni usar el ADMIN de QA como revisor productivo por defecto. Reemplazos/delegaciones y plazos concretos no quedaron especificados.

## 2. Participantes externos: datos faltantes no bloquean

- No exigir datos mínimos del generador/transportista externo como barrera para registrar baja intensidad. Admitir información incompleta o ausente y conservar lo que el responsable efectivamente declaró.
- Sugerir razón social, CUIT, nombre de fantasía, dirección y teléfono; mostrar faltantes como advertencias recuperables, no como errores de envío. No completar con CUIT, domicilio, cuenta o firma ficticios.
- Identidad incompleta no se fusiona por nombre ni se presenta como validada. Un registro sin identidad conserva su propia referencia y responsable, no se agrupa con todos los desconocidos como si fueran la misma empresa.
- Esta tolerancia se refiere a datos de participantes externos en este circuito, no a eliminar autenticación, permisos, límites de tamaño, protección de archivos o integridad de las acciones. Tampoco elimina los requisitos del alta ordinaria.

## 3. Número oficial de baja intensidad

- Corresponde cuando **el generador carga los datos del operador y aprueba ese manifiesto de baja intensidad**. El mero registro por el operador o una decisión administrativa no sustituye ese acto.
- Hasta cumplirlo se conserva referencia interna. Cumplido, asignar exactamente un número oficial con transacción e idempotencia; no crear un segundo movimiento ni duplicar estadísticas.
- Debe existir identidad verificable de quien aprueba como generador, incluso si la operación empezó sin alta. No atribuir su conformidad al operador ni simular una sesión ausente. El mecanismo de identificación/acceso es trabajo técnico pendiente.
- Rango/titular y agotamiento no se resolvieron con esta respuesta. Conservar el registro sin inventar números ni reutilizar anulados/vencidos; el manejo excepcional no debe aplicar una renumeración a históricos.

## 4. Fechas

- Los 30 días se cuentan desde la fecha de retiro, en zona `America/Argentina/Mendoza`, no desde la aprobación ni desde el momento de acordarlo.
- Interpretación operativa a validar en el diseño: **fecha de retiro pactada**, porque se trata de la caducidad si el retiro aún no ocurrió. No usar el campo de retiro efectivo (`fechaRetiro`) como base de un plazo previo al retiro; el modelo distingue `fechaEstimadaRetiro` y `fechaRetiro`.
- Acopio: seis **meses calendario** desde llegada y aceptación ya confirmadas. No convertirlo en 180 días ni reiniciarlo al reemitir documentos.
- Reprogramación con evento validado modifica plazo; vencido exige otro manifiesto vinculado, no revalidación. Recepciones parciales, prórrogas, in situ y borde inclusivo del último día siguen sin detalle; no ejecutar caducidades automáticas sobre datos existentes.

## 5. Fuente de compatibilidad, movilidad y entregas

- Fuente: datos del alta revisados por la autoridad, junto al proceso TEF. El cálculo o pago TEF **no sustituye por sí solo** una autorización de corriente/capacidad.
- Conservar fuente, versión, autoridad y vigencia de la autorización usada al mostrar compatibilidad; no derivarla de lo meramente declarado por el solicitante o de la aparición de una Y en una adenda.
- Diferentes transportes/móviles pueden llevar diferentes cargas y corrientes Y. Un transporte puede realizar un recorrido con varias entregas en serie.
- Desglosar recorrido, paradas, carga asignada y entregas: no confundir viaje con manifiesto ni sumar cargas de distintas unidades. La respuesta no determina todavía si una misma declaración se divide entre varios móviles simultáneamente; no inventar ese reparto.
- La selección de recursos y la continuidad no eliminan el historial de cambios ni los avisos internos a partes. El momento exacto exigible del chofer sigue por precisar.

## 6. Firma y cierre con adendas

- El documento del operador debe conservar **su firma**. No crear una firma de SITREP en su nombre ni interpretar esto como obligación de una tecnología de firma digital particular.
- **No puede cerrarse documentalmente con adendas pendientes o rechazadas.** Es regla definida, no pregunta a repetir.
- “Certificados parciales” era una hipótesis del backlog (certificar sólo parte de una carga tratada), no una funcionalidad solicitada/confirmada. Queda fuera del próximo corte; no exigirla para avanzar.
- Evaluar `CONFORMIDAD_RECHAZADA` / `CIERRE_PENDIENTE` como dimensión documental, conservando etapa física y hechos. “Manifiesto rechazado” fue planteado como posibilidad, no como instrucción de convertir automáticamente el estado existente a `RECHAZADO`.
- Una adenda rechazada requiere una resolución/rectificación vinculada antes del cierre conforme, conservando el rechazo. No simular aceptación, borrar el antecedente ni revertir un tratamiento registrado.
- El corte anterior usa `TRATADO` para terminar el circuito vigente y no acredita cierre documental. La implementación nueva debe separar ambos, también en botones, PDF y permisos; no basta cambiar una etiqueta o marcar como conforme todo lo tratado.

## 7. Avisos configurados por ADMIN

- ADMIN configura destinatarios, canales, horarios y reglas. Los eventos típicos del backlog: pedido de aprobación, observación/rechazo, resolución post facto con nueva Y a autoridad, recordatorio de retiro, vencimiento y pendientes de cierre.
- Mantener las reglas ya definidas: recordatorios a primera hora, eventos dentro de ventana configurable, tolerancia de programación menor a24h con conformidades aplicables y deduplicación por evento/versión/destinatario.
- “Los típicos” no activa correo, push ni todos los destinatarios. Valores iniciales y rutas de entrega se proponen en configuración y se prueban con proveedores simulados; canales externos siguen apagados. Distinguir aviso creado, entrega pendiente y entrega confirmada.

## Revisión de código: multirol no está resuelto hoy

Inspección de la fuente activa, sin conectar DB ni cuentas:

| Evidencia | Consecuencia |
|---|---|
| `backend/prisma/schema.prisma`, Usuario: `rol Rol`, email/CUIT únicos | Una identidad de cuenta con un rol; no colección de habilitaciones ni rol activo independiente |
| Usuario tiene relaciones opcionales generador/transportista/operador | Hay vínculos reutilizables, pero tener filas asociadas no concede multirol en autorización |
| `solicitud.controller.ts`, registro: rechaza email/CUIT existente y crea usuario+solicitud de un tipo | No permite solicitar otra actividad repitiendo el alta con el mismo CUIT; no quitar unicidad para sortearlo |
| Aprobación de solicitud: `usuario.update({ rol: solicitud.tipoActor })` | Aprobar una segunda actividad sobrescribiría el rol de la cuenta, en lugar de añadir habilitación |
| `auth.middleware.ts`: consulta `rol` en DB y `hasRole` evalúa ese único valor | Un selector sólo frontend no sería suficiente ni seguro |
| `AuthContext.tsx`: permisos y navegación derivados de `u.rol`; wizard por `tipoActor` | Formularios, sesiones, cachés y rutas necesitan contexto explícito de actividad |

### Propuesta de implementación, sin migrar ni activar

1. Una identidad/CUIT y datos comunes; actividades solicitables múltiples, cada una con documentos y decisión de alta propios. Pedir otra actividad desde la cuenta autenticada, no duplicar usuario ni recuperar datos sólo por conocer un CUIT.
2. Habilitaciones por rol y contexto activo comprobados en servidor. Añadir un rol aprobado sin quitar el anterior; solicitarlo no concede acceso. No reutilizar la impersonación administrativa como cambio de actividad.
3. Reutilizar datos compartidos con procedencia, evitando repetir formularios. Separar documentos específicos, flota, corrientes y TEF aplicables. TEF sólo en vista administrativa, como ya fue definido.
4. Conservar para cada aprobación persona, empresa, rol representado, versión y fecha. Cambio de actividad no autoriza aprobar por otra empresa ni activa automáticamente todos los roles del manifiesto.
5. Compatibilidad aditiva: cuentas actuales siguen con su rol; no convertirlas retrospectivamente a multirol ni cambiar historial. El cambio de contexto no debe cambiar las decisiones o borradores de otra pestaña.

## Brecha del candidato probado y orden siguiente

La QA `38722598671` sobre `7ef526e` sigue siendo evidencia del comportamiento anterior, **no aceptación de estas reglas nuevas**:

- `manifiestoExcepcional.ts` exige nombre, identificación y domicilio: contradice la nueva tolerancia. Próximo corte: campos opcionales/adverts, identidad incompleta preservada y cero fusiones implícitas.
- Revisión actual usa revisor ADMIN explícito de QA: debe evolucionar a decisiones entre partes, identidad multirol y aviso a autoridad, sin conceder permisos globales por anticipado.
- No existe asignación oficial excepcional bajo el evento del generador definido aquí.
- Cierre vigente ordinario usa `TRATADO`; no tiene transición independiente de cierre documental V2. El rechazo de carga existente no representa rechazo documental posterior.
- Alta multirol y recorridos con entregas en serie no están implementados. La asignación actual tiene un transportista y un snapshot de recurso por manifiesto.

Orden propuesto: tolerancia/advertencias externas → alta y contexto multirol → revisión entre partes/antecedentes y aviso capturado → numeración idempotente y cierre documental → agenda/recorridos. Sólo candidato aislado; publicación requiere otra autorización.

## Criterios de prueba nuevos, todavía NO ejecutados

1. Guardar baja intensidad con datos de participante vacíos/incompletos, advertir y poder completar mediante rectificación con historial; sin actor genérico, cuenta ni correo. Un CUIT malformado no se usa para vincular silenciosamente otra ficha.
2. Alta con dos actividades; aprobar una no aprueba la otra, aprobar la segunda no revoca la primera; rechazo de una no suspende automáticamente la otra. Datos comunes no se duplican y adjuntos específicos no se pierden.
3. Cambio de rol con sesiones/pestañas, expiración y borrador; servidor rechaza rol no concedido. Una empresa no ve expedientes ajenos por sumar actividades.
4. Contraparte aprueba versión actual; comentario/lectura no aprueba; nueva Y post facto produce un evento de comunicación deduplicado para autoridad, sin entrega externa en QA.
5. Pedido repetido recupera antecedente autorizado rechazado/sin aprobación; no filtra datos de otra empresa ni hereda su decisión. Identidades desconocidas no se unen por coincidencia de nombres.
6. Generador completa operador y aprueba: número oficial único incluso con dos solicitudes concurrentes/reintento. Sin ese acto, sólo referencia interna; rango ausente/agotado no inventa número ni pierde registro.
7. Fechas con zona Mendoza y meses calendario; reloj controlado, fin de mes/año, reprogramación validada y manifiesto vencido que no revive. Documentar los bordes aún por definir antes de automatizar vencimientos.
8. Pendiente/rechazada impide cierre documental por UI y API, incluida carrera entre revisión y cierre; no impide registrar hechos operativos ni borra cantidades/fechas. Firma/PDF original preservados; no emisión parcial por inferencia.
9. Recorrido con varias entregas consecutivas conserva destinatario, carga/Y, cantidades y evidencias por entrega, sin doble conteo. Móvil compatible no implica intercambiabilidad con toda la flota.
10. Cada corte con unit/HTTP/E2E web escritorio, móvil y `/app`, y APK separado en nube; proveedores externos apagados, sólo fixtures sintéticos. No reinterpretar suites previas como pruebas de multirol o nuevas reglas.
