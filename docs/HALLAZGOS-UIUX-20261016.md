# SITREP — hallazgos UI/UX, revisión 16/10/2026

Rama `codex/sitrep-uiux-review-20261016`, partida `sitrep-uiux-baseline-20261016` (`9d701e3`). Sin merge, sin despliegue.

## Cómo se obtuvo

- **Revisión estática de código** de `frontend/src-v6` (routers, primitivas `components/ui`, páginas por área). Lectura, grep y comprobación manual de cada fragmento citado antes de corregirlo.
- **No se ejecutó la aplicación.** El preview sintético 76.13.234.213 no se usó: el cierre anterior registra la consulta SSH bloqueada por la protección local y esta sesión no tiene otro acceso autorizado. No se improvisó otro entorno, navegador ni emulador.
- Por eso **todo hallazgo es «hipótesis de código»**: hay certeza sobre lo que el código hace, no observación en pantalla. Faltan capturas, consola, foco, scroll, overlays y contraste medidos.

## Inventario de rutas y cobertura

Routers: `App.tsx` (web, con alias `/mobile/*` para la web móvil), `AppMobile.tsx` (`/app`, basename `/app`), `routes/pages.ts` (64 páginas lazy). Alias deduplicados por área:

| Área | Rutas principales | Roles | Revisión estática | Web 1440 | Web 360 | App 390 | APK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Altas | `/inscripcion/:tipo`, `/registro`, `/reclamar`, `/mi-solicitud`, `/admin/solicitudes/:id`, `/admin/actores/{generadores,operadores,transportistas}/nuevo\|:id/editar\|:id/renovar` | Solicitante, DGFA | Sí: wizard, documentos/OCR, borradores, TEF, revisión | — | — | — | — |
| Empresas | `/empresas`, `/empresa-invitacion/:token` | Responsable, persona autorizada, DGFA | Parcial: formularios, picker, invitación | — | — | — | — |
| Manifiestos | `/manifiestos`, `/nuevo`, `/:id`, `/:id/editar`, `/:id/adendas`, `/baja-intensidad`, verificación pública | Generador, transportista, operador, DGFA | Sí: listado, alta/edición, detalle, modales de acción, adendas, baja intensidad | — | — | — | — |
| Inspecciones | `/inspecciones`, `/inspecciones/:id`, `/mis-inspecciones[/:id]`, `/verificar/inspecciones/:token` | Inspector, inspeccionado, DGFA | Parcial: expediente, evidencia, timeline | — | — | — | — |
| Viaje/campo | `/transporte/viaje/:id`, `/transporte/perfil`, `/escaner-qr` | Transportista | Parcial: shell móvil, banner de viaje | — | — | — | — |
| Monitor/mapas | `/monitor`, `/centro-control[/viaje/:id]` | DGFA, inspector | Parcial: panel de viajes, línea de tiempo | — | — | — | — |
| Soporte/avisos | `/soporte[/:id]`, `/alertas`, `/notificaciones` | Todos | Parcial: burbuja, campana, badges | — | — | — | — |
| Reportes/perfil/ayuda | `/reportes`, `/estadisticas`, `/mi-perfil`, `/ayuda`, admin catálogos | Todos / ADMIN | **No revisado** en esta pasada | — | — | — | — |

«—» = no ejecutado en esta sesión. No se infiere aprobación de pruebas históricas.

## Hallazgos priorizados

Tipo: **F** bug funcional, **V** visual, **U** mejora de uso, **D** decisión de negocio. Estado: **corregido** (en esta rama), **registrado** (sin cambio).

