# Padrón, domicilios y usuarios que actúan por una empresa

Fecha: 16/10/2026. Revisión y definición de alcance; sin migración ni despliegue.

## Definido por el usuario

- Conservar el domicilio legal y los domicilios productivos como conceptos diferentes.
- Una persona jurídica puede tener varias personas usuarias operando en su nombre, cada una con un rol.
- El responsable de empresa validado por DGFA puede autorizar y revocar esos accesos.
- Inferir las marcas de color del padrón a partir de los datos. Conservar la inferencia y su evidencia, sin presentarla como una resolución administrativa que el archivo no contiene.

La cuenta de una persona, la entidad titular, la actividad autorizada y el establecimiento son identidades distintas. Una persona física titular también puede ser generador; no limitar el modelo a sociedades.

## Hallazgos comprobados

Se analizaron siete archivos y sus 18 hojas, incluyendo hojas vacías, ocultamientos, estilos, fórmulas y referencias. Dos archivos históricos de generadores son byte-idénticos y cuentan como una sola fuente independiente. La comparación con producción se hizo en una transacción REPEATABLE READ READ ONLY el 16/10 a las 15:08:59 de Mendoza.

| Dato | Resultado |
|---|---:|
| Filas con contenido en REGISTRO, sin encabezado | 1.758 |
| Filas reales de padrón | 1.627 |
| Filas que sólo contienen fórmulas de plantilla | 131 |
| Certificados distintos | 1.626 |
| Filas reales ocultas | 82 |
| CUIT formalmente válidos / distintos | 1.567 / 1.286 |
| CUIT ausentes / no aceptados por formato o verificador | 29 / 31 |
| CUIT con varias filas/certificados | 155, sobre 436 filas |
| Domicilio legal y real/productivo diferentes | 559 |
| Domicilio legal / productivo completamente ausente | 40 / 37 |
| Filas con varios correos de contacto | 1.171 |
| CUIT con más de un rol entre los tres padrones recientes | 30 |

La validación formal del CUIT es local; no se consultó ARCA. Varias filas del mismo CUIT no prueban por sí solas cuántas plantas hay: pueden representar establecimientos, certificados, cambios históricos o una inconsistencia. Conservarlas hasta resolver el alcance de cada inscripción.

## Qué se puede llevar y qué no debe colapsarse

El staging privado preparado retiene las 1.627 filas, sus celdas originales, fórmulas y valores cacheados, colores resueltos y originales, anotaciones, ocultamientos y origen archivo/hoja/fila/SHA256. No crea usuarios ni modifica fichas actuales.

La conciliación actual separa 1.282 filas con certificado y CUIT coincidentes, 279 con una empresa existente pero otro certificado, 60 con CUIT a revisar, dos filas del mismo certificado repetido, tres coincidencias ambiguas en fichas actuales y una entidad nueva a preparar. Las categorías suman exactamente 1.627. Coincidir no equivale a autorizar sobrescritura.

- Hay 57 diferencias que completarían campos vacíos después de revisar tipo y alcance, 1.830 diferencias con valores ya cargados y 133 diferencias de valores tipados que requieren tratamiento específico, por ejemplo EXENTO/OFICIO en columnas numéricas o errores de fórmula. No aplicar las tres categorías como un UPDATE genérico.
- El duplicado de certificado G-000342 necesita conservar ambas filas y anotaciones. No imponer una relación universal de un certificado con una sola sede sólo para resolverlo.
- 64 celdas de las columnas DDJJ contienen texto o varias referencias, incluidos descargos. No tratarlas automáticamente como presentación aprobada ni como un único número GDE.
- 2024 y «DDJJ de ABRIL 2024» son columnas diferentes. El modelo actual único por actor/año pierde ese detalle si se usa sin un registro de presentaciones o referencias adicional.
- El archivo nuevo cambia los encabezados U (de informe técnico a resolución de renovación) y V (de TEF2025 a TEF2026). La columna T pasa de INDIV a RANGO. El importador anterior no sirve sin revisar este contrato.
- 78 valores cacheados contienen errores: 77 fórmulas M×R y el contador AE2. No convertirlos en cero ni certificar su resultado económico.
- El monto TEF no prueba pago. Un número o texto de DDJJ no acredita aprobación. No hay PDFs de certificados, recibos o declaraciones dentro de este registro.
- Las 20 categorías de RUBROS permanecen iguales; aparecen 417 textos de rubro distintos que no coinciden exactamente con el catálogo. Conservar el texto libre y preparar equivalencias revisables; no crear 417 categorías normativas nuevas.

