# SITREP — estabilización web/PWA, 5 de septiembre de 2026

## Resultado

Release `20260905-stabilization` desplegada únicamente en SITREP. RPTRAZAR y el sistema operativo gubernamental no fueron intervenidos. No se modificaron credenciales demo ni se habilitó SMTP.

- Web: https://sitrep.ultimamilla.com.ar/login
- PWA: https://sitrep.ultimamilla.com.ar/app/login
- Notificaciones web: https://sitrep.ultimamilla.com.ar/notificaciones
- Escáner PWA: https://sitrep.ultimamilla.com.ar/app/escaner-qr
- Manual: https://sitrep.ultimamilla.com.ar/manual/
- Formulario para capacitación, sin altas/envíos: https://sitrep.ultimamilla.com.ar/inscripcion/operador?modo=revision

## Cambios de esta iteración

1. Dashboard móvil: estadísticas coherentes con la API, actividad real, filtros por estado, acciones según rol y recuperación explícita ante errores. Se eliminaron contadores de notificaciones ficticios.
2. Guards compartidos web/PWA: navegación por rol y restricciones de rutas administrativas; manejo de error y solicitud pendiente en móvil. La autorización definitiva sigue siendo del backend.
3. Altas públicas: no se avanza si falla el guardado; reanudación recuperable, protección contra doble envío, aviso de cambios pendientes, controles de vigencia y frente/dorso. Los archivos seleccionados pendientes de envío no sobreviven a una recarga: el formulario lo advierte.
4. Altas administrativas/importación: creación atómica de usuario y actor, nuevos actores inactivos y activación condicionada a documentación válida. Los actores existentes conservan su estado.
5. Documentación: reglas comunes de aprobación, vigencia, antivirus y ambas caras; se preservan esos metadatos en el expediente permanente y se revisan al emitir certificados.
6. Archivos: validación estructural en worker limitado; rechazo de PDF corrupto/protegido, más de 30 páginas, imágenes corruptas o superiores a 25 megapíxeles. Continúan el límite de 10 MB y ClamAV obligatorio.
7. Errores: campos obligatorios se rechazan antes de escribir; no se registran excepciones crudas con consultas/contraseñas ni se exponen errores internos fuera de desarrollo.
8. Web: se agregó `/notificaciones`, que existía en PWA pero daba 404 en escritorio.

## Evidencia ejecutada

| Comprobación | Resultado |
|---|---|
| Backend unitarias | 340/340, 42 archivos |
| Frontend unitarias | 123/123, 20 archivos |
| Build backend | Correcto |
| Build web | Correcto |
| Build PWA | Correcto |
| E2E de salida en QA aislada | 52 aprobados; 2 repeticiones móviles de impersonación omitidas por diseño; 0 fallos |
| Smoke en dominio público después del despliegue | 12/12 |
| `git diff --check` | Sin errores |

La suite QA cubrió ocho roles, navegación web/PWA (72 visitas administrativas entre ambas superficies y tamaños), recuperación de error de dashboard, formularios de revisión a 360/390/1366 px, alta inactiva de los tres actores, rechazo de activación sin documentos, flujo nacional de manifiesto hasta tratamiento, rechazo entre propietarios, ATM concurrente/idempotente, PDF corrupto/MIME falso, certificado firmado y verificación pública. El workflow de estados se ejercitó por API y se verificó su resultado en UI: no equivale a pulsar todos los botones de todos los formularios.

El smoke público verificó autenticación real, los cuatro perfiles demo en web/PWA, impersonación reversible, catálogos, recursos principales y assets offline. No creó manifiestos ni altas productivas.

No se ejecutaron indiscriminadamente todos los scripts E2E históricos: algunos contienen IDs productivos fijos o acciones mutantes. La certificación corresponde a la suite de salida indicada, no a una garantía universal de ausencia de defectos.

## QA y despliegue