| ID | P | Tipo | Ruta / componente | Rol, estado | Evidencia (código) | Efecto | Aceptación | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H01 | P1 | F | `utils/api-error.ts` (20 llamadas) | Todos; sin señal o timeout | Devuelve `error.message` de axios antes del texto de respaldo | Se muestra «Network Error» o «timeout of 30000ms exceeded» en inglés; nunca aparece «Revisá la conexión… los datos siguen en pantalla» | Error de transporte sin respuesta → texto de respaldo en español; mensaje del servidor y `Error` propios se conservan | corregido |
| H02 | P1 | U | `services/solicitud.service.ts:46` `uploadDocumento`, `services/api.ts:21` | Solicitante; foto de 3–8 MB con señal mala | Timeout global 30 s, sin `onUploadProgress` (0 usos), sin reducción de imagen | Carga cortada a los 30 s, sólo «Subiendo…» | Tiempo de espera de carga mayor y progreso visible | registrado: hay que confirmar los límites de nginx/servidor |
| H03 | P1 | U | `InscripcionWizardPage.tsx:383-405` `goStep` | Solicitante; señal mala | Cambiar de paso, incluso hacia atrás, espera un PUT exitoso | No se puede volver a corregir un dato; el error aparece arriba de la tarjeta, lejos del botón | Volver atrás sin esperar al servidor; el error recibe foco | registrado: cambia la semántica del borrador |
| H04 | P1 | F | `hooks/useActorRegistrationDraft.ts:24-50` | DGFA; perfil falla al cargar | La verificación de sesión no se reintenta; `assertSession` bloquea envío y autoguardado | Seis pasos cargados, imposible guardar; al recargar se pierden | Reintento al volver el foco o la conexión; sin bloquear el borrador local | registrado |
| H05 | P2 | U | `RegistrationFleetFields.tsx:40,96`, `InscripcionWizardPage.tsx:388-391` | Solicitante transportista | Patente o DNI repetidos invalidan el paso pero el banner se suprime y el campo sólo marca vacíos | «Siguiente» no hace nada visible | Error por campo duplicado | registrado |
| H06 | P1 | F | `components/CalculadoraTEF.tsx:99` | DGFA; alta generador/operador | `inputsKey` no incluye `coefA` | Los coeficientes A cambiados vuelven atrás al salir del paso y el envío usa los anteriores | Coeficientes A conservados al alternar pasos | corregido |
| H07 | P2 | U | `pages/admin/SolicitudDetallePage.tsx` (modales observar/rechazar) | DGFA | Cerrar por fondo o Escape borra el texto escrito | Se pierde una observación larga al tocar fuera para bajar el teclado | El texto sobrevive a un cierre accidental; se limpia al enviar | corregido |
| H08 | P2 | F | `MiSolicitudPage.tsx`, `SolicitudDetallePage.tsx` (chat y «responder y re-enviar») | Solicitante, DGFA; señal lenta | Enter envía sin comprobar `sending`; si el mensaje se publica y el re-envío falla, reintentar publica la respuesta otra vez | Mensaje duplicado | Enter ignorado mientras se envía; el reintento no repite la respuesta ya publicada | corregido |
| H09 | P2 | U | 7 campos CUIT de altas admin, actores y `/reclamar` | DGFA, reclamante | Sin `inputMode="numeric"` | Teclado de texto completo para 11 dígitos | Teclado numérico; validación sin cambios | corregido sólo en `/reclamar` (el backend normaliza guiones). En altas admin y actores queda registrado: el teclado numérico de iOS no tiene guion y no se confirmó que esas rutas del backend normalicen el CUIT |
| H10 | P0 | F | `pages/manifiestos/EditarManifiestoPage.tsx:121,146-157` | Generador; borrador IN_SITU | Exige transportista y siempre envía `transportistaId`; `fechaEstimadaRetiro` editable no viaja | Un borrador in situ no se puede editar sin volverlo con transporte; la fecha editada se descarta en silencio | Paridad con `NuevoManifiestoPage` (modalidad) | corregido en el frontend. `PUT /manifiestos/:id` sólo lee `transportistaId`, `operadorId`, `observaciones` y `residuos`; ignora `modalidad`, `fechaEstimadaRetiro` y `generadorId`, y un `transportistaId` vacío no borra el anterior. Por eso un borrador IN_SITU no pide ni envía transportista, la modalidad y la fecha estimada se muestran sólo como lectura (la fecha antes se precargaba con `fechaRetiro`) y un error de validación vuelve al paso del campo y lo enfoca. Pendiente de backend (**D**): editar fecha estimada y modalidad, y que el generador elegido no se descarte en silencio |
| H11 | P1 | F | `components/ui/ButtonV2.tsx` sin `type` por defecto; `EmpresaInvitacionPage.tsx:34`, `EmpresasPage.tsx:114` | Persona invitada, responsable | Un `<Button>` dentro de `<form>` envía el formulario | «No tengo cuenta / Ya tengo cuenta» dispara validación nativa o un POST | Los botones de alternar no envían | corregido en los dos sitios; el valor por defecto compartido queda propuesto (488 usos por auditar) |
| H12 | P2 | U | `ManifiestosPage.tsx:173-178,312` | Todos | Cada tecla vacía la lista y pide de nuevo, sin debounce | Con señal mala la lista parpadea y puede llegar desordenada | Debounce y datos previos mientras carga | registrado |
| H13 | P1 | F | `ActionModals.tsx:304-309` (pesaje), `AdendasManifiestoPage.tsx:86`, `BajaIntensidadPage.tsx:63` | Operador; generador | Pesaje vacío → `0`; en adendas/baja escribir «0» borra el campo | Puede enviarse `cantidadRecibida: 0`; no se puede tipear 0,5 | Campo vacío ≠ 0; valores decimales tipeables | registrado: definir si vacío bloquea el pesaje (**D**) |
| H14 | P2 | U | `components/ui/Toast.tsx:69`, banners en `EmpresasPage.tsx:56`, `BajaIntensidadPage.tsx:134` | Todos | Errores en toast de 5 s o arriba de la página | El motivo del rechazo desaparece o queda fuera de vista | Error junto a la acción, con foco | registrado: persistencia es decisión de UX |
| H15 | — | D | `ActionButtons.tsx` retiro/entrega/recepción/cierre | Transportista, operador | Un toque ejecuta un paso irreversible; la pantalla de viaje sí confirma | Inconsistencia y riesgo de toque accidental | Decidir si se confirma con `ConfirmModal` | decisión pendiente |
| H16 | P2 | F | `ManifiestoDetallePage.tsx:274,323-326,357,375,395`, `Editar/NuevoManifiestoPage` | Usuarios de `/mobile` | Navegaciones absolutas sin `mp()`; redirección de transportista durante el render | Se sale del shell móvil web; posible página en blanco | Navegación con prefijo | registrado (68 casos, algunos intencionales) |
| H17 | P2 | F | `BajaIntensidadPage.tsx:44,106-108,137` | Generador | Enter en la búsqueda del padrón envía la operación; tras guardar quedan datos anteriores | Alta involuntaria o duplicada con datos viejos | Búsqueda aislada; reinicio completo al guardar | registrado |
| H18 | P2 | U | `AdendasManifiestoPage.tsx:108`, `EmpresasPage.tsx:35`, `NuevoManifiestoPage.tsx:341` | Generador, responsable | Reemplazos de borrador sin aviso | Se pierde lo cargado a medias | Aviso o conservación | registrado |
| H19 | P2 | U | `NuevoManifiestoPage.tsx:81-90`, `EditarManifiestoPage.tsx:43-51` | Generador | Errores de catálogos ignorados | Selects vacíos sin reintento | Banner con reintentar | registrado |
| H20 | P1 | V | `frontend/app.html:8` | Todos en `/app` (Android) | `maximum-scale=1, user-scalable=no` | No se puede ampliar foto de evidencia, mapa ni texto chico | Zoom con pellizco habilitado | corregido. Sin `viewport-fit=cover`, para no cambiar las zonas seguras. `MobileLayout` ya contempla el zoom. Falta verlo en Android: con teclado abierto y en el APK/TWA |
| H21 | P1 | F | `AppMobile.tsx:116`, `main-app.tsx` | Todos en `/app` | Sin `ErrorBoundary` alrededor de 64 rutas lazy (la web sí lo tiene) | Un fallo de carga deja pantalla en blanco | Pantalla con «Recargar» / «Intentar de nuevo» | corregido con el mismo `ErrorBoundary` de la web. Ante un chunk caído sirve «Recargar»: «Intentar de nuevo» reutiliza la importación fallida. Falta reintentar las importaciones lazy |
| H22 | P2 | V | `MobileLayout.tsx:622`, `InstallPWAModal.tsx:85` | Todos en `/app` (iPhone) | `.safe-area-top/.safe-area-bottom` usadas en 4 lugares pero no definidas | Pie del menú lateral y modal de instalación bajo el indicador de inicio | Margen inferior seguro en esos dos sitios | corregido en los dos sitios sin protección. No se definieron las clases globales: el header y la barra inferior ya tienen `safe-top`/`safe-bottom` internos y quedarían con margen doble |
| H23 | P3 | U | `MobileLayout.tsx:478-505` menú lateral | Todos en `/app` | Sin `role="dialog"`, Escape, foco ni bloqueo de scroll | Accesibilidad y foco | Misma lógica que `Modal` | registrado |
| H24 | P3 | U | `components/ui/SearchInput.tsx` (7 llamadas) | ADMIN | Foco sólo por color, botón limpiar sin etiqueta, 36 px | Accesibilidad | Anillo de foco, `aria-label`, 44 px | registrado |
| H25 | P1 | F | `InspeccionExpedientePage.tsx:507-510` | Inspector sin señal | Evidencia en cola anunciada con toast de éxito de 5 s que otro éxito reemplaza | Se cree sincronizado lo que sólo está en el dispositivo | Aviso informativo, igual que el borrador local | corregido |
| H26 | P3 | U | `NotificationBell.tsx:236-278` | Todos | Enlace dentro de botón; punto sin texto | Accesibilidad | Acciones hermanas, texto «sin leer» | registrado |
| H27 | P2 | V | `MobileLayout.tsx:427,448,377` | Transportista | Banner de viaje en `bottom-[76px]` sin safe-area; reintentar 36 px | Tapa navegación o el final de la lista | Variable común para la pila inferior | registrado |
| H28 | P3 | U | `components/SupportBubble.tsx:57` | Todos | «Reporte enviado» queda fijo en pantalla | Tarjeta flotante permanente sobre el contenido | Se oculta sola | corregido |
| H29 | P3 | U | `InspectionEvidenceImage.tsx:44-74` | Inspector | Visor sin trampa de foco, 100vh | Accesibilidad, pie fuera de vista | Usar `Modal` | registrado |
| H30 | P3 | U | `centro-control/.../ViajesPanel.tsx:74,192-224` | DGFA | Filas de «Realizados» sin teclado, botón 28 px, 100vh | Accesibilidad | Botones como en «Activos» | registrado |
| H31 | P3 | U | `monitor/.../TimelineControls.tsx:184-236` | DGFA | Controles de 28 px, sólo `title` | Toque y lector de pantalla | 44 px y `aria-label` | registrado |

