# Auditoría acotada SITREP — 4 de septiembre de 2026

## Dictamen

Base funcional apta para continuar capacitación supervisada. No certificada todavía para apertura general de altas y operación sin acompañamiento. No hace falta un refactor completo: cerrar las inconsistencias identificadas y ejecutar un flujo real aislado por actor.

## Evidencia de esta revisión

- Backend: 305/305 tests, 37 archivos; build TypeScript correcto.
- Frontend: 100/100 tests, 17 archivos; build web y build PWA correctos.
- API SITREP consultada por SSH: status=ok, db=connected.
- Release web activa: product-20260903-082300-altas-review.
- Disco servidor: 87% usado, 11 GB disponibles.
- ClamAV instalado: 1.4.3; firmas reportadas por clamscan: 28043, 26/06/2026.
- Archivo de configuración consultado: NODE_ENV=production, DISABLE_EMAILS=true, DEMO_LOGIN_ENABLED=true. No se inspeccionó el entorno efectivo de cada proceso; no equivale a una auditoría completa de colas/correos.
- Git: rama codex/sitrep-hardening-snapshot-20260729, 146 entradas modificadas y 107 no rastreadas. Las entradas pueden representar directorios.
- No se ejecutaron altas, envío de correos, cambios de credenciales ni migraciones. No se desplegó código. No se auditó RPTRAZAR en esta pasada.

## Hallazgos para resolver antes de apertura general

1. **Alta administrativa y pública aplican condiciones diferentes.** `backend/src/controllers/actor.controller.ts:115`, `:371`, `:900` crean usuarios activos y con correo confirmado, sin exigir en esos handlers los documentos que exige `solicitud.controller.ts:660`. El cambio de contraseña obligatorio sí existe, pero no reemplaza la validación documental. Centralizar condiciones de habilitación o definir y auditar una excepción administrativa explícita.

2. **Alta no atómica: puede quedar un usuario sin actor.** Los tres handlers anteriores crean primero `usuario`, luego el actor con otra operación Prisma sin transacción conjunta. Si falla el segundo paso, el email queda ocupado y el reintento puede bloquearse. Agrupar creación de usuario/actor/flota en una transacción y probar rollback ante fallo de datos.

3. **Pérdida silenciosa de progreso ante cortes.** `frontend/src-v6/pages/public/InscripcionWizardPage.tsx:249` avanza antes de confirmar guardado y descarta el error con `.catch(() => {})`; navegar por el selector de pasos no guarda la sección. Archivos seleccionados viven en memoria hasta el envío. Mostrar estado de guardado, conservar cambios pendientes y ofrecer reintento. Probar corte → recarga → reanudación.

4. **Documentos frente/dorso y vigencia tienen un contrato incompleto.** En `document-management.controller.ts:247` la cara de documento de solicitud queda en el nombre; la deduplicación retorna el primer documento del mismo archivo/solicitud sin distinguir tipo/cara. La aprobación (`solicitud.controller.ts:660`) verifica tipo, estado y fecha final, pero no inicio de vigencia ni ambas caras. La UI pública tampoco recoge fechas al adjuntar. El alta administrativa de transporte recoge número de licencia, pero no carga el carnet en ese wizard; el soporte documental está en otros recorridos. Unificar identidad documental, metadatos y requisitos según sujeto, y probar rechazo de documentación incompleta/futura.

5. **Antivirus instalado con firmas antiguas.** La fecha reportada es de más de dos meses atrás. Verificar actualización automática, actualizar firmas, comprobar modo efectivo de escaneo y probar archivo inocuo/EICAR en QA antes de admitir documentación pública. No se ejecutó actualización en esta auditoría.

6. **Release poco reproducible.** Mucho WIP sin registrar y despliegue desde compilaciones locales. El incidente del 03/09 mostró que permisos 0700 en el artefacto podían cortar los estáticos. Consolidar una release versionada; validar lectura con el usuario real de Nginx antes del cambio de enlace y probar restauración de backup. Las releases previas ayudan al rollback, pero no demuestran recuperación de base de datos.

## Limitaciones que deben quedar explícitas

- Internacional: el selector y borrador existen; `manifiesto-workflow.controller.ts:87` bloquea la firma con 409. No es todavía un circuito internacional completo. Puede quedar fuera de la primera salida nacional.
- SMTP: el archivo consultado lo mantiene desactivado. Nuevos transportistas administrativos reciben una contraseña aleatoria privada y requieren invitación/reset; falta certificar una vía de entrega de acceso compatible con esa configuración. Conservar credenciales de capacitación no resuelve altas nuevas.
- GPS/cámara/push: no certificados en dispositivos físicos en esta pasada. La certificación del 30/08 ya los excluía. No prometer GPS continuo con teléfono bloqueado en una PWA.
- E2E documental: `frontend/e2e/document-qa-workflow.spec.ts` requiere habilitación y base aislada; los tests unitarios no lo ejecutan. Su comprobación PWA verifica el shell, no operación completa offline ni recepción push.
- TEF: generador administrativo sanea entradas y calcula en backend; operador administrativo guarda `tefInputs` directamente. Confirmar regla esperada y cubrir ambos caminos con casos de negocio antes de certificar equivalencia.

## Cierre mínimo propuesto

1. Resolver hallazgos 1–4 y el acceso inicial sin SMTP; conservar credenciales existentes.
2. Actualizar/verificar firmas antivirus y preparar release reproducible con preflight de permisos y rollback.
3. En base QA aislada, un E2E por generador, transporte y operador: alta → documentación → revisión → acceso → manifiesto nacional → cierre/certificado; incluir concurrencia ATM, permisos cruzados y corte de red.
4. Una sesión en Android y otra en iPhone: instalación, QR físico, GPS activo, push con reposo y regreso desde segundo plano.

No se requiere rehacer diseño ni componentes globales para cerrar estos puntos. Estimación orientativa: 3–5 jornadas enfocadas si hay QA y dispositivos disponibles; no es una promesa de plazo ni incluye completar operación internacional.
