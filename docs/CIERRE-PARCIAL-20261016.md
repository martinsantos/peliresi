# SITREP — cierre parcial para revisión UI/UX

16/10/2026. Es un punto de traspaso de desarrollo, **no una publicación ni un GO global**. No mezclar SITREP con Precrimen u otros proyectos.

## Revisión UI/UX — primera tanda (rama `codex/sitrep-uiux-review-20261016`)

**Qué es.** Una revisión estática de código; en esta tanda no se ejecutó la aplicación. El detalle está en [hallazgos, cobertura y pruebas](HALLAZGOS-UIUX-20261016.md).

**Qué no se hizo:**
- No se usó el preview 76.13.234.213: no hay acceso autorizado desde esta sesión y no se improvisó otro entorno.
- Sin capturas, consola, recorridos, build, suite completa ni APK.
- Sin merge, deploy ni Actions.

**Hallazgos.** Hay 31 registrados con ID, prioridad, ruta, rol, evidencia, efecto y aceptación. Todos son «hipótesis de código»: se sabe qué hace el código, pero nada se observó en pantalla.

**Corregidos en 9 commits chicos**, uno por causa, sin tocar backend, permisos, contratos ni reglas regulatorias:
- Los errores de red ahora se muestran en español con texto de recuperación.
- Los coeficientes A de la TEF ya no se pierden al cambiar de paso.
- Los textos de observación y rechazo de DGFA sobreviven a un cierre accidental.
- El chat de solicitudes ya no envía mensajes duplicados.
- Los botones de empresa e invitación ya no envían el formulario por accidente.
- El CUIT de `/reclamar` abre el teclado numérico.
- `/app` tiene `ErrorBoundary`, permite zoom con pellizco y protege los pies sin zona segura.
- La evidencia de inspección sin señal ya no se anuncia como sincronizada.
- El aviso «Reporte enviado» se oculta solo.

**Pruebas locales livianas:**
- 3 regresiones fallan antes del arreglo y pasan después.
- 27 archivos unitarios afectados: 286/286.
- Typecheck sin errores.
- ESLint de los archivos tocados: sin errores nuevos.

**Pendientes:**
- **Funcionales:**
  - H10: la edición de un manifiesto in situ y la fecha de retiro descartada (P0).
  - H13: el pesaje vacío se envía como 0.
  - H04: la verificación de sesión del alta administrativa no se reintenta.
  - H03: el wizard bloquea el cambio de paso hasta guardar en el servidor.
  - H17: baja intensidad se envía con Enter y conserva datos tras guardar.
- **Decisiones de negocio:**
  - H15: confirmar los pasos irreversibles del manifiesto.
  - H14: cuánto deben persistir los errores.
- **Validación:**
  - Recorridos web/móvil/app con capturas.
  - Build y suite completa.
  - Android físico/APK.

## Git y punto de partida

- Repositorio: `https://github.com/martinsantos/peliresi.git`.
- Rama funcional: `codex/sitrep-manifiestos-v2-20261014`.
- Último cambio de producto: `10ecc9a` — conserva borradores de empresa/sede/persona al alternar secciones. Su padre documental es68f55c9; runtime anterior de05909.
- Rama separada para el otro motor: `codex/sitrep-uiux-review-20261016`.
- Punto de partida estable: tag anotado `sitrep-uiux-baseline-20261016`; incluye el arreglo y este cierre documental. No reescribir el tag ni hacer force-push.
- La rama de revisión nace del cierre, no de `main`. No se fusionó ni publicó nada. Se observaron actualizaciones forzadas remotas en `main` y otras ramas al consultar; esto no se interpreta como versión productiva ni se reconcilia automáticamente.
- Commits de cierre con `[skip ci]`: no gastar Actions ni activar despliegues. El workflow productivo tiene disparador en main/master; no empujar allí para entregar esta revisión.

La fuente activa local es el checkout llamado `sitrep-production-source-20261001` en la carpeta de evidencia de este hilo; la ruta absoluta se conserva sólo en el checkpoint privado. El checkout histórico de SDTERA no es la fuente para nuevos cambios. Reutilizar la fuente activa; no crear más clones/worktrees ni copiar dependencias para leer el proyecto.

## Estado funcional que debe preservarse

- Empresa titular por CUIT, domicilio legal separado de establecimientos productivos, varias personas y actividades autorizadas. DGFA valida responsable/actividades; el responsable concede/revoca alcance dentro de su empresa. No convertir contactos del padrón en usuarios.
- Contexto persona→empresa→actividad→sede y permisos comprobados por servidor. Los documentos/manifiestos anteriores conservan su fotografía de domicilio y autoría. Delegación por sede cerrada en el candidato para GENERADOR; no generalizar a inspecciones u otros alcances sin sus pruebas.
- Paginación de empresas25/máximo100, búsqueda, totales del servidor y selección estable ante reordenamiento/error. No reinstaurar un corte silencioso de200.
- Formularios visitados conservan borrador al alternar pestañas. React Activity pausa efectos de los ocultos y no monta los no visitados; al cambiar de empresa se reinicia el estado. No es persistencia de formulario sin guardar después de recargar/cerrar: no prometerla en esta pantalla.
- Manifiestos V2, baja intensidad, adendas post facto, multirol y conciliación de participantes externos son candidatos de desarrollo sin publicar. No borrar lo declarado ni hacer cambios bloqueantes por estética.
- Conciliación del padrón: dudas conservadas, no bloqueo global. No fusionar identidades dudosas, elegir domicilio contradictorio, crear permisos/cuentas/sedes ni inferir estado legal del color. La importación real no está autorizada en este cierre.

