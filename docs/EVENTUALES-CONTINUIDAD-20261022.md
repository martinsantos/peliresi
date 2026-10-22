# Eventuales: búsqueda y continuidad entre participantes

Estado: **8a4d8225 publicado** en backend, web, app y manual el **22/10/2026 12:18:43 Mendoza**; base anterior 45c79bb9, rama codex/sitrep-training-20261018. Autorización del dueño: continuar el plan y publicar las correcciones comprobadas, sin main ni datos reales; CAP cerrado y correos/push apagados.

## Brechas reproducidas

- La lista sólo paginaba, sin búsqueda ni etapas. La lectura abierta no recibía cambios de otra parte.
- Una actualización mientras se escribe necesita distinguir la versión de la nota de la última versión del registro; no se debe enviar silenciosamente una decisión sobre una versión nueva.
- El cierre de adendas mostraba «CAP» también en expedientes operativos.

## Cambio y límites

Búsqueda del servidor por referencia BI-, nombre/identificación de participantes y patente, sin distinción de mayúsculas; etapa opcional, páginas estables de veinte y retorno al mismo filtro. Se conservan alcance por actor, autoridad exclusiva ADMIN en eventuales y el carácter interno de BI-. Íconos de aprobación de las partes reales, sin tildes decorativas ni aprobaciones ficticias para externos.

Actualización cada cinco segundos con pantalla abierta. Las notas y cargas observadas conservan su versión de partida; ante un cambio concurrente se requiere leer y aceptar la versión actual antes de confirmar. Un rechazo de parte no ofrece nuevas aprobaciones imposibles. No se modifican los contratos de aprobación, originales ni decisiones previas. Adendas operativas ya no se identifican como CAP al liberar la final.

Manual 2026.22.3, mismo renderer/CSS. Sin migración ni cambio de flags. Evidencia de QA en test-results-eventual-usability-20261022 (ignorado), contenedor remoto reutilizado, esquema exclusivo eventual_usability_20261022. Browser plugin no disponible: Playwright remoto conforme a skill frontend-testing-debugging y al límite del dueño. Una fase/un worker/1 CPU/2 GiB/swap cero. No emulador local ni Actions.

Prueba inicial: backend 1 aprobada/11 fallidas; interfaz 38 aprobadas/4 fallidas. Evidencia anterior conservada. Las verificaciones de implementación de filtros se adaptaron a SQL parametrizado porque Prisma 5 no soporta búsqueda JSON sin distinción de mayúsculas; no se relajaron permisos, paginación ni resultados. La aceptación SQL real se verifica por HTTP en PostgreSQL.

## Validación de esta tanda

Regresión dirigida: **16/16 backend y 44/44 interfaz**. PostgreSQL por HTTP: **6 grupos** que cubren paginación completa para los cuatro roles autorizados, búsqueda sin distinción de mayúsculas, referencia completa, etapa, página fuera de rango, filtros inválidos, caracteres de SQL tratados como texto, actores ajenos y administraciones sectoriales sin acceso al eventual.

**30/30 E2E únicos**, sin omitidos ni reintentos, en escritorio 1440×900, web móvil 360×800 y app 390×844. Incluyen búsqueda más allá de la primera página, regreso al filtro, aprobación desde otra sesión durante una nota, carga observada conservada durante otro movimiento, pérdida de respuesta después del guardado y recuperación por ID sin duplicar el hecho. También se repiten los recorridos existentes de participantes externos, mixtos, creación por generador y revisión posterior independiente.

Se conservaron dos pasadas incompletas del nuevo ensayo: un selector buscaba el texto completo de una etiqueta que incluía opciones y una aserción de Playwright esperaba un número en lugar del valor textual del control. Se corrigió el ensayo usando el nombre accesible del selector y el valor «12», sin cambiar permisos, cantidades ni expectativas del circuito. La primera suite global de interfaz detectó además una expectativa desactualizada de la versión del manual; se mantuvo el control de versión exacta y se actualizó a 2026.22.3.

La revisión de capturas detectó la alineación del ícono de Actualizar; se usa la propiedad del botón existente. El manual elimina frases de ensayo antiguo en la guía operativa de eventuales. Estos últimos ajustes pasaron nuevamente 44 pruebas dirigidas de interfaz, 8 del manual, tipos/lint y builds web/app, más 12 recorridos de presentación (subconjunto repetido de los 30). No se modifican renderer ni CSS del manual.