En los padrones recientes de operador/transporte, la conciliación del 10/10 sigue sin nuevas altas o parches propuestos: 74 filas coincidentes, 12 pendientes y 127 diferencias conservadas. El total histórico de transporte y su hoja dinámica «Vigentes» son referencias anteriores, no una orden actual de baja para quienes no aparecen en el subconjunto reciente.

## Colores: inferencia autorizada y respaldada

| Marca | Filas | Evidencia | Lectura que se conserva |
|---|---:|---|---|
| Verde | 38 | Las 38 indican EXENTO en R | Exención indicada en fuente; separar el tratamiento TEF de la vigencia de la inscripción |
| Naranja | 74 | Ninguna trae DDJJ2025 o DDJJ2026 | Falta de referencias recientes en esta fuente; seguimiento documental |
| Amarillo | 108 | 106 sin DDJJ2026 y 92 sin DDJJ2025 | Marca de revisión/seguimiento; no suspensión |
| Rojo oscuro | 1 | Segunda fila del certificado repetido | Revisar agrupación/antecedentes del certificado |
| Rojo intenso | 2 | Ambas ocultas y sin DDJJ2025/2026; una dice OFICIO | Revisión especial; significado administrativo original no determinado |

Guardar color y etiqueta inferida por separado, con fundamento y fecha. «Sin dato en Excel» no significa incumplimiento, deuda, baja o habilitación vencida. La inferencia sirve para organizar la revisión, no para suspender cuentas o bloquear movimientos.

## Modelo propuesto

| Concepto | Identidad y alcance |
|---|---|
| Titular/entidad | CUIT confirmado; razón social y nombre de fantasía. Admite persona física o jurídica |
| Domicilio legal | Dirección para el titular, con procedencia e historial. Conservar discrepancias; no elegir silenciosamente una de varias direcciones legales |
| Establecimiento | Identificador propio, nombre, domicilio productivo, localidad/departamento y ubicación territorial; pertenece a un titular |
| Inscripción/habilitación | Rol, expediente, certificado, resoluciones, vigencia explícita y establecimientos comprendidos. No inventar que cada certificado sólo puede abarcar una sede |
| Persona usuaria | Cuenta personal identificada; credencial propia. No una cuenta nueva por planta ni una cuenta compartida de la empresa |
| Autorización | Persona × entidad × actividad/rol × establecimientos autorizados; otorgante, fecha, estado y revocación |
| Responsable de empresa | Designación validada por DGFA que permite gestionar accesos dentro de la empresa |
| Contacto | Dirección de correo/teléfono y finalidad. Estar en la lista del Excel no crea autorización ni demuestra representación |
| Fuente de padrón | Lote inmutable, fila, datos originales, anotaciones, colores y resolución de conciliación |

El rol operativo de generador/transportista/operador debe estar respaldado por una actividad aprobada de la entidad. El responsable de empresa asigna personas a ese alcance; no se convierte en autoridad DGFA ni habilita nuevas actividades regulatorias. Esto conserva la separación del circuito multirol ya probado: aprobar actividades y autorizar personas son acciones diferentes.

## Consecuencias en UI y operación

