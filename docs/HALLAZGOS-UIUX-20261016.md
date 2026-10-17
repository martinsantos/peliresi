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
| H27 | P2 | V | `MobileLayout.tsx`, `MainLayout.tsx`, `SupportBubble.tsx` | Todos en `/app` y web móvil | El contenido de `/app` termina con `pb-28` (112 px), pero la burbuja de ayuda llega a 136 px (212 px con banner de viaje o botón «+»). En web móvil, la píldora «Ayuda» con texto queda sobre el pie | El final de listas y paneles queda siempre debajo del botón | Al terminar el scroll, el último contenido queda sobre el botón | corregido en `56d839f`: el espacio reservado sale de la misma medida que posiciona la burbuja y en teléfono se muestra sólo el ícono. Verificado en el preview (ver abajo). Sin cambios: la posición del banner de viaje y el «reintentar» de 36 px |
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
  - El servidor la rechaza siempre: `DELETE /manifiestos/:id` exige `GENERADOR` o `ADMIN` y estado `BORRADOR` o `CANCELADO`.
  - **Corregido en `a02a629`.** `canOfferManifestDelete` replica esa regla sin cambiar el backend.
  - En el navegador se verificó sólo el caso negativo (`TRATADO` sin papelera). El caso positivo (`BORRADOR`) está cubierto por unitarias.
- **Pendiente relacionado:** el botón «Editar» de la tabla de escritorio también aparece en todos los estados.

**No cubierto por esta corrida:**
- Interacciones de los arreglos: cerrar los modales DGFA, chat, TEF entre pasos, evidencia offline y edición in situ. Sólo están cubiertos por unitarias.
- Teclado abierto.
- Zoom real en Android.
- APK.

## Preview sintético — segunda corrida: H27 y O1 (17/10/2026 00:35–01:03 UTC)

Se usó el mismo contenedor aislado, con base nueva en cada corrida. El spec agrega una verificación en web móvil y `/app`: después de bajar hasta el final, la última hoja visible tiene que quedar por encima del botón de ayuda.

| Corrida | Fuente del producto | Resultado |
| --- | --- | --- |
| Antes | Compilación `04e45dd` (sin los arreglos) | 9 de 18 fallan; 4 en web móvil y 5 en `/app`. Ejemplos: `/app` manifiestos, contenido hasta 726 px con la ayuda en 632; web móvil manifiestos, 733 contra 728 |
| Intermedia | `73a1942`, compilada en el contenedor (build web y app aprobados, pico 1,49 GiB, sin OOM) | 13/18. Web móvil, todo bien. En `/app` falla el inicio de los 5 roles por un **falso positivo del spec**: el texto oculto de un `<details>` cerrado («Conexión y dispositivo») reporta posición. La captura muestra la tarjeta visible terminando antes de la ayuda |
| Final | Misma compilación; sólo se corrigió el spec en `0cf57d2` para ignorar contenido no visible | **18/18**, 2,7 min. Inicio de `/app` 691 contra 708. Sin `pageerror` ni scroll horizontal. Cierre sin forzar, `OOMKilled=false`, contenedor detenido |

Capturas «después», incluidas las `-fin` al final del scroll: [qa/uiux-20261016/despues](qa/uiux-20261016/despues/).

**Límite de la línea base:** la corrida «antes» usó el spec previo a ese ajuste, así que sus fallas del inicio de `/app` mezclan el falso positivo con la superposición real. Las de manifiestos y centro de control sí son superposiciones reales.

## Tercera tanda — «Eventuales» y cabecera compacta del listado (17/10/2026)

Pedido de revisión humana sobre el preview: títulos repetidos y filtros que ocupaban un tercio de la pantalla en los listados de `/app`. Además, el circuito de baja intensidad pasa a llamarse **Eventuales**.

**Cambios** (`f494b4a`, `271ed77`, `16100dd`):
- **Nombre «Eventuales», sólo en lo que se ve.**
  - Enlace «Eventuales» en el listado.
  - Título «Manifiestos eventuales» en la página.
  - Título de la barra de `/app`: «Eventuales».
  - **No cambian:** la ruta `/manifiestos/baja-intensidad`, la API, los estados, las claves de datos ni los permisos.
- **Listado de manifiestos por debajo de 768 px.**
  - El título de la página queda sólo para lectores de pantalla, porque la barra ya lo muestra.
  - Las acciones van en una fila: Eventuales, actualizar (ícono con nombre accesible «Actualizar listado») y «Nuevo», con nombre accesible «Nuevo Manifiesto».
  - Búsqueda y Filtros van en una fila. El estado pasa al panel de filtros.
  - Los filtros aplicados se muestran como chips que se quitan con un toque.
  - El botón Filtros anuncia la cantidad activa.
  - «Limpiar» borra también el estado y cumple 44 px.
