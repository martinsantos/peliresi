# Capacitación — agenda compacta y estados visuales, 19/10/2026

## Estado vigente — agenda actualizada al crear, 19/10/2026

Web, `/app` y manual publicados sobre **`ea92004b0f82897516be324cb5f32db09039ca3e`**, el **19/10/2026 09:29:02 Mendoza**. Backend `8de58de` conservado, mismos dos workers sin reinicio. SW raíz **v125**, manual **2026.20.9**; mismos accesos CAP y vencimiento.

- La agenda conserva el orden de creación descendente de la API: el recién creado aparece primero en Todos, Hoy y los filtros de estado. Sólo **Próximos** ordena cronológicamente por fecha prevista.
- Crear invalida inmediatamente la consulta de tareas y de programados. Otra sesión abierta recibe la propuesta por la actualización periódica existente (5 segundos), sin recargar.
- **Te toca aprobar** cuando falta la decisión propia; **En espera** después de aprobar, mientras faltan otras partes. No hay aprobación automática ni cambios de permisos/reglas. Los tres íconos mantienen verde/gris, sin tildes adicionales.
- Las filas nuevas entran con animación breve; los nodos existentes permanecen al actualizar. La animación se desactiva con movimiento reducido.

La causa era el reordenamiento local por fecha/número ascendente, que dejaba las propuestas nuevas detrás de las seis filas visibles, junto con la falta de invalidación de las consultas al crear.

Validación remota dirigida: **22/22 unitarias**, **16/16 manual**, **8/8 E2E** (cuatro roles × web móvil/app), dos sesiones independientes por caso. Incluye creación desde UI, aprobación explícita del creador, primer lugar en la agenda, espera, llegada a la contraparte sin recarga, filtro y movimiento reducido. Build web/app serial, 1 CPU/2 GiB/swap cero, un worker. Fuente comprobada contra los **2.124 blobs de Git** antes/después de compilar. No se repitieron las suites completas ni se certifica Android físico.

El primer intento E2E conservado dio 4/8: el test esperaba espera antes de la aprobación propia del operador/transporte. Se corrigió el test para aprobar explícitamente, conservando el producto y las expectativas de unanimidad; repetición final 8/8. El runner final de preview tenía una etiqueta GITHUB_SHA provisional equivocada: `preview-source-proof.json` acredita de forma independiente los 2.124 archivos exactos de `ea92004`; no se usa aquella etiqueta como evidencia de procedencia. Build final y release sí llevan el SHA correcto.

