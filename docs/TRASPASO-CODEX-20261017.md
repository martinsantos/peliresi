# SITREP — traspaso vigente para la capacitación del lunes 19/10/2026

## Estado vigente — aviso de acceso corregido, 19/10/2026

Web/app **`75f3062`**, publicado 11:42:46 Mendoza: conserva el mensaje de error al volver al formulario después de un login fallido. Generador CAP confirmado por API y UI; los cuatro alias responden 200. Credenciales, límites y permisos sin cambios. Backend `8de58de` sin reinicio, manual `ea92004` conservado, SW v126. Unitarias dirigidas 33/33; navegador publicado 4/4 (401/429 inyectados, login real y recarga de sesión en web/app); build remoto serial y smoke 44/44. Rollback sólo frontend a `20261019-agenda-live-ea92004`. Sin datos reales, main ni workflows. Leer [incidente, pruebas y rollback](ACCESO-CAPACITACION-20261019.md).

## Historial — agenda actualizada al crear, 19/10/2026

Web/app/manual **`ea92004`** publicados a las 09:29:02 Mendoza. El recién creado aparece primero, actualiza agenda al crear y llega a otra sesión sin recargar; después de la aprobación propia queda **En espera**. Animación breve con movimiento reducido respetado. Aprobaciones y permisos conservados. Backend `8de58de` sin reinicio; SW v125, manual 2026.20.9. Preview: unitarias 22/22, manual 16/16, cuatro roles × web/app 8/8. Agenda publicada de sólo lectura 3/3, smoke 44/44. Gemelo detenido y relay cerrado. Rollback sólo frontend al release `20261019-icons-88b1a0e`. Sin datos reales, main ni workflows. Leer [pruebas y rollback](AGENDA-CAPACITACION-20261019.md).

## Historial — simplificación visual, 19/10/2026

Web/app `88b1a0e`: íconos compactos sin tilde/reloj, verde aprobado y gris pendiente. Manual `71780c6` actualizado; backend `8de58de` conservado, sin reinicio. Agenda publicada 3/3, smoke 44/44, manual 16/16 + 4/4 archivos. SW v124; mismos accesos CAP. Rollback sólo frontend al release `20261019-agenda-8de58de`. Sin datos reales, main ni workflows. Leer [estado, pruebas y rollback](AGENDA-CAPACITACION-20261019.md).

## Historial — agenda de capacitación, 19/10/2026

**Backend, web, app y manual publicados sobre `8de58de`, el 19/10/2026 07:23:27 Mendoza.** Leer [agenda, pruebas y rollback](AGENDA-CAPACITACION-20261019.md). Inicio compacto con filtros y tres aprobaciones visibles; certificados con íconos/estados; adenda con teclado de texto; contraste y diálogo de entrega corregidos. Circuito aprobado conservado.

Publicado: circuito 2/2, eventual 2/2, manual 3/3, agenda 3/3, smoke 44/44. 83 manifiestos CAP anteriores intactos, mismos cuatro accesos simples. Sin datos reales, main, correos ni push productivo. SW v123; actualizar web/app y activar sonido. Rollback inmediato: ambos releases `20261018-proactivo-gps-312d6f2`; sin restaurar base. Gemelo detenido y relay cerrado. Los intentos fallidos y límites de QA se documentan en el cierre.

## Historial — avisos proactivos y entrega GPS corregida

**Backend, web, app y manual publicados sobre `312d6f239a015b0528218bf7d9a710fff4f36d04`, el 18/10/2026 a las 22:24:44 Mendoza.** Leer [afinamiento, pruebas, límites y rollback](AFINADO-CAPACITACION-20261018.md). Único checkout `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`; main permanece `c840219`, sin integración. Commits `[skip ci]`, sin workflows.

