# Revisión de compatibilidad de aprobaciones antes de un corte

Esta herramienta se probó **sólo en el preview artificial**. No se ejecutó en producción y no determina por sí sola si una publicación es segura. Su propósito es cuantificar candidatos a revisión antes de que una versión que exige tres aprobaciones pueda impedir iniciar un manifiesto anterior.

## Qué informa

El servicio examina manifiestos con `isDemoData=false` en estado Borrador, Pendiente de aprobación o Aprobado. Usa las mismas reglas de la versión candidata para comprobar la propuesta y las decisiones: detecta marcadores ausentes, inválidos o duplicados, partes o modalidad que no coinciden, decisiones con metadatos inconsistentes, rechazo, aprobaciones faltantes y coordinación pendiente. Las filas del informe agrupan por estado, modalidad, resultado y motivo; esas categorías son excluyentes y suman el total examinado.

También informa comprobaciones independientes de coherencia de estado: aprobados a los que falta algún tipo de evento de aprobación, pendientes que ya tienen tres decisiones verificables y borradores con un marcador de propuesta. Esas cifras pueden solaparse con las categorías y no deben sumarse a ellas.

Para los registros que la regla presenta como listos, cuenta decisiones fechadas antes de la propuesta, coordinaciones anteriores a las decisiones y pasos con la misma fecha. Esos indicadores pueden solaparse. Una fecha igual deja el orden incierto: no demuestra que haya habido una irregularidad. El informe **no reconstruye la autorización que tenía cada firmante**, ni prueba por sí mismo el consentimiento o la validez jurídica de los documentos. Tampoco revisa expedientes que ya están en tránsito o en etapas posteriores.

El proceso lee identificadores y descripciones necesarios dentro de la base y la memoria, pero sólo devuelve totales: no incluye números de manifiesto, empresas, personas ni credenciales. Identificar y resolver los casos requiere una revisión autorizada separada; el informe no los modifica ni los aprueba.

## Cómo se ejecutaría en una etapa autorizada

El comando es manual y no está conectado a rutas, tareas automáticas ni workflows. Antes de usarlo en otro entorno se debe verificar el servidor migrado y la identidad de su base, y preparar una cuenta con permisos de lectura para las tablas necesarias. La conexión se entrega mediante `SITREP_AUDIT_DATABASE_URL`; la base, dirección interna del servidor PostgreSQL, puerto y esquema esperados se suministran mediante `SITREP_AUDIT_EXPECTED_DATABASE`, `SITREP_AUDIT_EXPECTED_ADDRESS`, `SITREP_AUDIT_EXPECTED_PORT` y `SITREP_AUDIT_EXPECTED_SCHEMA`. No se usa la conexión predeterminada de la aplicación. Los secretos deben provenir del mecanismo seguro del entorno y no incluirse en el historial de comandos.

Una vez compilada y revisada la versión correspondiente, el punto de entrada es:

```bash
node backend/dist/scripts/auditProposalImpact.js --operativo
```

La herramienta verifica la identidad **dentro de la misma transacción** antes de leer manifiestos. Usa una transacción PostgreSQL de sólo lectura y aislamiento `repeatable read`, páginas de 100 registros y un límite de 90 segundos. Si el destino no coincide, la conexión falla o el examen no termina, devuelve error sin informe parcial. Una instantánea prolongada puede afectar el mantenimiento de una base activa; el tiempo y la carga real deben evaluarse antes de ejecutarlo en el entorno de destino.

La consulta SQL anterior `CONSULTA-CORTE-APROBACIONES-20261029.sql` sigue siendo una búsqueda parcial: no valida el contenido de los marcadores ni de las decisiones y sus grupos pueden solaparse. No debe utilizarse como recuento completo del impacto.

## Evidencia y límites de la prueba

En el preview, siete casos artificiales se examinaron en páginas de dos registros; las categorías sumaron siete y no se devolvieron identificadores. Una escritura de prueba fue rechazada por PostgreSQL. En un segundo ensayo, otro proceso cambió uno de tres registros artificiales entre páginas: el informe mantuvo los tres de la instantánea inicial, mientras la consulta independiente veía dos. Esos tres registros temporales se eliminaron al terminar. El comando manual también se ensayó contra la base artificial y rechazó un puerto esperado incorrecto. No se enviaron correos ni push; CAP permaneció cerrado en la configuración de QA.

No se midió el volumen ni la duración en producción, no se consultaron registros reales y no se resolvieron casos históricos. Siguen pendientes la revisión de impacto y la decisión de Ambiente, además de las pruebas de Android físico, participantes y capacidad indicadas en el registro general.
