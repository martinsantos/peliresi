# Análisis — generadores con tratamiento internacional

Fecha: 2026-08-24
Estado: diseño previo a implementación

## 1. Alcance

Se necesita soportar un generador habilitado para declarar que sus residuos
serán tratados en el exterior. En ese circuito el manifiesto debe poder
referenciar un transportista y un operador extranjeros, conservar una
declaración textual abierta de tratamiento internacional y mantener una
trazabilidad distinta de la nacional.

Este documento no modifica todavía el modelo ni las rutas de producción. La
razón es evitar una migración parcial que deje manifiestos nacionales ambiguos
o permita declarar una operación internacional sin habilitación documental.

## 2. Hallazgos del modelo actual

- `Generador` no tiene un alcance de tratamiento; sólo contiene datos de
  inscripción, categoría, actividad y corrientes de control.
- `Manifiesto.modalidad` ya existe en SITREP, pero sus valores actuales son
  `FIJO` e `IN_SITU`. Representa la modalidad operativa del retiro, no el país
  de tratamiento. No debe reutilizarse para internacionalidad.
- En SITREP `transportistaId` ya es opcional para el circuito `IN_SITU`, pero
  `operadorId` sigue siendo local y obligatorio.
- En RPTRAZAR ambos vínculos (`transportistaId` y `operadorId`) son obligatorios
  y el esquema todavía no contempla solicitudes públicas, OCR documental ni
  actores extranjeros.
- Los formularios de alta, edición de generadores, nuevo manifiesto,
  edición, detalle, PDF, QR, notificaciones, reportes, centro de control,
  permisos y filtros parten de que los actores son locales.

## 3. Decisión de dominio recomendada

No usar un booleano aislado ni sobrecargar `modalidad`. Incorporar un concepto
de alcance de gestión extensible:

```text
AlcanceTratamiento = NACIONAL | INTERNACIONAL
```

En el generador se guarda `alcanceTratamiento`, con valor por defecto
`NACIONAL`. La UI puede mostrarlo como “Tratamiento en Argentina” /
“Tratamiento internacional”, pero el contrato persistido debe quedar preparado
para futuros alcances o acuerdos regionales.

En el manifiesto se guarda el mismo alcance como snapshot de la operación. El
snapshot es importante: si mañana se modifica la habilitación del generador,
un manifiesto histórico no debe cambiar de significado.

## 4. Modelo propuesto

### Generador

Agregar:

```text
alcanceTratamiento AlcanceTratamiento @default(NACIONAL)
```

La edición sólo debe permitir pasar a `INTERNACIONAL` cuando el expediente del
generador tenga habilitación aprobada y vigente. La inscripción pública debe
mostrar el selector, pero la solicitud queda pendiente de revisión; el cliente
no puede autoactivar la capacidad.

### Manifiesto

Agregar:

```text
alcanceTratamiento              AlcanceTratamiento @default(NACIONAL)
transportistaExteriorId         String?
operadorExteriorId              String?
declaracionTratamientoInternacional String?
```

Reglas de integridad de aplicación:

- `NACIONAL`: conserva exactamente las reglas actuales y exige actores locales
  según la modalidad operativa.
- `INTERNACIONAL`: exige `generador.alcanceTratamiento=INTERNACIONAL`, una
  declaración no vacía y un transportista y operador exteriores válidos.
- No se permite seleccionar simultáneamente actor local y actor exterior para
  el mismo rol sin una regla explícita de tramo; si se necesita transporte
  nacional hasta frontera más transporte exterior, debe modelarse como etapas,
  no como dos IDs ambiguos.
- La declaración debe tener límite, historial de cambios y autor; no debe
  quedar solamente en un campo libre sin auditoría.

### Actores exteriores

Recomiendo una tabla separada, no reutilizar `Transportista`/`Operador` local:

```text
EntidadExterior
- id
- tipo: TRANSPORTISTA | OPERADOR
- razonSocial
- pais
- identificacionFiscal
- domicilio
- telefono / email
- numeroHabilitacion
- estado: BORRADOR | PENDIENTE | APROBADO | RECHAZADO | INACTIVO
- documentos y vigencias regulatorias
- createdAt / updatedAt
```

La separación evita otorgar roles de login provinciales a una empresa
extranjera, evita contaminar catálogos nacionales y permite aplicar una
política documental internacional diferente. Si el negocio exige que el actor
extranjero opere dentro de SITREP, se puede agregar después un usuario
sectorial, pero no debe ser un requisito de la primera migración.

## 5. Flujo funcional

### Alta y edición del generador

1. Selector visible: “Alcance del tratamiento”.
2. Si se selecciona internacional, mostrar explicación y requisitos.
3. Guardar el valor en la solicitud de alta y en la ficha editable.
4. La aprobación administrativa exige la documentación/habilitación
   internacional definida por DGFA.
5. El cambio queda auditado; no debe alterar manifiestos históricos.

Superficies SITREP a actualizar: inscripción pública, `NuevoGeneradorPage`,
`GeneradorDetallePage`, `AdminGeneradoresPage`, solicitud/revisión documental,
tipos `Generador`/API y catálogos. RPTRAZAR deberá recibir el mismo contrato o
quedar explícitamente como versión nacional.

### Nuevo manifiesto

1. Seleccionar generador.
2. La interfaz muestra el alcance habilitado del generador.
3. Para un generador internacional, ofrecer “Manifiesto de tratamiento
   internacional”.
4. Seleccionar o registrar transportista exterior y operador exterior.
5. Capturar declaración abierta, país(es), referencia de permiso y documentos
   cuando la definición regulatoria esté aprobada.
6. Mostrar una revisión destacada antes de crear el manifiesto.

