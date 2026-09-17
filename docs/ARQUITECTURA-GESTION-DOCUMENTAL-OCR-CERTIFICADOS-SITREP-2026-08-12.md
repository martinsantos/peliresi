# SITREP — Arquitectura propuesta para gestión documental, OCR y certificados

**Fecha:** 12/08/2026
**Alcance:** web, PWA `/app`, backend, Prisma/PostgreSQL y almacenamiento privado
**Estado:** especificación técnica para implementación; no implica despliegue ni cambio de datos

## 1. Veredicto ejecutivo

La mejora es viable, pero no conviene agregar campos de archivo y OCR sobre el circuito actual sin una etapa previa de saneamiento. El sistema tiene dos implementaciones documentales incompatibles y el alta pública no mantiene hoy un contrato coherente entre frontend y backend.

La solución recomendada tiene cinco capacidades separadas:

1. un repositorio privado y único de archivos, con cuarentena, validación y hash;
2. documentos regulatorios versionados, vinculados a actor, vehículo o chofer;
3. comprobantes ATM con deduplicación exacta y semántica global;
4. OCR local, asistivo y auditable, que nunca aprueba por sí solo;
5. certificados SITREP inmutables, con vigencia, historial, PDF y QR verificable.

El primer entregable debe reparar el alta. Recién después deben incorporarse ATM, documentación del transporte y certificados.

## 2. Estado observado

### 2.1 Brechas funcionales bloqueantes del alta

- El wizard envía `datosFormulario`, pero el backend sólo procesa `datosActor`, `datosResiduos`, `datosTEF` y `datosRegulatorio`. El progreso aparente no se persiste.
- El wizard adjunta el archivo como `archivo`; la ruta de solicitudes espera `file`. La carga falla antes del controlador.
- `iniciarSolicitud` crea un usuario inactivo/no verificado y devuelve sólo `solicitudId`; el wizard pasa inmediatamente a llamadas autenticadas. Falta un contrato explícito de “verificar correo, iniciar sesión y reanudar borrador”.
- El botón público **“Saltar al formulario (modo prueba)”** lleva a la fase siguiente sin `solicitudId`; al finalizar, el envío sale silenciosamente sin hacer nada.
- La UI no integra `captchaToken`, aunque el backend lo exige cuando Turnstile está configurado.
- Sólo hay validación sustantiva en el primer paso. Los adjuntos no son obligatorios y el backend permite enviar una solicitud sin verificar el conjunto documental esperado.
- La aprobación administrativa no consulta los documentos ni exige que estén aprobados; puede activar al actor con cero documentos.
- Los documentos de la solicitud no se convierten en documentos regulatorios permanentes al aprobar el actor.

### 2.2 Fragmentación documental

Existen dos circuitos:

- `Documento` de generadores/operadores: valida firma binaria, usa nombres aleatorios, permisos `0600`, almacenamiento privado y ClamAV configurable.
- `DocumentoSolicitud`: escribe directamente en disco, confía en el MIME declarado, conserva un nombre basado en el original y no calcula hash ni ejecuta antivirus.

Además:

- `Documento` no admite transportistas, vehículos ni choferes.
- `Renovacion` sólo contempla generadores y operadores.
- `Vehiculo.patente`, `Chofer.dni` y `Chofer.licencia` no tienen normalización ni restricciones de unicidad.
- `PagoTEF` guarda importes y fechas, pero no representa el comprobante ATM, su número, archivo, emisor o huella.
- `DeclaracionJurada.ticketPago` es texto libre.
- La descarga administrativa de una solicitud usa `href={doc.path}` en vez de un endpoint autorizado de descarga.

### 2.3 UX observada en producción

- El formulario se adapta correctamente al ancho móvil y los adjuntos son legibles.
- En transporte, vehículos y choferes se cargan como texto libre “uno por línea”. Eso impide asociar de manera inequívoca una tarjeta con una patente o una licencia con una persona.
- En móvil, el stepper muestra principalmente iconos; falta un nombre accesible/visible del paso y un estado más claro.
- Los tipos documentales son genéricos y no muestran vigencia, frente/dorso, estado OCR, discrepancias ni responsable de revisión.

