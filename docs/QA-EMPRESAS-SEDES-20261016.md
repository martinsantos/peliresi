# Empresas, establecimientos y personas — candidato no publicado

16/10/2026. Alcance: empresa titular por CUIT, domicilios legal/productivos separados, varias personas autorizadas por responsable validado por DGFA y preparación segura del padrón.

## Contrato implementado

- Ocho tablas nuevas, sin reescribir IDs de cuentas, fichas operativas, inscripciones ni manifiestos anteriores. Migración aditiva versionada; rollback de aplicación sin borrar columnas ni datos.
- Empresa con actividades GENERADOR, TRANSPORTISTA y OPERADOR ya aprobadas, CUIT formalmente válido y coincidente. Vinculación y validación del responsable exclusivas de DGFA.
- Responsable validado: mantiene domicilio legal/establecimientos, autoriza/revoca personas verificadas, prepara invitaciones de un uso y 24 horas. Sin correo desde estos endpoints.
- Cada persona conserva ID/cuenta y rol base. Contexto empresa/actividad/sede por pestaña; servidor verifica autorización en cada petición. Revocar no borra ni desactiva la cuenta personal.
- Delegación por establecimiento de GENERADOR: sólo registros con origen/sede identificados. No se infieren sedes de históricos. TRANSPORTISTA y OPERADOR requieren alcance completo de empresa en este corte.
- Manifiesto nuevo en contexto empresarial conserva empresa, autorización/revisión, establecimiento y domicilio legal al declarar. Creador sigue siendo la persona. PDF distingue domicilio productivo/legal. Editar empresa no cambia la fotografía anterior.
- Ediciones con revisión y motivo; transacciones serializables y conflicto 409 antes de pisar versiones. Historial antes/después en base, últimos 50 eventos en interfaz.
- Invitación con token aleatorio 256 bits, sólo hash en base. Aceptación con contraseña y correo verificado, sin reemplazar sesión abierta. No activa suspendidos ni cuentas con CUIT/ficha/solicitud propia pendiente; puede activar cuenta personal nueva sin esos vínculos, mediante invitación válida.
- Flags ENTERPRISE_ENABLED/VITE_ENTERPRISE_ENABLED OFF por defecto, ON sólo en VM sintética.

## Preparación del padrón

Planificador puro sin cliente de base ni modo apply. Origen SHA256/hoja/fila y hash canónico de contenido. Repetir exactamente no duplica propuestas; misma identidad con contenido distinto falla. Conserva observaciones/celdas/estilos y separa inferencias del estado legal, nulo.

Agrupa por CUIT confirmado y conserva certificados/establecimientos candidatos sin elegir la primera ficha. CUIT dudoso, certificado duplicado o conciliación ambigua quedan pendientes con su origen. Domicilios legales divergentes se conservan como candidatos. Nunca crea cuentas desde contactos de Excel.

Datos reales en padrones-20261016/private, fuera del repositorio y de Actions. Snapshot productivo 16/10 sólo lectura, nunca usado para pruebas. Operadores/transportistas conservan planes privados anteriores; ninguno se aplica aquí.

## Validación en curso

Primer intento38950498951/019593b detuvo compilación por dos estrechamientos de tipo y una variable de actividad. Corregidos en eb5496f. No se cuentan suites pasadas. Cleanup SUCCESS.

38950668018/eb5496f pasó compilación3, suites unitarias y migración; reprodujo fallo500 de aceptación de invitación: la autorización copiaba campos de invitación. c6af25b limita la proyección a tres campos de alcance, con prueba de regresión. 38951658104/c6af25b llegó a la comprobación final de históricos; comparaba eventos SQL sin orden explícito. bae3ebb conserva la comparación completa y ordena por ID antes/después. Cleanup SUCCESS en ambos.

38952820023 y38953885985 canceladas con cleanupSUCCESS para incorporar sede productiva correcta en formulario/mapa/detalle, recorrido de delegado y límite por enlace+IP. No se cuentan como validación completa. Sin corridas solapadas.

38954126969/ecf1c2d: builds3, backend1027/1027 y frontend1480/1480 sin fallos/omitidas, migración/cliente anterior/histórico y cleanupSUCCESS. HTTP429 correcto pero respuesta era texto plano; el guion esperaba JSON. d995a74 agrega respuestaJSON española y mantiene5intentos. Evidencia anterior descargada en empresas-qa-38954126969 (sinAPK). No se cuentan E2E/APK como ejecutados.

38955267515/d995a74 CANCELLED confirmado, sin runner asignado ni pruebas ejecutadas: el usuario informó agotamiento de crédito de GitHub Actions. No relanzar. Pendiente comprobar compilación3, suites completas, HTTP/PDF, E2E36 y APK Android15; luego capturas/histórico/cleanup. No afirmar GO por resultados del candidato anterior.

Control de consumo: manifiesto-qa.yml queda sólo con workflow_dispatch, sin disparador push. Se conservan íntegros los casos, guardas y asercciones: no confundir seleccionar pruebas afectadas durante una corrección con aprobar el cierre completo. La regresión completa se ejecutará una vez estabilizado el candidato, no por cada cambio menor.

Alternativa simple por comprobar: servidor de preview 76.13.234.213 documentado en INFRAESTRUCTURA.md. También aloja otros servicios; sus cifras antiguas no acreditan capacidad actual ni KVM. La consulta SSH de sólo lectura fue bloqueada por la protección local; no se reintentó para eludirla ni se instaló/ejecutó nada allí. Hace falta habilitar esa comprobación antes de decidir su uso. No se ha trasladado la QA a otra plataforma.

Recorrido delegado agregado: sólo Planta Norte, sin pestañas de personas/historial ni enlace a ficha corporativa completa; usa empresa/sede, crea manifiesto con dirección productiva y legal correctas y autoría personal. Ubicación desconocida no hereda coordenadas de la ficha antigua. Repetido en web/móvil/app/APK. Responsable prueba actualizar domicilios, revocar/reautorizar a una sede, aceptar invitación de otra persona conservando su sesión, auditar y volver a contexto personal.

Límite de aceptación: cinco intentos por IP+capacidad durante15min, clave sin token crudo. Prueba cinco rechazos+429 y aceptación de otro enlace con la misma IP, sin bloquear a todo un Wi-Fi. No se envía correo: la verificación usa una prueba sintética conocida y el endpoint real.

## Límites

Sin publicar, migrar producción, correos/push, datos reales ni formulario humano. Sin instalaciones/servicios/pruebas pesadas locales. APK QA debug separado: no acredita firma/actualización del instalado, TWA/TLS final ni cámara/GPS/batería físicos.

Browser plugin no disponible: Playwright existente sólo dentro de Actions. No certifica GO global de pendientes V2 ni revisión legal de inferencias. Antes de activar: autorización y conciliación contra snapshot actualizado.
