# Fuente conciliada con producción — 01/10/2026

Esta rama conserva la fuente del frontend `20261001-control-ui-r1` y el backend `20261001-actor-recovery-r1`, no toda la rama experimental de QA. Base histórica: `5af6e04`; recuperación desde archivos canónicos y candidatos verificados, sin reemplazar los checkouts previos.

Frontend fuente/configuración corresponde al lote publicado: 531 unit y 36 E2E aprobados, 288 archivos cambiados comprobados por HTTPS con SHA exacta. Backend canónico compilado coincide en 87/87 archivos de runtime con el paquete publicado; dos archivos compilados de setup/mock de tests no forman parte del deploy. Los resultados son evidencia del lote anterior, no una nueva corrida de cobertura ni certificación global.

No se incorporan otros 30 deltas experimentales del backend ni suites pendientes de otra rama. La rama recuperada `codex/sitrep-recovery-20260929` permanece preservada. No ejecutar migraciones ni desplegarla automáticamente por hacer push: esta rama de conciliación no es main/master.

Modelo de voz español: `frontend/public/voice/vosk-small-es-0.42.tar.gz` es un artefacto compartido, conservado fuera de Git para no duplicar el archivo grande. Licencia/notice se incluyen; el despliegue conserva el modelo existente. Para ejecución local puede enlazarse a la copia verificada del lote publicado. El modelo no implica certificación de dictado argentino con ruido.

Login azul institucional, sistema verde y marca conservados. No se modifican datos reales, correos, push, expedientes, cuentas o servidor del Gobierno. QA nativo sólo en base sintética local, con un worker y cierre comprobado.

Siguen pendientes uniformidad global de hover/active/tablas/íconos y bandeja de notificaciones; teléfonos físicos, Safari, PWA instalada, batería y revisión legal PDF. No afirmar software perfecto/100%.

## Siguiente lote: navegación web/app

Sobre esa fuente se corrige la selección simultánea del padre Actores y su categoría; los encabezados conservan la categoría en fichas. En la app, los accesos de generadores/operadores usan las rutas canónicas y señalan su categoría al abrir una ficha. Menú principal/drawer con objetivos mínimos de 44px, foco visible y transiciones de color sin animar geometría. Permisos, marca, login azul y sistema verde se conservan; SW web v79, política de caché sin cambios.

Verificación local de este candidato: 540 unit frontend, typecheck y builds web/app aprobados; lint de los archivos cambiados sin errores, 11 advertencias heredadas. 30 ejecuciones E2E aprobadas sobre los mismos builds en Chrome escritorio1440×900, Pixel7 responsive y ruta /app: seis navegación, doce Control/Monitor, doce inspecciones/manifiestos. Datos y sesiones reales únicamente de PostgreSQL sintético loopback, sin interceptar API de negocio. La publicación manual prevista es `20261001-navigation-ui-r1`, con rollback y backend anterior sin restart; hacer push no activa la producción.

No es cobertura global nueva. La rama previa de QA y otros 30 deltas backend siguen separados: no promoverlos ni descartarlos por esta conciliación.
