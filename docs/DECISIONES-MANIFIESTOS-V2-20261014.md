# Manifiestos V2 — respuestas del usuario a los siete grupos

Fuente: respuesta directa del usuario del 14/10/2026. Son decisiones de producto para el candidato, no una nueva acta de DGFA ni reglas publicadas. Complementan las confirmaciones previas de Santiago; no modifican producción ni manifiestos existentes.

Este documento prevalece sobre las preguntas y condiciones anteriores del backlog en los puntos que resuelve. Lo no respondido permanece explícito, sin volver a consultar lo confirmado.

Actualización de implementación: ver [candidatos de baja intensidad y adendas ordinarias, con evidencia de QA](QA-BAJA-INTENSIDAD-20261014.md). El 15/10 se implementa registro y revisión independiente de adendas ordinarias; corrida38714116108 SUCCESS, incluidas web/móvil/app y Android QA aislado. La matriz productiva de autoridad y el cierre documental siguen pendientes; las pruebas planificadas más abajo corresponden al backlog completo, no todas están implementadas. Sin publicación.

## Reglas definidas

1. **Variantes y baja intensidad (D01/D11).** El sistema contempla variantes por modalidad y participantes. Debe permitir operar sin la aprobación de un generador no inscripto, bajo la denominación solicitada «Manifiesto de baja intensidad», para registrar una actividad que de otro modo quedaría fuera del sistema. También contempla transportista sin alta y el recorrido de participantes externos. No crear cuentas, firmas ni aprobaciones ficticias. Baja intensidad describe el circuito de registro, no una clasificación de peligrosidad, volumen o habilitación ambiental.
2. **Registro y seguimiento (D11).** Conservar participantes declarados, hechos, cantidades, evidencias y responsable del registro; acumular movimientos para regularización posterior. Falta de alta en SITREP no prueba por sí sola falta de habilitación legal. No exigir completar primero el alta como condición para registrar la actividad.
3. **Continuidad y aprobación posterior (D06/D12/D13).** Las diferencias no bloquean el circuito en SITREP: registrar y continuar, dejando aprobación post facto pendiente o solicitud a la autoridad para que resuelva posteriormente. No exigir autorización previa como condición de esa continuidad. Conservar original, adenda y resolución independientes. Una incompatibilidad de corrientes o falta de evidencia se registra y destaca, no se oculta ni se convierte en habilitación. El silencio no aprueba. El hecho ocurrido se conserva aun ante rechazo posterior. Registrar un tratamiento o un documento no equivale a certificar conformidad de todo el expediente.
4. **Reprogramación y vencimiento (D05).** Reprogramar modifica los plazos cuando se sustenta en eventos de autorización validados; editar una fecha tentativa no los reinicia por sí solo. Un manifiesto vencido no se revalida: se produce otro, conservando el anterior. Mantener vínculo de antecedente sin reutilizar su número ni duplicar actividad estadística. Sigue vigente lo confirmado: 30 días para hacer efectivo el retiro, no para terminar tratamiento; seis meses de acopio desde llegada y aceptación por el operador.
5. **Transporte (D04/D10).** Al elegir transporte debe existir al menos un móvil; con varios, orientar la elección a la carga, corrientes Y y compatibilidad pertinente, mostrando la evidencia disponible. Permitir cambios, incluido el transporte, sin frenar el registro/circuito y sin exigir reaprobación de la carga al resto de actores; conservar recurso anterior/nuevo, quién, cuándo y motivo, e informar a las partes. No confundir recurso activo con aptitud verificada. La captura de un transporte externo no debe depender de haberlo creado antes en el padrón.
6. **Documentos (D08).** Incorporar los PDF originales del operador. Las rectificaciones son agregados vinculados: no reemplazar ni borrar el original. Conservar integridad, autor, fecha y relación entre documentos. Se mantiene el emisor confirmado: operador, tanto constancia de acopio al recibir como disposición final después de tratar.
7. **Agenda y avisos (D09).** Horarios configurables: recordatorios a primera hora del día y avisos por evento dentro del rango horario definido. Programar con menos de 24 horas está permitido con aprobación de las partes involucradas; no rechazar por antelación insuficiente. La falta de cuenta del generador utiliza la excepción del punto 1, no una aprobación inventada. Registrar eventos aunque su entrega quede para la ventana configurada; deduplicar y actualizar avisos ante reprogramación. No activar envíos reales durante desarrollo/QA.

