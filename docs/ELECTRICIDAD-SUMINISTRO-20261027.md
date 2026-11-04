# Facturas eléctricas: identificación de EDESTE

Revisión de 27/10/2026, sólo preview. Complementa la cobertura de cantidades y unidades de UX128; no certifica todos los formatos históricos ni escaneos.

## Fuente y límite

- [EDESTE: preguntas frecuentes, «Cómo identifico mi suministro»](https://www.edeste.com.ar/preguntasfrecuentes.php): identifica el suministro mediante Ruta y Folio, en el frente de la factura.
- [EPRE: presentación de la factura única, 03/06/2019](https://epremendoza.gob.ar/el-epre-aplico-multas-millonarias-a-empresas-de-servicio-electrico/): distingue NIC para EDEMSA, número de usuario para Godoy Cruz y Ruta–Folio para EDESTE. Es una referencia histórica de identificación, no una validación de tarifas actuales.

El enlace al modelo PDF desde la noticia del EPRE devuelve 404. La página de muestra de Argentina.gob.ar no pudo recuperarse. No se atribuye evidencia visual a esos archivos ni se utilizan facturas personales encontradas en buscadores. Los ejemplos utilizados para probar el producto son artificiales y están identificados como tales.

## Comportamiento implementado

El lector reconoce pares explícitos en una misma línea, con las dos etiquetas Ruta/Folio o Ruta y Folio separadas. Conserva ceros iniciales y ambos componentes; no los concatena en un número indistinguible del de factura. Sólo aplica esta interpretación cuando EDESTE es la única distribuidora identificada.

Los pares distintos generan conflicto y no se elige uno automáticamente. Un par repetido conserva las evidencias sin generar falso conflicto. No se juntan números de líneas o páginas separadas, ni se usa una ruta aislada, un folio aislado o un número de factura para completar lo que falta. El formulario muestra dónde revisar el dato faltante en el original.

Los documentos y lecturas históricas no se reescriben. La nueva lectura se aplica al analizar o releer. No cambia categoría tarifaria, consumo, potencia, HP, TEF, pago ATM ni aprobación del alta. Las tablas o imágenes que no permitan identificar ambos componentes siguen requiriendo revisión manual. Hace falta ampliar el corpus de muestras autorizadas y representativas para afirmar cobertura de formatos reales.
