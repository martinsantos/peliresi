# Inspecciones — P0 de presentaciones y correos · preview 03/11/2026

Estado: **preview con datos artificiales. No publicado, sin merge a main, sin workflows, correos y push apagados.**
Registro único de esta tanda: defectos, cobertura y pendientes. Continúa [el cierre parcial](CIERRE-PARCIAL-INSPECCIONES-20261103.md); no lo reemplaza.

## Referencia

- Rama: `codex/inspection-field-model-20261103`, sobre el cierre `17349400`.
- Código probado: `28bf6967f995227bd2c9df767b9d8b0d0874b97a` (commits `323cd4e5`, `dac33679`, `c9a9bbf0`, `28bf6967`). [Manifiesto del candidato](evidence/inspection-p0-20261103/candidate.json).
- Copia de trabajo nueva, clonada del bare preservado. El checkout histórico no se tocó.

## Suposiciones tomadas (corregibles)

1. El aviso al inspeccionado va al **correo declarado por el inspector** al preparar el enlace. Es una dirección no verificada: además del kill switch y de la familia `inspecciones`, su envío exige un flag propio `INSPECTION_ACT_MAIL_ENABLED=true` (hoy ausente en todos los entornos).
2. Destinatarios: presentación → inspeccionado (confirmación), inspector asignado (responder) y jefatura `ADMIN_INSPECCIONES` (seguimiento). Respuesta → inspeccionado y copia de seguimiento al inspector/jefatura que **no** la escribió. ADMIN y ADMIN_<sector> siguen recibiendo sólo el aviso interno de la campana, como antes.
3. El correo al inspeccionado **no incluye el enlace personal** (el token sólo existe en el correo de entrega; el servidor guarda su hash). Le indica usar el enlace del correo «Copia del acta …» y su vencimiento.
4. El borrador del personal sobrevive al cierre de sesión (vencida o voluntaria) en ese dispositivo, con la misma regla que los borradores de intercambio existentes: queda aislado por cuenta, rol, contexto de empresa, inspector y expediente.
5. El enlace limitado no admite adjuntos; no se agregaron. «Adjuntos pendientes» no aplica a esta superficie.

## P0-1 · Recuperación de presentaciones y respuestas

| Superficie | Clave de aislamiento | Se guarda | Se borra |
|---|---|---|---|
| Enlace limitado (`/acta-compartida/:accesoId`, web y app) | `accesoId` (un token por acceso) | nombre, tipo, texto, id de solicitud y vencimiento del enlace | registro confirmado (201); 403/404 del enlace (vencido, revocado, inválido); vencimiento aunque no haya conexión; presentación ya visible en el historial |
| Respuesta del equipo (Finalizar → Copia del acta y respuestas) | cuenta + contexto de autorización + expediente, por presentación | texto e id de solicitud | publicación confirmada; respuesta idéntica ya publicada |

- El borrador del enlace se muestra **sólo después** de que el servidor validó el acceso.
- El id de solicitud se guarda antes de enviar: tras una respuesta perdida, reabrir y reenviar repite la misma operación y el servidor devuelve la presentación existente (sin duplicado). Editar el texto genera un id nuevo.
- Error de red o 5xx: el texto y el id se conservan, con aviso explícito. Error terminal del enlace: se borra del dispositivo y se avisa que hay que copiarlo.
- Dos pestañas: si la otra pestaña partió de la copia de esta, se adopta su versión con aviso; si ambas divergieron, se ofrece elegir. Si otra pestaña registró o descartó, se recarga el historial antes de permitir reenviar.

## P0-2 · Correos de presentación y respuesta