## Commits de esta tanda

| Commit | Hallazgo |
| --- | --- |
| `2a925c2` | H01 |
| `4354390` | H06 |
| `27f06d3` | H07, H08 |
| `16ff1c2` | H11 |
| `d380e2e` | H09 (sólo `/reclamar`) |
| `85280c2` | H21 |
| `fad0569` | H20, H22 |
| `482f735` | H25 |
| `75f7ac3` | H28 |
| `4edc13b` | H10 |

## Pruebas locales de esta tanda

Se corrieron en la Mac, sólo como verificación liviana: sin build, sin E2E, sin base de datos ni navegador.

- **Regresión antes/después.** Tres pruebas nuevas fallan sobre el código del baseline y pasan con el arreglo:
  - `apiErrorMessage`: 3 fallas antes, 6/6 después.
  - `CalculadoraTEFInputs`: 1 falla antes, 1/1 después.
  - `SupportBubble`, autocierre: 1 falla antes, 7/7 después.
  - `EditarManifiestoModalidad` (H10): 4 fallas antes, 4/4 después; junto con `NuevoManifiestoCompatibility`, 11/11, un worker. Typecheck sin errores.
- **Unitarias afectadas:** 27 archivos, 286/286, un worker, 30 s, sin omitidas. Es la selección por archivos que importan lo modificado; **no** es la suite completa.
- **Typecheck:** `tsc -p tsconfig.app.json --noEmit` sin errores (7 s, ~0,75 GB).
- **ESLint** sobre los archivos tocados: 0 errores. Hay 22 advertencias preexistentes y ninguna está en una línea modificada.
- **Sin pruebas propias:**
  - H07, H08, H11, H09 y H25 tienen sólo las pruebas existentes de esas páginas, que siguen en verde.
  - H20, H21 y H22 no tienen ninguna prueba que los cubra.