- Base separada: `sitrep_qa_stabilization_20260905`, sin copiar usuarios ni datos productivos; usuario SQL exclusivo y SMTP desactivado.
- Runtime QA: `/opt/sitrep-qa-stabilization-20260905`, puerto loopback 3103.
- Almacenamiento QA: `/var/lib/sitrep-qa-uploads-20260905`.
- Migraciones nuevas, probadas en QA y luego aplicadas en SITREP: `20260905120000_solicitud_document_face`, `20260905150000_new_actor_pending_documentation`. Son aditivas; no cambian contraseñas ni estados de filas existentes. Total: 17 migraciones aplicadas.
- Release web: `/var/www/sitrep-releases/20260905-stabilization`.
- Release backend: `/var/www/sitrep-backend-release-candidates/20260905-stabilization`.
- Respaldo privado previo: `/var/backups/sitrep/stabilization-20260905/before.dump`. Se verificó lectura completa con `pg_restore --file=/dev/null`, no una restauración en una base real.
- Metadata de reversión: `/opt/sitrep-release-20260905-stabilization/release.json`.
- Versiones anteriores conservadas: web `product-20260903-082300-altas-review`; backend `20260830-203031-mobile-v28`.
- Activación por sustitución atómica de enlaces y recarga rolling de las dos instancias PM2 de SITREP, con rollback ante fallo de readiness/smoke. Sin reboot ni actualización de paquetes/SO.
- Permisos de lectura verificados como usuario `nginx` antes de activar.
- Dependencias: lockfile idéntico al backend anterior; Prisma generado en la copia nueva, sin modificar sus node_modules anteriores.
- ClamAV: firmas actualizadas a 28114; motor 1.4.3 conservado. La actualización de motor a la versión recomendada queda para mantenimiento separado.

## Capacidades físicas y conectividad: análisis y límite de certificación

La exclusión no significa que estas funciones estén ausentes. Están implementadas y fueron verificadas a nivel de código y de navegador simulado; todavía no tienen evidencia de aceptación en teléfonos físicos representativos. Por eso no se las declara «certificadas» ni se promete ausencia absoluta de defectos.