## 3. Flujo objetivo web y PWA

1. **Crear cuenta.** Validar email, contraseña, CUIT y captcha. Crear usuario candidato y solicitud en borrador.
2. **Verificar correo.** Mostrar una pantalla explícita de espera y reenvío. Una vez verificado, iniciar sesión y reanudar el borrador por ID.
3. **Completar actor.** Usar formularios tipados por Generador, Transportista u Operador; guardar cada sección de manera idempotente.
4. **Cargar estructura.** Para transporte, crear tarjetas independientes de vehículos y choferes; no usar áreas de texto.
5. **Adjuntar documentación.** Cada requisito debe ser una tarjeta con tipo, sujeto, frente/dorso, vigencia y estado.
6. **Asistir con OCR local.** Mostrar campos sugeridos, confianza y comparación con lo declarado. El usuario confirma o corrige.
7. **Validar antes de enviar.** Backend y frontend usan el mismo esquema versionado de requisitos. No se envía si falta un obligatorio.
8. **Revisar.** El administrador sectorial ve original, datos OCR, diferencias, vigencia y alertas de duplicado. Aprueba/rechaza cada documento.
9. **Aprobar solicitud.** Una transacción crea/activa el actor, migra las versiones documentales y registra la decisión. Debe ser imposible aprobar con requisitos incompletos.
10. **Emitir certificado.** Al cumplirse la política, generar un PDF inmutable con serial, periodo, alcance y QR de verificación.

En PWA, los binarios regulatorios no deben entrar en CacheStorage. Si se requiere carga sin conectividad, debe implementarse una cola IndexedDB cifrada con Web Crypto, identificada por usuario y solicitud, con borrado en logout/cambio de usuario y vencimiento corto. Hasta contar con eso, sólo el formulario puede guardarse offline; la UI debe informar que el archivo espera conectividad.

## 4. Modelo de datos recomendado

### 4.1 Archivo binario único

```prisma
model ArchivoBinario {
  id              String   @id @default(cuid())
  storageKey      String   @unique
  nombreOriginal  String
  mimeDetectado   String
  bytes           Int
  sha256          String   @unique
  estadoScan      EstadoScan @default(CUARENTENA)
  motorScan       String?
  versionScan     String?
  escaneadoAt     DateTime?
  creadoPorId     String
  createdAt       DateTime @default(now())

  documentos      DocumentoRegulatorio[]
}
```

Reglas:

- `storageKey` aleatorio; nunca guardar ni devolver una ruta física.
- hash SHA-256 del original antes de cualquier compresión o preprocesado;
- estado `CUARENTENA | LIMPIO | RECHAZADO`; sólo `LIMPIO` puede revisarse o descargarse;
- detectar tipo por bytes y limitar páginas, píxeles, tamaño y ratio de compresión;
- almacenamiento fuera del webroot, con permiso `0600` y descarga autenticada.

### 4.2 Documento regulatorio versionado

```prisma
model DocumentoRegulatorio {
  id               String   @id @default(cuid())
  archivoId         String
  tipo              TipoDocumento
  estado            EstadoDocumento @default(PENDIENTE)

  generadorId       String?
  transportistaId   String?
  operadorId        String?
  vehiculoId        String?
  personaChoferId   String?

  numeroNormalizado String?
  emisor             String?
  emitidoAt          DateTime?
  vigenteDesde       DateTime?
  vigenteHasta       DateTime?
  datosOcr           Json?
  confianzaOcr       Float?
  version            Int      @default(1)
  reemplazaAId       String?
  solicitudId        String?
  revisadoPorId      String?
  revisadoAt         DateTime?
  motivoRechazo      String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  archivo            ArchivoBinario @relation(fields: [archivoId], references: [id])
}
```

La migración SQL debe agregar un `CHECK` que exija exactamente un sujeto entre generador, transportista, operador, vehículo y persona-chofer. Prisma no expresa bien este XOR con relaciones opcionales.