El selector no debe permitir cambiar manualmente un generador nacional a
internacional. El backend debe volver a validar la relación y la habilitación.

### Workflow

El workflow nacional no debe cambiar por defecto. Para internacional se debe
definir antes de programar:

- si conserva `BORRADOR → APROBADO → EN_TRANSITO → ENTREGADO → RECIBIDO →
  EN_TRATAMIENTO → TRATADO`;
- si `ENTREGADO` significa llegada a frontera, a destino exterior o entrega al
  operador;
- si habrá hitos aduaneros, exportación, recepción extranjera y certificado
  extranjero;
- qué rol firma cada hito y qué evidencia es obligatoria.

Hasta resolverlo, la primera versión segura puede crear el manifiesto y
mantenerlo en un estado específico `PENDIENTE_VALIDACION_INTERNACIONAL`, sin
habilitar las acciones nacionales de retiro/recepción por accidente.

## 6. Impacto técnico

| Área | Cambio necesario |
|---|---|
| Prisma/migraciones | enum, snapshot en manifiesto, entidades exteriores, índices, relaciones opcionales y backfill nacional explícito |
| Backend alta/edición | aceptar y validar alcance; impedir autoactivación internacional |
| Backend manifiestos | nuevo contrato Zod; validar habilitación, declaración y actores exteriores |
| Permisos | revisar quién puede crear, aprobar, editar y cerrar un internacional |
| Catálogos | endpoints separados para entidades exteriores; no mezclarlas con actores locales |
| Workflow | definir estados/hitos y transacciones; no reutilizar reglas nacionales sin revisión |
| PDF/QR | imprimir alcance, países, actores exteriores y declaración; preservar verificación pública sin PII excesiva |
| Reportes | filtros y agregados nacional/internacional; evitar contar exterior como operador mendocino |
| Centro de control | mostrar país/tramo y tratar GPS sólo si existe base legal y alcance operativo |
| Notificaciones | textos, destinatarios y fechas de frontera/aduana; evitar enviar a emails no verificados |
| Offline/PWA | sincronizar un payload nuevo y resolver conflictos sin perder la declaración |
| Documentos/OCR | requisitos por tipo de actor exterior; OCR sólo asistivo y revisión humana |
| Blockchain/auditoría | incluir alcance y hash de declaración; no cambiar el hash de manifiestos existentes |
| Frontend SITREP | alta, edición, nuevo manifiesto, detalle, modales, tipos, servicios y reportes |
| Frontend RPTRAZAR | portar contrato o marcar la capacidad como no disponible en la versión nacional |
| Pruebas | unitarias, migración, autorización, contrato API, E2E y regresión nacional |

## 7. Compatibilidad y migración

1. Migración aditiva: todos los registros actuales quedan `NACIONAL`.
2. No convertir `IN_SITU` a internacional: son conceptos distintos.
3. No hacer obligatorios nuevos campos en manifiestos existentes.
4. Crear índices para alcance y búsquedas por entidad exterior.
5. Usar feature flag de backend para bloquear escritura internacional hasta que
   existan políticas y fixtures QA.
6. Publicar frontend y backend coordinadamente; el frontend viejo debe seguir
   pudiendo leer manifiestos nacionales durante el despliegue.
7. Ejecutar backfill en una base QA aislada y verificar conteos antes de
   cualquier base compartida de SITREP/RPTRAZAR.

## 8. Contrato API preliminar

```text
GET  /api/catalogos/entidades-exteriores?tipo=TRANSPORTISTA|OPERADOR
POST /api/catalogos/entidades-exteriores              (admin sectorial)
PUT  /api/catalogos/entidades-exteriores/:id         (admin sectorial)

POST /api/manifiestos
{
  generadorId,
  alcanceTratamiento: "INTERNACIONAL",
  transportistaExteriorId,
  operadorExteriorId,
  declaracionTratamientoInternacional,
  ...
}
```

El backend debe responder errores de negocio estables, por ejemplo:
`GENERADOR_SIN_HABILITACION_INTERNACIONAL`,
`ACTOR_EXTERIOR_NO_APROBADO` y
`DECLARACION_INTERNACIONAL_REQUERIDA`.

## 9. Plan de implementación por fases

1. Acordar semántica regulatoria y documentos obligatorios con DGFA.
2. Implementar enum, snapshot y habilitación del generador; migración nacional
   con tests de compatibilidad.
3. Implementar entidades exteriores y CRUD administrativo mínimo.
4. Implementar creación/edición de manifiesto internacional detrás de feature
   flag, sin cambiar workflow nacional.
5. Incorporar revisión documental, PDF/QR, auditoría, reportes y notificaciones.
6. Definir y activar hitos internacionales, GPS/aduana y certificado final.
7. Portar el contrato a RPTRAZAR y ejecutar pruebas de paridad antes del
   despliegue gubernamental.

## 10. Preguntas que bloquean la implementación final

- ¿Cuál es el nombre jurídico y el valor oficial de la habilitación?
- ¿Qué países y qué documentos aduaneros son obligatorios?
- ¿Se admite un transporte nacional hasta frontera más uno exterior?
- ¿El operador exterior firma en la plataforma o sólo se registra como tercero?
- ¿Qué estado representa la entrega al operador exterior?
- ¿Se emite certificado extranjero, certificado DGFA o ambos?
- ¿Debe existir trazabilidad GPS fuera de Argentina?
- ¿Qué datos pueden aparecer en QR/verificación pública?
- ¿Qué rol administrativo puede aprobar o revocar la habilitación internacional?

Sin esas respuestas, implementar sólo el selector visual produciría una
funcionalidad que parece completa pero no garantiza una declaración válida.