- Nuevo `inspectionActMail.service.ts`. Seis variantes (2 eventos × 3 audiencias). Cada una indica **motivo, acta/expediente, responsable y próxima acción**; el personal recibe acceso web/app al expediente, que exige sesión.
- Se escriben en `email_queue` dentro de la misma transacción que la presentación/respuesta, con id estable `inspection-act:<evento>:<audiencia>:<destinatario>` y `skipDuplicates` (deduplicación). Sólo en la rama de creación; los reintentos idempotentes no generan filas.
- Con el kill switch activo quedan `SUPRIMIDO / EMAIL_DISABLED` y nunca se liberan después (sin backfill, igual que el resto de avisos). Con todo habilitado quedarían `PENDIENTE / NOTIFICATION_READY`.
- Al entregar, `queuedNoticeStillEligible` vuelve a verificar: enlace no revocado ni vencido y destinatario igual al declarado; inspector todavía asignado; jefatura todavía designada; cuenta activa, verificada y con avisos por correo.
- Enlace revocado antes de una respuesta: el inspeccionado no recibe correo; el personal conserva su copia.
- El equipo ve en cada presentación/respuesta **Avisos por correo**: audiencia, destinatario, asunto, estado legible y el mensaje completo en un marco aislado. Nuevo `GET /api/inspecciones/:id/correos-acta`, con el mismo permiso que el expediente.
- Aviso de campana existente sin cambios (`soloCampana`), para no duplicar con el relé genérico.

## Verificación (sobre 28bf6967, preview aislado)

| Verificación | Resultado y límite |
|---|---|
| Tipos backend/frontend | Aprobados |
| Pruebas backend | 358 en 15 archivos. Nuevas: 18 de correos (`inspectionActMail.service.test.ts`) y 4 de controlador. Incluye `notification-mail` y `email.service` como regresión del relé |
| Pruebas frontend | 102 en 11 archivos. Nuevas: 9 del enlace limitado y 7 del panel del equipo |
| Compilaciones | Backend, web y app aprobadas; pico 1,87 GB con la API aislada detenida (guarda 1,95 GB). [build.json](evidence/inspection-p0-20261103/build.json) |
| Circuito API | 32 comprobaciones ([flow-p0.json](evidence/inspection-p0-20261103/flow-p0.json)): presentación, reintento idempotente, id reutilizado con otro texto → 409, filas por audiencia, respuesta sin copia al autor, copia al inspector cuando responde la jefatura, enlace revocado sin acceso ni correo, actor denegado en 5 rutas internas, cero filas enviadas |
| Navegador app | 320/393 px: recuperación tras cerrar/reabrir, fallo sin conexión con texto e id conservados, registro confirmado limpia el borrador, enlace revocado borra sólo su borrador |
| Navegador web | 1365/768 px: respuesta sin publicar recuperada tras salir y tras cerrar sesión (con ingreso intermedio de otra cuenta); panel sin desborde; registro de avisos legible |
| Rol actor | Generador artificial: menú sin Inspecciones ni Mis inspecciones; expediente → «Acceso no disponible»; API 403 |
| Correos | 8 renderizados del circuito revisados a 320/375 px ([correos](evidence/inspection-p0-20261103/correos/), [capturas](evidence/inspection-p0-20261103/capturas/)) |

[Resumen y límites](evidence/inspection-p0-20261103/verification.json). Arnés: [qa-harness.mjs](evidence/inspection-p0-20261103/qa-harness.mjs) y [flow-p0.mjs](evidence/inspection-p0-20261103/flow-p0.mjs) (contraseñas por variables de entorno, no en el repositorio).

## Defectos encontrados y corregidos en la revisión visual