Los cuatro accesos CAP del equipo 1 conservan sus claves simples. Abrir `/app/` o web, actualizar la versión y tocar **Activar sonido**. El aviso nuevo aparece con enlace al caso, sin cubrir botones. Cualquier rol CAP crea la propuesta; generador firma, transporte y operador aprueban. Con las tres decisiones, una parte pulsa **Iniciar coordinación**; luego transporte confirma el retiro físico y envía GPS. El cierre espera los envíos GPS pendientes antes de confirmar entrega. Operador recibe/pesa/trata, firma y publica parcial/final; los otros descargan desde el mismo manifiesto. Fechas futuras son los mismos manifiestos programados. Adendas y eventual conservan sus revisiones y límites.

Comprobación publicada final: **circuito 2/2, eventual 2/2, manual 3/3 y smoke 44/44**. Incluye cuatro sesiones independientes, aviso visible, inicio idempotente, GPS hacia C3, entrega con envío en vuelo, adenda independiente y certificados firmados. Casos finales: CAP-2026-000046, CAP-2026-000041. El intento previo sobre `0e5ad03` tuvo web fallida por una carrera GPS; se conserva la evidencia y se corrigió el producto, sin excluir el error del test. GPS emulado; no certificación de sensores, Android ni segundo plano.

Auditoría a las 22:34:26: **62 manifiestos CAP anteriores intactos**, incluido el cierre humano de `CAP-1-ENTREGADO`; 40 cuentas CAP activas. Veinte manifiestos propios de los dos ensayos publicados conservados, cuatro tratados, ocho certificados, dos eventuales tratados. Datos reales no consultados. `.env` SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`, UPLOADS_DIR, flags false, correos apagados y VAPID vacío conservados; sin migraciones ni seeds. Accesos hasta `2026-10-20T03:00:00Z` (fin del lunes 19, Mendoza).

Releases activos `20261018-proactivo-gps-312d6f2`. SW raíz **v122**, app **20261019012304**. Hojas A4 privadas con QR/usuarios/claves: `test-results-proactivo-20261018/output/pdf/`; no incorporar claves a Git/manual. Auditoría privada `/var/backups/sitrep/20261018-proactivo-gps/`.

Rollback inmediato: volver ambos enlaces a sus releases `20261018-proactivo-0e5ad03` y recargar sólo backend conservando configuración y vencimiento. Ese release incluye los avisos, pero conserva la carrera GPS corregida ahora. Para volver al producto anterior a todo este afinamiento, se conservan ambos `20261018-circuito-930d3e6`. **No restaurar base ni borrar prácticas.** Gemelo propio detenido, relay cerrado, imagen/evidencias conservadas. Límites 1 CPU/2 GiB/swap cero, un worker; sin OOM (contador `memory.events max` 12 durante el build final, sin kill).

## Instantánea histórica — circuito completo publicado, 18/10 a las 19:49:28 Mendoza

**Backend, web, app y manual publicados sobre `930d3e6ae7c363789d5474d4aa40b4242b860825`.** Leer primero [circuito completo, resultados y rollback vigente](CIRCUITO-CAPACITACION-20261018.md). Fuente única: `sitrep-production-source-20261001`; rama `codex/sitrep-training-20261018`. Main permanece en `c840219`, sin integración. Commits `[skip ci]`, sin workflows.

El operador, generador, transporte o administrador CAP pueden iniciar. Generador firma; transporte y operador aprueban por separado. Hay avisos internos y agenda de retiros futuros. El retiro requiere las tres decisiones. Después del viaje/GPS/C3, recepción/pesaje/tratamiento, el operador libera parciales y final con firma; la adenda conserva el original, requiere revisión independiente y debe resolverse antes del final. Sólo sesiones CAP autenticadas; permisos operativos y flags siguen sin activarse.

Prueba publicada: web completa aprobada y repetición app completa aprobada; eventual 2/2, manual 3/3 y smoke público 44/44. Los intentos fallidos de QA se conservan y explican en el cierre. A las 20:03:12: 40 cuentas CAP y 35 casos preparados intactos; 000015/000025 Tratados con dos posiciones GPS y certificados; 000020 quedó pendiente por una interrupción del test, sin viaje activo. Para mañana crear otro caso y compartir su número. El GPS fue emulado: comprobar el teléfono físico con la hoja.

Los cuatro accesos y sus claves simples no cambiaron; no se usa administrador personal. Vencen al finalizar el lunes 19/10 en Mendoza (`2026-10-20T03:00:00Z`). Dos hojas A4 privadas con QR y pasos están en `test-results-circuito-20261018/output/pdf/`. Manual conserva diseño. SW raíz v120, app 20261018224742; recargar web/app o usar el aviso de nueva versión antes del ensayo.

`.env` SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`, sin cambios. UPLOADS_DIR, flags false, correos apagados y VAPID vacío conservados. Sin migraciones, semillas ni restauraciones. Auditoría privada `/var/backups/sitrep/20261018-circuito/`.

