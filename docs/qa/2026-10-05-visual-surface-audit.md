# Auditoría renderizada de superficies e interacción — 05/10/2026

## Estado actual: en ejecución, sin aprobación global

El usuario pidió continuar la revisión y corregir los defectos verificables en
web de escritorio, web responsive y app web. No se retomaron automatizaciones,
agentes antiguos ni proyectos externos. Se conservan login azul, sistema verde,
marca, fuentes y dependencias compartidas mediante symlink.

La fuente `55d7abf1d457b4fbc72b980727c201d3dbd3f51e` está en la rama
`codex/sitrep-cloud-qa-20261002`. La ejecución completa
[QA85](https://github.com/martinsantos/peliresi/actions/runs/37336254527)
terminó FAILURE: **485 unit backend, 985 frontend y 160/162 E2E aprobados**,
sin skips ni retries. Las tres compilaciones, 54 controles HTTP, dos SQL,
tres de calendario y cinco de permisos territoriales aprobaron. El cierre de
procesos propios y PostgreSQL aprobó a las 16:17:57 UTC. Los 141 recorridos
funcionales anteriores aprobaron; los dos fallos pertenecen al nuevo inventario.
No es un despliegue ni una aprobación Android.

## Segunda tanda: contrastes compartidos y recuperación real

QA85 produjo 190 recibos con contenido, ninguno con tres o menos nodos de texto.
Se revisaron **nueve PNG originales**: operadores escritorio, Monitor app,
Controles inspección app/escritorio, Centro de Control responsive, alta generador
app, manifiestos app, certificación app y recuperación app en blanco. Esto NO
acredita 190 revisiones visuales ni todas las áreas fuera del primer viewport.

Se conservaron 177 candidatos de contraste, mayormente repetidos por un mismo
componente en roles y superficies. Defectos confirmados y cambios acotados:

| Before | After | Why |
| --- | --- | --- |
| `navigate('/recuperar'); return null` durante render | `<Navigate to="/recuperar" replace />` | La app sin token quedaba totalmente en blanco; navegación declarativa evita el callejón sin salida. |
| `bg-error-500 text-white` en contadores | `bg-error-700 text-white` | El texto medido daba 3,76:1; se cambia el consumidor compartido, no la paleta global. |
| `text-neutral-500` en título de rol teñido | `text-neutral-700` | Administrador daba 4,20:1 y Operador 4,48:1. |
| `text-red-600` sobre `bg-red-50`, LIVE/PDF | Color 700 | Texto normal medido en 4,41:1; conserva significado y funcionamiento. |
| `bg-emerald-600 text-white` en certificación | Fondo 700, hover 800, foco visible | 3,77:1 en acción y filtro seleccionado; no cambia blockchain ni su criterio legal. |
| Filtros de certificación sin envoltura | `flex-wrap`, controles de 44px, `aria-pressed` | El último filtro estaba cortado en el PNG app; la selección también debe ser semántica. |
| Viaje `text-success-600` y pendiente `text-warning-600` sobre tintes | Colores 700 | Lecturas reales 3,58:1 y 3,07:1; no se altera estado, cantidad ni destino. |
| Operador `FlaskConical` verde en administración | Mismo glifo azul canónico en título/total/tabla/tarjeta | Categoría no se confunde con el estado éxito, que sigue verde. |

Primero fallaron ocho contratos nuevos de contraste, uno de identidad, dos
de recuperación y cuatro operativos. Tras corregir, las dos ejecuciones focales
aprobaron **44 y 9 pruebas** respectivamente, un worker/heap256MB, mocks sin DB
ni proveedores externos. Un mock inicial recreaba los datos y fue detenido
por PID propio antes de corregir su estabilidad: no se cambia producto para
favorecerlo. Las clases unit no certifican contraste CSS; falta el siguiente
gate renderizado de la misma fuente. No se hicieron builds locales.

Los otros fallos del montaje se distinguen de producto: selector escogía un
título oculto en responsive; `#expediente` no era un apartado real y capturaba
Visita. Ahora se exige estructura visible y se descubren/clican los href reales,
incluido `#revision`. La inspección espontánea no tiene Datos declarados. Las
capturas anteriores con hash incorrecto NO cuentan como esos apartados revisados.

El gate nuevo falla ante contraste insuficiente en texto habilitado cuya
composición pueda medirse, conserva los gradientes/imágenes no resueltos como
pendientes y verifica explícitamente `/reset-password` → `/recuperar` con
formulario real. No baja umbrales ni elimina candidatos para pasar.

Próximo: una ejecución completa cloud serial con unit, HTTP, E2E y Android OS;
revisar sus PNG/recibos, corregir nuevos fallos y después popups móviles de
Monitor, títulos truncados, estados/modal/scroll/tab de Reportes pendientes.
Android OS autenticado QA y APK original anónimo son alcances distintos;
teléfono físico/APK del usuario/ruido/batería/segundo plano siguen pendientes.

## Fallos reproducidos y correcciones de esta tanda

| Caso | Reproducción anterior | Cambio candidato | Validación actual |
| --- | --- | --- | --- |
| Agenda global oculta viajes al transportista | QA83 y QA84: mismo fallo en tres superficies; unit nuevo rojo | Elimina filtro por nombre de empresa; mantiene búsqueda y permisos privados | QA85 aprobó en tres superficies |
| Viaje seleccionable enlaza a expediente ajeno | Unit rojo para permiso falso y ausente | Backend reutiliza permiso existente y devuelve `canViewDetail`; selección y cierre siguen disponibles sin destino prohibido | Unit, HTTP territorial y E2E QA85 aprobados |
| Pendientes globales de Monitor llevan a acceso denegado | Dos unit rojos | Separa consulta operativa de navegación privada; no amplía permisos de lectura ni escritura | Unit y E2E QA85 aprobados |
| Fichas T/O cambian icono y color respecto al mapa | Dos unit rojos | Símbolo compartido, color canónico y fondo independiente del glifo | Unit y tres recorridos reales QA85 aprobados |
| Historial de Monitor crea etiquetas competidoras | Dos unit rojos y captura anterior QA82 | Un marcador seleccionable por viaje; detalle bajo demanda; eventos mantienen círculo y detalle en el control/feed | Unit y recorrido 30 días QA85 aprobados; popup live móvil pendiente |
| Animaciones del mapa sobreviven a la salida | Unit nuevo exige cancelación | Cancela frames propios al reiniciar y desmontar | Focal unit aprobado |

Los cinco archivos focalizados aprobaron **32 pruebas**, con un worker y heap
máximo de 256 MB; los procesos locales terminaron. Las pruebas unitarias usan
dobles de dependencias y no certifican CSS renderizado. No se instaló Vitest en
el backend local: esa suite se ejecuta en nube con DB desconectada.

## Defecto del montaje visual descubierto y conservado

QA84, fuente `d918bcb1b9ff04c885db90de0219b2e06ae6685a`, terminó FAILURE:
472 unit backend y 975 frontend aprobados; 42 E2E aprobados y tres fallos T2.
No hubo skips ni retries que ocultaran esos fallos. El cierre de PostgreSQL y
procesos propios quedó aprobado antes de lanzar QA85.

El inventario produjo 204 recibos, pero **188 sólo midieron pantalla vacía o
carga inicial**. Se inspeccionaron seis originales de app que confirmaron ese
defecto. No se cuentan como pantallas revisadas ni como aprobación visual.
Los controles de negocio aprobados siguen siendo sus controles concretos; no
se invalida ni se exagera su alcance.

Se endureció el montaje para esperar estructura real dentro de `#root`,
ausencia de carga/spinner visible, consultas ocupadas terminadas y fuentes
listas. Se reduce sólo la resolución del PNG a píxeles CSS, no el viewport,
las condiciones del navegador ni los umbrales. No hay interceptación de APIs
de negocio, respuestas fabricadas ni sesiones inyectadas.

Los recibos válidos anteriores detectaron dos candidatos de contraste:
contador de avisos blanco sobre rojo, **3,76:1**, y texto Administrador sobre
verde claro, **4,20:1**. Se escribieron primero cinco expectativas nuevas y
fallaron, con cinco pruebas previas aprobadas. Se conservaron sin corregir el
producto durante la ejecución congelada QA85; integran el siguiente lote.

## Cómo se decide la aprobación

- Unit backend/frontend, HTTP con PostgreSQL sintético, E2E con clicks reales,
  contraste renderizado, inspección de PNG y Android son capas diferentes.
- Cada recibo identifica ruta, rol, viewport, estado, fuente y ámbito capturado.
  Primer viewport no acredita áreas fuera de pantalla, modales ni todos los
  estados del formulario.
- Imágenes, gradientes y composiciones no resueltas quedan **no medidas**, no
  aprobadas. Se revisan aparte; los candidatos no equivalen automáticamente a
  defectos confirmados sin comprobar su composición visible.
- Las rutas registradas y los casos no capturados permanecen en el inventario.
  No se excluyen archivos ni se cambia un denominador para declarar 100%.
- Android físico, APK exacto del usuario, ruido, batería y GPS/cámara reales no
  se certifican desde una vista responsive.

## Aislamiento y recursos

Una VM GitHub y un worker de navegador; base exclusivamente
`sitrep_night_qa_20260926` en `127.0.0.1:55440`. Correos, push y blockchain
externos deshabilitados en QA. Sin navegador, Docker, Postgres, API, build ni
emulador locales nuevos. Sólo se descargó el ZIP final de QA84, no un resumen
duplicado ni dependencias. No hubo envíos ni escrituras de datos reales.

No se ejecutó el publicador protegido ni un sustituto para eludir su bloqueo.
Commit/push no equivalen a producción. El cierre exige resultados y capturas
del mismo candidato; todavía no se afirma GO, 100% ni perfección.
