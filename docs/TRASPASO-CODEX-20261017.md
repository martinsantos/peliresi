# SITREP — traspaso vigente para la capacitación del lunes 19/10/2026

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
