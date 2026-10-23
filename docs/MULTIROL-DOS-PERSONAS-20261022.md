# Multirol y dos personas por razón social — 22/10/2026

## Alcance

Revisión solicitada exclusivamente en preview: una razón social/CUIT con actividades Generador, Transportista y Operador aprobadas, y hasta dos personas en total, incluida la titular. El cupo no crece con roles ni establecimientos. Responsabilidad ante SITREP y permisos operativos siguen siendo decisiones separadas.

Base `c861c2e3`, rama `codex/sitrep-training-20261018`, checkout autorizado `sitrep-production-source-20261001`. Producción documentada en `712de167`; no se accede ni se publica durante esta revisión. Main permanece en `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Sin push ni workflows. No hay migraciones nuevas.

## Fallos y correcciones

1. **Alta de una tercera persona por CUIT.** Reproducción HTTP previa: entidad con dos responsables, sin actividades, seguida de alta administrativa de Generador con una cuenta titular nueva: devolvía 201 en lugar de 409. El conteo confundía la cuenta recién insertada con una persona ya autorizada. La reserva ahora reconoce como previa la vinculación por responsabilidad, permiso o actividad, no la sola declaración del CUIT. El mismo control alcanza altas administrativas, aprobación de solicitudes y vinculación de actividades, dentro de su transacción.
2. **Solicitante pendiente contado como representante.** La declaración de CUIT de una solicitud pública no acredita representación. La inferencia por CUIT requiere identidad activa y verificada; una persona suspendida con responsabilidad, permiso o actividad vinculada conserva su lugar. Los excesos históricos se muestran y no se corrigen borrando registros.
3. **Invitaciones que no podían aceptarse.** Ya no se prepara una invitación para un permiso registrado, activo o revocado. La pantalla explica cómo revisar y actualizar/reactivar mediante «Autorizar cuenta verificada», con la revisión actual del permiso. Un enlace antiguo no recupera acceso revocado.
4. **Invitaciones duplicadas.** Una invitación vigente por persona y actividad se reutiliza o se revoca antes de generar otra. Invitar a esa misma persona para otra actividad no consume otro lugar. Repetir la revocación de una invitación no vuelve a emitir el evento. El enlace preparado se muestra sólo para su persona/rol y mientras siga pendiente y vigente; se oculta al revocarlo o aceptarlo.

5. **Consulta de sello fuera del alcance de la sede.** La revisión de consola encontró un 403 en `/blockchain/manifiesto/:id` al abrir un manifiesto como representante limitado a un establecimiento. El servidor aplicaba correctamente su permiso de alcance completo, pero la interfaz igualmente consultaba ese panel. Ahora sólo lo monta en cuenta personal o representación de todas las sedes. Los controles del servidor y la trazabilidad del manifiesto no cambian. Cuatro casos nuevos comprueban permiso limitado/completo en web y app; la regresión real del representante exige consola sin errores.

## Recorrido de uso

- La primera actividad aprobada vincula la identidad y la entidad. Las actividades adicionales conservan la misma cuenta y requieren aprobación independiente.
- En **Empresas y establecimientos → Personas autorizadas**, el contador muestra las personas y reservas vigentes compartidas entre todas las actividades.
- La segunda persona puede recibir uno, dos o tres roles. Los establecimientos limitan alcance, no crean cupos nuevos.
- Una invitación reserva lugar durante 24 horas y exige la cuenta invitada verificada. No equivale a aprobación de una actividad ni designación como responsable.
- Retirar responsabilidad no elimina los permisos por actividad. Revocar un rol no elimina los otros. Para liberar el lugar de una persona delegada hay que retirar sus permisos restantes, su responsabilidad y sus invitaciones vigentes.
- Los avisos internos conservan decisiones y revocaciones. Correos y push permanecen apagados.

## Evidencia y cierre

**Cerrado en preview, no publicado.** Código y manual contrastados contra **1.785 archivos SHA-256** sincronizados desde este checkout. No se reutilizan estos bundles QA con API `/api` para una publicación.

| Comprobación | Resultado y alcance |
| --- | --- |
| Backend completo | **1.582/1.582 PASS**, sin omitidos; incluye el conteo, bloqueo transaccional y permisos finales. |
| Frontend completo | **1.858/1.858 PASS**, sin omitidos, antes del último ajuste de visibilidad del panel blockchain. |
| Regresión frontend final | **30/30 PASS** sobre la versión final: ficha del manifiesto, panel blockchain y gestión de personas; incluye cuatro casos nuevos de alcance limitado/completo en web y app. |
| E2E | **33/33 casos únicos PASS**, 11 recorridos por superficie: escritorio, web angosta y `/app`. Repetición final de invitaciones **3/3**, roles de la segunda persona **3/3** y representante limitado **3/3**, sin omisiones, fallos ni reintentos. Las repeticiones no suman casos únicos. |
| HTTP real | Representación **131 solicitudes PASS**, incluidas tres carreras concurrentes; casos de altas/cupo/invitaciones **133 solicitudes PASS**. Además, empresa **7 grupos** y multirol **8 grupos PASS**, con paginación de 215 entidades nuevas y alcance de establecimientos. |
| Compilación | Backend, tipos frontend y builds seriales web/app PASS. Builds finales incluyen el último ajuste de alcance. |
| Lint dirigido | **0 errores / 42 advertencias** en los archivos frontend/QA revisados; no se silenciaron reglas. |
| Auditoría | **1.038 tablas QA anteriores intactas** por conteo y huella; cero intentos, envíos o cola activa de correo. Cuatro alias CAP rechazados con 403; configuración de ambos procesos comprobada sin proveedores ni push. |
| Evidencia visual | **84 capturas** de recorridos y repeticiones. Revisión de escritorio, web angosta y app; contenido/identidad visibles, sin desbordes ni overlay de error en los recorridos. Consola final del representante sin errores en las tres superficies. |

Se comprobó: misma identidad al cambiar de Generador a Transporte y Operador; segunda persona con tres roles y cupo 2/2; tercera persona rechazada en alta administrativa y aprobación pública G/T/O, con rollback completo; reemplazo explícito permitido tras liberar el lugar; invitaciones vigentes, aceptación única, revocaciones y reactivación con revisión vigente; avisos de las decisiones; alcance por establecimiento; recuperación de la sesión tras revocar la actividad. Un rol revocado no afecta automáticamente a los otros ni borra los documentos anteriores.

La comprobación visual detectó un detalle cosmético previo en el encabezado lateral de escritorio: «TRANSPORTISTA» puede partirse en dos líneas. No afecta la selección de rol ni el acceso; queda registrado para la revisión general del encabezado, sin ampliar esta corrección de permisos/cupo.

Preview detenido **22/10/2026 21:38:34 Mendoza** después de cerrar API, frontend y PostgreSQL. Imagen, base artificial y evidencias conservadas. Cgroup con `max=0`, `oom=0`, `oom_kill=0`; Docker confirma detenido, sin OOM. No se accedió a producción ni se modificó main, configuración productiva, cuentas reales, históricos reales o workflows.

La preparación de expedientes para revisión usa sólo filas artificiales en el esquema exclusivo. Se ejercitan los controladores HTTP reales de creación/aprobación; esta tanda no certifica documentación fiscal ni repite la carga completa de ATM/energía.

Incidencias del arnés conservadas en evidencia: los primeros ensayos de las pruebas nuevas ajustaron el alcance del selector de estado y la espera del refresco de React Query. La primera suite completa de frontend dio 1.857/1.858: `NuevoManifiestoCompatibility` falló a los 5.126 ms, alrededor del límite predeterminado de 5 s. Su repetición aislada, sin cambios de producto, aserciones o timeout, aprobó 7/7; el caso señalado tardó 819 ms. La segunda suite completa aprobó 1.858/1.858 con un margen de 15 s por caso sólo en el ejecutor QA limitado a 1 CPU, sin modificar la configuración del proyecto ni sus expectativas funcionales.

Esquema sintético exclusivo `multirole_people_20261022` en el contenedor `sitrep-qa-training-20261018`, host preview `76.13.234.213`. Serial, un worker, 1 CPU/2 GiB/swap cero. Evidencias locales ignoradas por Git: `test-results-multirole-people-20261022/`.

Manual **2026.22.7**, guía «Una entidad, varias actividades y dos personas» ampliada sin cambiar sus seis pasos ni capturas. Renderer y CSS conservados byte por byte.

**Límite de validación:** web escritorio, web de ancho móvil y `/app` en Chromium. Android físico queda pendiente por decisión del dueño; no se certifica PWA instalada ni entrega externa. Browser plugin not available: se usa Playwright en el preview, sin conectar el navegador a producción.


## Archivos de evidencia

En `test-results-multirole-people-20261022/`: `summary.json`, `backend-all.json`, `frontend-all.json`, `frontend-all-first.json`, `frontend-compatibility.json`, `scope-frontend.json`, `representation-http.json`, `edge-http.json`, los cuatro reportes de navegador, `audit.json`, `lint.json`, `source-proof.json` y `preview-closed.json`. `delegate-403-diagnostic.json` conserva la petición inicial rechazada; `scope-browser.json` acredita la corrección. No contienen credenciales reales. Las cuentas son exclusivamente `@night-qa.invalid`.

Para una próxima inspección interactiva se puede incorporar Browser plugin; estas pruebas quedaron ejecutadas con Playwright aislado y no dependen de ese complemento.

Capturas representativas, agrupadas:

- [Web: dos personas con tres roles](../test-results-multirole-people-20261022/edge-browser/multirole-people-one-ident-1fd49-thout-duplicate-invitations-web-desktop/three-roles-two-people.png).
- [App: cupo compartido 2/2](../test-results-multirole-people-20261022/edge-browser/multirole-people-one-ident-1fd49-thout-duplicate-invitations-app/three-roles-two-people.png).
- [App: segunda persona actuando como Operador](../test-results-multirole-people-20261022/edge-browser/multirole-people-one-ident-1fd49-thout-duplicate-invitations-app/representative-operador.png).
- [App: manifiesto creado por representante de una sede](../test-results-multirole-people-20261022/scope-browser/enterprise-delegated-site--6c787-g-other-sites-or-management-app/delegate-created-manifest.png).
