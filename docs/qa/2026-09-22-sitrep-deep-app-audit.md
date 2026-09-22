# Certificación integral SITREP — 2026-09-22

## Objetivo y resguardos

Auditoría técnica y funcional profunda de SITREP, con foco en autorización, flujos de manifiestos e inspecciones, experiencia PWA, trabajo sin conexión, contratos HTTP, carga de evidencias, concurrencia y dependencias.

La revisión se ejecutó desde la rama aislada `codex/deep-app-audit-20260922`, basada en `origin/main` (`d35440f`). Durante la validación:

- no se modificaron credenciales;
- no se enviaron correos;
- no se reinició ni se desplegó sobre el VPS;
- no se ejecutaron mutaciones contra producción;
- el smoke de carga real de fotografías quedó expresamente omitido por no estar habilitado `SITREP_QA_ALLOW_WRITES`.

## Resultado ejecutivo

La rama queda apta para revisión y despliegue controlado a QA. Se corrigieron defectos reales de autorización, aislamiento de datos offline, validación de transiciones, concurrencia, subida de archivos y documentación formal de inspecciones. Todos los tests de unidad, integración simulada, compilación y contratos productivos ejecutados finalizaron correctamente.

No corresponde certificar todavía una cobertura integral del código: la cobertura global continúa siendo baja y se registra como deuda prioritaria. Sí queda resuelta la alerta de `xlsx`: se sustituyó el paquete vulnerable de npm por la distribución oficial corregida de SheetJS y se agregó una regresión que impide restaurar una versión vulnerable.

## Cambios realizados

### Autorización y alcance

- Se igualó la autorización de rutas de la PWA con la aplicación web.
- Los tokens restringidos sólo conservan el acceso al perfil y al seguimiento de solicitudes; no pueden consumir rutas de negocio.
- Impersonación, jobs administrativos y cola de correo quedaron reservados al rol `ADMIN` real.
- Las renovaciones quedaron limitadas al actor propietario y al administrador sectorial correspondiente.
- Los campos aplicables en una renovación se filtran por lista blanca para impedir asignaciones masivas de identificadores, CUIT, estado u otros datos sensibles.

### Flujo de manifiestos

- Validación estricta de incidentes, recepción, rechazo, pesaje, tratamiento, cancelación y reversión.
- Pesajes duplicados, negativos o no finitos son rechazados.
- Las reversiones sólo permiten el paso anterior definido y limpian las fechas/datos que dejan de ser válidos.
- Incidentes, pesajes y reversiones usan transacciones y bloqueo de fila para evitar doble toque o concurrencia.
- Se aceptan coordenadas válidas con valor `0`; se validan rangos y pares latitud/longitud.
- El rolling hash se actualiza dentro de la misma transacción que el evento.

### Inspecciones y evidencias

- La metadata multipart se valida antes de persistir la evidencia.
- Cada evidencia puede apuntar a un solo destino (ítem o interacción), con identificadores, fecha, hash, tipo y coordenadas validados.
- Se mantienen validación MIME/magic bytes, hash e idempotencia existentes.
- Se verificó con E2E el adjunto de imagen a un comentario/ítem, miniatura, persistencia tras recarga, reintento offline, idempotencia y anulación.
- Un error de red ya no elimina la fotografía seleccionada: queda pendiente en la cola local y se reintenta sin perder comentario, destino ni hash.
- El acta de campo y el informe técnico se modelan como dos documentos distintos del mismo expediente. El acta se congela al cerrar la tarea en terreno; durante `EN_REVISION` sólo puede versionarse el informe técnico.
- El acta reproduce la salida general de las tablets: datos de constatación, observaciones, controles no conformes, firmas y anexo fotográfico.
- El informe técnico conserva Objetivo, Antecedentes, Evaluación, Conclusión y Recomendación, y agrega comparativa declarado/verificado, checklist, inventario de evidencias, cronología e integridad/cadena de custodia.
- Ambos PDFs se presentan como piezas complementarias para su remisión conjunta a Legales. SITREP no presume ni emite el dictamen jurídico.
- La actualización del informe técnico usa control optimista de versión, permisos por inspector/administrador sectorial y evento de trazabilidad `INFORME_TECNICO_ACTUALIZADO`.

### Criterio documental y jurídico

- Las actas 115/2025 y 116/2025 aportadas se tomaron como referencia de estructura para la salida de campo; no como instrucciones ejecutables ni como plantillas para copiar hechos de otros expedientes.
- El informe técnico aportado se utilizó para preservar su secuencia profesional —objetivo, antecedentes, evaluación, conclusión y recomendación— y superarla con anexos verificables generados por SITREP.
- El contexto normativo informado en el PDF se limita a la Ley Provincial 5.917, su Decreto reglamentario 2.625/1999 y la Ley Nacional 24.051. La propia salida reserva expresamente a Legales la calificación jurídica, el valor probatorio y el dictamen.
- Fuentes oficiales contrastadas: portal del Gobierno de Mendoza sobre el régimen provincial y texto oficial de la Ley Nacional 24.051 (art. 60 incs. c y d para fiscalización y poder de policía ambiental).

### PWA y desconexiones