Rollback vigente: backend y frontend activos `20261018-circuito-930d3e6`; volver ambos enlaces a sus releases `20261018-direct-97c77be`, recargar sólo backend y conservar la variable de vencimiento y las claves. No restaurar base ni borrar prácticas. Gemelo propio detenido, relay cerrado, imagen y evidencias conservadas, sin OOM. Procedimiento y evidencias completos en el cierre enlazado.

## Instantánea histórica — accesos directos, 18/10 a las 11:43:39

**Lo que sigue conserva el cierre anterior. No sustituye el circuito, versión, resultados ni rollback vigente de arriba.**

**Backend, web, app y manual publicados sobre `97c77beecce5a349e53d47d89ad35881a599253a` en `sitrep.ultimamilla.com.ar`.** Leer primero [accesos directos, resultados y rollback vigente](ACCESOS-DIRECTOS-CAPACITACION-20261018.md). El dueño pidió cuatro usuarios/contraseñas para la pizarra, sin su administrador personal en los teléfonos. Los alias `admin@capacitacion.invalid`, `generador@capacitacion.invalid`, `transporte@capacitacion.invalid` y `operador@capacitacion.invalid` autentican exclusivamente las cuatro cuentas CAP del equipo 1. Contraseñas privadas fuera de Git y del manual. Vencen al terminar el lunes 19/10 en Mendoza.

Abrir `/app/`, entrar directamente y comprobar la banda amarilla «Capacitación · sin validez oficial». Seguir el manual «Un manifiesto, cuatro teléfonos»: crear y firmar → retirar y enviar GPS → observar el mismo número en C3/Hoy → entregar → recibir/pesar/tratar/cerrar. Cada persona conserva su rol. Eventuales y adendas mantienen el ámbito escolar y sus revisiones; los flags operativos, correos y push siguen apagados.

Fuente única y rama sin cambios: este checkout `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`; main `c840219`, sin integrar. SW raíz v119, app `20261018143836`. Backend completo 1.112/1.112; frontend completo 1.568/1.568. Recorridos publicados 2/2, manual publicado 3/3 y smoke 44/44. A las 11:50:18: 40 cuentas CAP, 35 casos preparados intactos, casos nuevos 000009/000010 tratados y workers sin reinicios posteriores. Gemelo propio detenido y relay cerrado, imagen/evidencias conservadas. Evidencia completa y límites en el cierre enlazado. GPS probado con coordenadas emuladas; falta comprobar ubicación física con los teléfonos de la clase.

