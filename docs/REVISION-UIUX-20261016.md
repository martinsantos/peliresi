# SITREP — entrada para revisión UI/UX por otro motor

## Abrir la versión correcta

Rama preparada: `codex/sitrep-uiux-review-20261016`. Baseline fijo: `sitrep-uiux-baseline-20261016`. Leer [cierre parcial](CIERRE-PARCIAL-20261016.md), [QA empresarial](QA-EMPRESAS-SEDES-20261016.md) y el contrato funcional de los módulos afectados. No partir de main, de un checkout tmp, de la demo antigua ni de Precrimen. No publicar/mezclar ramas como parte de la revisión.

Web pública: https://sitrep.ultimamilla.com.ar/ ; app web: https://sitrep.ultimamilla.com.ar/app/ ; manual: https://sitrep.ultimamilla.com.ar/manual/ . Son producción, **no el candidato**. Dominio final previsto `sitrep.mendoza.gov.ar`: conservar enlaces relativos y prefijos web/app. No se proporciona cuenta/sesión productiva en este paquete.

No hace falta arrancar nada para revisar código, capturas y criterios. Reutilizar el checkout existente. No duplicar node_modules, instalar otro navegador/emulador o levantar Docker Desktop. QA interactiva sólo en entorno sintético autorizado, una tarea/worker a la vez, máximo1CPU/2GiB/swap0; apagar al terminar. No disparar Actions sin crédito.

## Prompt para copiar al otro motor

> Revisá SITREP como especialista sénior de UI/UX de software operativo. Usá la rama codex/sitrep-uiux-review-20261016 y verificá el tag de partida sitrep-uiux-baseline-20261016. Primero leé este documento y CIERRE-PARCIAL-20261016.md.
>
> Buscamos formularios livianos y predecibles en teléfono, mala señal, teclado abierto y documentos difíciles. No más texto explicativo, campos redundantes, pasos decorativos ni maquetas que oculten estados reales. Mejorá jerarquía, sugerencias pertinentes, ayuda contextual, recuperación y acciones por rol. Conservá la marca/colores/iconografía actuales.
>
> Primero entregá diez hallazgos priorizados con evidencia y matriz de cobertura. Luego proponé y, si corresponde al pedido humano, implementá cambios pequeños de componentes compartidos en esta rama. No rediseñes todo de una vez ni cambies backend/permisos/reglas regulatorias para simplificar UI. Devolvé commits/diff y pruebas afectadas; no hagas merge ni deploy.
>
> Cada hallazgo: ID, P0–P3 justificada, tarea, ruta, rol, viewport/estado, evidencia o «hipótesis de código», efecto observable, causa común, propuesta mínima, componentes repetidos y aceptación. Separá bug funcional, problema visual, mejora de uso y nueva feature. Registrá también qué no pudiste revisar; no extrapoles de capturas/unitarias a todas las pantallas ni a Android.
>
> Sin datos reales, correos, sesión/formulario humano, imports, nuevas cuentas productivas ni instalaciones/emuladores locales. Un worker por vez en preview aprobado1CPU/2GiB, proveedores apagados y limpieza de procesos. Si sólo tenés el ZIP, hacé revisión estática/visual: el paquete es referencia, no una aplicación instalable ni acceso autenticado.

## Prioridad de recorridos