**Pendiente:** recorridos reales en escritorio 1440, web móvil 360 y `/app` 390 (consola, foco, scroll, overlays, capturas); build web/app; suite completa; APK.

## Preview sintético — corrida de pantallas (17/10/2026 00:23–00:28 UTC)

Fuente `04e45dd`: los arreglos de esta rama más H10, aplicados sobre una copia del servidor verificada contra el baseline (1039 archivos con hash idéntico). Se usó el contenedor existente `sitrep-qa-enterprise-20261016`:
- red interna sin gateway;
- 1 CPU, 2 GiB, swap 0;
- base Postgres sintética nueva;
- correo, push y blockchain apagados (`runtime-proof.json`);
- un worker.

| Paso | Resultado |
| --- | --- |
| Build web (`tsc -b` + vite) y `/app` | Aprobados, 1 min 35 s, pico 1,40 GiB, sin OOM |
| Base, migración, fixture y servicios en loopback | Aprobados |
| Recorrido `uiux-preview.spec.ts` (sólo lectura, sin envíos) | 18/18 en escritorio 1440×900, web móvil 360×800 y app 390×844. Sin omitidas, flaky ni reintentos; 2,3 min |
| Pantallas | 45 capturas en [qa/uiux-20261016](qa/uiux-20261016/). Raíz con contenido, sin overlay, sin scroll horizontal, sin `pageerror` |
| Consola | En las pantallas logueadas, ninguna. En login y reclamar sin sesión, `ERR_NAME_NOT_RESOLVED`: el test público no instala la caché offline de fuentes que sí usa el login. Es del test, no del producto |
| Comprobaciones de arreglos | `/reclamar` con CUIT `inputmode=numeric` en los 3 viewports. `/app` sin `user-scalable=no` |
| Cierre | Procesos detenidos sin forzar, Postgres detenido, contenedor `exited`, `OOMKilled=false`, `restart=no` |

