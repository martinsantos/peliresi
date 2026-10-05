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

### Resultado final QA78

Fuente probada exacta `2d62c9609eb2989bb10c51377dc7f1f906c091a9`,
[ejecución37308100305](https://github.com/martinsantos/peliresi/actions/runs/37308100305).
Los cambios documentales y las cuatro capturas añadidas posteriormente no
son una segunda ejecución de producto. La rama es `codex/sitrep-cloud-qa-20261002`.

| Grupo | Resultado medido |
| --- | --- |
| Unit backend, DB desconectada | 472PASS / 0FAIL / 0pending |
| Unit frontend | 967PASS / 0FAIL / 0pending |
| Compilaciones backend/web/app | 3PASS |
| Grupos HTTP reales | 54PASS / 0FAIL |
| Subscriber compilado/PostgreSQL | 2PASS / 0FAIL |
| Calendario de Monitor HTTP | 3PASS / 0FAIL |
| Permisos territoriales HTTP | 5PASS / 0FAIL |
| E2E focal completo de esta tanda | 21PASS / 3FAIL / 0flaky / 0skip |
| Nuevos recorridos de geometría/interacción | 3PASS / 0FAIL |
| Android/APK y paquete de promoción | No ejecutados |

El focal duró163790,504ms. Los tres fallos conservados corresponden al mismo
defecto territorial preexistente: transportista2 recibe por API el viaje global
`2026-990001`, pero «Agenda y viajes» lo oculta en las tres superficies.
No son fallos nuevos del símbolo ni una aprobación global de la aplicación.
El workflow completo terminó FAILURE y no generó paquete de promoción.
La suite completa de141E2E no se ha ejecutado sobre esta corrección; este
subconjunto de24 no la reemplaza.

### Verificación renderizada y visual

Entorno aislado `http://127.0.0.1:4177`, rutas `/centro-control`, `/reportes`
y sus equivalentes `/app/`, login real de cuenta sintética. Escritorio1440×900;
responsive yappweb360×800, con casos adicionales320×800 en ambas.
Playwright existente en GitHub, worker1/retries0; ninguna API de negocio
interceptada ni sesión ficticia. El prefijo `/app/` no equivale al APK instalado.

| Comprobación en los tres nuevos recorridos | Estado |
| --- | --- |
| Identidad SITREP y contenido significativo, no página vacía | PASS |
| Sin overlay de compilación ni desbordamiento horizontal final | PASS |
| Consola del recorrido, errores y warnings | 0 / 0 |
| Padding/centrado/color/glifo/espacio reservado | PASS |
| Etiquetas completas en una línea y contenido dentro del padding | PASS,320/360px incluidos |
| Activar/desactivar cuatro capas con respuesta HTTP real y tamaño estable | PASS |
| Teclado oculta/restaura un marcador real de transportista en Reportes | PASS |
| Revisión humana del agente de13PNG originales seleccionados | Realizada; filtros centrados y legibles |

Se midieron83marcosSVG entre las tres superficies y los diferentes estados;
no son83pantallas ni83íconos únicos. SVG14×14px, trazo blanco, fondo dentro
de la reserva en todos los casos. Desviación máxima de centro en cualquiera
de los ejes0,0000153px; padding de cuadros/círculo5px, mínimo en rombo
2,100496px. Son medidas del marcoSVG, no del contorno óptico de cada trazo.

La inspección de capturas corrigió dos problemas que un test anterior dejaba
pasar: invasión del padding por el texto y partición de palabras a320px.
Ahora360px conserva dos columnas y320px pasa a una. Aumenta la altura de la
botonera muy estrecha; las etiquetas permanecen completas y el scroll normal
del documento se conserva. Reportes y sus filas usan el mismo símbolo;
Monitor reutiliza marcadores compartidos, pero no esta botonera.

### Comando y evidencia

```sh
gh workflow run certification-tests.yml --repo martinsantos/peliresi \
  --ref codex/sitrep-cloud-qa-20261002 \
  -f unit=true -f android=false -f load_only=false \
  -f context_only=true -f alert_only=false
```

No repetir este comando por inercia: es el registro de la tanda terminada.
Crudos finales en el ZIP único externo `map-symbol-run78-final.zip`,
artifact11344648446,31.957.920bytes. No se descargaron el resumen adicional
de16,75MB, builds ni dependencias. Las cuatro capturas del informe son copias
byte por byte de las capturas nativas del navegador, sin edición de imagen.
El conjunto original seleccionado conserva13PNG y las tandas fallidas previas.

Closure12:22:44.026UTC detuvo runtime5745/server5746; cleanupPostgreSQL SUCCESS,
workflow COMPLETED. Proveedores externos deshabilitados; no envíos, datos
reales, despliegue, servicios o configuración de producción modificados.
No quedan procesos QA locales ni otra VM despachada por esta tarea.

## Límite de entrega

No se despliega en esta tanda. La publicación protegida sigue pendiente y los
fallos funcionales del informe territorial no se ocultan detrás del arreglo
visual. APK autenticado instalado por el usuario, hardware físico, Safari y las
superposiciones de etiquetas del Historial de Monitor no se certifican aquí.

Lección del incidente: comprobar legibilidad y existencia de glifos no verifica
su padding ni su huella rotada. Medir ambos en el navegador y revisar capturas.

## Capturas originales QA78

Escritorio, Centro de Control:

![Centro de Control escritorio](map-symbols-20261005/control-desktop.png)

Responsive360px, Centro de Control:

![Centro de Control responsive360px](map-symbols-20261005/control-responsive-360.png)

Appweb360px, Reportes:

![Reportes appweb360px](map-symbols-20261005/reports-app-360.png)

Appweb320px, etiquetas completas en una columna:

![Centro de Control appweb320px](map-symbols-20261005/control-app-320.png)