| Orden | Tarea | Roles / aceptación principal |
| --- | --- | --- |
| 1 | Alta pública, administrativa y modo revisión | Solicitante/DGFA: mismos datos/circuito, OCR opcional/corregible, choferes/vehículos/documentos, borrador/sesión/retorno. TEF sólo en revisión administrativa |
| 2 | Empresa, establecimientos y personas | Responsable/delegado/DGFA: legal≠productivo, contexto claro, varias sedes/personas, alcance/revocación, paginación real y borradores entre pestañas. Ya implementado como candidato; no tratarlo como mera propuesta |
| 3 | Manifiestos ordinarios/V2/adendas/externos | Generador/transporte/operador/revisor: original vs agregado, cambios por versión, hechos no bloqueados, pendientes documentales explícitos, historial y conciliación sin acceso implícito |
| 4 | Inspecciones | Inspector/inspeccionado/DGFA: dirección sugerida sin pisar observada, pasos compactos, títulos alineados, select sin teclado prematuro, acordeones cerrables, errores que conservan datos |
| 5 | Viaje y campo | Transporte: retiro/entrega/GPS/offline/QR, estado honesto, cola/reapertura. No certificar sensores reales desde un viewport |
| 6 | Centro de control/monitor/mapas | Capas/iconos/check centrados, filtros no duplicados, paneles cerrables, período/reproducción30días, GPS vs ubicación aproximada distinguibles |
| 7 | Soporte/avisos/solicitudes | Ticket breve, adjunto opcional, derivarme/derivar/responder/notas, identidad representada, badges pendiente≠sinleer, aviso enlazado al origen y respuesta al autor |
| 8 | Reportes, perfiles, catálogo, QR/PDF/manual | Totales y paginación globales, filtros compactos, domicilios/vigencia, contraste, descarga/retorno/sesión, enlaces/capturas pertinentes por rol |

Inventariar todos los routers `frontend/src-v6/App.tsx`, `AppMobile.tsx` y `routes/pages.ts`, deduplicando aliases sin omitir roles/estados. Por cada ruta anotar web escritorio1440, web móvil360, app390 y APK separado; inicio, cargada, vacío, espera, error, teclado, envío y retorno. Estado de la revisión externa al entregar: **pendiente**, no automáticamente aprobada por pruebas históricas.

## Contrato que no debe cambiar por estética

- Login/portada institucional: tratamiento azul vigente; operación: verde. Marca SITREP de reciclaje/rotonda, sin volver a la hoja/S ni rediseñar identidad. Generador Factory/púrpura, transporte Truck/naranja, operador FlaskConical/azul e inspector con su familia existente. Marca de Mendoza original, sin rasterizar/reducir nitidez.
- Componentes compartidos y tokens existentes primero. Select buscable: opciones antes que teclado; acordeones/widgets cerrables; atrás con espacio propio sin correr el título; blancos/padding y controles táctiles con contraste medido. Skeleton/spinner reales sin inventar datos, respetando reducción de movimiento.
- Empresa/CUIT no equivale a una persona ni una dirección. DGFA valida actividades/responsables; responsable empresarial autoriza/revoca personas dentro de su empresa. Mantener aislamiento de permisos/empresa/sede y fotografía histórica; no borrar borradores al cambiar secciones ni conservarlos en la empresa equivocada.
- OCR propone, no valida pagos/licencias automáticamente ni bloquea entrada manual. Contactos de Excel no crean usuarios. Legal y productivo no se fusionan. Dudas a conciliar no bloquean todo el padrón, pero tampoco autorizan una fusión o estado legal inventado.
- Original de manifiesto inmutable; adendas y sus decisiones/historial separados. Baja intensidad tolera faltantes y actores sin alta; no inventa aprobaciones. Cierre conforme no se habilita por ocultar adendas pendientes/rechazadas. No cambiar plazos, certificados, numeración, permisos o autoridades emisoras desde un refactor visual.
- Avisos claros por rol, no textos preventivos permanentes en todos los formularios. Ayuda contextual y recuperación útil. No activar correo ni usar datos reales para demostrar un aviso.

## Evidencia y devolución

Las seis capturas sintéticas del [cierre actual](CIERRE-PARCIAL-20261016.md) muestran el candidato, no producción. En el ZIP se incluyen además referencias históricas etiquetadas en provenance.json: APK QA de una tanda anterior, no certificación Android empresarial actual. No editar capturas para ocultar problemas.

Pruebas de cada cambio: regresión antes/después, afectados unitarios, build/typecheck y recorrido real web/móvil/app con consola/URL/título/root/overlay/scroll/capturas. No ejecutar suites completas por cada ajuste; consolidarlas cuando el candidato esté estable y el entorno autorizado. Android/KVM/firma físicos se marcan pendientes si no hay entorno adecuado; no instalar local para forzar verde.

Entregar hallazgos y cobertura, decisiones tomadas/no tomadas, diff/commits por causa, pruebas con evidencia y límites. Priorizar conservación de datos y tareas posibles por encima de claims como «perfecto», «100%» o «world class» sin medición.
