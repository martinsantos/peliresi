# Fichas y edición de actores — preview, 24/10/2026

## Alcance

Revisión administrativa de Generadores, Transportistas y Operadores: ficha, pestañas, edición, validación, borradores y regreso al padrón en web y app. Continuación de `59cecd11`, posterior al producto publicado `8fb6277e`.

Esta tanda **no está publicada**. No cambia permisos, cuentas reales, main, workflows, esquema de base de datos ni configuración productiva. Android físico y el cierre del proceso de una PWA instalada siguen pendientes; las pruebas móviles utilizan la app en Chrome.

## Correcciones

- La pestaña de la ficha queda en su URL. Editar, cancelar y guardar regresan a esa ficha; el regreso posterior conserva los filtros del listado. Los destinos se validan para impedir saltar a otra ficha o fuera de la app. Al salir de un formulario largo, la ficha comienza arriba.
- Una ficha que no carga ofrece Reintentar y Volver al listado en vez de quedar vacía.
- Abrir la edición sin cambiar datos ya no genera un borrador automáticamente. Se distingue “Borrador guardado en SITREP · cambios sin aplicar” del guardado efectivo de la ficha. Guardar espera la comprobación inicial de sesión y borrador.
- El CUIT de una ficha existente se muestra sin edición, acorde con el contrato del servidor. Las validaciones se reinician al cambiar de ficha. Un error al guardar Transporte permanece visible y conserva el formulario.
- Vaciar campos opcionales envía una eliminación explícita; no se pierde por convertir el vacío en `undefined`. Las coordenadas vacías se guardan como `null`, y las inválidas se rechazan.
- Los datos guardados prevalecen sobre el enriquecimiento histórico. Los campos vaciados no reaparecen desde esa importación.
- Corrientes como `Y8/Y9` y `Y8;Y9` se separan correctamente. Recuperar borradores antiguos que guardaban una cadena combinada conserva ambas corrientes. Este defecto se reprodujo en navegador antes de corregirlo.
- El acceso a la flota vuelve a Flota y Conductores. El catálogo de tratamientos mantiene el prefijo de la app.

## Verificación y evidencias

Evidencias locales de este hilo: `fichas-edicion-20261024`, bajo el directorio de visualizaciones del 17/10/2026. Se conservan JSON, logs de compilación, capturas y fuentes auxiliares de QA; no contienen credenciales reales.

- 245 pruebas frontend dirigidas, 15 archivos: continuidad, borradores y adjuntos, aislamiento por cuenta/ficha, conflicto de revisión, validación, doble clic, permisos de consulta, identidad, menús y parser de corrientes. No son una validación de todo el producto.
- TypeScript y builds web/app en el contenedor remoto limitado a 1 CPU, 2 GiB y swap 0, un worker.
- 21 comprobaciones HTTP sobre tres actores artificiales: editar, volver a leer, vaciar, rechazar coordenadas inválidas y restaurar los registros utilizados. Backend sin modificaciones en esta tanda.
- Recorridos reales de navegador: Generador, Transportista y Operador en web y app. Se revisan errores junto a campos, ficha/pestaña/listado, cierre de pestaña, reapertura, recuperación, guardado y lectura posterior. Captura adicional de la app a 320 px.
- 61 observaciones de navegador registradas, no 61 E2E independientes; cero errores de consola en los recorridos finales. La última repetición de la app, tras aceptar su actualización, utilizó `main-C1Zra5K7.js`. El borrador de Operador 21 no aparece al editar Operador 22.
- Lectura final de la base artificial: actividad y teléfono del Generador 21 conservados, localidad de Transporte 21 conservada, certificado del Operador 21 conservado; ambas corrientes Y8/Y9 presentes en Generador y Operador.

La evidencia inicial conserva fallos que motivaron las correcciones y resultados inconclusos de automatización: una selección de pestaña todavía no aplicada y la ocultación de valores telefónicos por la herramienta. La recuperación se volvió a comprobar con marcadores sintéticos no sensibles y lectura del registro de QA.

## Seguridad del ensayo

Sólo datos sintéticos `qa-directory-20261024-*` y cuentas `@night-qa.invalid` en el esquema aislado del preview. Sin nuevos manifiestos. CAP cerrado, correo y push apagados; credenciales SMTP y VAPID vacías. La auditoría final y las lecturas de registros se guardan en `audit.json` y `browser-saved-records.json`.

Auditoría final: **515 manifiestos sin cambios, cero correos enviados y cero intentos**, configuración verificada en los dos procesos del preview a las 21:20:11 de Mendoza. Sin conexión a producción durante esta tanda. Preview disponible mediante túnel privado en `http://127.0.0.1:4177/` y `/app/`; backend en loopback, sin publicación pública. Los servicios de QA quedan activos para revisión y consumen los límites indicados; no iniciar otro contenedor ni duplicar dependencias.

## Manual y límites

Guía **Padrones administrativos** ampliada con consulta, edición, regreso, validaciones y recuperación. La continuidad de los filtros se verifica dentro del recorrido de navegación; una pestaña nueva abierta directamente en la edición vuelve a la ficha por defecto, sin reconstruir un listado de origen inexistente.

No se modificaron alta pública, trámites ATM/OCR, TEF, habilitaciones ni permisos. Estas pruebas no reemplazan una revisión integral de esos circuitos ni pruebas con Android físico.
