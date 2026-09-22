# Inspecciones: orientación, guardado y recuperación en campo

Fecha: 22/09/2026. Entorno de publicación autorizado: SITREP de pruebas en `sitrep.ultimamilla.com.ar`. No se interviene el VPS gubernamental.

## Cambios

- Índice persistente del recorrido, anclas de checklist/declaración y estados escritos también en controles colapsados.
- El botón **Guardar cambios** está junto al comentario, antes de las fotografías. Guarda todo el borrador, sin cambiar de etapa. Distingue copia local, confirmación del servidor, error de almacenamiento y conflicto.
- `PATCH /api/inspecciones/:id/borrador` guarda metadatos, checklist y comparación en una transacción, una versión y un evento. Rechaza versiones obsoletas e identificadores ajenos. Una comparación sin cambios conserva quién la verificó y cuándo.
- Un único editor por usuario/expediente/origen mediante Web Locks. Otra pestaña puede consultar y recuperar la edición cuando se cierre la anterior; no fuerza apropiaciones. La concurrencia entre dispositivos sigue protegida por versión en el servidor.
- Fotos pendientes con miniatura, motivo del rechazo, descarga del original, corrección y descarte confirmado. Un archivo inválido no bloquea otros archivos válidos. El reemplazo conserva atomicidad en IndexedDB y genera una identidad nueva; reintentar conserva la identidad original.
- Formatos admitidos de fotografía: JPG, PNG y WEBP, hasta 25 MB, validados por contenido. GIF/HEIC/HEIF no se anuncian como subidos: se pide conversión. La copia local no equivale a incorporación al expediente.
- Recuperación de sesión offline limitada al mismo token/usuario previamente confirmado por la API, hasta el menor entre ocho horas y vencimiento JWT. No se utiliza ante 401, 403 o errores HTTP del servidor. Logout/cambio de usuario revoca la sesión offline.
- Service workers con fallback al shell correcto para rutas profundas; cachés web/PWA aislados. API, archivos públicos/manual y recursos de otro origen no se convierten en shell de inspección. La lectura local se ejecuta incluso cuando React Query detecta desconexión.
- Contención de inputs ocultos de fotos en `<main>`: dejan de extender el documento y expulsar la cabecera de pantalla.
- Acta e informe: referencias de evidencia estables, descripciones íntegras y paginadas, encabezados y firmas sin separación arbitraria. Una observación general no reemplaza una conclusión técnica inexistente.

## Verificación reproducible

Todas las escrituras de pruebas se hicieron con fixtures locales/sintéticos. No se enviaron correos ni se modificó el expediente abierto por el usuario.

| Comprobación | Resultado local |
| --- | --- |
| Backend `DISABLE_EMAILS=true npm test` | 237 pruebas / 31 archivos aprobados |
| Frontend `npm test` | 272 pruebas / 41 archivos aprobados |
| `npm run lint:critical` y TypeScript | Aprobados |
| Builds web, PWA y backend | Aprobados |
| Chrome: módulo, trazabilidad e intercambios | 44 aprobadas; 4 combinaciones duplicadas omitidas explícitamente; 0 fallos |
| Dos pestañas reales con Web Locks nativo | Un editor; segunda pestaña consulta; recuperación del comentario tras liberar el bloqueo |
| Fotos: primer archivo 400 y siguiente 201 | La primera se conserva con error y copia descargable; la segunda se incorpora; eventos online repetidos no duplican cargas |
| PDF: cuatro muestras, acta/informe breve/extenso | 27 páginas renderizadas y revisadas; 28 regresiones PDF dentro de la suite backend |
| QR del informe renderizado a 300 dpi | Decodificación digital correcta hacia la URL de verificación de la muestra |
| Reapertura completamente offline, web y PWA | 2/2 aprobadas: navegador sin red y servidor de fixture cortando sockets; usuario, caso y comentario recuperados; 401 al reconectar cierra la sesión |

Comandos de navegador:

```sh
PLAYWRIGHT_USE_SYSTEM_CHROME=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 npx playwright test e2e/inspection-module.spec.ts e2e/inspection-traceability.spec.ts e2e/inspection-exchange.spec.ts --reporter=line
PLAYWRIGHT_USE_SYSTEM_CHROME=1 npx playwright test e2e/inspection-offline-session.spec.ts --project=chromium --reporter=line
```

`inspection-offline-session.spec.ts` utiliza un servidor HTTP aislado, los builds reales y service workers reales; no reemplaza la API mediante interceptores de navegador. Registra el caso/token sintético online antes de cortar la red. Se verificó además convivencia de las cachés web y PWA en ambos órdenes de activación y cero respuestas servidas durante la desconexión.

Evidencia local: `/private/tmp/sitrep-field-v3-unit-final.log`, `/private/tmp/sitrep-field-v3-e2e-final.log`, `/private/tmp/sitrep-pdf-presentation-final/`, `/private/tmp/sitrep-evidence-qa-QJ8PiJ/`, capturas `/tmp/sitrep-field-v3-final-comment-settled-{mobile,600px-web}.png`.

## Límites explícitos

- No hay promesa de operación indefinida sin sesión válida, almacenamiento disponible ni descarga previa de la aplicación y el expediente. Borrar los datos del navegador elimina las copias locales.
- Un navegador sin Web Locks ofrece consulta y explica por qué bloquea edición; no se usa una exclusión ficticia basada en localStorage.
- Las pruebas móviles corresponden a Chrome con viewport/emulación, no a un Android físico instalado, cámara real, batería agotada o teclado de un equipo específico.
- El QR digital fue decodificado, pero falta ensayo de impresión y escaneo con cámaras físicas.
- El diseño, la huella y el QR no hacen un informe jurídicamente inapelable ni reemplazan la revisión/firma de la autoridad competente. No se amplía el marco normativo en esta iteración.
- No se modifican tablas ni se aplican migraciones. La promoción al VPS gubernamental continúa siendo una operación separada.

## Release y reversión

Pendiente de publicación al redactar este registro. El despliegue preservará los releases anteriores, los archivos persistentes y la configuración de correo deshabilitado. Backend primero por compatibilidad del nuevo endpoint, frontend después; fallo de salud revierte los enlaces a los releases anteriores. La verificación posterior será de sólo lectura sobre una inspección DEMO.
