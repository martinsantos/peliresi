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
- Para consultar el detalle de todas las advertencias se conserva el comando directo `npx eslint . --format json`; el controlador no reemplaza ni oculta ese informe.
- La ejecución no escribe, amplía ni regenera el registro. `eslint-baseline.json` queda versionado para revisión; incluye el SHA de origen.
- El comando existente `lint:critical` no se modifica: Inspecciones continúa con `--max-warnings=0`.
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

Prueba aislada con Node 20.19.6, un worker, 1 CPU / 2 GiB, sin red externa: el control completo devuelve cero errores, 1.906 advertencias existentes y cero grupos no aceptados. Pasan 9/9 pruebas del control: errores, archivos nuevos/cambiados/renombrados, mensajes y reglas nuevos, multiplicidad, compensación entre archivos y registros inválidos. La suite completa final del frontend pasa 4.158/4.158, sin fallos; incluye las nueve pruebas del control, que no se suman otra vez. TypeScript y el lint crítico de Inspecciones también pasan. Los builds web/app y el smoke de recuperación/reintento (2/2) del PR #46 siguen siendo la evidencia de producto: esta propuesta no cambia su código de ejecución. Se cotejaron 1.863 archivos del frontend por hash, sin diferencias. No se ha ejecutado todavía el CI de main sobre una fusión de esta propuesta. El registro procede del informe completo de ESLint sobre el commit de origen y los hashes de sus archivos Git. No contiene registros de usuarios ni datos de producción.

No modifica dependencias, esquema, estados de negocio, permisos, flags, CAP, correos, push ni servicios de capacitación. No prepara ni publica un bundle. La secuencia de release conserva CI, revisión del SHA exacto, preflight, prepare, revisión del recibo/BUNDLE_SHA y publish.
