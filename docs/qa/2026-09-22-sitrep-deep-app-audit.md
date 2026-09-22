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

La rama queda apta para revisión y despliegue controlado a QA. Se corrigieron defectos reales de autorización, aislamiento de datos offline, validación de transiciones, concurrencia y subida de archivos. Todos los tests de unidad, integración simulada, compilación y contratos productivos ejecutados finalizaron correctamente.

No corresponde certificar todavía una cobertura integral del código: la cobertura global continúa siendo baja y se registra como deuda prioritaria. Tampoco se declara resuelta la alerta de desarrollo de `xlsx`, ya que el paquete no ofrece una versión corregida.

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
- El pipeline ahora bloquea vulnerabilidades de runtime y compila tanto web como PWA.

## Matriz de certificación

| Capa | Resultado | Alcance |
|---|---:|---|
| Backend unitario | 105/105 | dominio, middlewares, servicios y regresiones |
| Frontend unitario | 106/106 | componentes, acceso móvil, cola offline y utilidades |
| Inspecciones E2E local | 10/10 | web/móvil, imagen por ítem, offline, reintento, informe y lista |
| PWA Android local | 3/3 | navegación, viaje, overflow y targets táctiles |
| Crawl productivo web/PWA | 8/8 | rutas principales autenticadas |
| Auditoría visual productiva | 1/1, 0 hallazgos | cinco viewports e Inspecciones lista/detalle |
| Contrato API productivo | 3/3 | 3 health probes, 33 lecturas autenticadas y detalle/PDF real |
| Smoke Inspecciones productivo | 2/2 + 2 omitidos | escritorio/móvil; escritura omitida de forma intencional |
| Build backend | OK | TypeScript de producción |
| Build frontend | OK | web y PWA |
| Lint frontend | 0 errores | persisten 597 advertencias heredadas |
| Auditoría runtime | 0 / 0 | backend / frontend |

## Cobertura

| Código | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| Backend global | 11,84% | 12,53% | 18,19% | 11,76% |
| Backend dominio nuevo | 93,02% | 90,24% | 100% | 95,65% |
| Frontend global | 5,87% | 4,05% | 3,69% | 6,16% |
| Política de cola offline | 100% | 100% | 100% | 100% |
| Acceso móvil | 87,87% | 88,88% | 100% | 89,65% |

La cobertura global no es suficiente como garantía única de regresión. Los E2E compensan parcialmente los caminos de negocio prioritarios, pero se recomienda elevar cobertura sobre controladores, rutas, páginas de manifiestos, autenticación, GPS y exportaciones antes de fijar umbrales globales exigentes.

## Riesgos pendientes y decisión de release

1. `xlsx@0.18.5` conserva una alerta alta de desarrollo (prototype pollution/ReDoS) y no tiene parche publicado. No forma parte del runtime desplegado, pero se usa en scripts/importaciones. Debe reemplazarse o aislarse en un proceso con archivos confiables, límites estrictos y sin exposición pública.
2. Persisten 597 advertencias de lint heredadas, principalmente `any` explícitos y símbolos no usados. No hay errores de lint; el subconjunto de archivos tocados todavía expone 37 advertencias preexistentes o adyacentes que deberán depurarse en una refactorización tipada posterior.
3. La cobertura global sigue por debajo de un estándar de certificación. No debe aumentarse artificialmente el umbral hasta incorporar pruebas significativas.
4. Producción fue validada en modo lectura contra el despliegue actual. Las correcciones de esta rama requieren primero despliegue en QA, migraciones si correspondieran y repetición de la matriz post-deploy.
5. La carga real de evidencia no se ejecutó en producción para evitar modificar actas; quedó cubierta con 10 E2E locales. En QA deberá ejecutarse además el smoke con `SITREP_QA_ALLOW_WRITES=1` sobre un expediente sintético desechable.

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
npm run build
npx vite build --config vite.config.app.ts
npm audit --omit=dev --audit-level=high
```

Las pruebas autenticadas contra un entorno deben recibir `SITREP_QA_ACCESS_TOKEN` por variable de entorno. El token no se versiona ni se imprime. Las mutaciones productivas permanecen deshabilitadas salvo habilitación explícita de `SITREP_QA_ALLOW_WRITES`.