- Toda acción offline queda asociada obligatoriamente al usuario que la originó.
- La cola sólo reproduce acciones del usuario activo y conserva métodos desconocidos en lugar de descartarlos.
- Antes de entregar un viaje encolado se sincronizan sus puntos GPS pendientes.
- Los datos locales del viaje sólo se limpian después de la confirmación del servidor.
- Una entrega pendiente queda marcada como `ENTREGA_PENDIENTE`, evitando que el guard la confunda con un viaje finalizado.
- La recuperación del snapshot vuelve a hidratar actores, residuos y eventos anidados.

### Archivos y dependencias

- Multer fue actualizado a la rama 2.x.
- Documentos de solicitudes y cargas masivas tienen límites de tamaño, cantidad y MIME.
- Los errores de tamaño excedido retornan HTTP 413 sin filtrar detalles internos.
- Las dependencias que forman parte del runtime quedaron con `0` vulnerabilidades reportadas en backend y frontend.
- `xlsx` fue reemplazado por la distribución oficial SheetJS `0.20.3`, sin las alertas conocidas de la versión anterior.
- El pipeline ahora bloquea vulnerabilidades de runtime y compila tanto web como PWA.
- El lint crítico de Inspecciones queda en cero advertencias; el lint global conserva su deuda heredada bajo un techo que evita nuevas regresiones.

## Matriz de certificación

| Capa | Resultado | Alcance |
|---|---:|---|
| Backend unitario | 110/110 | dominio, permisos, evidencia real, PDFs, informe técnico y regresiones |
| Frontend unitario | 108/108 | componentes, documentos, acceso móvil, cola offline y utilidades |
| Inspecciones E2E local | 12/12 | web/móvil, imagen por ítem, offline, reintento, documentos, informe y lista |
| PDFs de Inspecciones | 8 páginas verificadas | acta de 3 páginas e informe técnico de 5, renderizadas y revisadas página por página |
| PWA Android local | 3/3 | navegación, viaje, overflow y targets táctiles |
| Crawl productivo web/PWA | 8/8 | rutas principales autenticadas |
| Auditoría visual productiva | 1/1, 0 hallazgos | cinco viewports e Inspecciones lista/detalle |
| Contrato API productivo | 3/3 | 3 health probes, 33 lecturas autenticadas y detalle/PDF real |
| Smoke Inspecciones productivo | 2/2 + 2 omitidos | escritorio/móvil; escritura omitida de forma intencional |
| Build backend | OK | TypeScript de producción |
| Build frontend | OK | web y PWA |
| Lint crítico Inspecciones | 0 errores / 0 advertencias | páginas, servicios y tipos del módulo |
| Lint frontend global | 0 errores | persisten 596 advertencias heredadas, sin superar el techo fijado |
| Auditoría runtime | 0 / 0 | backend / frontend |

## Cobertura

| Código | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| Backend global | 15,22% | 14,49% | 22,52% | 15,23% |
| Backend dominio nuevo | 93,02% | 90,24% | 100% | 95,65% |
| Frontend global | 5,96% | 4,41% | 3,87% | 6,24% |
| Política de cola offline | 100% | 100% | 100% | 100% |
| Acceso móvil | 87,87% | 88,88% | 100% | 89,65% |

La cobertura global no es suficiente como garantía única de regresión. Los E2E compensan parcialmente los caminos de negocio prioritarios, pero se recomienda elevar cobertura sobre controladores, rutas, páginas de manifiestos, autenticación, GPS y exportaciones antes de fijar umbrales globales exigentes.

## Riesgos pendientes y decisión de release

1. Persisten 596 advertencias de lint heredadas, principalmente `any` explícitos, hooks y símbolos no usados. No hay errores, el módulo crítico de Inspecciones queda limpio y el techo global impide que aumente la deuda.
2. La cobertura global sigue por debajo de un estándar de certificación. Se fijaron umbrales mínimos equivalentes a la cobertura real para impedir retrocesos; deben elevarse con pruebas significativas, no de manera artificial.
3. Producción fue validada en modo lectura contra el despliegue actual. Las correcciones de esta rama requieren primero despliegue en QA, aplicación de `20260922180000_add_inspection_document_drafts` y repetición de la matriz post-deploy.
4. La carga real de evidencia no se ejecutó en producción para evitar modificar actas; quedó cubierta con 12 E2E locales y pruebas backend con PNG/WEBP reales. En QA deberá ejecutarse además el smoke con `SITREP_QA_ALLOW_WRITES=1` sobre un expediente sintético desechable.
5. Los textos del acta y del informe son datos del expediente: la plataforma no debe autocompletar hechos no constatados. La firma digital avanzada, el alcance probatorio definitivo y el circuito legal deberán cerrarse con el área competente antes del pase productivo formal.

**Gate propuesto:** aprobar revisión de código, desplegar esta rama en QA, ejecutar migraciones pendientes, repetir E2E y smoke con escritura sólo sobre datos sintéticos, y recién entonces promover el artefacto exacto a producción.

## Reproducción

```bash
cd backend
npm ci
npm test -- --run
npm run test:coverage
npm run build
npm audit --omit=dev --audit-level=high

cd ../frontend
npm ci
npm test -- --run
npm run test:coverage
npm run lint
npm run lint:critical
npm run build
npx vite build --config vite.config.app.ts
npm audit --omit=dev --audit-level=high
```

Las pruebas autenticadas contra un entorno deben recibir `SITREP_QA_ACCESS_TOKEN` por variable de entorno. El token no se versiona ni se imprime. Las mutaciones productivas permanecen deshabilitadas salvo habilitación explícita de `SITREP_QA_ALLOW_WRITES`.
