# SITREP · balance de cierre de la revisión

**Estado: avance técnico verificable en preview; aceptación integral y publicación pendientes.** El producto ensayado es `67f330a711e5d12b268897d22366b428cf44b44f`, descendiente de `df3e5f97`. No se consultaron datos reales ni se publicó esta versión. El registro detallado, las reproducciones anteriores y los límites de cada corrección están en [REFACTOR-UX-20261025.md](REFACTOR-UX-20261025.md).

## Qué se comprobó en el corte actual

La regresión usó datos artificiales, el producto real compilado para web y la ruta app, PostgreSQL privado y Chromium con un trabajador, una CPU, 2 GiB y sin swap adicional. CAP permaneció cerrado y correo/push apagados; se verificaron cero intentos y envíos de correo. Las opciones operativas necesarias se activaron únicamente en los procesos y compilaciones aislados de QA.

| Recorrido | Evidencia actual | Alcance |
|---|---|---|
| Manifiesto ordinario | Seis recorridos completos: cada uno de los tres roles inició en web y en app; aprobaron las tres partes; hubo coordinación, retiro, entrega, recepción, pesaje, adenda observada, rectificación aprobada, tratamiento y certificados. La auditoría cotejó los seis PDF y cantidades con la base artificial. | No abarca todos los estados, errores o registros históricos. |
| Tratamiento en origen | Seis recorridos desde los tres roles en web/app confirmaron las tres aprobaciones sin viaje ni GPS. Dos continuaron hasta el certificado y abrieron enlaces de correo renderizado tras iniciar sesión. | Los correos se renderizaron sin envío; no se verificó apertura nativa de Android. |
| Inspecciones | Seis intercambios desde un expediente artificial ya notificado: requerimiento, descargo, nueva solicitud, subsanación y cierre. La auditoría cotejó adjuntos, destinatarios y denegación de acceso ajeno. | No cubre la visita completa en campo ni a personas reales. |
| Viajes y Monitor | Dos casos de GPS simulado con tres cargas, una entrega y un relevo; otros dos comprobaron la posición recibida en Monitor. | No acredita el sensor real, suspensión prolongada ni todas las colas entre dispositivos. |
| Altas y representantes | 141 solicitudes de integración comprobaron altas, revisión ATM, otra foto del mismo pago, multirol y máximo dos personas. Dos pruebas de navegador cargaron facturas eléctricas artificiales y conservaron la potencia declarada. | Son casos sintéticos, no todos los formularios ni formatos históricos de facturas de Mendoza. |
| Accesibilidad y documentos | Pasaron nueve pruebas de navegador de foco, formularios, campana y navegación ampliada; dos descargas de un acta larga verificaron sus páginas. Pasaron 175 pruebas dirigidas de interfaz, 32 de PDF y 29 del manual. | No son un barrido completo de todas las pantallas, lectores de pantalla o tecnologías de asistencia. |

En total son **37 pruebas de navegador** distribuidas entre esos grupos. Algunas etapas y datos se repiten; no representan 37 personas ni 37 flujos independientes. Las pruebas unitarias y del manual se repitieron sobre la misma fuente y no se suman a ejecuciones anteriores. El archivo del manual servido coincidió con su fuente por SHA-256.

La comparación cotejó 2.162 archivos versionados de producto y QA; no hubo diferencias de producto. Cuatro diferencias correspondían al arnés de QA, entre ellas la selección explícita del backend aislado; un arnés GPS anterior distinto no se ejecutó en esta corrida. El backend se compiló desde una lista explícita de archivos comprometidos y se comprobó que no incorporara el trabajo GPS local no validado. Las compilaciones web/app usaron la misma fuente del commit y las opciones necesarias para este ensayo.

El primer intento se detuvo porque la compilación visual reutilizada no tenía activadas las propuestas operativas, aunque el backend de prueba sí. Se conservó la traza y se recompilaron ambas superficies con las opciones de QA correspondientes; las pruebas anteriores son el resultado de la repetición. Esto demuestra que las opciones de compilación y de servidor deben cotejarse en cualquier corte futuro; no acredita cómo está configurada producción.

## Qué impide declarar terminado el objetivo

1. **Aprobaciones anteriores.** No se conoce el impacto de exigir tres decisiones sobre los manifiestos existentes. El usuario indicó no consultar datos reales, ni siquiera agregados; la auditoría preparada queda restringida al preview artificial.
2. **GPS y alertas.** Siguen abiertas las condiciones C12–C15 y C18: colas de otros dispositivos o versiones, cierres forzados, hora de captura frente a recepción, unidad histórica de velocidad, análisis durable y desconexiones intermitentes no atribuidas. La corrección local del detector por tramo de UX220 está preservada, pero no se integró ni validó.
3. **Validación humana y Android.** No hay teléfono disponible ni participantes para la ronda de tres personas por rol. No se pueden declarar satisfechas las metas de comprensión, tiempo o finalización, ni la prueba física de GPS, enlaces y reconexión.
4. **Otros controles.** Persisten el contraste de TEF con la autoridad, muestras autorizadas de facturas, revisión más amplia de avisos/documentos y la medición de capacidad sostenida. Las pruebas sintéticas de concurrencia anteriores no demuestran capacidad del entorno de destino.
5. **Publicación.** Requiere una etapa separada con versión identificada, respaldo y reversión adecuados y smoke no mutante. El ensayo de reversión parcial no cubre todos los flujos; un respaldo del preview no es respaldo de producción. No se activaron correos ni push.

Las evidencias y la base artificial se preservan cifradas en la Mac y SDTERA. Debe conservarse la copia completa `copia-cc9206cb`, sus incrementos y la clave de recuperación separada; `copia-2d41d06f` conserva además el GPS local no validado. Esas ubicaciones no son geográficamente independientes.