Estados: `PENDIENTE`, `APROBADO`, `RECHAZADO`, `REEMPLAZADO`, `VENCIDO`, `REVOCADO`.

Tipos mínimos:

- `ATM_COMPROBANTE_SELLADO`
- `CONSTANCIA_AFIP`
- `HABILITACION_ACTOR`
- `SEGURO_AMBIENTAL`
- `TARJETA_IDENTIFICACION_VEHICULO`
- `AUTORIZACION_USO_VEHICULO`
- `LICENCIA_CONDUCIR`
- `MEMORIA_TECNICA`

No conviene modelar sólo “tarjeta verde/azul”: el nombre normativo puede cambiar. El tipo de documento debe expresar identificación del vehículo o autorización de uso, conservando la denominación mostrada al usuario como catálogo configurable.

### 4.3 Comprobante ATM

```prisma
model ComprobanteATM {
  id                    String   @id @default(cuid())
  documentoId           String   @unique
  emisor                 String
  referenciaNormalizada String
  cuitContribuyente      String?
  concepto               String?
  periodo                String?
  fechaPago              DateTime?
  importeCentavos        BigInt?
  fingerprintHmac        String?  @unique
  estadoValidacion       String   @default("PENDIENTE")
  createdAt              DateTime @default(now())

  @@unique([emisor, referenciaNormalizada])
}
```

Usar entero en centavos o `Decimal`, nunca `Float`, para importes fiscales.

### 4.4 Vehículos y choferes

El modelo actual mezcla identidad y pertenencia. Para conservar historial y evitar falsos duplicados:

- `Vehiculo`: identidad global por patente normalizada y, cuando exista, VIN/chasis.
- `TransportistaVehiculo`: asignación con `desde`, `hasta`, estado y transportista.
- `PersonaChofer`: identidad global por DNI normalizado.
- `TransportistaChofer`: asignación con vigencia y transportista.
- `HabilitacionConductor`: número de licencia, jurisdicción, clases, emisión y vencimiento.

No debe hacerse `Chofer.dni @unique` sobre la tabla actual: una persona puede estar legítimamente asignada a más de un transportista. La unicidad pertenece a la identidad global, no a la relación laboral.

### 4.5 Credenciales y certificados

Separar la autorización administrativa de su representación PDF:

- `CredencialActor`: actor, tipo, alcance, vigencia, estado, política aplicada y documentos fuente.
- `EmisionCertificado`: serial único, snapshot JSON inmutable, `pdfSha256`, emitido por, fecha, credencial y versión.
- `PoliticaCertificacion`: versión, requisitos por tipo de actor y reglas de vigencia.

Estados derivados/administrativos: `PENDIENTE`, `VIGENTE`, `POR_VENCER`, `VENCIDO`, `SUSPENDIDO`, `REVOCADO`.

El certificado histórico debe seguir descargable y mostrar claramente “vencido/revocado” cuando corresponda. Nunca regenerar un PDF histórico con datos actuales.

## 5. Control de duplicados ATM

El control debe ser global y transaccional, no una consulta previa desde el frontend.

1. **Duplicado binario exacto:** SHA-256 único sobre bytes originales.
2. **Duplicado fiscal:** índice único `(emisor, referenciaNormalizada)`.
3. **Duplicado semántico:** HMAC-SHA-256 de `emisor|referencia|importeCentavos|fecha|CUIT`, usando un secreto del servidor. Evita guardar esos datos sensibles en el índice.
4. **Imagen modificada:** hash perceptual sólo genera alerta de posible duplicado; no bloquea automáticamente porque formularios similares pueden parecer iguales.
5. **Concurrencia:** insertar archivo, documento y comprobante en una transacción. La restricción única de PostgreSQL decide incluso si dos usuarios suben al mismo tiempo.

Respuesta segura:

- mismo usuario/reintento: devolver el recurso idempotente ya creado;
- otro usuario: `409 DOCUMENTO_YA_REGISTRADO`, sin revelar nombre, CUIT ni actor propietario;
- registrar el intento como evento de seguridad y enviarlo a la bandeja administrativa.