Publicación frontend/manual únicamente: **3/3 agenda publicada de sólo lectura** (escritorio, web móvil y app), **44/44 smoke HTTP**, 245 archivos web y 189 app verificados, cuatro archivos del manual verificados. `.env` SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`, UPLOADS_DIR, flags apagados, correos y VAPID conservados. No se crearon casos en producción para este ajuste, no se consultaron datos reales y no se modificó main.

**Rollback inmediato:** reemplazar atómicamente sólo el enlace `/var/www/sitrep` para volver a `/var/www/sitrep-releases/20261019-icons-88b1a0e` (manual `71780c6`). Backend permanece en `/var/www/sitrep-backend-releases/20261019-agenda-8de58de`; no recargarlo ni restaurar la base. Release actual `/var/www/sitrep-releases/20261019-agenda-live-ea92004`. Auditoría privada `/var/backups/sitrep/20261019-agenda-live/`; evidencias locales ignoradas `test-results-agenda-live-20261019/`. Gemelo propio detenido y relay cerrado a las 09:30:22 Mendoza; límites 1 CPU/2 GiB/swap cero verificados, sin eventos OOM ni presión max. Se conservan casos/evidencias de preview e imagen.

## Historial — íconos compactos simplificados, 19/10/2026

Web y `/app`: **`88b1a0e`**, sin círculo de tilde/reloj junto a los íconos compactos. Verde aprobado, gris pendiente; etiquetas accesibles conservadas. Detalle de aprobaciones sin cambios. Manual **`71780c6`**, recurso `2026.20.8`, explica los mismos colores. Backend permanece **`8de58de`**, sin reinicio ni cambio de `.env`, flags o datos.

Verificación de este ajuste: build web/app serial en preview 1 CPU/2 GiB/swap cero, fuente verificada; agenda publicada 3/3 (escritorio/web móvil/app); smoke HTTP 44/44; manual estático 16/16 y archivos publicados 4/4. No se repitió el circuito mutante por este cambio visual; su evidencia 2/2 sobre `8de58de` queda debajo. SW raíz **v124**. Commits `[skip ci]`, sin workflows ni main. Preview detenido y relay cerrado.

Rollback de este ajuste: volver sólo `/var/www/sitrep` al release `/var/www/sitrep-releases/20261019-agenda-8de58de`. No recargar backend ni restaurar base. Auditoría `/var/backups/sitrep/20261019-icons/`; evidencias locales ignoradas `test-results-icons-20261019/`.

## Historial — publicación completa de la agenda

Backend, web, `/app` y manual publicados sobre **`8de58de885bf888ab2cee1211bf1e388ca204ce3`**, el **19/10/2026 07:23:27 Mendoza**, en `sitrep.ultimamilla.com.ar`. Rama `codex/sitrep-training-20261018`; único checkout `sitrep-production-source-20261001`. Main `c840219` conservado. Commits `[skip ci]`; no se dispararon workflows.

## Qué cambia para las personas

- Inicio: **Mi agenda**, o **Agenda de operaciones** para ADMIN. Número en una línea, acción breve y tres íconos con tilde/reloj. Búsqueda por número; filtros Todos, Por aprobar, En espera, En curso; fecha Toda fecha, Hoy, Próximos. Primero lo previsto para hoy y lo que está en curso. Se muestran seis filas, con Ver más. La consulta conserva el límite de los últimos cien registros e informa cuándo se alcanza.
- Manifiestos programados: búsqueda por número y páginas de cincuenta; ya no obliga a adivinar dónde quedó un caso fuera de la primera página.
- Aprobaciones: mismos íconos en agenda y detalle; menos texto y acción principal visible. Las tres decisiones y el inicio de coordinación siguen siendo obligatorios antes del retiro de una propuesta.
- Certificaciones: encabezado con ícono institucional; parcial y final muestran si están emitidas, listas para firmar o bloqueadas. Conservan firma, cantidades, revisión independiente de adendas y descarga por las partes.
- Adenda: corriente con teclado de texto, mayúsculas y ejemplo Y21. El número solo sigue siendo inválido. Motivo acepta texto; cantidad conserva teclado decimal.
- Contraste de botones: se retiraron fondos verdes forzados que prevalecían sobre el estado deshabilitado. Ventana de entrega identificada como diálogo; sin cambios en la lógica de GPS.
- Manual: guía actualizada con agenda y filtros, recurso help-data `2026.20.7`; se mantienen diseño, navegación, `manual.css` y `manual.js`. Las dos hojas privadas con QR, accesos simples y recorrido siguen vigentes en `test-results-proactivo-20261018/output/pdf/`.

Antes del ensayo, recargar web/app; si aparece **Nueva versión disponible — Actualizar cuando termines**, tocarla después de guardar el trabajo pendiente. Luego tocar **Activar sonido**. Los cuatro usuarios y contraseñas no cambiaron. Avisos con la app abierta; correos y push externo siguen apagados. Abrir un caso nuevo y compartir su número; no reutilizar ni resetear las prácticas anteriores.

## Evidencia y alcance

Toda la QA pesada se ejecutó en el preview aislado `76.13.234.213`, serial, un worker, 1 CPU/2 GiB/swap cero. Browser plugin no disponible; se utilizó el Playwright existente del proyecto. Datos y sesiones CAP; solicitudes mutantes limitadas a casos propios del ensayo.

| Comprobación | Resultado |
| --- | --- |
| Backend dirigido: propuesta, filtros de actor y nueva metadata de agenda | 23/23 |
| Frontend dirigido: agenda, adenda, acciones, avisos, GPS y service worker | 106/106 |
| Manual estático | 16/16 |
| Preview: circuito web completo | Aprobado en `.qa-agenda-final-20261019` |
| Preview: circuito app con diálogo corregido | Aprobado en `.qa-agenda-pages-20261019` |
| Preview: agenda, filtros y certificados en escritorio/web móvil/app | 3/3 |
| Publicado: circuito completo con cuatro sesiones independientes | 2/2 |
| Publicado: eventual y revisión por otro actor | 2/2 |
| Publicado: manual | 3/3 |
| Publicado: agenda, filtros, íconos y certificados | 3/3 |
| Smoke HTTP no mutante con hashes de artefactos y readiness | 44/44 |

Los recorridos incluyen creación por los distintos roles, aprobación unánime, rechazo, aviso visible, coordinación idempotente, retiro, posiciones GPS hacia C3, entrega esperando el envío en vuelo, recepción/pesaje/tratamiento, parcial firmado de 4 kg, adenda de 12 kg revisada sin alterar los 10 kg originales y final total de 10 kg. También se verificó el contraste de los botones principales (al menos 4,5:1), ausencia de desbordes, página identificada y sin pantalla de error. Los bloqueos 403/409 de controles negativos y las solicitudes ajenas al aula bloqueadas por el arnés se conservan en evidencia; no son errores inesperados del circuito.

No se afirma una suite unitaria completa sobre este commit ni certificación global. Viewports 360×800 y escritorio 1280×900; GPS emulado con llamadas reales a la API CAP. Sensores, audio físico, Android instalado y segundo plano requieren la comprobación con los teléfonos de la clase.

### Intentos fallidos conservados

1. `.qa-agenda-20261019`: ambos recorridos se detuvieron porque el texto se había abreviado a «Falta: Transporte». Se restituyó «Falta aprobar: Transporte», sin relajar la expectativa.
2. `.qa-agenda-final-20261019`: web aprobada; app se detuvo al intentar cerrar un aviso detrás del modal de entrega, que carecía de rol de diálogo. Se corrigió el marcado del producto, se agregó una comprobación explícita del diálogo y se repitió app. Las verificaciones de entrega con GPS en vuelo permanecen.
3. `.qa-agenda-delivery-20261019`: la acumulación de más de cincuenta programados dejó un caso nuevo fuera de la primera página. Se agregó búsqueda paginada y se verificó encontrar el mismo número, sin aumentar el límite ni borrar casos. La repetición final está en `.qa-agenda-pages-20261019`.

## Preservación y publicación

Auditoría posterior `2026-10-19T10:33:25.471Z`: **83 manifiestos CAP anteriores intactos**, 40 cuentas CAP activas, 10 casos propios conservados, 4 certificados y 2 eventuales propios tratados. Sin consultar datos reales. Dos workers online, sin reinicios adicionales después del despliegue.

`.env` SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7` conservado. `UPLOADS_DIR=/var/lib/sitrep-uploads`; flags enterprise/eventual/adenda/party-review/multirole false, correos desactivados y VAPID vacío. Sin migraciones, seeds, cambio de claves ni restauraciones. Accesos CAP hasta `2026-10-20T03:00:00Z`, fin del lunes 19 en Mendoza.