## Contrato de experiencia propuesto

Separar tres dimensiones, sin multiplicar formularios ni crear una aplicación paralela:

- **Operación:** programado, retirado, recibido, tratado; hechos y fechas reales.
- **Conformidad:** aprobaciones obtenidas, faltantes, observaciones y revisión por autoridad.
- **Regularización:** participantes sin alta y documentación pendiente.

La UI de web, móvil, PWA y APK debe permitir continuar y mostrar un pendiente accionable, sin mensajes de éxito que hagan pasar una excepción por aprobación completa. Los permisos de acceso, identidad de quien registra, integridad y aislamiento siguen aplicando: «no bloquear» no autoriza acceder a expedientes ajenos ni falsificar decisiones.

## Precisiones aún necesarias, sin repetir lo resuelto

- **Numeración excepcional (D03):** cuándo consume número oficial un baja intensidad, rango/titular aplicable y qué hacer si se agota. Hasta resolverlo no inventar número ni unanimidad; la referencia interna permite conservar el registro.
- **Responsabilidades (D01/D02/D11/D12):** matriz por modalidad/multirol; quién registra, revisa y resuelve por autoridad; mínimos de identidad/evidencia; qué cambios versionan y requieren nueva conformidad; plazo de revisión y efecto documental del rechazo/silencio. La continuidad sin aprobación previa ya está definida, no volver a preguntarla.
- **Cómputo (D05/D07):** evento validado y fecha base exactos para computar los 30 días, corte horario; seis meses calendario, recepciones parciales/prórrogas. Reprogramación con autorización modifica plazo y vencido exige nuevo: ya resuelto.
- **Recursos y compatibilidad (D10/D13):** momento exigible de designación de chofer; fuente de corrientes/capacidad y tratamiento de evidencia faltante; precisar si «varios transportes» también significa reparto simultáneo de una carga, no sólo elegir/reemplazar un móvil. No inventar reparto ni asumir que falta de dato equivale a compatibilidad.
- **Cierre documental (D08/D12):** metadatos/firma mínimos, certificados parciales y cómo distinguir cierre operativo de conformidad documental cuando quedan observaciones. PDF del operador y rectificaciones aditivas ya resueltos.
- **Configuración de avisos (D09):** destinatarios, canales, valores iniciales de hora/ventana y permisos de configuración. No asumir 08:00, correo habilitado ni excepciones nocturnas.

## Pruebas de aceptación a implementar

Estas son pruebas planificadas para el backlog completo; **no se ejecutaron ni se incorporaron al runtime en la actualización documental original**. Consultar la evidencia enlazada arriba para los subconjuntos implementados después; no interpretar esta lista como resultados.

1. Generador externo, transportista externo y ambos: registrar/continuar sin cuenta ni aprobación ficticia; preservar identidad y pendientes; regularización sin duplicar estadísticas.
2. Diferencia de cantidad y de corriente: continuar con adenda pendiente, solicitar resolución posterior, aprobar/rechazar conservando hechos; incompatibilidad visible y nunca marcada apta por ausencia de datos.
3. Reprogramar tentativamente no mueve plazo; evento validado sí. Vencido no revive; nuevo manifiesto relacionado no reutiliza número ni duplica cantidades.
4. Seleccionar segundo móvil compatible y sustituir móvil/empresa: historial íntegro, aviso capturado, sin reaprobación de carga ni borrado de los demás campos. Pendiente explícito ante compatibilidad no comprobada.
5. PDF original descargado con bytes idénticos; rectificación conserva ambos documentos; roles ajenos no acceden.
6. Menos de 24 h con conformidades aplicables; recordatorio a horario configurable; eventos fuera de ventana quedan en cola, sin pérdida ni duplicados y sin entregar correo real.
7. Todos los recorridos en escritorio, web móvil, PWA y APK QA en nube; sesión expirada, doble toque, reconexión, roles y snapshot histórico sin cambios. Una ejecución serial, sin instalaciones ni emulador local.

## Siguiente corte

Continuar con los pendientes del contrato operación/conformidad/regularización desde los cortes ya implementados y probados. No repetir la definición ni pruebas terminadas salvo regresión; no activar numeración oficial excepcional o reglas de cierre no resueltas. La publicación sigue requiriendo autorización separada. No migrar ni reinterpretar los manifiestos actuales.
