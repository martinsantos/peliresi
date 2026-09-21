# Inspecciones SITREP: marco legal verificado y diseño resiliente

Fecha de contraste: 21 de septiembre de 2026.

Este documento separa deliberadamente tres niveles: **exigencia normativa verificada**, **decisión de producto inferida** y **punto pendiente de validación jurídica**. No reemplaza el dictamen de la Asesoría Letrada ni una resolución que asigne competencias.

## Fuentes oficiales verificadas

- [Ley Provincial 5.917 y Decreto Provincial 2.625/1999](https://www.mendoza.gov.ar/wp-content/uploads/sites/34/2020/01/Ley-Provincial-5917-y-Decreto-Reglamentario-2625-99.pdf), Gobierno de Mendoza.
- [Decreto Provincial 2.625/1999, texto consultable](https://e-legis-ar.msal.gov.ar/leisref/public/showAct.php?id=10440), Legislación en Salud Argentina, Ministerio de Salud de la Nación.
- [Ley Nacional 24.051, texto actualizado](https://www.argentina.gob.ar/normativa/nacional/450/actualizacion), Argentina.gob.ar.
- [Ley Provincial 9.003 de Procedimiento Administrativo](https://eticapublica.mendoza.gov.ar/assets/public/ley-9003.pdf), Oficina de Investigaciones Administrativas y Ética Pública de Mendoza.
- [Ley Nacional 25.506 de Firma Digital](https://www.argentina.gob.ar/normativa/nacional/70749/texto), Argentina.gob.ar.
- [Creación y funciones actuales de la Dirección de Gestión y Fiscalización Ambiental](https://www.mendoza.gov.ar/prensa/modernizacion-institucional-nace-la-direccion-de-gestion-y-fiscalizacion-ambiental/), Gobierno de Mendoza.
- [Digitalización provincial de actas de inspección](https://www.mendoza.gov.ar/prensa/proteccion-ambiental-digitalizo-las-actas-de-inspeccion-para-darle-mayor-agilidad/), Gobierno de Mendoza.
- [Resolución Nacional 306/2020](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-306-2020-341942/texto), utilizada sólo como referencia funcional federal; no atribuye por sí misma facultades a inspectores provinciales.

## Qué exige el régimen provincial

La Ley 5.917 adhiere a la Ley 24.051 y designa autoridad provincial de aplicación. El Decreto 2.625/1999 regula el procedimiento mendocino.

El artículo 44 del decreto exige, para la constatación in situ:

1. acta por duplicado;
2. datos personales de titulares, responsables y/o representantes técnicos;
3. domicilio real y legal;
4. descripción con la mayor exactitud y verosimilitud posibles de hechos y acciones vinculados con la presunta infracción;
5. daños a personas y bienes, terceros partícipes, testigos presenciales y demás circunstancias relacionadas;
6. verificación y/o secuestro del Libro de Registro de Operaciones;
7. firma de los intervinientes;
8. entrega de una copia al titular, responsable o presunto infractor;
9. notificación de lo actuado, plazos de descargo, ofrecimiento de prueba y constitución de domicilio legal.

El artículo 45 reserva la resolución y sanción a la autoridad de aplicación, luego del expediente administrativo. Si existe descargo con prueba, el “Instructor” debe ser abogado del Cuerpo Jurídico. Por lo tanto, **el inspector constata y documenta; no debería resolver la sanción ni aprobar su propia actuación**.

La Ley 9.003 exige debido proceso: acceso a actuaciones, derecho a ser oído, decisión fundada, prueba y plazo razonable. La UI no debe buscar una actuación “inapelable”: debe producir una actuación íntegra, verificable y correctamente recurrible.

La Ley 25.506 diferencia firma electrónica de firma digital. Un clic autenticado, token JWT o hash SHA-256 no debe rotularse como “firma digital”. Para obtener las presunciones de autoría e integridad propias de la firma digital se requiere la infraestructura y certificados previstos por ese régimen.

La descripción institucional vigente de la DGFA confirma la función de fiscalización y control ambiental a través de su cuerpo de inspectores. El antecedente oficial de digitalización de actas también enumera empresa o titular, representante, observaciones, plazo de presentación o descargo y espacios de firma. Es evidencia de práctica administrativa provincial, pero no reemplaza el texto normativo ni amplía por sí solo las competencias personales de cada inspector.

## Alcance funcional que SITREP puede afirmar hoy

| Capacidad | Fundamento | Estado de producto |
|---|---|---|
| Inspección in situ de generadores, transportistas y operadores | Ley 5.917 y Decreto 2.625/1999 | Modelado |
| Comparar lo declarado con lo observado | Deber de constatación y registros obligatorios | Modelado |
| Checklist, comentarios y fotografías por control | Medio técnico para describir con precisión; inferencia de diseño | Modelado |
| Huella SHA-256 por archivo | Control técnico de integridad; no equivale a firma digital | Modelado |
| Trazabilidad de revisión, respuestas y adjuntos | Expediente y debido proceso | Modelado parcialmente |
| Resolver sanciones desde el rol inspector | No corresponde al artículo 45 | Debe permanecer separado |
| Auxilio policial, ingreso forzoso o toma compulsiva de muestras | La Resolución 306/2020 lo prevé para autoridad federal, no prueba competencia provincial | Requiere validación jurídica y protocolo provincial antes de implementarse |
| Grabación de audio de terceros | No surge de las normas relevadas | Requiere protocolo de privacidad, consentimiento y conservación |

## Brecha legal de la implementación actual

SITREP ya conserva actor, inspector, fechas, ubicación, comparación declarada/verificada, checklist, observaciones, evidencias, hashes, eventos y plazo de respuesta. Eso es una base probatoria valiosa, pero **todavía no alcanza para afirmar que el PDF satisface por sí solo todos los extremos del artículo 44**.

Falta estructurar y validar:

- persona responsable presente, carácter y documento;
- domicilio real y domicilio legal por separado;
- daños, terceros y testigos como datos explícitos;
- estado del Libro de Registro de Operaciones y detalle de su verificación o secuestro;
- firmas de todos los intervinientes o constancia de negativa/ausencia;
- entrega de copia y constancia de recepción;
- comunicación inequívoca de plazo de descargo, ofrecimiento de prueba y constitución de domicilio;
- rol independiente de Instructor letrado y acto de la autoridad competente;
- snapshot inmutable del acta cerrada y, si se decide, firma digital válida.

## UI recomendada: simple en campo, rigurosa por detrás

### 1. Modo Recorrido

Una tarjeta por control, con tres decisiones grandes: **Cumple**, **No cumple**, **No aplica**. Al marcar “No cumple” se abre sólo lo necesario: descripción, foto y acción requerida. La evidencia queda vinculada al control, no perdida en una galería general.

La aplicación registra automáticamente identificador idempotente, hash, usuario, hora declarada de captura, hora de recepción del servidor, versión y reintentos. Nada de eso debe convertirse en trabajo manual del inspector.

### 2. Modo Acta

Antes de “Enviar a revisión”, un único control de completitud agrupa los requisitos del artículo 44:

- intervinientes y domicilios;
- hechos, daños, terceros y testigos;
- Libro de Operaciones;
- firmas o constancias de negativa/ausencia;
- copia y notificación de derechos/plazos.

La pantalla debe llevar al primer faltante. No debe presentar un formulario legal de veinte campos desde el inicio.

### 3. Modo Expediente

Después del cierre de campo, la vista cambia a lectura: síntesis, hallazgos, evidencia, cadena de custodia y timeline. Inspector, revisor administrativo, Instructor letrado y autoridad resolutiva deben ser roles y acciones distinguibles.

## Resiliencia requerida para campo

1. **Offline real:** texto, decisiones y blobs se guardan localmente; no sólo un mensaje de “sin conexión”.
2. **Cola visible:** cada captura muestra `Pendiente`, `Sincronizando`, `Sincronizada` o `Requiere atención`.
3. **Idempotencia:** un reintento usa el mismo `clienteId`; una respuesta perdida no duplica la evidencia.
4. **Integridad:** el cliente calcula SHA-256 y el servidor lo vuelve a calcular; si difieren, rechaza la carga.
5. **Doble tiempo:** se conserva captura del dispositivo y recepción del servidor. La hora del teléfono no se trata como fuente infalible.
6. **Cierre bloqueado:** no se cierra si hay capturas pendientes, conflictos de versión o requisitos obligatorios incompletos.
7. **Recuperación:** una recarga, cierre de la PWA o reinicio del teléfono no borra la cola.
8. **Contexto hostil:** acción visible “Interrumpir por seguridad”, que conserva todo y permite registrar motivo. No presupone facultad de coerción.
9. **Negativa/ausencia:** registrar negativa a firmar, ausencia de responsable y testigos sin inventar una firma.
10. **Privacidad local:** la cola contiene información sensible. Debe quedar aislada por usuario y, para despliegue institucional, protegida con política de dispositivo, bloqueo y cifrado local definido.

## Criterio de cierre jurídico-técnico

Un expediente puede considerarse técnicamente listo para revisión cuando:

- no hay sincronizaciones pendientes ni errores;
- todos los controles obligatorios tienen resultado;
- toda no conformidad tiene descripción suficiente;
- las evidencias referenciadas existen, tienen hash y autor;
- los campos del artículo 44 están completos o existe una constancia explícita de no disponibilidad;
- la versión de cierre se inmoviliza;
- el PDF identifica versión y huella del snapshot;
- la firma de intervinientes y entrega de copia están resueltas por el mecanismo jurídicamente aprobado;
- el inspector no puede aprobar ni sancionar su propia actuación.

## Decisiones que requieren dictamen antes de codificar

- mecanismo válido de firma de inspector, responsable y testigos;
- tratamiento de negativa a firmar y valor de testigos;
- validez de copia digital frente al requisito de duplicado;
- canal de notificación fehaciente y cómputo de plazos;
- alcance de ingreso, toma de muestras, secuestro y solicitud de fuerza pública;
- grabación de audio, consentimiento, retención y acceso;
- plazo de conservación de originales digitales y copias offline.