- Acceso: si sólo hay una empresa/actividad habilitada, entrar directamente. Si hay varias, ofrecer el contexto y recordar la elección. Mostrar de forma compacta «Actuando por [empresa] · [actividad] · [sede]» cuando sea necesario.
- Perfil de empresa: «Empresa», «Establecimientos» y «Personas autorizadas». Cada usuario conserva su perfil personal.
- Domicilios: «Legal» y «Productivo» explícitos. Permitir usar el mismo domicilio sin duplicar su escritura; si cambian después, no mantenerlos sincronizados silenciosamente. Cambios de padrón siguen el circuito de revisión aplicable.
- Manifiestos: elegir establecimiento de origen y destino físico; sugerir la sede habitual. El domicilio legal no debe sustituir el lugar de retiro por falta de un dato. Si falta ubicación, mostrarlo y conservar el recorrido tolerante definido, sin inventar una dirección.
- Inspecciones: sugerir establecimientos productivos y conservar la posibilidad de registrar el lugar observado. El helper actual ya distingue domicilio real/legal; ampliar a múltiples establecimientos sin perder el snapshot histórico.
- Mapa/monitor: punto territorial del establecimiento y procedencia de la coordenada. El helper actual distingue coordenadas, geocodificación y referencia departamental; no presentar la dirección legal o un centro departamental como GPS productivo exacto.
- Auditoría: registrar la persona que actuó, empresa, actividad, establecimiento, autorización y evento. No atribuir a la empresa acciones sin identificar a la persona.
- Revocación: comprobar autorización en el servidor en cada acción y retirar acceso al ámbito revocado. Borradores locales permanecen identificados por su propietario/contexto, sin filtrarse a otra empresa.

## Implementación por cortes y aceptación

1. **Staging y conciliación:** alta de lote/fila/colores/anotaciones independiente, idempotencia por SHA/hoja/fila, diff completo, pendientes explícitos. Prueba: 1.627 filas conservadas, 131 plantillas separadas, mismas fuentes al repetir, cero escrituras en manifiestos/cuentas durante el dry-run.
2. **Titular y establecimientos:** tablas y enlaces aditivos con mapeo a fichas actuales. Prueba: mismo CUIT con dos sedes/certificados no se fusiona; certificado repetido no se descarta; legal/productivo diferentes, iguales o ausentes; direcciones anteriores siguen en documentos históricos. Mantener IDs y permisos heredados durante la transición.
3. **Personas autorizadas:** responsable validado por DGFA, cuentas personales, roles/alcances por empresa/sede y revocación. Prueba: dos personas simultáneas en la misma empresa; persona con varias empresas; revocación con sesión abierta; denegación de otra empresa; responsable sin atribuciones DGFA; cambio de contexto sin mezclar borradores/cachés/avisos.
4. **Publicar datos revisados:** respaldo, lista exacta de cambios y valores previos, transacción, auditoría, comparación posterior y repetición idempotente. No borrar valores por celdas vacías ni aplicar cambios de habilitación a partir de colores. Completar primero las decisiones de identidad de cada fila afectada.
5. **Validación de superficies:** unit con DB/proveedores simulados; HTTP con base sintética; E2E escritorio y móvil/app; APK aislado en nube. Misma empresa con dos personas y dos sedes debe completar alta/borrador/revisión/selección/manifiesto/inspección/consulta en cada superficie. Las pruebas de V2 anteriores no certifican estas funcionalidades nuevas.

Compatibilidad: el esquema actual ya conserva campos de domicilio legal/real y sedes de operador, pero Generador/Transportista/Operador tienen CUIT único y usuarioId único; Usuario tiene un rol y vínculos uno-a-uno. No basta agregar un campo de dirección o quitar un índice: hay que adaptar consultas, autorizaciones, borradores, notificaciones y auditoría antes de cambiar la fuente de lectura. Conservar SedeOperador y relacionarla; no crear otra lista paralela de sedes sin mapeo.

## Estado de esta entrega

Análisis y staging privados preparados; diseño funcional definido. No se ejecutó el importador antiguo, no hubo cambios de producción/cuentas/manifiestos, no se enviaron correos ni se alteró el formulario humano. No se instalaron servicios ni emuladores. Los datos de conciliación y contacto quedan fuera del repositorio y del paquete para la otra IA.