Única variable nueva: `TRAINING_DIRECT_LOGIN_UNTIL=2026-10-20T03:00:00Z`. `.env` actual SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`; se conservan todas las variables anteriores y `UPLOADS_DIR`. No hubo migraciones/seeds ni cambios de permisos. Se respaldaron y verificaron los cuatro hashes CAP antes de reemplazarlos. Auditoría privada: `/var/backups/sitrep/20261018-direct-login/`.

Rollback vigente: ambos enlaces activos apuntan a sus releases `20261018-direct-97c77be`; volver backend a `20261018-training-c819ecf` y frontend a `20261018-four-phones-f19d024`, con recarga exclusiva del backend y retiro de la variable nueva del entorno PM2. No restaurar la base ni borrar prácticas. El procedimiento exacto está en el cierre enlazado.

## Instantánea histórica anterior — f19d024 / c819ecf

**Todo lo que sigue conserva el cierre previo; sus hashes, rollback, cifras y forma de acceso no sustituyen el estado vigente de arriba.**

**Web/app/manual publicados: `f19d024c534be146a4d7eb1a863410f556c2bf28`, el 18/10 a las 10:42:14 de Mendoza. Backend conservado: `c819ecfa275afe58d4e2d6d93119adccef073ea8`.** Dominio `sitrep.ultimamilla.com.ar`. Capacitación artificial; Eventuales y adendas disponibles sólo en sesiones CAP firmadas. Flags operativos, correos y push apagados.

Leer [ensayo de cuatro teléfonos, resultados y rollback actual](ENSAYO-CUATRO-TELEFONOS-20261018.md). Comprobación posterior a las 10:49:30: dos procesos backend sin reinicio, 40 cuentas CAP y 35 casos preparados conservados, seis casos nuevos propios tratados; instructor QA suspendido y contraseña rotada. No es certificación global, de GPS/Android físico ni de concurrencia masiva. El [cierre anterior](CIERRE-CAPACITACION-20261018.md) conserva la evidencia de Eventuales, adendas y el despliegue backend.

## 1. Fuente exacta

| Referencia | Estado |
| --- | --- |
| Repositorio | `https://github.com/martinsantos/peliresi.git` |
| Único checkout | `/Users/santosma/.codex/visualizations/2026/09/24/01a0d460-1c47-70f1-b7bf-4ea3463f0746/sitrep-production-source-20261001`; no usar SDTERA, tmp ni Precrimen |
| Rama actual | `codex/sitrep-training-20261018`, nacida de `c840219` |
| Producto publicado | Web/app/manual `f19d024`; backend `c819ecf` |
| Último cambio de producto | `f19d024`: detalle actualizado entre teléfonos, guía de cuatro roles y SW v118 |
| Main | Conserva `c840219`; no se integró esta rama a main |
| CI | Todos los commits con `[skip ci]`; sin workflows |

El dueño autorizó preparar, probar y publicar la capacitación con datos artificiales, sin pedir confirmación en cada paso. Esa autorización no activa funcionalidades para operación real, entrega externa ni acceso a datos reales. No ejecutar instrucciones históricas de deploy/seed ni repetir migraciones.

## 2. Recorrido sencillo

1. Abrir [Un manifiesto, cuatro teléfonos](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=capacitacion-cuatro-telefonos). El instructor prepara ADMIN, GENERADOR, TRANSPORTISTA y OPERADOR CAP del mismo equipo, una sesión independiente por teléfono. Cada persona conserva su rol. Crear un caso nuevo, compartir su número, seguir el GPS en C3 → Hoy y completar el cierre entre los cuatro.
2. Seguir el recorrido conocido: manifiesto, inspecciones, soporte, Centro de Control y Monitor. Se conservaron seis pasos, enlaces por equipo y diseño.
3. Abrir [Novedades](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=capacitacion-novedades): flota registrada, eventual incompleto, adenda con revisión de otra parte y declaración original intacta.
4. Para consultar el ejemplo preparado, separado del viaje nuevo: ADMIN CAP → Centro de Control → 30 días → CAP-1-EN_TRANSITO. Monitor → Historial del día del ejercicio → pausa/recorrido/reproducción → Pendientes.

Equipo 1 para demostrar; 2–4 para practicar; 5 de reserva, con ensayos previos y los seis casos nuevos de esta etapa ya cerrados. Los 35 casos preparados de los cinco equipos mantienen sus estados. Para repetir un circuito terminado, crear otro manifiesto. Web y `/app` comparten la guía; el manual conserva la superficie seleccionada.

## 3. Configuración preservada