El OCR no es una medida antifraude suficiente: un dato de baja confianza queda pendiente de revisión y nunca crea una restricción semántica dura por sí solo.

## 6. OCR local sin IA externa

### 6.1 Opción recomendada

Usar [Tesseract.js](https://github.com/naptha/tesseract.js) en un Web Worker, con assets WASM y `spa.traineddata_fast` alojados en SITREP. Funciona en navegador y Node y no envía datos a terceros. No procesa PDF directamente.

Para que no perjudique la app:

- cargar el módulo y el idioma sólo al abrir “Escanear documento”;
- reutilizar un único worker por sesión;
- cachear los assets OCR bajo el scope `/app/`, separados del app-shell;
- mantener intacto el bundle inicial;
- cancelar y liberar el worker al salir del flujo.

Para preprocesado en backend puede usarse [sharp](https://sharp.pixelplumbing.com/) —rotación, resize, recorte, contraste— en un worker separado. En cliente, Canvas/CreateImageBitmap cubre el camino liviano.

Para PDF:

1. intentar extracción de texto con `pdfjs-dist`;
2. si no hay texto, renderizar páginas acotadas a imagen;
3. pasar esas imágenes a Tesseract;
4. rechazar PDFs con demasiadas páginas o dimensiones desproporcionadas.

### 6.2 Campos sugeridos

**ATM:** referencia, CUIT, concepto, periodo, fecha, importe.
**Tarjeta vehicular:** patente, titular, DNI/CUIT, VIN/chasis, motor, marca/modelo, número de tarjeta.
**Licencia:** DNI, nombre, número, jurisdicción, clases, emisión y vencimiento.

Cada campo debe mostrar:

- valor leído;
- confianza;
- valor declarado en SITREP;
- coincidencia/discrepancia;
- confirmación manual.

OCR nunca debe activar un actor, aprobar un documento ni emitir un certificado automáticamente.

## 7. Certificados descargables y verificables

Contenido mínimo del PDF:

- identidad y CUIT del actor;
- tipo de actor y alcance autorizado;
- número de inscripción/habilitación;
- periodo exacto `vigenteDesde`–`vigenteHasta`;
- serial de emisión y versión de política;
- fecha y administrador emisor;
- estado visible;
- QR a `/certificados/verificar/:codigo`;
- hash del PDF y leyenda de verificación.

La verificación pública debe exponer sólo datos mínimos: serial, razón social, tipo, vigencia, estado y alcance. Los adjuntos fuente, DNI, licencias y tickets ATM nunca son públicos.

Un código aleatorio de alta entropía o payload firmado permite detectar alteraciones. Si el certificado debe tener **validez de firma digital oficial**, se necesita además una política de firma y un certificado institucional/infraestructura PKI; un PDF con QR emitido por SITREP no debe presentarse como firma digital cualificada sin esa definición jurídica.

## 8. API propuesta

```text
POST   /api/solicitudes/iniciar
POST   /api/solicitudes/:id/reanudar
PUT    /api/solicitudes/:id/secciones/:seccion
GET    /api/solicitudes/:id/requisitos
POST   /api/solicitudes/:id/documentos
POST   /api/documentos/:id/ocr
PATCH  /api/documentos/:id/datos-confirmados
GET    /api/documentos/:id/download
PATCH  /api/admin/documentos/:id/revisar
POST   /api/admin/solicitudes/:id/aprobar

POST   /api/actores/:tipo/:id/comprobantes-atm
GET    /api/actores/:tipo/:id/credenciales
POST   /api/admin/credenciales/:id/emitir-certificado
GET    /api/certificados/:id/download
GET    /api/certificados/verificar/:codigo

POST   /api/transportistas/:id/vehiculos
POST   /api/vehiculos/:id/documentos
POST   /api/transportistas/:id/choferes
POST   /api/personas-chofer/:id/licencias
```

Todas las mutaciones deben usar esquemas Zod compartidos, claves de idempotencia y comprobación del sujeto del recurso en la consulta de escritura; no basta autorizar el ID del actor presente en la URL.

## 9. Permisos

| Acción | Actor propio | Admin sectorial | ADMIN | AUDITOR |
|---|---:|---:|---:|---:|
| Cargar/reemplazar documento propio | Sí | Sí, de su sector | Sí | No |
| Ver estado y observación | Sí | Sí | Sí | Metadatos |
| Descargar adjunto con PII | Sí | Sí, de su sector | Sí | No por defecto |
| Aprobar/rechazar documento | No | Sí, de su sector | Sí | No |
| Emitir/revocar certificado | No | Sí, de su sector | Sí | No |
| Descargar certificado | Sí | Sí | Sí | Sí |
| Verificar certificado público | Sí | Sí | Sí | Sí |

Toda descarga sensible debe quedar auditada. Durante impersonación debe conservarse el ID del administrador iniciador; conviene bloquear o reforzar la auditoría de descargas de PII.

## 10. Seguridad, privacidad y operación

- Unificar todas las cargas en el pipeline robusto; eliminar la implementación `diskStorage` de solicitudes.
- Validar firma binaria, extensión, MIME, tamaño, páginas, dimensiones y bombas de descompresión.
- ClamAV obligatorio en preproducción/producción; si está caído, la carga queda en cuarentena, no “aprobada”.
- Descarga con autorización, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` y `Cache-Control: private, no-store`.
- Excluir bodies de rutas documentales/OCR/actores del middleware de analytics. Hoy sólo se redactan claves que contienen password/token/secret/credential y podrían registrarse DNI, licencia, CUIT o referencia ATM.
- No registrar texto OCR completo ni imágenes en logs, errores o telemetría.
- Definir retención por tipo documental y borrado seguro. Conservar sólo una huella HMAC/tombstone si la normativa permite impedir reuso después de eliminar el binario.
- Backups cifrados, prueba de restauración y rotación de secretos de HMAC fuera del repositorio.
- Rate limit específico por usuario/solicitud, no sólo por IP compartida.
- Nunca incluir adjuntos regulatorios en el Service Worker ni en caches HTTP públicos.

## 11. Migración sin corte destructivo

### Fase 0 — contrato del alta (bloqueante)

- corregir payloads, nombre de campo multipart, sesión/reanudación y captcha;
- retirar el “modo prueba” de producción;
- esquemas compartidos por paso y requisitos obligatorios;
- aprobación bloqueada si falta un documento o está pendiente/rechazado;
- endpoint autorizado de descarga.

### Fase 1 — núcleo documental

- agregar tablas nuevas de forma aditiva;
- implementar almacenamiento privado, hashes, cuarentena y deduplicación;
- backfill de `Documento` y `DocumentoSolicitud`, calculando hash sin cambiar archivos aún;
- dual-read temporal y luego corte al repositorio único.

### Fase 2 — ATM

- catálogo de comprobantes, normalización y restricciones globales;
- carga en altas y perfiles existentes;
- cola de posibles duplicados y auditoría.

### Fase 3 — transporte y OCR

- formularios estructurados de vehículo/chofer;
- frente/dorso y vigencias;
- OCR lazy en web/PWA y fallback interno en worker, si se decide;
- migración de vehículos/choferes existentes y resolución manual de duplicados.

### Fase 4 — credenciales y certificados

- políticas versionadas por actor;
- emisión, revocación, historial, PDF y QR;
- avisos de vencimiento 60/30/7 días sin depender de SMTP para el control interno.

### Fase 5 — operación

- tableros de pendientes, vencimientos, duplicados y fallos OCR;
- alertas in-app/push y correo sólo cuando SMTP esté formalmente habilitado;
- métricas sin PII y runbook de incidentes.

## 12. Plan de pruebas obligatorio

### Unitarias

- normalización de CUIT, patente, DNI, licencia y referencia ATM;
- SHA-256, HMAC semántico e idempotencia;
- parsers OCR por tipo, confianza y fechas ambiguas;
- cálculo de estado de vigencia en límites horarios;
- elegibilidad de certificado por política y versión;
- autorización por sujeto y rol.

### Integración

- dos usuarios suben simultáneamente el mismo binario: uno crea, el otro recibe 409 sin fuga de identidad;
- misma referencia ATM con imágenes diferentes: bloqueada por índice/fingerprint;
- imagen parecida sin datos coincidentes: alerta manual, no bloqueo duro;
- solicitud sin requisito aprobado: enviar/aprobar rechazados;
- archivo con MIME falso, malware, exceso de páginas o dimensiones: cuarentena/rechazo;
- documento vencido entre revisión y emisión: certificado no emitido;
- reemplazo conserva versión e historial;
- descarga ajena, sector incorrecto, auditor e impersonación: 403/auditoría esperada;
- analytics y logs no contienen DNI, licencia, ticket ni texto OCR.

### E2E web y PWA

- Generador: alta → ATM → revisión → certificado → descarga → QR.
- Operador: alta → ATM/habilitación → revisión → certificado.
- Transportista: alta → vehículo → tarjeta frente/dorso → chofer → licencia → certificado.
- Admin sectorial: bandeja → comparación OCR → observar → corregir → aprobar.
- ADMIN: supervisión y revocación.
- Reanudación después de verificar correo y de cerrar/reabrir la PWA.
- Pérdida de red durante metadata y durante upload; no duplicar ni perder estado.
- Cámara, orientación, permisos y archivo desde galería en Android/iOS reales.

### Rendimiento y bundle

- el app-shell no incorpora Tesseract ni el idioma;
- ningún request OCR va a dominios externos;
- medir tiempo frío/caliente y memoria en un teléfono de gama media/baja;
- reutilizar worker y limitar concurrencia para no bloquear UI ni PM2;
- verificar limpieza de temporales, workers y colas en cancelación/logout.

## 13. Criterios de aceptación

- Ningún actor puede quedar activo sin requisitos aprobados según una política versionada.
- El mismo ticket ATM no puede ser aceptado por dos actores, incluso con uploads concurrentes.
- Un recorte/recompresión del mismo ticket queda bloqueado o en revisión por fingerprint, sin falso bloqueo automático por similitud visual sola.
- Todo archivo tiene hash, tipo detectado, estado antivirus y propietario/sujeto inequívoco.
- Toda credencial tiene vigencia y toda emisión PDF es inmutable y verificable.
- OCR opera localmente, es lazy, auditable y siempre requiere confirmación humana.
- Vehículo y chofer tienen entidades estructuradas; cada archivo se asocia al sujeto correcto.
- Web y PWA comparten reglas, contratos y pruebas; ninguna replica lógica regulatoria a mano.
- No hay PII documental en logs, analytics, CacheStorage ni URLs/rutas públicas.

## 14. Definiciones necesarias de DGFA/ATM antes de programar

1. formato oficial y campo inequívoco del número de ticket/sellado ATM;
2. conceptos/períodos válidos y si un comprobante puede cubrir más de un trámite;
3. documentos obligatorios y vigencia por cada tipo de actor;
4. texto, alcance y autoridad firmante del certificado SITREP;
5. si el certificado requiere firma digital oficial o sólo verificación SITREP con QR;
6. política para choferes asignados a más de un transporte y vehículos transferidos;
7. plazo de conservación de tickets, tarjetas y licencias vencidas;
8. qué información mínima puede ser pública al verificar un certificado.

## 15. Evidencia de código principal

- `frontend/src-v6/pages/public/InscripcionWizardPage.tsx`: payload, upload y reanudación.
- `frontend/src-v6/pages/public/inscripcion/steps/StepCuenta.tsx`: modo prueba y transición.
- `backend/src/controllers/solicitud.controller.ts`: upload, envío y aprobación.
- `backend/src/controllers/documento.controller.ts`: pipeline robusto reutilizable.
- `backend/src/routes/solicitud.routes.ts`: autenticación, captcha y multipart.
- `backend/prisma/schema.prisma`: documentos, TEF, renovación, vehículos y choferes.
- `backend/src/middlewares/analytics.middleware.ts`: captura actual de request bodies.
