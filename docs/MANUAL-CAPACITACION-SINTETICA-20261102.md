# Guía de capacitación con datos sintéticos

**Estado al 2 de noviembre de 2026:** material de preparación; no es una invitación ni una dirección de acceso. No hay un entorno validado y disponible para participantes. CAP sigue cerrado, el túnel temporal del instructor venció y no debe reutilizarse ninguna credencial histórica. No presentar el producto de producción como entorno de práctica.

## Para qué sirve una sesión sintética

La sesión permite aprender el flujo con registros ficticios y sin validez oficial: crear un manifiesto, revisarlo desde los roles participantes, coordinar retiro y entrega, registrar recepción y tratamiento, y observar los documentos resultantes. Una prueba anterior del modo preview aislado asignó números que incluyen `PRUEBA` y marca artificialmente los registros creados por el servidor. Esto se comprobó para ese preview y sus versiones identificadas; no implica que la producción ni la actual publicación 5c asignen esa marca. No quitar ni editar la marca para hacer que un registro parezca real.

## Opt-in y condiciones de apertura

La participación debe ser voluntaria y limitada a una sesión preparada. Antes de invitar a nadie, el responsable técnico debe disponer de un preview accesible que tenga:

- Aplicación, API, base y almacenamiento separados de producción, con credenciales y claves de sesión distintas.
- Cuentas artificiales independientes por rol y acceso limitado a participantes autorizados; credenciales entregadas fuera del manual y de los registros de prueba.
- Verificación de que el proxy no puede enrutar solicitudes del preview a producción, ni viceversa.
- Confirmación de correo y push apagados, destinatarios reales ausentes y tareas automáticas controladas. Si se pausan las tareas, la sesión no demuestra la ejecución automática de recordatorios. Los avisos directos que se ensayen tampoco acreditan la entrega externa de correo/push.
- Casos y archivos sintéticos identificados desde su creación por el entorno. No depender de edición manual de base ni de una acción posterior del arnés para poner `isDemoData`.
- Capacidad suficiente medida en el entorno elegido. Los ensayos conservados de API y sesiones virtuales no prueban una clase real con más de 20 personas.
- Ventana de inicio/cierre, responsable de soporte y plan para detener acceso y eliminar o retener de forma controlada los datos artificiales.

Sin todas esas verificaciones, no abrir acceso a participantes. La configuración CAP anterior no se considera habilitada ni vigente por existir documentación histórica.

## Web, app y Android

Web y la ruta `/app/` son superficies distintas y deben incluirse en la preparación. Hubo pruebas privadas de navegador que recorrieron los roles por web y ruta app; sus resultados corresponden a versiones de preview concretas, no al sitio público actual ni a una clase disponible. La ruta `/app/` abierta en un navegador de escritorio o Chromium móvil es una prueba de interfaz web/PWA; no equivale a instalar y probar la aplicación en un teléfono Android.

La prueba física en Android sigue pendiente: permisos, instalación, cámara/QR, conectividad intermitente, GPS y recuperación al volver de segundo plano deben probarse en el dispositivo que se vaya a usar. Hasta entonces, mostrar posiciones de GPS como simuladas cuando corresponda y no afirmar que se validó ubicación física.

## Recorrido sugerido cuando exista un entorno aprobado

1. Cada persona inicia sesión con su propia cuenta artificial, confirma el aviso visible de práctica y su rol. Administración observa el ejercicio; no aprueba en nombre de las partes.
2. Generador crea el caso sintético. Compartir el número que contiene `PRUEBA`; Transportista y Operador revisan y responden desde sus propias cuentas. Confirmar que las aprobaciones requeridas quedan registradas antes de coordinar.
3. Transportista registra retiro y entrega. El grupo observa en Monitor la última posición y su antigüedad; distinguir ubicación simulada de una captura física validada.
4. Operador confirma recepción, registra pesaje y, si el guion lo incluye, una diferencia o hallazgo. Las partes revisan la adenda y su respuesta.
5. Operador registra tratamiento y cierre según el caso. Descargar el documento de práctica y comprobar su marca antes de compartirlo.
6. Anotar dudas, errores y pasos donde alguien necesitó ayuda. No convertir esta sesión en una medición formal de experiencia sin participantes, observación y método acordados.

Si una acción queda sin confirmación, conservar el formulario y consultar el estado del mismo caso antes de reintentar. No crear otro manifiesto para sortear un resultado incierto.

## Documentos y límites de la marca

En pruebas privadas de versiones de preview se revisaron PDFs de manifiesto, anexos/certificaciones y, en otra versión, actas, informes y reportes. Esa cobertura pertenece a esas versiones y artefactos sintéticos; no certifica todos los formatos ni la publicación actual.

Los certificados previamente almacenados no se reescriben automáticamente y podrían carecer de la marca. Adjuntos aportados, exportaciones CSV e impresión del navegador no quedaron cubiertos de forma general por las pruebas de leyenda. El manual se sirve como contenido separado y no lleva la banda visual de la aplicación. No distribuir ninguno de esos documentos como válido oficialmente; antes de compartir un formato, verificar que muestra la identificación de práctica o excluirlo del ejercicio. La presencia de una banda en pantalla no sustituye la revisión del archivo descargado.

## Evidencia y situación actual

La preparación conserva pruebas aisladas de preview —incluidas asignaciones `PRUEBA`, recorridos de navegador y revisiones de algunos PDFs— y ensayos de carga con sesiones virtuales. No prueban acceso público, disponibilidad para participantes, aislamiento de un entorno de clase ya desplegado, capacidad simultánea real, experiencia observada ni compatibilidad Android física. La publicación 5c pasó checks no mutantes de servidor y recursos públicos; eso tampoco habilita el preview.

Hay un impedimento concreto de capacidad: la reserva de espacio libre de 7 GiB debe mantenerse. No liberar ese margen ni tocar otros proyectos para preparar la sesión. Resolver capacidad y respaldos fuera de esa reserva antes de desplegar o restaurar un laboratorio.