```text
UPLOADS_DIR=/var/lib/sitrep-uploads
ENTERPRISE_ENABLED=false
MANIFEST_EXCEPTIONAL_ENABLED=false
MANIFEST_ADDENDA_ENABLED=false
MANIFEST_PARTY_REVIEW_ENABLED=false
ACTOR_MULTIROLE_ENABLED=false
MANIFEST_EXCEPTIONAL_REVIEWERS=
DISABLE_EMAILS=true
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

`.env` SHA-256 `d34cc69b6c61d60059206ec58ba4a63eee2e3f50b5abddeb8aff17fc071d5815`, conservado exactamente. Las demás variables mantienen su valor anterior. Frontend: API `https://sitrep.ultimamilla.com.ar/api`; enterprise, exceptional, addenda, multirole y demo false. La excepción de aula depende del ámbito CAP autenticado y del principal/esquema escolar aislado; no de un parámetro del navegador.

Conservar `/var/lib/sitrep-uploads`, el fallback histórico y los releases anteriores. Anexos/documentos oficiales bloqueados en CAP. La simulación mantiene roles, vínculos, autoría y revisión independiente; registra al instructor, sin habilitar a todo ADMIN como revisor regulatorio.

## 4. Validación de esta entrega

| Verificación | Resultado |
| --- | --- |
| Backend completo | 1.074/1.074; backend sin cambios posteriores |
| Frontend completo (baseline) | 1.561/1.561 antes de las últimas correcciones; no se repitió la suite completa sobre f19d024 |
| Manual y Monitor posteriores | 14/14 estáticas, 43/43 manual, 70/70 Monitor |
| Capacitación en preview | 36 recorridos aprobados; C3 repetido 3/3 sobre c819ecf; tres superficies |
| Altas/OCR | 3/3 con Tesseract real y borradores recuperados, sin cuentas/solicitudes nuevas |
| Build actual | Web/app f19d024; 2.090 fuentes verificadas antes/después; 244 + 187 archivos de artefactos. Backend c819ecf sin cambios |
| Smoke actual | 44/44 públicos + cinco archivos del manual por hash; sin lectura de negocio |
| Aula previa c819ecf | Primera corrida 5 aprobados/1 espera fallida; C3 web y app repetidos 2/2 con 420cdd3. Quedan cubiertos los seis recorridos, sin presentar el conjunto como una sola corrida 6/6 |
| Cuatro teléfonos | Preview 2/2 y aula publicada 2/2: cuatro sesiones persistentes, dos ubicaciones enviadas por UI, C3 y cierre en todos los roles; GPS emulado |
| Pruebas de la corrección y manual | 80/80 unitarias, 15/15 estáticas, 9/9 manual en preview y 3/3 manual publicado |
| Estado posterior actual | 40 cuentas CAP, 35 casos preparados intactos; seis casos nuevos propios tratados, incluidos los dos interrumpidos recuperados por UI; dos workers sin reinicio e instructor QA suspendido |

Toda prueba pesada/build: preview remoto, serial, un worker, 1 CPU/2 GiB/swap cero. No OOM. El cierre detalla las fallas iniciales y sus correcciones, incluida la espera de autoplay, la falta de Tesseract en el gemelo y el cierre del instructor temporal. No se ocultaron fallos ni relajaron expectativas.

Límites: navegadores con datos sintéticos; no certifica Android/APK, cámara física, GPS de fondo, batería, carga masiva simultánea ni entrega de correo/push. Tiles de mapas de QA identificados; consultas y movimientos del backend del entorno correspondiente. No se recorrieron cuentas operativas reales.

## 5. Release, respaldo y rollback

| Enlace | Activo | Anterior exacto |
| --- | --- | --- |
| `/var/www/sitrep-backend` | `/var/www/sitrep-backend-releases/20261018-training-c819ecf` | No cambia en esta entrega; `1ab057a` es fallback histórico |
| `/var/www/sitrep` | `/var/www/sitrep-releases/20261018-four-phones-f19d024` | `/var/www/sitrep-releases/20261018-training-c819ecf` |

