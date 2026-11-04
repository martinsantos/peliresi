# Identidad SITREP — contrato visual vigente

Actualizado el 23/10/2026. Esta revisión está en **preview**, pendiente de publicación. [Resultados y muestras](PRODUCTO-IDENTIDAD-AYUDA-20261023.md).

## Marca

**SITREP y su flecha circular usan el mismo verde `#1B5E3C`.** Tres segmentos iguales, sin monograma S, hoja ni recuadro verde. La marca se presenta sobre blanco o un fondo claro que conserve el contraste. Los colores de estados y actores expresan su función; no cambian el color de la marca.

- Vector aprobado: `frontend/public/mail-sitrep-rotonda.svg`.
- Isotipo sin fondo para interfaz: `frontend/public/sitrep-mark-green.svg`.
- Componentes: `SitrepMark` y `SitrepWordmark`. El nombre no hereda el color del rol, de Mendoza ni de un tema de interfaz.
- Favicon y copia portátil del manual: `favicon.svg` y `docs/manual/sitrep-mark.svg`. Usan la misma geometría verde sobre blanco.
- Íconos de instalación: PNG 192 y 512. La variante **maskable** tiene margen propio para mantener la flecha dentro del círculo seguro; no se usa el PNG normal como adaptativo.
- `scripts/qa/brand-assets.ts --check` comprueba derivados y zona segura. `mail-brand-assets.ts --check` comprueba el PNG del correo. La generación se hace en preview.
- El arranque de la PWA usa fondo blanco y tema verde. No se cambian los IDs, alcances ni accesos directos de la aplicación.

Los activos oficiales de Mendoza mantienen su dibujo y colores originales. El panel azul del acceso pertenece a la identidad gubernamental. El nombre SITREP se conserva verde también en ese acceso. El logo gubernamental secundario blanco se utiliza exclusivamente donde corresponde a un fondo oscuro.

## Correo y PDF

La cabecera usa **dos mitades equilibradas** sobre blanco:

| Mitad izquierda | Mitad derecha |
|---|---|
| Marca horizontal de Mendoza y Dirección General de Fiscalización Ambiental | Flecha, palabra SITREP y Sistema de Trazabilidad de Residuos Peligrosos |

El nombre y el isotipo comparten color. No se traslada SITREP al extremo izquierdo ni se agranda una marca para llenar espacio. La separación respeta la proporción de cada activo. Una línea azul/verde cierra la cabecera; el título del documento aparece una sola vez debajo.

En el correo, la composición toma una base de 600 px, márgenes internos de 12 px, marca Mendoza 100 × 32 px, flecha de 22 px y nombre de 20 px. Las referencias son de 12/15 px. En pantallas angostas se conservan ambas marcas y se retiran sólo las referencias secundarias. El nombre SITREP es texto real, incluso si se bloquean las imágenes.

PDFKit y los reportes jsPDF conservan esas proporciones al ancho imprimible. Los documentos extensos repiten su cabecera y reservan cuerpo y pie. Las referencias del PDF conservan un orden de lectura semántico. Los títulos, datos, firmas, QR, estados y leyendas propios de cada documento no se sustituyen por elementos decorativos.

**Los documentos firmados existentes mantienen sus bytes y hash originales.** La identidad nueva no reemite certificados ni reescribe antecedentes. CAP continúa cerrado; ningún cambio visual habilita sus cuentas o emisiones.

## Interfaz y manual

- Cabeceras blancas y marca verde en escritorio, app, menú, bienvenida, C3, inspecciones, acceso y recuperación.
- Formularios, alertas, próximos pasos y permisos siguen dependiendo del contexto y del rol. Una decisión visual no altera reglas de negocio.
- `LoadingIndicator` usa la flecha verde; en botones el indicador conserva el contraste de la acción. La animación respeta la preferencia de movimiento reducido.
- El manual y su directorio usan la misma marca, favicon y cabecera clara; se mantienen los recorridos y el renderer.
- La pantalla sin conexión ofrece reintento y explica cómo comprobar el guardado. No promete sincronización universal ni recarga indefinidamente.

## Verificación y límites

La revisión usa capturas reales del preview, plantillas reales renderizadas sin envíos y PDF con datos artificiales. Incluye controles de color computado, texto completo, desbordes, imágenes cargadas, cabeceras, navegación y archivos de instalación. La cobertura y los fallos corregidos se detallan en el informe enlazado al inicio.

No equivale a certificar Android físico, un APK instalado, entrega externa en Gmail/Outlook ni comportamiento de todos los clientes de correo. Esos controles requieren sus entornos. No se habilitan correos, push ni CAP para verificar la identidad.

Las exploraciones anteriores (incluido el monograma S rechazado) permanecen en el historial Git; no son alternativas vigentes ni deben regenerarse.
