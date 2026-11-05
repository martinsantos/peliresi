# Jefatura: eventuales, adendas y relevos — preview 05/11/2026

## Alcance y resultado

Base de código: `65322ad39da3fd520dd234743ef96ebcb6b7d917`.
Sólo preview aislado, datos artificiales y cuentas de práctica. Sin publicar,
sin modificar main ni consultar o modificar registros reales. CAP cerrado,
correos/push apagados y trabajos automáticos pausados.

Se ejecutaron seis operaciones por interfaz: eventual, adenda y relevo externo,
cada una desde web y app. Generaron ocho antecedentes: dos eventuales,
dos relevos y cuatro hallazgos de adendas (generador y operador por adenda).
La cuenta de jefe tiene designación explícita ADMIN_INSPECCIONES sobre un rol
base GENERADOR; la prueba no utilizó ADMIN general como sustituto.

Cada antecedente fue evaluado por Jefatura, vinculado a una inspección, asignado
a un inspector y programado. La agenda del 14/11/2026 muestra ocho expedientes,
con fechas de 10:00 a 17:00 Mendoza. Los declarados sin alta conservan su nombre
y la advertencia de identidad por verificar, sin crear un padrón ficticio.

| Origen de práctica | Expedientes en agenda |
| --- | --- |
| Eventual app | IRP-2026-00009 |
| Relevo externo app | IRP-2026-00010 |
| Adenda app, operador/generador | ORP-2026-00005 / GRP-2026-00008 |
| Relevo externo web | IRP-2026-00011 |
| Adenda web, operador/generador | ORP-2026-00006 / GRP-2026-00009 |
| Eventual web | IRP-2026-00012 |

Las adendas conservaron la declaración original Y1:10 kg. Las observaciones
registraron Y1:14/15 kg y Y21:2 kg; se comprobó la distinción entre corriente
omitida por el generador y corriente fuera del alcance declarado del operador.
El relevo app conservó los datos de identidad incompletos para seguimiento.

## Defectos corregidos

- Identidad de Jefatura en Inicio, Inspecciones y Avisos: no mostrar sólo el rol
  base Generador cuando la función explícita es administrar inspecciones.
- Bienvenida y Repasar mi rol propios de Jefatura: evaluar antecedentes,
  asignar inspector y fecha, seguir respuestas y decisiones.
- Ayuda contextual de Jefatura: antes explicaba responder como inspeccionado;
  ahora orienta a organizar y seguir expedientes. Sin ampliar permisos.
- Agenda: el contador sin responsable medía ausencia de actor vinculado,
  no ausencia de inspector. Se rotuló sin actor vinculado.
- Manual PSIP actualizado con estas distinciones.

En el laboratorio se alineó MANIFEST_PROPOSALS_ENABLED con el frontend ya
habilitado; su ausencia provocaba 404 en tareas-partes. Esto fue configuración
exclusiva de QA, no cambio de flags de producción.

## Verificación

- 78 pruebas frontend, seis archivos: identidad, guía, panel de antecedentes,
  agenda, borrador y datos de apertura.
- 47 pruebas backend, cuatro archivos: permisos de jefe, antecedentes,
  operaciones y avisos de agenda.
- TypeScript frontend y compilaciones web/app: PASS.
- Lint de los once archivos TypeScript modificados: cero errores; cuatro
  advertencias preexistentes en SupportBubble y AuthContext, fuera de las líneas
  cambiadas. Sintaxis del manual JavaScript: PASS.
- Ocho avisos internos de antecedentes al jefe y diez de asignación/programación
  al inspector. Los dos adicionales corresponden a programaciones posteriores.
- Enlace desde Avisos: inspector abrió IRP-2026-00010 en web e IRP-2026-00012
  en /app/, con su contenido de origen intacto.
- Identidad, ayuda contextual y bienvenida corregidas comprobadas en web/app.
- Inspección móvil a 320 px y 393 px: ancho de documento igual al viewport;
  agenda final a 393×852 sin desborde horizontal. Capturas conservadas.
- Consola app en revisión final: cero errores.
- Auditoría de la base artificial: ocho antecedentes VINCULADA, ocho inspecciones
  PLANIFICADA, todas con inspector y fecha; cero correos nuevos en emailQueue.
- Verificación final del runtime: base sitrep_ephemeral_qa_1a93, esquema
  inspection_field_20261103; CAP cerrado y correo/push bloqueados.

Las acciones de origen, evaluación, apertura y programación se realizaron por
la UI; el contraste de datos fue sólo lectura sobre la base sintética.

## Evidencias y límites

Evidencias locales en `preview-review/`: review-flow-proof.json, review-tests.log,
review-backend-tests.log, review-build-final.log, product-changes.patch y capturas
agenda-jefatura-web.jpg, agenda-jefatura-app-393.jpg,
ayuda-jefatura-app-393.jpg, bienvenida-jefatura-app-393.jpg e
inspector-aviso-app-320.jpg. Las capturas corresponden a casos artificiales.

No se valida Android físico ni entrega real de correo/push. No es una prueba
exhaustiva de todos los flujos del producto ni un despliegue.

Observación adicional fuera de la agenda: el listado general de Expedientes e
Inicio aún usa Espontánea / denuncia para registros sin padrón, mientras Agenda
sí muestra el nombre declarado. Conviene extender esa identidad al listado y
al encabezado del expediente en una próxima corrección; no falta la información
original en el expediente ni en el antecedente.

Incidencias de instrumentación: el primer origen local 4189 conservaba recursos
anteriores durante la recompilación; se continuó en 4190 y se conservaron assets
anteriores en QA. La API de tamaño no aplicaba el viewport; la comprobación final
usó los controles responsive visibles de Chrome y midió el ancho efectivo.
Las fechas nativas se confirmaron mediante teclado para disparar onChange.
No se atribuyen estos incidentes a fallos de negocio.