Releases activos: `20261019-agenda-8de58de`. SW raíz **v123**, app con versión nueva y hash verificado. API del build `https://sitrep.ultimamilla.com.ar/api`; todos los flags frontend false. Código y artefactos verificados contra el commit antes y después de compilar.

## Rollback

Conservar los dos releases anteriores y el mismo `.env`. Volver el enlace `/var/www/sitrep-backend` a `/var/www/sitrep-backend-releases/20261018-proactivo-gps-312d6f2` y `/var/www/sitrep` a `/var/www/sitrep-releases/20261018-proactivo-gps-312d6f2`, mediante reemplazo atómico de enlaces. Recargar exclusivamente `sitrep-backend` conservando flags y vencimiento CAP; verificar readiness y hashes de web/app. **No restaurar base ni borrar prácticas.** El despliegue incluye rollback automático a esos destinos si falla readiness o smoke.

Auditoría privada: `/var/backups/sitrep/20261019-agenda/`. Evidencias locales ignoradas: `test-results-agenda-20261019/`; preview `.qa-agenda-*` y `.qa-release-agenda-20261019`. Contenedor propio detenido, relay cerrado e imagen/evidencias conservadas. Contadores cgroup al cierre: `low 0, high 0, max 933, oom 0, oom_kill 0, oom_group_kill 0`; presión de memoria registrada, sin OOM y sin elevar los límites.