**Observado en pantalla** (deja de ser hipótesis):
- **H27:** el botón flotante de ayuda tapa contenido.
  - En `app--transportista-dashboard`, la flecha del primer ítem de «Actividad reciente».
  - En `web-responsive--generador-manifiestos`, las tarjetas y el pie institucional.
- **Nuevo, O1 (P2):** en `web-responsive--generador-manifiestos` el generador ve la papelera en manifiestos `TRATADO`.
  - Falta comprobar si el servidor lo rechaza.
  - Aceptación: no ofrecer acciones que el rol o el estado no permiten.

**No cubierto por esta corrida:**
- Interacciones de los arreglos: cerrar los modales DGFA, chat, TEF entre pasos, evidencia offline y edición in situ. Sólo están cubiertos por unitarias.
- Teclado abierto.
- Zoom real en Android.
- APK.

## Comprobado y sin defecto

`Modal` (bloqueo de scroll, trampa de foco, Escape, alto por viewport visible, pie fijo), `Select` (abre en una opción, no en la búsqueda: no abre el teclado), `Input`, `ButtonV2` (44 px en móvil), `Tabs`, `NativeSelect`, `MapLayerToggle`, badges pendiente≠sin leer, wizard público con reintento por documento y envío protegido contra doble toque, `SupportReportDialog` con borrador local.

## No revisado en esta pasada

Reportes, estadísticas, perfiles, catálogos admin, PDF/QR, manual y ayuda; viaje en curso y escáner QR en detalle; contraste medido; APK Android. Ninguno se da por aprobado.