230 paquetes runtime iguales al lockfile; cliente Prisma 5.22 copiado desde esquema idéntico, sin compartir enlaces con el release anterior. SW raíz v118, app `20261018134006`. Nginx sin cambios. Auditoría actual: `/var/backups/sitrep/20261018-four-phones-release/`; anterior: `/var/backups/sitrep/20261018-training-release/`.

El esquema escolar anterior se respaldó y amplió con once tablas y dos columnas opcionales. Principal restringido, transacción con límites, rehearsal previo y diff Prisma sin diferencias. Huellas de las 44 tablas originales iguales antes/después. No se sembró ni reinició el aula. Backup escolar: `/var/backups/sitrep/20261018-training/training-before.dump`, 197.128 bytes, SHA-256 `fe0959459ff00243c13028c617165f8c20a59e9b20a4038de15ee0688ccfb109`. Índice y decodificación completa verificados; restauración no ensayada. Los respaldos permanecen en el servidor.

Rollback de esta entrega: comprobar los enlaces actuales y sustituir **sólo `/var/www/sitrep`** atómicamente por `20261018-training-c819ecf`. Comprobar web, app, manual y service workers. No recargar backend ni restaurar base, retirar tablas o borrar prácticas. El rollback histórico de la entrega backend a `1ab057a` permanece en el cierre anterior. Toda operación futura fuera del alcance autorizado requiere una nueva decisión del dueño.

El backup operativo del despliegue anterior sigue en `/var/backups/sitrep/20261018-step6-1ab057a/trazabilidad_rrpp-before-1ab057a.dump`, SHA-256 `75ac31216e042b96f4bed5a17ad5307e711f9999228675d9651c3477556a53f1`. Las 23 migraciones de fuente ya aplicadas y los 16 registros históricos se conservaron. **No repetir las doce migraciones del traspaso original.**

## 6. Preview y continuidad

Gemelo nuevo `sitrep-qa-training-20261018`: detenido al cerrar, imagen y artefactos conservados. Contenedores ajenos sin modificaciones de esta tarea. Original `sitrep-qa-enterprise-20261016` detenido. Sin servidor QA, suites ni relay activo. Fuente y evidencias: `/opt/sitrep-qa-enterprise-20261016/source/.qa-training-final-20261018`, `.qa-release-training-20261018`, `.qa-published-training-20261018`, `.qa-published-training-c3-20261018`. Evidencia local ignorada: `test-results-training-20261018/` y `test-results-four-phones-20261018/`. Las nuevas corridas y artefactos están detallados en el [ensayo de cuatro teléfonos](ENSAYO-CUATRO-TELEFONOS-20261018.md).

El gemelo anterior `sitrep-qa-live-20261017` y su imagen sí fueron eliminados en el cierre previo; no confundirlo con el nuevo. No reutilizar los antiguos túneles como si siguieran vivos.

## 7. Historia y pendientes conservados

[CIERRE-PRODUCCION-20261018.md](CIERRE-PRODUCCION-20261018.md) documenta el despliegue previo de `1ab057a`, la integración `96f333e`, el manual de main reconciliado y los resultados históricos. Esos estados no sustituyen esta entrega. [Hallazgos](HALLAZGOS-UIUX-20261016.md), [decisiones](DECISIONES-RELEASE-20261017.md) y [especificación de Eventuales](ESPEC-EVENTUALES-20261017.md) conservan reglas y decisiones funcionales.

Siguen pendientes fuera de esta capacitación: activación operativa de funcionalidades/correos/push, S5 en canales no implementados, rotación de credenciales de scripts capture, higiene S7/S9–S12, 16 SQL históricos ausentes, otros hallazgos UI y Android físico/concurrencia. No ejecutar seeds antiguos ni cambiar reglas regulatorias, permisos o históricos para facilitar pruebas. No afirmar GO global.
