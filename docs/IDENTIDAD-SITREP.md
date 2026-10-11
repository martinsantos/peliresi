# Identidad SITREP — candidato vectorial

Rediseño solicitado el 11/10/2026. No publicado ni aplicado a un APK distribuido.

## Marca del sistema

Monograma S como recorrido entre origen y destino, con extremos circulares.
Elimina la hoja anterior. Es una marca de producto, no un pictograma reglamentario
de peligrosidad, una habilitación ni una categoría de actor.

- Fuente única: `frontend/public/favicon.svg`, retícula 24×24, 411 bytes.
- Trazo blanco de 2,5 unidades, extremos y uniones redondos.
- Base verde institucional `#1B5E3C`, radio 5 sobre 24.
- Sin filtros, fuentes externas, imágenes embebidas ni scripts dentro del SVG.
- `scripts/qa/brand-assets.ts` genera las variantes SVG y los PNG 192/512.
  `--check` verifica que los derivados no se separen de la fuente vectorial.
- Se conservan rutas, tamaños y contratos del componente `SitrepMark` y de los
  manifiestos PWA. No se cambia la lógica de instalación, sesiones o borradores.

## Familia de categorías existente

| Identidad | Símbolo | Color | Contenedor |
|---|---|---|---|
| SITREP | S trazable | `#1B5E3C` | Cuadrado redondeado |
| Generador | Factory | `#7c3aed` | Cuadrado redondeado |
| Transporte | Truck | `#ea580c` | Rombo, símbolo sin girar |
| Operador | FlaskConical | `#2563eb` | Cuadrado redondeado |
| Inspección | ClipboardCheck | `#0f766e` | Cuadrado redondeado |

Los íconos de categorías mantienen sus formas y colores. La marca usa el mismo
lenguaje de contorno Lucide, retícula y trazo; no copia su significado. No se
debe sustituir Operador por un edificio ni girar el camión junto con su rombo.
El control de inspección conserva el símbolo que usan los inspectores; no se
introduce otra categoría ni permiso por una decisión gráfica.

## Encabezado de correos

Firma de Mendoza y DGFA en una fila blanca compacta; SITREP y su descripción
forman un bloque verde propio, con la nueva marca. El inicio de la firma, la
marca y el mensaje comparten el mismo eje de 24 px. El nombre SITREP es texto
real para que siga identificándose el remitente si se bloquean imágenes.
Tablas de presentación y estilos en línea; sin fuentes remotas, SVG en correo,
gradientes, badges de estado inventados ni navegación decorativa.

El logo del Gobierno de Mendoza no se modifica. Login azul y sistema verde
se conservan. Los correos usan el PNG derivado, no otro dibujo de la marca.

## Verificación

La prueba `frontend/cloud-qa/mail-e2e/brand.spec.tsx` comprueba el logo en el
login real y genera una lámina con los componentes reales de categoría, no
copias de sus SVG. Evalúa tamaños 16/24/32/44 px y escritorio/móvil/app.
Las 58 vistas de correo verifican imágenes cargadas, contraste declarado,
alineación común, ausencia de desborde y tamaño de acciones.

La aceptación estética corresponde al usuario. QA de navegador no equivale
a validar Gmail/Outlook, modo oscuro, imágenes bloqueadas ni un APK instalado.
