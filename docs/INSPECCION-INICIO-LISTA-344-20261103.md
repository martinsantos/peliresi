# Inspecciones — Inicio por rol y lista con una sola acción (344 px) · 03/11/2026

Estado: **preview con datos artificiales. No publicado, sin merge a main, sin workflows.**
Continúa los puntos 2 y 3 de «Qué haría a continuación» del [registro de simplificación del formulario](INSPECCION-SIMPLIFICACION-344-20261103.md).

Pedido: dos pantallas de la app para quien inspecciona con un teléfono de 344 px, sin quitar funciones.
1. **Inicio** (`/app/dashboard`): dejaba de mostrar «Resumen de manifiestos» con cuatro ceros a un inspector que no tiene manifiestos.
2. **Lista de Inspecciones** (`/app/inspecciones`): una sola acción principal; el resto en un menú; «Continuar apertura» integrado a la tarjeta del expediente y no en un cartel aparte; pestañas y filtros se conservan.

## Qué se midió (344 × 760, app, cuenta artificial `inspector01`, parte superior sin desplazar)

Script: [measure-344.mjs](evidence/inspection-inicio-lista-344-20261103/measure-344.mjs) (Playwright con el Chromium propio de la Mac contra el túnel del laboratorio; la cuenta y la contraseña van por variables de entorno). Resultados en [measurements-344.json](evidence/inspection-inicio-lista-344-20261103/measurements-344.json); capturas de pantalla y de página completa en [capturas/](evidence/inspection-inicio-lista-344-20261103/capturas/).

Métricas: `firstItemTop` = borde superior de la primera tarjeta de inspección; `firstActionTop` = primer botón o enlace tocable del contenido (sin la barra de la app); `buttons` = botones, enlaces y desplegables visibles en el contenido; `paragraphs` = párrafos visibles; `contentHeight` = alto total desplazable.

| Pantalla | Primera tarjeta | Primera acción | Botones y enlaces | Alto total |
|---|---|---|---|---|
| Inicio | — → **236** | 198 → 140 | 7 → **3** | 577 → 577 |
| Lista | 579 → **411** | 139 → 138 | 21 → **19** | 1362 → 1194 |
| Lista con una apertura guardada en el dispositivo | 719 → **411** | 139 → 138 | 22 → **19** | 1502 → 1194 |

Antes → después, sobre `2de5425a` y este cambio. En Inicio «antes» no había ninguna tarjeta de inspección: los siete botones eran dos accesos (Inspecciones, Solicitudes), las cuatro cifras de manifiestos y el desplegable de conexión. En la lista, los 19 botones que quedan son la acción principal, el menú, las tres pestañas, las cinco etapas, Filtros, los enlaces de las tres tarjetas y la paginación.

## Qué cambió

**Inicio** (`frontend/src-v6/pages/mobile/MobileDashboardPage.tsx`, nuevo `InspectorHome.tsx`)
- `MobileDashboardPage` decide por rol: con `esInspector` o `esJefeInspecciones` muestra `InspectorHome`; cualquier otro rol conserva el panel de manifiestos tal cual (sin cambios en transportista, operador, generador ni administración). Un administrador sin perfil inspector sigue viendo manifiestos.
- `InspectorHome`: título «Hoy», un solo acceso («Inspecciones») y la lista de inspecciones **en campo o programadas**, reutilizando la consulta del listado (`useInspections` con `estados: ['EN_CAMPO', 'PLANIFICADA']`). Cada tarjeta muestra número, estado, establecimiento, desde cuándo está en campo o para cuándo está programada, la ubicación y, si hay un punto de reanudación guardado, «Retomá en …»; el enlace abre el expediente en ese punto. En campo primero, después las programadas por fecha.
- La jefatura ve el trabajo de todo el equipo; el inspector sólo lo suyo. La cuenta de práctica es `ADMIN` con `esInspector`, así que el servidor le devuelve todas las inspecciones y el filtro por inspector asignado se hace en pantalla.
- Nada de manifiestos para este rol: la consulta de estadísticas (`useDashboardStats`, que refrescaba cada 30 s) ya no se ejecuta en su Inicio. Sin conexión se muestran las copias del dispositivo con aviso; una consulta fallida se informa como error con «Reintentar», nunca como un día vacío.

