# SITREP · estado del corte y prioridades

**1 de noviembre de 2026.** El candidato de producto `f3307f3f` se probó en preview; el entorno de esta tanda se apagó al finalizar y no está acreditada su publicación. Este documento sintetiza la evidencia y los impedimentos de cierre; el detalle y la reproducción de cada cambio están en [el registro de revisión](REFACTOR-UX-20261025.md) y [el balance](BALANCE-CIERRE-20261030.md).

## Lo comprobado

| Área | Evidencia en preview artificial | Límite |
|---|---|---|
| Operación diaria | En `f3307f3f` pasaron seis ciclos ordinarios y seis en origen, iniciados por cada rol en web y app de navegador; se comprobaron las tres aprobaciones. Los ordinarios incluyeron aviso, adenda observada, rectificación aprobada, tratamiento y certificados. | No se probaron todos los estados o datos anteriores. |
| PSIP | Seis intercambios desde expedientes notificados verificaron requerimientos, respuestas, adjuntos, avisos y denegación a un actor ajeno. | No representan toda la visita en campo ni sustituyen una evaluación con personas. |
| Altas | Siete grupos de integración cubrieron altas, ATM, otra imagen del mismo pago, multirol y máximo dos representantes; dos casos de navegador cargaron facturas artificiales. | No cubren todas las facturas ni formatos históricos. La factura eléctrica sigue siendo opcional. |
| Viajes, GPS y Monitor | Viajes simultáneos, relevo y posiciones en Monitor se comprobaron en navegador con GPS simulado. La duración sólo debe generar alertas por umbrales activos configurados por Ambiente. | No acredita sensores, suspensión o reconexión de Android físico, ni capacidad sostenida. |
| Chofer | En `f3307f3f` pasaron 16 casos dirigidos de incidente, entrega y relevo en web y app de navegador; además, 135 pruebas de interfaz/GPS y 55 de manual y resguardos. | El incidente no se ha demostrado idempotente cuando el servidor lo guarda pero la respuesta se pierde. |
| Comunicaciones | Se probaron campana, destinatarios y enlaces en recorridos concretos y correos renderizados sin enviarlos. | No se comprobó entrega real ni apertura desde un cliente de correo o un dispositivo físico para todas las variantes. |

La regresión integrada de 37 casos, 245 pruebas de interfaz, 32 de PDF y 55 de manual y resguardos pasó sobre `f3307f3f`. Es una repetición de la batería anterior, no se suma a ella como cobertura nueva. Las pruebas de navegador usan Chromium; «app» designa la ruta móvil del producto, no una instalación Android física.

## Pendientes antes de considerar el corte completo

1. **Seguridad del viaje y acciones inciertas.** Resolver y volver a probar las condiciones GPS C12–C15 y C18: hora de captura frente a recepción, colas en otros dispositivos o versiones, cierre forzado y análisis durable. Comprobar que una respuesta perdida al registrar un incidente no permita duplicarlo. Hasta entonces, el aviso de revisar el historial reduce la confusión pero no garantiza idempotencia.
2. **Compatibilidad y reversión.** Las tres aprobaciones son obligatorias también en origen, con transportista aprobador. Se ensayaron casos históricos artificiales: algunos registros anteriores no pueden iniciarse y una propuesta en origen sin transporte debe volver a crearse; los que ya iniciaron y sus documentos no se reescriben. No están cubiertos todos los formatos históricos. El efecto real se desconoce y la instrucción vigente prohíbe consultar datos reales, incluso agregados. Una reversión debe conservar la comprensión de las propuestas en origen de versión 2.
3. **Prueba con personas y Android.** Faltan dispositivo físico y participantes de cada rol. No se pueden declarar cumplidas las metas de comprensión, tiempo y finalización, ni validados GPS, enlaces, instalación y reconexión nativos.
4. **Cobertura restante.** Faltan pruebas amplias de formularios, enlaces, avisos y documentos, accesibilidad con tecnologías de asistencia, y capacidad sostenida bajo concurrencia. La recuperación local no sincroniza automáticamente otros dispositivos y algunas acciones dependen de Web Locks.
5. **Preparación de un futuro despliegue.** Identificar versión, preservar respaldo y reversión, probar la transición desde los service workers anteriores y verificar los procesos programados. Correo y push apagados no impiden que esos procesos creen avisos o modifiquen registros. La pausa preparada afecta sólo procesos nuevos configurados para ello; no detiene trabajos que ya estén corriendo.

## Resguardos y conservación

El ensayo usa PostgreSQL artificial y un contenedor remoto sin puertos publicados, con una CPU, 2 GiB, sin swap adicional y un trabajador. CAP se comprueba cerrado en la base artificial; correo y push están apagados y se auditan los intentos de envío. Las opciones activadas para probar los circuitos son sólo del preview.

Las copias cifradas del código, compilaciones y evidencia están en la Mac y SDTERA, junto con una base artificial restaurada y cotejada. Son una cadena de copias incrementales que requiere la copia anterior y su clave; no son un respaldo de producción ni ubicaciones geográficamente independientes. El trabajo local sin confirmar permanece fuera del candidato y de los bundles confirmados. En esta tanda no se consultaron datos reales ni se modificaron producción, `main`, workflows, migraciones o flags productivos.
