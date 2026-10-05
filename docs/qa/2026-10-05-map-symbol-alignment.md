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

La primera captura del ajuste detectó que «Transportistas» invadía el padding
derecho, aunque el texto seguía dentro del botón y la comprobación antigua
aprobaba. En móvil se compactan el gap y padding horizontal usando tokens
existentes. El ajuste de 6 px no alcanzó: QA76 reprodujo invasión del padding
en las dos superficies móviles. La segunda iteración usa 4 px de gap/padding
horizontal. QA77 aprobó geometría/acciones, pero su captura de 320 px mostró
palabras partidas; no se aprueba ese resultado visual. La tercera iteración
elimina esa partición y usa columnas automáticas de mínimo 8,75rem, acotadas al
ancho disponible: dos cuando caben, una cuando no. Escritorio conserva el
flex existente, 8 px de gap y 10 px de padding. La altura adicional en
pantallas estrechas es un tradeoff explícito para preservar las etiquetas.
El control conserva su altura táctil y la caja del símbolo. El helper ahora
exige texto dentro del área de contenido descontando bordes y padding.

## Pruebas

- Cinco unit nuevas verifican decoración oculta a lectores de pantalla, color,
  separación fondo/ícono, rotación exclusiva del fondo y tamaño/glifo SVG.
- Las pruebas de consumidores siguen exigiendo los mismos colores, glifos,
  estados, roles y callbacks; sólo buscan el color en el nuevo elemento fondo.
- Un recorrido Playwright por cada superficie mide centro, padding transformado,
  espacio reservado, color, trazo, tamaño, legibilidad y estabilidad al alternar.
  El helper exige además etiquetas completas en una línea, sin palabras partidas.
  Recorre Centro de Control → las cuatro capas → Reportes → teclado para ocultar
  y restaurar un marcador real → fila de transportista.
- La caché legítima de React Query se respeta: se usa la acción real Actualizar
  ahora para exigir una respuesta HTTP actual con las capas seleccionadas.
- Tres superficies: escritorio 1440×900, responsive 360×800, `/app/` 360×800.
  Se añaden comprobaciones de contenido, símbolos y capturas a 320×800 en
  ambos recorridos móviles, restaurando después el tamaño de 360 px.
  Playwright existente, una VM GitHub, worker1/retries0. Browser plugin not available.
  Sin navegador, Docker, API, DB ni emulador Android locales.
- Los tres fallos territoriales transportista del informe anterior permanecen
  en el focal; no se excluyen, marcan esperados ni se resuelven mediante este CSS.
  El paquete completo exige ahora 141 E2E, no el subconjunto focal de 24.

## Resultados

Referencia74 / `37298970767`, fuente `30d968f` sin cambios de producto:
472BE/962FE unit, tres builds, 54HTTP, 2SQL, 3calendario y 5territorial PASS.
Focal18PASS/6FAIL/0flaky/0skip. Tres fallos territoriales preexistentes y tres
timeouts del montaje al esperar red para queries frescas; no tres bugs nuevos.
Trace original confirma centros exactos, SVG14px y padding3px/0,100508px.
No se alcanzaron las aserciones finales del nuevo recorrido. Capturas antes
conservadas; cleanupSUCCESS/cierre11:01:48.093UTC.

Iteración75 / `37300415275`, fuente `76bd89e`: 472BE/967FE unit, tres builds y
los mismos gruposHTTP/SQL PASS. Focal18PASS/6FAIL/0flaky/0skip. Las tres nuevas
fallas son un selector ambiguo entre la fila nativa y el marcador Leaflet con
el mismo nombre; se alcanzaron los filtros y la ocultación/restauración real
del marcador, pero no las aserciones finales. No presentarlas como tres bugs
de la app ni tres recorridos completos aprobados. Capturas Centro/Reportes
mostraron padding SVG mejorado y el problema móvil del texto descrito arriba.
CleanupSUCCESS/cierre11:10:29.312UTC.

Iteración76 / `37301878627`, fuente `87b227b`:472BE/967FE unit PASS,
tres builds PASS,54HTTP/2SQL/3calendario/5territorial PASS. Focal17PASS/7FAIL,
0flaky/0skip. El nuevo recorrido de escritorio completó mediciones: centros
dx≤0,000016px/dy0, padding5px/2,100497px, glyph14px y colores correctos,
fondo dentro de la reserva, sin errores ni warnings de consola. Cuatro fallos
son la misma invasión del padding de «Transportistas» móvil, tanto en el nuevo
recorrido como en la prueba contextual existente; los otros tres son T2.
No es aprobación móvil. Captura fresca y test estricto conservados antes de
la segunda corrección horizontal. ZIP final único39.520.931bytes en el disco
externo, sin descargar el resumen adicional. CleanupSUCCESS y cierre
11:25:36.197UTC detuvieron runtime5767/server5768.

Iteración77 / `37306298373`, fuente `f788e81`:472BE/967FE unit PASS,
tres builds PASS,54HTTP/2SQL/3calendario/5territorial PASS. Focal21PASS/3FAIL,
0flaky/0skip,163882ms. Los tres recorridos nuevos aprobaron; sólo fallan T2.
Geometría Control/Reportes/filas/320px: dx/dy≤0,000016px, SVG14px, padding5px
y mínimo2,100496px en rombo, colores y trazo correctos, fondo contenido.
Sin errores/warnings de consola en los tres recorridos. Las capturas360px
son legibles y centradas, pero320px parte cuatro etiquetas en dos líneas.
Se conserva esa evidencia; no es un GO visual aunque no recorte palabras.
ZIPfinal único32.211.904bytes,13PNG seleccionados, no websummary extra.
CleanupSUCCESS/cierre12:06:27.853UTC detuvo runtime5776/server5777.

Próxima validación: mismo focal con columnas adaptativas y exigencia de una
línea para las etiquetas de categoría a320/360px, sin rebajar umbrales.
Resultado final aún pendiente.

## Límite de entrega

No se despliega en esta tanda. La publicación protegida sigue pendiente y los
fallos funcionales del informe territorial no se ocultan detrás del arreglo
visual. APK autenticado instalado por el usuario, hardware físico, Safari y las
superposiciones de etiquetas del Historial de Monitor no se certifican aquí.

Lección del incidente: comprobar legibilidad y existencia de glifos no verifica
su padding ni su huella rotada. Medir ambos en el navegador y revisar capturas.