## Pruebas actuales: alcance acotado

Los mismos bytes de los dos archivos de10ecc9a se compilaron y probaron en el preview existente76.13.234.213. [Resumen y hashes](qa/nonblocking-20261016/evidence-proof.json). No se reejecutaron suites grandes para crear el commit documental.

| Capa | Resultado actual |
| --- | --- |
| Preparación y guardas | 36/36, sin fallos/omitidas; DB desconectada |
| Unitarias frontend afectadas | 14/14 en5archivos; DB desconectada |
| Builds | Web con TypeScript y app web aprobadas |
| Integración sintética | Preparador real→continuación privada→9fuentes en staging; replay0duplicados;5grupos de dudas no bloqueantes |
| Operación HTTP | Un borrador sintético creado con empresa/sede mientras las dudas siguen abiertas; sin altas/permisos automáticos |
| E2E | 3/3 finales: escritorio1440×900, web móvil360×800 y app web390×844;1worker/0retries/0omitidas/flaky/errores |
| UI | URL/título, raíz con contenido, sin overlay/overflow ni consola/pageerror; conservación legal/sede/persona, selección de contexto y consulta de manifiesto Norte; campo visible/hit-test |
| Datos | Diez modelos previos y conteos conservados; única diferencia operativa permitida: el borrador sintético nuevo. Cero correos enviados |

Fallos conservados: aceptación privada de fechas ausentes/inválidas coincidentes (6PASS1FAIL antes); pérdida de borradores por desmontaje (2unitPASS3FAIL y primerE2E1FAIL2noejecutados); opción `exact` no admitida por los tipos de nuevas pruebas, sustituida por regex anclada. No se relajaron expectativas. La repetición de capturas fue3/3 sobre producto idéntico; no contar las pasadas como6casos únicos.

Cuota agregada1CPU/2GiB/swap0, red interna sin salida ni puertos públicos. Pico1.649.426.432bytes (~1,536GiB), memory.events max/oom/oom_kill0. Backend/frontend/PG y contenedor detenidos23:04:03UTC, restart=no, sin procesos QA pendientes. No se instaló ni ejecutó navegador/emulador/build/DB local. `Browser plugin not available`: se usó Playwright ya existente remoto.

Capturas sintéticas actuales, sin edición:

- [Borrador escritorio](qa/nonblocking-20261016/desktop-draft.png), [móvil web](qa/nonblocking-20261016/mobile-draft.png), [app web](qa/nonblocking-20261016/app-draft.png).
- [Manifiesto escritorio](qa/nonblocking-20261016/desktop-manifest.png), [móvil web](qa/nonblocking-20261016/mobile-manifest.png), [app web](qa/nonblocking-20261016/app-manifest.png).

Baseline histórico separado: suites completas anteriores1037backend/1486frontend,39E2E y HTTP/PDF/aditiva aprobados en el corte previo. No sumarlos a los resultados actuales ni certificarlos como nueva corrida de10ecc9a. Ver [QA detallada](QA-EMPRESAS-SEDES-20261016.md).

## Worktrees y copias

| Elemento | Tratamiento en el cierre |
| --- | --- |
| Fuente activa | Cambios probados guardados; entrega por rama funcional, rama de revisión y tag. No otro checkout creado |
| SDTERA histórico | Conserva su rama histórica y los archivos ajenos sin seguimiento. Se añade un aviso de entrada al cierre actual; no se trasplanta producto ni se hace reset |
| Cinco worktrees tmp desaparecidos | Sólo se depuran sus referencias huérfanas de Git tras respaldo de metadatos. Ramas y commits conservados |
| `citrep-report-branch` | Worktree de otra línea, sin checkout materializado (sólo.git, índice vacío). No agregar sus1318 eliminaciones aparentes ni reconstruirlo desde SITREP |
| Adjuntos `sitrep-role-release` y `sitrep-recovery-20260929` | Rutas ya ausentes; no se inventó recuperación ni se archivó con pérdida. No utilizarlas como fuente |
| Baselines, evidencia y copias de releases | No se borran, fusionan ni despliegan; no son fuentes activas |

Respaldo recuperable de las cinco referencias en el checkout SDTERA, sólo artefactos: `tmp/repo-close-20261016/prunable-worktree-metadata.tgz`. Conservar junto al inventario privado antes/después. No incluye ni restaura por sí solo carpetas de trabajo ya desaparecidas.

## Límites y siguientes pasos

1. El otro motor empieza por [la guía UI/UX](REVISION-UIUX-20261016.md), con inventario de rutas/roles/estados y hallazgos de mayor impacto. No un reemplazo visual indiscriminado.
2. Preparador/cola privada y almacenamiento sintético probados **no equivalen a una pantalla/importador productivo de conciliación**: falta esa implementación específica. El helper de fecha y herramientas privadas permanecen fuera del repo con la evidencia; planes reales históricos intactos. No copiar esos directorios a GitHub/otra IA.
3. Las dudas del padrón y DGFA siguen documentadas, sin bloquear el resto. Una aplicación futura requiere pedido explícito, snapshot vigente y validación por lote seguro, no resolver todas las dudas globalmente.
4. APK original/firma/actualización, teléfono físico, GPS/cámara/batería/TWA/TLS final y nuevas funciones empresariales en Android no se certifican aquí. Preview sin KVM y Actions sin crédito; no instalar un emulador local para salvar ese pendiente.
5. Producción/manual públicos no cambiaron. No comprobar el candidato sólo mirando la URL productiva. Correos/proveedores/formulario humano intactos. Reanudar pruebas aisladas sólo cuando cambie el código o alcance, con autorización del entorno y cierre de procesos.