- **Escritorio:** la cabecera se mantiene. El enlace «Eventuales» queda debajo, en el lugar del anterior, y perdió el texto «· revisión posterior». «Limpiar» ahora también borra el estado.

**Pruebas:**
- **Unitarias:** 4 nuevas en el listado. Fallan sobre el código anterior y pasan después; la de nombres accesibles pasa en ambos, lo que prueba que se conservan. 7 archivos afectados: 104/104 + 1. Typecheck sin errores. ESLint sin errores nuevos.
- **Preview aislado**, fuente `16100dd`, mismos límites:
  - build web y app aprobados;
  - base nueva e integraciones HTTP aprobadas;
  - **E2E completo 39/39** en escritorio 1440, web móvil 360 y app 390, sin omitidas, flaky ni reintentos, en 10 min 13 s. Incluye el recorrido de eventuales con el enlace nuevo y el «+» de `/app`;
  - recorrido de pantallas 18/18.
  - El pico de memoria del contenedor llegó a **1,94 GiB de 2 GiB**, sin OOM. Queda poco margen.
- **Primera corrida de pantallas: 6 falsos positivos.** Con 28 manifiestos, el scroll infinito seguía cargando. Se corrigió el spec en `3deb15e` para esperar a que la lista deje de crecer; luego pasó 18/18. Capturas en [qa/uiux-20261016/eventuales-filtros](qa/uiux-20261016/eventuales-filtros/).
- **O1 confirmado en ambos sentidos:** papelera en «Borrador», ninguna en «Tratado».

**Pendiente, no hecho:**
- El mismo patrón compacto en los otros listados: actores, inspecciones, solicitudes.
- El título repetido en Nuevo/Editar manifiesto en `/app`.
- El título repetido en escritorio.
- «Editar» se ofrece en manifiestos tratados en la tabla de escritorio.
- El mensaje de validación del backend todavía dice «Baja intensidad»: es un cambio de backend que requiere tu decisión.

## Cuarta pasada — formularios, avisos, maquetas y scripts (17/10/2026, estática)

Revisión de código sin ejecutar. **Verificados a mano** en el código: S1–S5 y F1, F2, F3, F5. El resto es hipótesis de código de alta certeza. Nada de esto está corregido todavía.

### Release y scripts (riesgo operativo)

| ID | P | Dónde | Problema | Acción sugerida |
| --- | --- | --- | --- | --- |
| S1 | P0 | `sitrep-deploy-fase3.sh:245` | El redeploy borra todo el directorio del backend salvo `.env`. El `.env` generado no define `UPLOADS_DIR`, y `solicitud.controller.ts:42` guarda documentos de inscripción en `cwd/uploads`. **Cada redeploy con fase3 borraría esos documentos** | Definir `UPLOADS_DIR` fuera del directorio de despliegue y excluir `uploads`. Confirmar el `.env` real del servidor |
| S2 | P1 | `backend/prisma/seed-admin-data.ts` | Sin guarda de `NODE_ENV`. Restablece contraseñas de cuentas administrativas con un valor fijo y ejecuta `deleteMany({})` sobre auditoría, logs y alertas | Guarda de producción o sacarlo del release |
| S3 | P1 | `backend/package.json` `demo:repair` → `repair-demo-certification.ts` | Crea cuentas demo activas con contraseñas conocidas, sin guarda | Guarda de producción o quitar el script |
| S4 | P1 | `MainLayout.tsx:515` → `ui/UserSwitcher.tsx` | El selector de usuarios demo aparece en la cabecera para todos («Cambiar a:», «0 usuarios disponibles») | Mostrarlo sólo en modo demo y dejar un menú de perfil/salida |
| S5 | P1 | `ConfiguracionPage.tsx:304,347` + `notification-dispatcher.service.ts:51-60` | WhatsApp y Telegram «(próximamente)» se activan y confirman, pero no envían nada. El backend registra el teléfono o chat y el texto del aviso en logs | Deshabilitar u ocultar, y no registrar datos personales |
| S6 | P2 | `sitrep-deploy-fase3.sh:184-199` | `DISABLE_EMAILS=true`: recuperación de contraseña y verificación de correo no envían | Confirmar que es intencional y anotarlo en el checklist |
| S7 | P2 | `scripts/health-check.sh` | URL antigua y alertas enviadas a un dominio ajeno | Quitar o reescribir |
| S8 | P2 | `frontend/scripts/capture-*.cjs/ts`, `debug-*.cjs` | Apuntan a producción con credenciales fijas en el código | Pasar a variables de entorno y **rotar si son cuentas reales** |
| S9 | P2 | `scripts/migration/migration-db-restore.sh` | `DROP DATABASE` sin confirmación y nombre de base desactualizado | Confirmación tipeada o archivar |
| S10 | P2 | `scripts/**` | Scripts que apuntan a hosts distintos (`sitrep.ultimamilla.com.ar` vs `rptrazar.mendoza.gov.ar`) | Destino explícito y único |
| S11 | P2 | `vite.config.v6.ts`, `package.v6.json`, `RUN_V6.sh` | Configuración duplicada cuyo dev proxy apunta a producción | Quitar |
| S12 | P2 | `public/test.html`, `public/generate_icons.html` | Se publican con el sitio | Quitar |
| S13 | P3 | `public/sw.js:3` | Versión de caché manual (`v115`) sin subir desde el 13/10 | Subirla en el release o inyectarla como en `sw-app.js` |
| S14 | P3 | `DemoAppOnboarding`, `ViajeEnCursoPage` (sin ruta), `ui/QRCode.tsx` (QR simulado), componentes no importados | Maquetas o código muerto | Quitar, sobre todo el QR simulado |
| S15 | P3 | `MapaActoresTab.tsx:203` | `console.debug` residual | Quitar |
| — | — | `frontend/dist` local | Compilación vieja (`sw` v81) | No desplegar ese `dist`: recompilar |

