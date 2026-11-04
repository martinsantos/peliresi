# Acceso de capacitación — incidente del 19/10/2026

## Cierre de los cuatro accesos, 19/10/2026

Por pedido del dueño al finalizar la demostración, se cerraron de inmediato los cuatro alias directos `admin`, `generador`, `transporte` y `operador` de `@capacitacion.invalid`. La fecha `TRAINING_DIRECT_LOGIN_UNTIL` pasó de `2026-10-20T03:00:00Z` a `2000-01-01T00:00:00Z`. La configuración se aplicó a `.env`, a ambos procesos PM2 y al estado guardado de PM2. El backend hizo una recarga controlada: dos workers online y `/api/health/ready` en 200. Ningún release de código cambió.

Se verificó con las credenciales originales: **4/4 nuevos ingresos rechazados con 403**. Se guardaron tokens temporales antes del cierre y se verificó que **4/4 sesiones previas recibieran 403** después. La API no consultó datos operativos; sólo se probaron los alias CAP. El respaldo íntegro del `.env` se verificó antes del cambio en `/var/backups/sitrep/20261019-cierre-capacitacion/backend-env.before.private` (acceso root, modo 0600); auditoría de la operación en `revocation.json`. Hash anterior `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`; nuevo `fd6a9d72f42f3eb5cd6a7378ba90424dfe0e147629dcb1a1fe51e7b61752529f`. Sólo cambió la línea del vencimiento.

Los 40 usuarios sintéticos preparados, sus manifiestos y certificados permanecen en el esquema escolar. Los otros 36 no recibieron estos cuatro alias de ingreso directo. No se modificaron cuentas ni datos operativos, permisos, contraseñas, frontend o `main`; no se dispararon workflows. Las hojas privadas de la clase conservan el registro de los accesos entregados, pero **esas cuatro credenciales ya no sirven**. No restaurar la fecha anterior ni reactivar alias sin una nueva indicación expresa del dueño.

## Historial — incidente de ingreso durante la clase

## Problema y diagnóstico

Durante la clase se informó que el generador no podía ingresar: «Demasiados intentos» y luego regreso al formulario sin aviso. Se probaron los cuatro alias CAP por HTTPS: los cuatro devolvieron 200, con `X-SITREP-Training: true`; el perfil del generador también devolvió 200. Ingreso adicional por la UI real de `/app/login`: cuenta CAP · GENERADOR 1, pantalla Mis trámites y agenda visibles. Contraseñas verificadas contra las entregadas, sin cambiarlas.

El límite de autenticación sigue siendo cinco intentos fallidos por identidad por minuto, además del límite de red. La pantalla ocultaba el error: AuthContext activa el estado de carga, el gate desmonta LoginPage y se pierde su estado local de error. AuthContext sí conservaba el mensaje. La corrección hace visible ese mensaje al montar de nuevo el formulario. No altera autenticación, duración de sesión, cuotas ni permisos.

## Cambio

Producto `271b63b`, arnés de comprobación adicional `75f3062`. `LoginPage` muestra el error local o el persistido en AuthContext; SW raíz v126. Manual permanece `ea92004` / recurso 2026.20.9. Backend `8de58de`, mismos accesos y vencimiento CAP al final del 19/10 Mendoza.

## Validación

- Cuatro cuentas por API: 4/4; perfil del generador: 200; UI real del generador: acceso y agenda confirmados antes de publicar.
- Regresión remota dirigida: 33/33. Incluye el desmontaje real por carga seguido de respuestas 401 y 429; el mensaje permanece visible y el botón vuelve a estar habilitado.
- Builds web y app seriales en preview: aprobados. Fuente `75f30620a4daa1aada61794636a568e5a35bffc9`, 2.126 blobs comprobados antes/después. 1 CPU, 2 GiB, swap cero, un worker; sin OOM.
- El primer preflight de procedencia se detuvo antes de ejecutar pruebas/build porque una ruta Unicode de `git ls-tree` estaba escapada. Se corrigió leyendo entradas delimitadas por NUL; evidencia inicial conservada, sin cambios de producto por ese fallo.

El primer ensayo de navegador mostró ambos errores correctamente en web/app y pasó app 2/2. Las dos comprobaciones web se detuvieron después del login válido porque esperaban «Mis trámites», título exclusivo de app. Se corrigió el test para exigir «Mis Manifiestos Recientes» en web; sin cambiar producto ni omitir la comprobación de sesión. Evidencia inicial conservada.

El arnés de navegador inyecta 401/429 únicamente en su contexto, sin consumir intentos fallidos de las cuentas de la clase. Después usa el login real del generador, comprueba Mis trámites y recarga para verificar que la sesión permanece. No modifica manifiestos ni datos de clase.

Repetición final publicada: **4/4**, sin fallos ni reintentos, contra frontend `75f3062`; test ajustado `2ba0540`. Los cuatro casos comprueban aviso visible (401/429 inyectados), login real del generador y persistencia tras recarga, en web y `/app`. Comprobación adicional interactiva: actualizar desde el aviso de nueva versión conserva la sesión CAP y la agenda. Captura `test-results-login-20261019/generador-publicado.png`.

## Preservación

Sin datos reales, main, workflows, cambios de contraseñas, migraciones ni reinicio del backend. `.env`, UPLOADS_DIR, flags apagados, correos y push conservados. Evidencias privadas locales: `test-results-login-20261019/`; comprobación inicial de UI: `test-results-agenda-live-20261019/generador-login-confirmado.png`.

## Publicación y rollback

Frontend web/app publicado **75f3062**, el **19/10/2026 11:42:46 Mendoza**. Smoke HTTP no mutante **44/44**; 245 archivos web y 189 app verificados por hash. Ambos workers backend conservan sus PID y número de reinicios. Auditoría `/var/backups/sitrep/20261019-login/`.

Release actual `/var/www/sitrep-releases/20261019-login-75f3062`. Para rollback, reemplazar atómicamente sólo `/var/www/sitrep` para apuntar a `/var/www/sitrep-releases/20261019-agenda-live-ea92004`. No reiniciar backend ni restaurar base. El release anterior recupera el defecto de mensajes silenciosos; las credenciales y los manifiestos no cambian.

Gemelo propio detenido y relay cerrado a las 11:45:39 Mendoza. Imagen/evidencias conservadas; 1 CPU/2 GiB/swap cero, sin OOM ni presión de memoria max. No se borraron prácticas.
