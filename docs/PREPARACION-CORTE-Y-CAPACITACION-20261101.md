# Corte de SITREP y preparación de la capacitación

**Estado al 1 de noviembre de 2026:** preparación en preview; no es una autorización de despliegue ni una confirmación de que la capacitación esté disponible. El producto bajo evaluación es `540ecfff63304bbba5268ccc24c9a3960bdf849c`. El registro vivo de pruebas y riesgos es [Estado del corte y prioridades](CORTE-UX-PENDIENTES-20261101.md).

## Qué tiene sentido incluir

Evaluar un corte coherente del circuito diario: creación por cualquiera de las partes, tres aprobaciones —también en origen con transportista aprobador—, avisos internos, coordinación, viaje, recepción, adendas y certificados, junto con sus interfaces y manual correspondientes. Incluye las mejoras de navegación por rol, altas e inspecciones que forman parte de la misma versión. No se debe presentar como una selección independiente de funciones hasta comprobar las dependencias entre backend, web, app, manual y opciones de compilación.

La última versión de producción **documentada** en el registro es `8fb6277e`; no se verificó que todavía sea la versión instalada. En Git es ancestro de `540ecfff` y no hay diferencias en `backend/prisma/` entre ambos commits. Esto no verifica el esquema efectivo ni el historial de despliegue del servidor de destino y, por sí solo, no acredita que el corte sea compatible o que no requiera intervención de datos.

## Condiciones para un corte posterior

1. Cerrar la regresión de la versión exacta y conservar por separado las fallas, repeticiones y resultados. Registrar explícitamente lo que sólo se probó con GPS simulado y navegador.
2. Resolver o delimitar el tratamiento de propuestas históricas y la reversión. En datos artificiales, algunos manifiestos anteriores quedan bloqueados y la reversión a `8fb6277e` no entiende propuestas en origen de versión 2. Se ensayó una alternativa parcial a `17152d81`, pero no cubre todos los flujos. No se consultaron registros reales y el alcance real se desconoce.
3. Preparar un respaldo verificado del destino y una reversión compatible antes de cualquier cambio autorizado. Las copias cifradas actuales son del preview; no sustituyen el respaldo de producción.
4. Separar el arranque de API e interfaces de los trabajos programados que pueden escribir avisos, alertas o registros aun sin correo ni push. La pausa del candidato actúa al arrancar procesos nuevos y no detiene tareas ya iniciadas. El procedimiento debe garantizar los límites acordados antes, durante y después de la comprobación; véase [procesos programados](CORTE-PROCESOS-PROGRAMADOS-20261031.md).
5. Comprobar compatibilidad de flags de backend y compilación, y planificar la transición desde service workers anteriores sin perder borradores ni quitar recursos que todavía puedan pedir las pestañas abiertas. No asumir los flags actuales del destino a partir de la configuración del preview.
6. Identificar los límites que quedarían pendientes para la decisión de publicación: hora de captura y recepción GPS, reconexión y otros dispositivos, capacidad sostenida, accesibilidad, Android físico y observación con usuarios. Una batería técnica aprobada no equivale a esas validaciones.
7. Publicar sólo la versión identificada y autorizada, sin `main` ni workflows, con correo y push desactivados y sin modificar datos reales según el alcance acordado. Terminar con un smoke no mutante y verificar que tampoco hayan quedado tareas programadas escribiendo después del smoke.

## Capacitación en vivo: preparación necesaria

La regresión actual corre dentro de una red privada sin puertos publicados. **Ese entorno no es un enlace de capacitación utilizable por participantes.** CAP permanece cerrado: la guía histórica de cuatro teléfonos describe una ventana de acceso anterior y no demuestra que sus cuentas o enlaces estén habilitados hoy. No se deben reutilizar sus credenciales históricas.

Antes de la sesión hay que preparar y verificar un preview accesible para las personas invitadas, separado del sistema y de las bases de producción, con datos y archivos artificiales identificados como práctica sin validez oficial. Necesita cuentas y sesiones separadas para administración, generador, transportista y operador; acceso limitado a los participantes, credenciales entregadas por un canal apropiado y un mecanismo de cierre posterior. Ninguna contraseña debe quedar en el manual, el repositorio ni los registros de prueba. Mientras siga vigente la instrucción de CAP cerrado, no se abre su acceso ni se supone que el modo CAP existente pueda utilizarse.

En ese entorno, verificar por anticipado que correos y push estén apagados, que no haya destinatarios reales y que los trabajos programados estén controlados. Si se los pausa, explicar que los avisos de acciones directas pueden ensayarse, pero no se está demostrando la ejecución automática de recordatorios programados. La capacidad del laboratorio actual —una CPU, 2 GiB y un navegador de prueba a la vez— no demuestra que soporte simultáneamente una clase; la capacidad del entorno elegido se debe medir por separado con usuarios y datos artificiales.

### Recorrido propuesto para el ensayo

1. Cada persona entra con su propio rol y verifica que está en el entorno de práctica. La persona administradora observa; no aprueba por las partes.
2. Una parte crea un manifiesto artificial y comparte el número. Generador, transporte y operador reciben y abren el aviso, comprueban los tres estados y aprueban. Coordinar sólo después de las tres decisiones.
3. Transporte confirma retiro; el instructor identifica el mismo viaje y la antigüedad de la última posición en Monitor. Si no se pudo probar ubicación física, presentar el punto como simulado y no como GPS validado.
4. Transporte entrega; operador recibe, pesa y registra un hallazgo o una diferencia mediante adenda. Las partes responden y se comprueba el estado y el aviso correspondiente.
5. El operador completa el tratamiento, cierra y libera la certificación cuando corresponda. Las partes abren el aviso y descargan el documento de práctica; una rectificación aprobada conserva la observación previa como antecedente.
6. Registrar lo que cada rol no encontró o entendió sin intervención, además de errores técnicos. Para medir las metas de experiencia del plan hacen falta participantes por rol y observación; la presentación técnica no las acredita automáticamente.

La prueba Android física y las personas participantes siguen pendientes. Si un envío queda sin confirmación, conservar el formulario, consultar el estado del mismo caso y registrar la incidencia sin crear un duplicado para continuar la demostración.
