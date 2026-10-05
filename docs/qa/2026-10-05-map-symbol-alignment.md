# Alineación de referencias accionables del mapa

## Alcance y contrato

Corrección solicitada por el usuario del centrado y padding de Generadores,
Transportistas, Operadores y En Tránsito. Se incluye Inspecciones, que usa el
mismo componente, y los consumidores de `MapCategorySymbol` en filtros y filas
de Reportes. No es una revisión visual certificada de todas las pantallas.

Se conservan Lucide, los colores `ACTOR_COLORS`, las formas de cada categoría,
los nombres accesibles, `aria-pressed`, los contadores reales —incluido cero— y
las acciones existentes. Login azul, sistema verde y marca sin cambios.
Backend, permisos, capas Leaflet y fuentes de datos no se modifican.

## Causa y corrección acotada

Antes, el símbolo tenía fondo de 20 px y SVG de 14 px. El fondo transportista
rotaba 45° con el SVG contrarrotado: la caja de flujo no reservaba la huella
visual del rombo. El margen del marco SVG en los ejes locales del rombo era
`10 - 7 × √2 ≈ 0,10 px`; en las otras categorías era 3 px.

Ahora, una caja de 36 px reserva la huella del fondo de 24 px, incluido el
rombo de aproximadamente 33,94 px. Fondo e ícono ocupan el mismo centro de una
grilla; sólo el fondo rota. El marco SVG mantiene 14 px, con 5 px de margen en
cuadros/círculo y aproximadamente 2,10 px en los ejes del rombo. Son medidas
del marco del SVG, no una afirmación de padding óptico de cada trazo.

El apilamiento queda aislado dentro del símbolo: el SVG se pinta delante de su
fondo sin elevarse sobre mapas, menús o paneles. No se añaden efectos, timers,
peticiones ni dependencias. El riesgo de ensanchar controles y filas exige
verificación renderizada de los textos largos en móvil.

## Pruebas

- Cinco unit nuevas verifican decoración oculta a lectores de pantalla, color,
  separación fondo/ícono, rotación exclusiva del fondo y tamaño/glifo SVG.
- Las pruebas de consumidores siguen exigiendo los mismos colores, glifos,
  estados, roles y callbacks; sólo buscan el color en el nuevo elemento fondo.
- Un recorrido Playwright por cada superficie mide centro, padding transformado,
  espacio reservado, color, trazo, tamaño, legibilidad y estabilidad al alternar.
  Recorre Centro de Control → las cuatro capas → Reportes → teclado para ocultar
  y restaurar un marcador real → fila de transportista.
- La caché legítima de React Query se respeta: se usa la acción real Actualizar
  ahora para exigir una respuesta HTTP actual con las capas seleccionadas.
- Tres superficies: escritorio 1440×900, responsive 360×800, `/app/` 360×800.
  Playwright existente, una VM GitHub, worker1/retries0. Browser plugin not available.
  Sin navegador, Docker, API, DB ni emulador Android locales.
- Los tres fallos territoriales transportista del informe anterior permanecen
  en el focal; no se excluyen, marcan esperados ni se resuelven mediante este CSS.
  El paquete completo exige ahora 141 E2E, no el subconjunto focal de 24.

## Resultados

Pendientes de recibos de la VM y revisión de las capturas originales.
El primer run de referencia es 74 / `37298970767`, fuente `30d968f` sin cambios
de producto. No publicar cifras aprobadas, GO o despliegue desde este borrador.

## Límite de entrega

No se despliega en esta tanda. La publicación protegida sigue pendiente y los
fallos funcionales del informe territorial no se ocultan detrás del arreglo
visual. APK autenticado instalado por el usuario, hardware físico, Safari y las
superposiciones de etiquetas del Historial de Monitor no se certifican aquí.

Lección del incidente: comprobar legibilidad y existencia de glifos no verifica
su padding ni su huella rotada. Medir ambos en el navegador y revisar capturas.