### Formularios y avisos

| ID | P | Dónde | Problema | Aceptación |
| --- | --- | --- | --- | --- |
| F1 | P1 | `PerfilPage.tsx:75`, `ConfiguracionPage.tsx:109` → `PUT /admin/usuarios/:id` (`hasRole('ADMIN')`) | Ningún rol salvo ADMIN puede guardar nombre o teléfono: 403. Mi perfil culpa a la conexión | Endpoint propio limitado a nombre/teléfono (**requiere backend**), o no ofrecer edición y mostrar el motivo |
| F2 | P1 | `push.controller.ts:25-28`, `AuthContext.logout` | En un dispositivo compartido, la suscripción push sigue del usuario anterior: B no recibe y A sigue recibiendo en un equipo que ya no usa. Es una **fuga de privacidad** | `usuarioId` en el `update` (**backend**) y desuscribir al cerrar sesión |
| F3 | P1 | `CargaMasivaPage.tsx:147-165` | El backend no devuelve `fallidos`, así que siempre dice «completado», aunque fallen todas las filas. Los errores por línea no se muestran y el archivo se borra aunque haya error | Contar `errores`, mostrarlos y conservar el archivo si falla |
| F4 | P1 | `SolicitarCambiosPage.tsx:151` | Oculta el motivo del servidor (una solicitud por actor y año) y sugiere reintentar | Mostrar el motivo. **D:** regla anual |
| F5 | P1 | `ConfiguracionPage.tsx:122-140,214` | Valida 6 caracteres; el servidor exige 8 con mayúscula y número. Culpa a la contraseña actual. Permite doble envío | Misma regla que en el registro, mensaje del servidor y bloqueo mientras envía |
| F6 | P1 | `AdminVehiculosPage.tsx:115,405,224` | Al editar, una capacidad con decimales se re-parsea multiplicada (1500,5 → 15005). Un año vacío se guarda como 0 | Partir del número crudo y no enviar vacíos |
| F7 | P2 | `TransportistaDetallePage.tsx:803-811` | Capacidad o año vacíos se envían como 0 y el error es genérico | Igual que H13 |
| F8 | P2 | `LoginPage.tsx:41` | Puede mostrar el error del intento anterior | Usar sólo el error del intento actual |
| F9 | P2 | `ViajeEnCursoTransportista.tsx:241-273` | Incidente y pausa no se encolan sin señal (retiro y entrega sí). El modal de incidente no es un diálogo accesible | `offlineSafeMutation` y `Modal` |
| F10 | P2 | `AlertasPage.tsx:302,406` | El contador cuenta sólo los primeros 20 avisos; difiere de la campana y la barra inferior | Usar `noLeidas` del servidor |
| F11 | P2 | `GeneradorDetallePage.tsx:230,256,292` | `confirm()` nativo para borrar pagos, DDJJ y documentos | `ConfirmModal` |
| F12 | P2 | `AdminTratamientosPage.tsx:265,276`, Reclamar/Forgot/Reset | Mensajes en inglés o genéricos (fuera del arreglo H01) | `getApiErrorMessage` |
| F13 | P2 | `NotificacionesPoller` montado por cada layout | El aviso «N sin leer» se repite al cambiar de grupo de rutas, se re-registra push y se hacen 3 consultas cada 30 s | Montarlo una sola vez y usar una sola consulta |
| F14 | P3 | `usePushNotifications.ts:44` | Pide permiso de push al cargar, sin gesto del usuario y sin opción para reactivarlo | Botón en Configuración |
| F15 | P3 | `RegistroPage.tsx`, `EscanerQRPage.tsx:84`, interruptores de Configuración | Etiquetas sin vincular, sin `inputMode`/`tel`; QR pendiente que nadie lee; interruptores sin `role="switch"` | Accesibilidad básica |