Suites completas: **1.497/1.497 backend y 1.818/1.818 frontend**, sin fallos. La suite completa de interfaz precede únicamente al ajuste de alineación del ícono y redacción operativa del manual; las comprobaciones finales afectadas se repitieron como se detalla arriba. El backend funcional no cambió después de su suite completa.

La primera captura del manual reveló que su ensayo no cargaba las fuentes en el preview aislado. Se reutilizó el caché verificado de las fuentes originales (CSS/WOFF por SHA), sin cambiar el producto ni el estilo del manual. **3/3 recorridos finales del manual** comprueban fuente cargada, texto, capturas y ausencia de desbordes. Son repeticiones, no se suman como nuevos E2E únicos. Se inspeccionaron las tres capturas finales.

Auditoría final: **786 tablas QA previas intactas**, cero intentos y cero cola activa de correo, cuatro alias CAP rechazados con 403, configuración cerrada verificada en ambos procesos. Runtime y PostgreSQL del preview cerrados después del ensayo; sin OOM ni presión en los límites. Evidencias completas y de la última repetición en `test-results-eventual-usability-20261022/evidence.tgz` y `manual-final-evidence.tgz`. El contenedor se reutilizó para compilar el commit definitivo y quedó detenido el 22/10/2026 12:15:02 Mendoza; imagen, base y evidencias conservadas.

No se certifican teléfonos físicos, trabajo en segundo plano ni entrega externa. La publicación y la reversión vigentes se detallan a continuación.


## Publicación y verificación final

Fuente **8a4d82251c2d60734d6b2d7900918daa8e9834a4**, sin push ni workflows. Compilación serial remota con 1 CPU/2 GiB/swap cero: backend, tipos efectivos, web y app; **2.397 blobs Git idénticos antes y después**, API `https://sitrep.ultimamilla.com.ar/api`, manual **2026.22.3** exacto. Los cuatro paquetes y sus archivos se verificaron por SHA-256 en preview, descarga y servidor. El build registró reclamación de memoria al límite (`memory.events max 1394`), sin OOM ni procesos matados; las pruebas finales previas registraron cero presión.

Backend activo: `/var/www/sitrep-backend-releases/20261022-eventuales-8a4d8225`. Web/app/manual: `/var/www/sitrep-releases/20261022-eventuales-8a4d8225`. SW raíz **v154**, app **20261022151220**; versionado de caché declarado como transformación del artefacto, fuente Git conservada. **144/144 smoke + 9/9 externo + 8/8 PWA**, sólo GET públicos/health/guardas sin token, cero logins o mutaciones. Dos workers estables con misma identidad/configuración; otros procesos y Nginx conservados.

**Sin migraciones, instalación de dependencias ni consultas/cambios de datos de negocio.** Paquetes, lock, esquema y migraciones idénticos a 45c79bb9. Respaldo privado de `.env` y PM2 comprobado antes de activar, releases anteriores íntegros por huella. `.env` SHA-256 **988d42eebd8fde9ad163db25f124a6680f6054849c6ce7c346f03ce284536872**, exactamente conservado. CAP cerrado, correos/push apagados, todos los flags actuales, cuentas y rutas de uploads conservados; ninguna cola externa liberada.

Evidencia local ignorada: `test-results-deploy-8a4d8225/` (build, artefactos, stage, deployment, smokes, lectura posterior y cierre de preview). Evidencia operativa privada: `/var/backups/sitrep/20261022-eventuales-8a4d8225/`; contiene además respaldo de configuración. No copiar secretos al repositorio.

## Reversión vigente preparada — no ejecutada

Volver a **45c79bb9 en backend, web, app y manual**, conservando el esquema, flags, archivos, borradores e históricos. Esta tanda sólo cambia lectura/listado/interacción y texto; los contratos de escritura son los mismos. No restaurar base ni ejecutar la reversión histórica de 45c79bb9 hacia 86a9b790.

```bash
ssh root@23.105.176.45 'node /var/backups/sitrep/20261022-eventuales-8a4d8225/publish-production.js rollback'
```

El comando verifica las huellas previas y configuración, recupera backend `/var/www/sitrep-backend-releases/20261022-circuitos-45c79bb9`, recarga sólo los dos workers SITREP, comprueba readiness y activa la copia de interfaz `/var/www/sitrep-releases/20261022-eventuales-8a4d8225-rollback`. Cachés de recuperación **v155 / 20261022151644**, para evitar servir bundles mezclados. Incluye los assets nuevos para clientes abiertos. Conserva Nginx y los otros procesos. Después verificar health, versión 45c79bb9 y configuración; registrar la ejecución si se usa.
