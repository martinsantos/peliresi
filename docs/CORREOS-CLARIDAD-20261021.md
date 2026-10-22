# Correos: decisiones, comprobantes y certificados — 21/10/2026

**Candidato `86a9b790`, probado sólo en preview. Sin publicación.** Rama `codex/sitrep-training-20261018`, único checkout `sitrep-production-source-20261001`. Última publicación documentada: `19230380`; su configuración y reversión siguen vigentes.

## Tres correcciones

| Evento | Correo corregido | Siguiente paso |
|---|---|---|
| Una parte aprueba una adenda | **Una parte aprobó la adenda**. Explica que es una decisión individual, sin representar a las otras partes ni el cierre documental. | Abrir la adenda y consultar autor, motivo y estado actual. |
| Archivo de comprobante repetido | **Comprobante repetido: revisá el documento**. Identifica la coincidencia de la huella del archivo y aclara que no acredita un pago nuevo. | Abrir la campana y seguir a la inscripción o perfil. No acusa fraude ni expone datos de otra persona. |
| Cierre de tratamiento | **Tratamiento finalizado**. El cierre operativo no confirma una certificación emitida. Las nuevas certificaciones requieren firma y emisión expresa del operador. | Consultar los documentos disponibles. La emisión tiene su aviso independiente; los históricos conservan su acceso. |

Sólo cambian asunto/contenido controlado en `notification-mail.service.ts`. Se conservan destinatarios, preferencias, permisos, enlaces, familias de correo, bloqueos y reglas del circuito. No se incorporan textos libres, CUIT, importes o enlaces aportados por terceros al correo.

## Manual y galería

Manual **2026.21.5**: guía `correos-decisiones-documentos`, visible para generador, transporte, operador y administración, con tres pasos y enlaces a adendas/certificaciones. Ruta: `/manual/tutorial.html?guide=correos-decisiones-documentos`. Se conservan **exactamente** `manual.js` y `manual.css`; sólo se actualizan contenido y versión de caché del catálogo en los tres puntos de entrada.

La galería local `test-results-communications-20261021/index.html` muestra los renderizadores del candidato y marca las tres correcciones. Conserva 180 escenarios, 177 con muestra de correo, 149 con campana/emergente, ocho roles y 21 archivos productores representados. **37 fuentes** verificadas contra el commit. Los escenarios no equivalen a 180 diseños distintos; los valores libres y sus combinaciones son ilimitados. Push es una simulación explícita de contenido, no prueba de entrega ni de implementación en cada evento.

## Pruebas del cambio

Ejecución serial en `76.13.234.213`, contenedor `sitrep-qa-training-20261018`, **1 CPU / 2 GiB / swap cero / un worker**, sin Actions ni instalaciones locales.

| Comprobación | Resultado |
|---|---|
| Backend: mail relay, plantillas, dispatcher, política externa y cuentas | **160/160** |
| Interfaz: navegación de avisos, refresco de campana y manual | **37/37**, incluidos 7 del manual |
| Backend TypeScript y builds web/app | **PASS**, builds secuenciales |
| E2E: cuatro correos/destinos y manual × tres superficies | **15/15**, sin omitidos, fallidos ni flaky |

Superficies: web 1440×900, web 360×800 y `/app` 390×844. Se renderizan los HTML reales, se comprueban asunto/cuerpo, imágenes, contraste del botón, ausencia de desborde, login real de cuenta artificial y destino correcto. La ruta web canónica del correo se prueba también en su equivalente `/app`; no se afirma apertura automática de una PWA por el sistema operativo. La campana muestra las dos variantes del comprobante: inscripción y perfil. Esta tanda no repite el OCR ni la carga de comprobantes.

Manual: guía, tres pasos, enlaces de índice, reanudación tras recarga, fuentes originales desde caché verificada y capturas. En la primera pasada el test unitario esperaba el catálogo anterior; se actualizó a la versión nueva. Las primeras capturas E2E mostraban la bienvenida superpuesta y el manual sin su caché de fuentes. Se corrigió la preparación del test, agregando comprobaciones de bienvenida cerrada e íconos cargados, y se repitieron los **15/15**. Se conservan ambas evidencias; no se relajaron expectativas ni se cambió el diseño del producto.

## Aislamiento y límites

- Esquema artificial nuevo `mail_copy_20261021` en la base QA existente. **536 tablas previas intactas**, comprobadas por cantidad y huella antes/después.
- **Cero cola activa, cero intentos y cero envíos de correo**. SMTP/VAPID vacíos, familias de correo vacías, `DISABLE_EMAILS=true`, push false; verificados en los dos procesos de QA.
- **CAP cerrado**: URL vacía, vencimiento pasado y cuatro alias rechazados con 403.
- Adendas/certificados habilitados únicamente dentro de QA para recorrer sus pantallas. No se inspeccionó ni modificó producción, ni sus flags, ni datos reales.
- `main` permanece `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Commits con `[skip ci]`, sin push ni workflows.
- Son regresiones focalizadas en estos tres correos y sus destinos. No se declaran suites globales, compatibilidad de clientes de correo externos, entrega SMTP/push ni certificación de Android/iOS físicos.

## Evidencia y reproducción

`test-results-mail-copy-20261021/`: reportes JSON de unitarias/E2E, capturas, auditoría, cierre y prueba SHA-256 de **1.554 archivos**. Huella de `proof.json`: `21b9d7699251fc03cd1ede072b79527e07c40f6fe7402d8d90f6f8b5b46fb880`. El runtime y PostgreSQL QA se cerraron el **21/10/2026 21:30:44 Mendoza**, sin terminaciones forzadas. Contenedor detenido **21/10/2026 21:34:23 Mendoza**, sin OOM ni eventos de presión de memoria; base, imagen y evidencias conservadas.

Las pruebas persistidas son `frontend/cloud-qa/mail-copy-fixture.ts`, `mail-copy.playwright.config.ts` y `e2e/mail-copy.spec.ts`. Requieren el entorno aislado y las guardas de `safety.ts`; el fixture `prepare` rechaza un esquema ya existente. No apuntar a una base real ni resembrar el esquema ya conservado. El ejecutor exacto y la configuración de esta tanda quedan en `test-results-mail-copy-20261021/runner.ts`.

### Galería: comprobación final

**9/9 grupos de comprobaciones**, incluidos los 180 escenarios a ancho de teléfono, ocho filtros de rol, búsqueda/vacío, campana leída/no leída y distinción entre emergente real y push simulado. Cero desbordes, errores de consola o solicitudes externas. Galería en 1440×1000 y 390×844; muestra interior de 375 px. Las tres correcciones tienen comprobaciones expresas de sus textos renderizados.

Archivo `test-results-communications-20261021/index.html`, fuente **86a9b790**, SHA-256 `7f82d9dadf9826ec317e0b32f5b25114ffc29d926f5ccd8e55d57502c7d0e47f`. Evidencias en el mismo directorio: `coverage.json`, `qa-result.json` y capturas. Generadores locales: `generate.ts` y `compose.ts`; este último coteja fuentes contra Git. `qa.ts` se ejecuta sólo en el contenedor preview. La galería está marcada como candidato no publicado y es autónoma, sin carga de recursos externos ni controles que envíen mensajes.