| # | Dónde | Defecto | Corrección |
|---|---|---|---|
| 1 | Correo, todas | «Descargo recibida», «Nueva descargo» | Concordancia por tipo; prueba |
| 2 | Correo y pantallas | Hora «07:00:59» sin a. m./p. m. (eran las 19:00) | Correo: 24 h explícita «h (Mendoza)», también en el correo de entrega existente. Pantallas: formateador compartido de inspecciones |
| 3 | Correo 320 px | Etiquetas cortadas a mitad de palabra («Responsabl e») | Datos apilados etiqueta/valor |
| 4 | Correo inspector | Ruta indicada inexistente («Expediente y seguimiento → …») | «abrí el expediente, paso 4, tarea Copia del acta y respuestas» |
| 5 | Enlace, app 320 | Fallo de envío anunciado sólo arriba, fuera de vista | Mensaje junto al botón, con causa legible |
| 6 | Enlace | Texto recuperado sólo visible al pie | Acceso «Tenés un texto sin registrar · ir al formulario» arriba |
| 7 | Enlace revocado | Ofrecía «Reintentar» inútil | Se oculta ante 403/404/410 |
| 8 | Enlace | «p. m..» doble punto | Redacción |
| 9 | Panel del equipo | Presentación pendiente enterrada (sección ~8.600 px con 16 presentaciones y 19 enlaces) | Pendientes primero con conteo; respondidas y enlaces plegados (~1.570 px); formulario de seguimiento tras «Agregar otra respuesta» |
| 10 | Panel del equipo | Error de publicación al final de la sección | Junto a la respuesta afectada |

## Pendientes y observaciones (no resueltos en esta tanda)

| Prioridad | Tema | Detalle |
|---|---|---|
| P1 | Rótulo del paso 4 web/app | Web «Revisar y firmar», app «Finalizar» para el mismo paso. El manual nombra ambos; falta decidir un rótulo único. |
| P1 | Expediente cerrado | En un caso Notificado, «Leer y firmar» muestra «Guardá los cambios y sincronizá las fotos…» con el botón deshabilitado, y el paso 1 ofrece «Continuar: Hechos…»: mensajes de edición en modo lectura. |
| P1 | Correo al inspeccionado | No lleva el enlace personal (sólo se guarda su hash). Si se pierde el correo de entrega, hay que generar un enlace nuevo. Decidir con la institución. |
| P1 | Envío real | Requiere autorización separada: kill switch, `EMAIL_NOTIFICATION_FAMILIES` con `inspecciones` y `INSPECTION_ACT_MAIL_ENABLED=true`. Ningún correo fue enviado. |
| P1 | Pruebas sólo automatizadas | Conflicto entre pestañas, vencimiento real del enlace, sesión vencida por tiempo (se probó cierre voluntario). |
| P1 | Dispositivo | Android físico, PWA instalada, red real intermitente: pendientes. La caída de red se simuló en la pestaña. |
| P1 | Dispositivo compartido | El borrador del personal sobrevive al cierre de sesión en ese equipo (mismo criterio que los intercambios). Revisar si la institución lo acepta. |
| P2 | Preview | El navegador reutilizó un `index.html` anterior tras una recompilación (sin service worker): conviene `no-cache` en el relay del preview. |
| P2 | Datos de laboratorio | El caso `qa-field-case` acumula 19 enlaces y 18 presentaciones artificiales de las corridas; útil para estados largos, no representa un caso típico. Se agregó una cuenta artificial `jefatura01@practica.sitrep.test` (ADMIN_GENERADOR + ADMIN_INSPECCIONES) mediante el alta de administración; su contraseña está sólo en el laboratorio. |
| — | Validación humana | Comprensión con inspectores, alcance de firma, entrega, apelación y jefatura: pendiente. Nada de lo anterior la sustituye. |

## Seguridad operativa

Sólo preview y datos artificiales. Producción, main, workflows y cuentas reales sin cambios. Correos y push apagados; 0 filas enviadas. Sin migraciones nuevas (la de `ADMIN_INSPECCIONES` de la tanda anterior sigue sin aplicarse fuera del preview). En el laboratorio: vigencia de `lab-secrets.json` extendida 10 h (sin rotar secretos, respaldo `.bak-20261103`), relay y bridge reiniciados, API 3048 reiniciada para cada backend; capacitación 3038 intacta. Para compilar dentro de la guarda se liberó caché de páginas del cgroup del contenedor QA y se detuvo la API aislada durante el build; los límites 1 CPU / 2 GiB / sin swap no se modificaron.
