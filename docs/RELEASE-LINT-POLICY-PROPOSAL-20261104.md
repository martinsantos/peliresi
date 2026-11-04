# Propuesta de aceptación explícita de deuda de lint — 04/11/2026

**No autoriza el release. Requiere decisión de Martín antes de fusionar.**

El PR #46, commit `5729352c4ac483564321b4b0f481f797fe0ed226`, elimina los errores y deja el control crítico de Inspecciones en cero advertencias. El control global todavía falla: el máximo configurado es 596 y el código contiene 1.906 advertencias en 433 archivos.

Esta propuesta **cambia el criterio de aceptación**: permite conservar esas 1.906 advertencias verificadas en lugar de corregirlas todas antes del corte. No equivale a resolver la deuda ni a obtener una UI plenamente validada. La alternativa es mantener el bloqueo actual y corregir la deuda antes de publicar.

## Control propuesto

- `npm run lint` sigue analizando `eslint .`, con los mismos archivos, reglas y severidades.
- Todo error de ESLint, sintaxis, compilación del controlador o lectura del registro provoca salida distinta de cero.
- Una advertencia sólo se admite si coinciden ruta, SHA-256 del archivo completo, regla, hash del mensaje y cantidad de apariciones.
- Una advertencia en un archivo nuevo, renombrado o modificado falla. Un archivo que se toca debe quedar sin advertencias o someter un nuevo registro a revisión explícita.
- No se pueden compensar advertencias nuevas quitando otras en otra pantalla.
- Al corregir o eliminar una advertencia, su permiso debe retirarse también del registro. Si queda un permiso obsoleto, el control falla: no puede reutilizarse para reintroducir código viejo con deuda. Un archivo registrado que desaparece del análisis también bloquea el control y exige verificar si fue eliminado o excluido.
- Para consultar el detalle de todas las advertencias se conserva el comando directo `npx eslint . --format json`; el controlador no reemplaza ni oculta ese informe.
- La ejecución no escribe, amplía ni regenera el registro. `eslint-baseline.json` queda versionado para revisión; incluye el SHA de origen.
- El comando existente `lint:critical` no se modifica: Inspecciones continúa con `--max-warnings=0`. El controlador rechaza además cualquier entrada del registro para ese alcance. Una prueba contrasta todas las rutas con el comando real para detectar desajustes.
- `dist-lint` contiene únicamente la compilación del controlador, bajo el patrón `dist-*` que ya estaba excluido. No se añade ninguna exclusión de fuentes.

## Deuda aceptada si se aprueba

| Grupo | Advertencias |
|---|---:|
| Herramientas y auditorías `cloud-qa` | 1.141 |
| Tests | 165 |
| Producto/configuración | 600 |
| Total | 1.906 |

La mayoría corresponde a `no-explicit-any` (1.567), pero también existen advertencias de efectos, referencias y pureza de React. Por eso no se presenta como un cambio puramente cosmético ni como prueba de ausencia de fallos funcionales.

## Validación

La versión inicial `eb39952a5181f625f28884f14323e173900f9899` pasó la suite completa del frontend: **4.158/4.158**, incluidos los nueve tests iniciales del controlador. TypeScript, el lint crítico y el control global también pasaron con el criterio propuesto. El smoke web/app de #46 pasó 2/2 con API artificial.

La revisión posterior modifica sólo el controlador, sus pruebas y este documento; no el código de ejecución del producto ni el registro de deuda. Validación de esa revisión:

- **13/13 pruebas unitarias** del controlador, incluyendo reintroducción de deuda corregida, archivos ausentes y prohibición de excepciones en Inspecciones.
- **10/10 comprobaciones del comando real** en carpetas sintéticas: salida cero para deuda conocida y archivos corregidos con registro depurado; salida distinta de cero para fuente modificada, permisos obsoletos, deuda reintroducida, archivo excluido, excepción crítica, advertencia crítica, error de sintaxis y registro malformado.
- Análisis completo: cero errores, 1.906 advertencias registradas, cero grupos no aceptados y cero permisos obsoletos.
- Cotejo independiente del registro con Git y el informe original: **433 archivos, 1.906 advertencias, ninguna diferencia**. El SHA-256 del registro se conserva: `9e32cc74278ef67e4e070818f67fab646b9b7d202286e155290372362d32bb71`.

Entorno de QA: Node 20.19.6, un worker, 1 CPU / 2 GiB, sin red externa. Las pruebas dirigidas no se suman a la suite completa como si fueran una sola ejecución nueva. No se ha ejecutado todavía el CI de main sobre la fusión de esta propuesta. Android físico y la experiencia completa con usuarios no quedan validados por este control.

El registro procede del informe completo de ESLint sobre el commit de origen y los hashes de sus archivos Git. No contiene registros de usuarios ni datos de producción.

No modifica dependencias, esquema, estados de negocio, permisos, flags, CAP, correos, push ni servicios de capacitación. No prepara ni publica un bundle. La secuencia de release conserva CI, revisión del SHA exacto, preflight, prepare, revisión del recibo/BUNDLE_SHA y publish.