## Quinta tanda — P1 de frontend corregidos (17/10/2026)

**Commits:** `ab5e474` S4, `f565d2d` S5, `6981704` F3, `8af96e2` F5, `f9aecd1` F6, `2055c93` F4. Sin cambios de backend, permisos ni contratos.

- **S4:** el menú de cuenta sólo muestra el selector de usuarios cuando existen cuentas demo. Si no, muestra «Usuario actual» y un enlace a «Mi perfil».
- **S5:** WhatsApp y Telegram ya no se ofrecen. Quien los tenía activados ve un aviso de que todavía no envían y un botón «Desactivar», que usa la misma ruta de preferencias, accesible para todo usuario autenticado.
- **F3:** carga masiva calcula el resultado con el contrato real (`total`, `exitosos`, `errores`):
  - distingue completado, parcial y error;
  - lista las filas con error;
  - conserva el archivo si falla;
  - explica una sesión vencida o la falta de conexión en lugar de culpar al formato.
- **F5:** el cambio de contraseña:
  - aplica la misma regla que el servidor (8 caracteres, una mayúscula y un número);
  - muestra el motivo real;
  - envía una sola vez;
  - está dentro de un `<form>` con `autoComplete`.
- **F6:** al editar vehículos:
  - la capacidad se precarga desde el número original, no desde «1.500,5 kg»;
  - año y capacidad vacíos no se envían, así que queda lo guardado;
  - se rechazan año y capacidad imposibles;
  - se acepta coma decimal.
- **F4:** la solicitud de cambios muestra el motivo del servidor y conserva lo editado.

**Pruebas:**
- **Unitarias:** 13 casos nuevos. Cada uno falla sin su arreglo, salvo los de la función nueva de vehículos, que no tiene versión previa. Los 10 archivos afectados dan 83/83. Typecheck limpio y ESLint sin errores.
- **Preview aislado** sobre `d0fb16b`:
  - build web/app, base nueva e integraciones HTTP aprobados;
  - **E2E 39/39** sin omitidas, flaky ni reintentos;
  - pantallas **20/20**, más 1 omitida a propósito (el menú de cuenta no existe en `/app`). Ahora incluye configuración, seguridad, carga masiva, vehículos, solicitar cambios y el menú de cuenta.
  - Capturas en [qa/uiux-20261016/formularios](qa/uiux-20261016/formularios/).
- **Memoria:** el contenedor llegó al techo de 2 GiB por caché de archivos durante los builds (`memory.events max` acumulado 727; memoria anónima unos 243 MB al cierre), sin OOM. Las corridas siguen siendo de a una.

**Observado en estas capturas, no corregido:**
- **O2:** en Configuración, la barra superior dice «SITREP» en vez de «Configuración».
- **O3:** la pestaña Seguridad muestra «Guardar cambios», que guarda el perfil. Para quien no es ADMIN termina en el 403 de F1.
- **O4:** en carga masiva, «Descargar plantilla» todavía dice «Descarga disponible cuando el API este conectado».
- **O5:** en Perfil se lee «JPG, PNG o GIF. Máximo 2MB» sin ningún control para subir.

## Sexta tanda — decisiones del dueño aplicadas (17/10/2026)

**Decisiones:** S1 sí, sin migrar archivos porque no hay subidos valiosos. S2/S3 sí. Correo: todavía no. F1: opción A. F2: sí.