| Capacidad | Implementado y comprobado | Riesgo que sigue abierto | Condición para certificarla |
|---|---|---|---|
| Cámara QR | `getUserMedia`, cámara frontal/trasera, linterna cuando el dispositivo lo permite, reintento y lectura alternativa desde una foto. El escáner está disponible en [PWA](https://sitrep.ultimamilla.com.ar/app/escaner-qr). | Permisos del navegador, cámaras corporativas bloqueadas, foco/iluminación y compatibilidad del dispositivo no se reproducen con Playwright. | Probar QR de manifiesto y certificado en Android Chrome y en iPhone/iPad instalado, con permiso nuevo, permiso denegado y foto de galería. |
| GPS de viaje | `watchPosition` de alta precisión durante `EN_TRANSITO`, primer punto inmediato, cola local cada 15 s, envío cada 30 s, persistencia y reintento al volver la red. | Una PWA no controla la ubicación continua cuando el SO la suspende, bloquea o cierra. Precisión, batería y permisos «siempre» dependen del teléfono. | Viaje real de al menos 20 minutos en Android y iOS: pantalla activa, bloqueada, pérdida/retorno de red y cierre/reapertura; contrastar ruta, horas y puntos pendientes. |
| Push con teléfono bloqueado | Service worker recibe `push`, muestra aviso, vibra según prioridad y abre la ruta interna al tocarlo. El servidor SITREP tiene VAPID configurado y la pantalla Configuración permite activar, probar y desactivar por dispositivo. | La entrega depende de la suscripción real, permisos, ahorro de batería, red y del proveedor push del navegador. No se probó recepción con pantalla bloqueada en un equipo físico. | Instalar la PWA, aceptar permiso, bloquear el teléfono y usar «Enviar prueba» desde Configuración; repetir en Android Chrome y en iOS/iPadOS instalado. Registrar modelo, SO y resultado. |
| Carga documental sin red | El expediente permanente de actores puede encolar archivos cifrados en IndexedDB si la red/VPN falla y los sincroniza después. La API vuelve a validar archivo, antivirus y permisos. | El alta pública conserva archivos seleccionados sólo hasta que se envían; una recarga antes de transmitirlos exige volver a elegirlos. Background Sync no es uniforme en todos los navegadores. | Cortar conectividad al cargar un documento desde expedientes de generador, transportista y operador; recuperar red, abrir de nuevo la PWA y comprobar una sola carga con su hash. Probar por separado el aviso de recarga en el alta pública. |

### Decisión operativa para esta semana

- La capacitación puede demostrar QR mediante **foto de galería** si la cámara no recibe permiso; no debe quedar bloqueada por hardware.
- El seguimiento GPS se demuestra con la aplicación abierta y el indicador de estado visible. No se presenta como monitoreo garantizado mientras el teléfono está bloqueado.
- Push se presenta sólo después de que cada participante instale la PWA y active el permiso. La prueba se hace con el botón «Enviar prueba» de su propio dispositivo, sin notificar usuarios finales.
- Para carga documental durante conectividad inestable, usar el panel de expediente del actor y esperar la confirmación de sincronización antes de cerrar. Para altas públicas, mantener la pantalla abierta hasta que los archivos indiquen guardado.

### Plan de certificación física — no bloquea la capacitación, sí la declaración de producción plena

1. Preparar dos cuentas QA sintéticas y dos QR de manifiesto/certificado; no usar cuentas ni documentos de ciudadanos.
2. En Android Chrome y un equipo iOS/iPadOS instalado, ejecutar cámara, GPS, push y carga/offline según la tabla.
3. Registrar versión de SO, navegador, permisos, batería, conectividad, resultado esperado/obtenido y captura de pantalla.
4. Si una plataforma no cumple, activar su alternativa operativa (foto QR, operación en primer plano o aviso in-app) y no anunciar la capacidad como garantizada.
5. Repetir el E2E QA y un smoke público de sólo lectura luego de cualquier ajuste.

## Límites que continúan abiertos

- Cámara QR física, precisión GPS real y push con teléfono bloqueado siguen pendientes de la prueba asistida anterior. No se declaran certificados.
- No se garantiza GPS continuo en segundo plano con una PWA; depende del sistema operativo.
- El alta pública no certifica una carga documental íntegramente offline: los archivos aún no transmitidos se deben volver a seleccionar tras una recarga. El expediente de actores sí dispone de cola cifrada, pero requiere la validación física descrita.
- Credenciales nuevas por correo y SMTP siguen diferidos expresamente. La capacitación utiliza los accesos existentes.
- El flujo internacional no forma parte del alcance nacional aprobado para esta salida.
- No se realizó carga masiva de estrés ni recertificación documental de todos los actores históricos.
- El WIP sigue sin commit: se preservó el estado previo en `/tmp/sitrep-stabilization-kPC9NY/` y no se descartaron cambios ajenos. La consolidación de Git sigue siendo un trabajo separado.

## Reproducción

Pruebas locales: `cd backend && npm test && npm run build`; `cd frontend && npm test && npm run build && npx vite build --config vite.config.app.ts`.

E2E QA: usar `frontend/e2e/run-stabilization-qa.ts` con `QA_ENV_FILE`, `QA_FIXTURE_FILE` y `QA_RESULTS_DIR` privados, preview loopback 4179 y túnel QA 13103. Ejecutar `stabilization-qa.spec.ts document-qa-workflow.spec.ts document-public-assets.spec.ts api-health.spec.ts demo-access-impersonation.spec.ts qa-navigation.spec.ts --project=chromium --project=mobile`. Nunca apuntar los casos mutantes al dominio público.

Logs, capturas y respaldo del WIP de esta sesión: `/tmp/sitrep-stabilization-kPC9NY/`; resultado final QA en `e2e-final-v2/run.log`, smoke público en `live-smoke.log`. Este directorio es privado y temporal; no distribuirlo porque contiene configuración QA.

Limpieza manual pendiente: `/tmp/sitrep-stabilization-kPC9NY/live-smoke.ts` contiene la credencial existente utilizada para el smoke. Quedó con permisos 0600 dentro del directorio privado 0700; la protección local bloqueó su eliminación automática. El usuario puede eliminar únicamente ese archivo manualmente, conservando los logs y el respaldo del WIP.

## Modelo

Esta ejecución usó el modelo configurado en la tarea. El goal no alterna automáticamente modelos; no se delegaron subtareas ni se cambiaron modelos durante esta iteración.