**Lista** (`frontend/src-v6/pages/inspecciones/InspeccionesPageV2.tsx`)
- Una acción principal, «Nueva», a todo el ancho en teléfonos. Al lado, un botón «Más acciones» (menú `DropdownMenu` ya existente) con: Denuncia / hallazgo, Exportar listado, Cómo funciona PSIP y, para administración con el modelo de campo habilitado, Administración de inspectores (se abre en un modal; `InspectionManagementPanel` ganó la opción `embedded` para renderizar sin su propio desplegable).
- Se retiraron las copias de Exportar y «Cómo funciona PSIP» que estaban dentro de Filtros (teléfono) y en la fila de etapas (pantalla ancha): una sola entrada para cada función, en el menú.
- **Apertura guardada en el dispositivo.** `InspectionOpening` ya no dibuja el cartel «Hay una apertura guardada… Continuar apertura» (`banner={false}`) y avisa su estado al padre (`onStateChange`). Con un borrador o un envío sin confirmar, la acción principal pasa a decir «Continuar apertura»: es la misma acción (al abrir el formulario se restaura lo guardado), así que no hay dos puertas. Cuando la apertura ya está confirmada, la nota «Apertura confirmada en este dispositivo · Continuar apertura» aparece dentro de la tarjeta de ese expediente y «Nueva» vuelve a decir «Nueva». Un error de lectura de la copia local se sigue mostrando como alerta.
- Se retiró la tarjeta separada «En campo · Continuar mi inspección en campo»: la misma tarjeta del expediente ya trae «Retomar: …» y su enlace abre en ese punto. Nada se pierde; desaparece una puerta duplicada.
- Pestañas Expedientes / Agenda / Antecedentes, etapas PSIP, buscador, filtros, exportación, paginación y aviso sin conexión: sin cambios de función.

**No se tocó:** el formulario de inspección ni sus archivos (`InspeccionExpedientePage`, `InspectionWorkspace`, `inspectionJourney`, `InspectionComparisonPanel`: los edita otra tanda en paralelo), el Inicio de la web (`pages/dashboard/DashboardPage.tsx`), la versión del service worker (sólo preview), el backend.

## Pruebas

- Laboratorio (`qa-p0.mjs`): tipos de backend y frontend aprobados; suites del arnés aprobadas, sin parada de la guarda de memoria (pico ≈ 1,49 GiB).
- Páginas tocadas, además del arnés: `InspeccionesPage.test.tsx` (12 previas + 2 nuevas), `mobile/InspectorHome.test.tsx` (2 nuevas), `mobile/MobileDashboardPage.test.tsx` (1 previa, operador): 17 aprobadas.
  - Nuevas: una sola acción visible en la barra y las secundarias en el menú; la tarjeta conserva «Retomar expediente … en …»; un borrador guardado convierte la acción principal en «Continuar apertura» y abre el formulario; una apertura confirmada se muestra en la tarjeta de su expediente y no como `status` aparte; Inicio del inspector lista sólo lo propio, en campo primero, sin «Resumen de manifiestos», con prefijo `/mobile` cuando corresponde y con error visible si la consulta falla.
- Preview reconstruido con `rebuild-all.sh` y revisado en `http://127.0.0.1:4188/app/` con la cuenta artificial: las tres capturas «después» son de ese build. El menú abierto a 344 px termina a 316 px, dentro de la pantalla ([captura](evidence/inspection-inicio-lista-344-20261103/capturas/despues-inspecciones-menu-344.jpg)).

## Límites

- Sólo preview y datos artificiales. Sin push, sin main, sin workflows; correos y push apagados en el laboratorio.
- La nota «Apertura confirmada en este dispositivo» en la tarjeta está cubierta por prueba unitaria; no se capturó en el preview porque exige crear un expediente nuevo con la cuenta artificial.
- Las medidas «antes» corresponden al build anterior del mismo laboratorio, tomadas con el mismo script y la misma cuenta en una sesión de navegador limpia; la tercera fila (apertura guardada) se obtiene en el propio script abriendo «Nueva», escribiendo un número de acta y volviendo.
- El Inicio de la web para el inspector no cambió; la decisión por rol vive en la app móvil.
- «Hoy» reutiliza la consulta del listado con su página de 25 expedientes y filtra en pantalla los propios: para una jefatura con un equipo grande, o para una cuenta de administración con perfil inspector cuyos casos queden más allá de esos 25, la lista y el contador «N en campo · M programadas» quedan truncados sin aviso. Es el costo de reutilizar la consulta; un parámetro de inspector en el servidor lo resolvería.
- «Volver» desde un expediente abierto en «Hoy» lleva a la lista de Inspecciones, no a Inicio: el destino de retorno del expediente sólo restaura fichas de actor (`inspectionReturnTarget`) y, para cualquier otro origen, vuelve al listado. Comprobado en el código, no en el preview.
- El ícono «+» de la acción principal se mantiene también cuando dice «Continuar apertura»; es un detalle visual pendiente.