| ID | Commit | Cambio |
| --- | --- | --- |
| S1 | `9772169` | `sitrep-deploy-fase3.sh`: `UPLOADS_DIR=/var/www/sitrep-uploads` en el `.env` nuevo. En un `.env` existente se agrega sólo si falta. Crea el directorio para el usuario del servicio. Verificado con `bash -n`. **fase3 no se ejecutó y el `.env` real del servidor no se leyó** |
| S2/S3 | `1dad348` | `seed-admin-data.ts` y `repair-demo-certification.ts` exigen `ALLOW_DEMO_SEED=1` y rechazan `NODE_ENV=production`. **`DEPLOY-NUEVO-SERVIDOR.md:994` y `SETUP.html:266` describen ese paso, que ahora aborta a propósito: hay que actualizar esa documentación** |
| F1 | `8ffe7f0` | `PUT /auth/profile`: sólo nombre y teléfono propios, con auditoría `UPDATE_PERFIL_PROPIO` (antes/después en la misma transacción). Rechazado en sesión suplantada o restringida; cualquier otro campo se rechaza con «Sólo podés modificar tu nombre y tu teléfono». Mi perfil y Configuración lo usan y muestran el motivo del servidor |
| F2 | `8ffe7f0`, `55de02d` | Push: la suscripción pasa al usuario actual. Una sesión suplantada no la modifica. `unsubscribe` sólo borra la propia. Al cerrar sesión se libera el endpoint del dispositivo, como intento de 5 s que no bloquea |

**Pruebas:**
- **Backend:** el typecheck y las pruebas se corrieron dentro del contenedor, porque la Mac no tiene las dependencias de desarrollo del backend. 3 archivos, 31/31, con perfil propio (incluye 404 y suplantación) y push.
- **Frontend:**
  - `pushRelease`: 3 casos nuevos;
  - Configuración: 2 casos nuevos, que fallan sin el arreglo;
  - 6 archivos afectados: 51/51;
  - typecheck limpio.
- **Preview aislado,** fuente `55de02d`, con build de backend:
  - build, base nueva e integraciones HTTP aprobados;
  - **nueva prueba HTTP real `own-profile-push-http.ts` 4/4.** No está incluida en `preview-run.ts http`: se corre aparte;
  - **E2E 39/39**;
  - pantallas 20/20, más 1 omitida a propósito.
  - El contador `memory.events max` acumulado llegó a 1736, sin OOM.

**Preview vivo:** `frontend/cloud-qa/live-easy-accounts.ts` deja cuentas fáciles sólo en la base del preview vivo (`rol@sitrep.test`, contraseña `Sitrep2026`). Correrlo sólo después de restaurar la base viva, nunca antes de HTTP o E2E.

**No hecho:**
- `solicitud.controller.ts:42` sigue guardando por defecto en `cwd/uploads`. Con `UPLOADS_DIR` definido no afecta a producción; alinear ese valor por defecto es opcional.
- El log de datos personales de WhatsApp/Telegram en el backend (S5) sigue pendiente.

## Séptima tanda — un solo título por página (17/10/2026)

Pedido del dueño: el título de la página repetía el de la barra superior, también en escritorio. Ejemplo: Inspecciones.

**Commit `a713f2f`:**
- **11 páginas:** el título queda sólo para lectores de pantalla y se quitan los subtítulos decorativos. Son Notificaciones, Mi Perfil, Tratamientos, Carga Masiva, Vehículos, Alertas, Configuración, Usuarios, Estadísticas, Auditoría e Inspecciones.
- **Se conservan** los subtítulos con datos reales: cantidades y estados de carga.
- **Barra superior:** Configuración, Mi Perfil, Notificaciones, Estadísticas y Ayuda ya no muestran «SITREP» (corrige O2).

**Pruebas:**
- **Unitarias:** 8 archivos afectados, 96/96. La prueba nueva de la barra (4 casos) falla sin el cambio.
- **Preview,** fuente `c0aee8b`:
  - **E2E 39/39**;
  - pantallas 20/20, más 1 omitida a propósito;
  - `alert-catalogue.spec` en verde, incluido el título «Mi Perfil» con `sr-only`, que Playwright sigue considerando visible.
  - `inbox.spec` tiene 3 fallas: el mismo caso en los tres tamaños, por datos de prueba. Espera un seguimiento preparado por otra integración que este preview no corre (`fixture...numero` indefinido), y falla antes de mirar el título. **El título de Notificaciones no quedó verificado en E2E**; sí en las capturas y en las unitarias.

## Comprobado y sin defecto

`Modal` (bloqueo de scroll, trampa de foco, Escape, alto por viewport visible, pie fijo), `Select` (abre en una opción, no en la búsqueda: no abre el teclado), `Input`, `ButtonV2` (44 px en móvil), `Tabs`, `NativeSelect`, `MapLayerToggle`, badges pendiente≠sin leer, wizard público con reintento por documento y envío protegido contra doble toque, `SupportReportDialog` con borrador local.

## No revisado en esta pasada

Reportes, estadísticas, perfiles, catálogos admin, PDF/QR, manual y ayuda; viaje en curso y escáner QR en detalle; contraste medido; APK Android. Ninguno se da por aprobado.
