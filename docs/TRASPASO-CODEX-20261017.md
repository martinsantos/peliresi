# SITREP — traspaso vigente para la capacitación del lunes 19/10/2026

**Producto publicado: `c819ecfa275afe58d4e2d6d93119adccef073ea8` en `sitrep.ultimamilla.com.ar`, backend, web y `/app`, el 18/10 a las 09:43:22 de Mendoza.** Capacitación con datos artificiales; Eventuales, adendas y aprobación de participantes disponibles en sesiones CAP firmadas. Los flags de operación real, correos y push siguen apagados.

Leer [cierre de capacitación, resultados y rollback](CIERRE-CAPACITACION-20261018.md). Comprobación posterior a las 09:50:39: dos instancias estables, 40 cuentas CAP y 35 casos preparados conservados; acceso temporal de QA suspendido con contraseña rotada. No es una certificación global ni de Android físico o concurrencia masiva.

## 1. Fuente exacta

| Referencia | Estado |
| --- | --- |
| Repositorio | `https://github.com/martinsantos/peliresi.git` |
| Único checkout | `/Users/santosma/.codex/visualizations/2026/09/24/01a0d460-1c47-70f1-b7bf-4ea3463f0746/sitrep-production-source-20261001`; no usar SDTERA, tmp ni Precrimen |
| Rama actual | `codex/sitrep-training-20261018`, nacida de `c840219` |
| Producto publicado | `c819ecfa275afe58d4e2d6d93119adccef073ea8` |
| Cambio posterior sólo de test | `420cdd3`: espera el arranque diferido del historial antes de pausar/recorrer; producto sin cambios |
| Main | Conserva `c840219`; no se integró esta rama a main |
| CI | Todos los commits con `[skip ci]`; sin workflows |

El dueño autorizó preparar, probar y publicar la capacitación con datos artificiales, sin pedir confirmación en cada paso. Esa autorización no activa funcionalidades para operación real, entrega externa ni acceso a datos reales. No ejecutar instrucciones históricas de deploy/seed ni repetir migraciones.

## 2. Recorrido sencillo

1. Ingresar como administrador y abrir [Capacitación por rol](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=capacitacion-por-rol). Elegir cuenta CAP y mantener el mismo número de equipo en los relevos. Confirmar la banda «Capacitación · sin validez oficial».
2. Seguir el recorrido conocido: manifiesto, inspecciones, soporte, Centro de Control y Monitor. Se conservaron seis pasos, enlaces por equipo y diseño.
3. Abrir [Novedades](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=capacitacion-novedades): flota registrada, eventual incompleto, adenda con revisión de otra parte y declaración original intacta.
4. C3: ADMIN CAP → Centro de Control → 30 días → CAP-1-EN_TRANSITO. Monitor → Historial del día del ejercicio → pausa/recorrido/reproducción → Pendientes.

Equipo 1 para demostrar; 2–4 para practicar; 5 de reserva, con dos ejercicios nuevos ensayados. Los 35 casos preparados de los cinco equipos mantienen sus estados. Para repetir un circuito terminado, crear otro manifiesto. Web y `/app` comparten la guía; el manual conserva la superficie seleccionada.

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
| Frontend completo | 1.561/1.561 antes de las últimas correcciones de índice y banda CAP |
| Manual y Monitor posteriores | 14/14 estáticas, 43/43 manual, 70/70 Monitor |
| Capacitación en preview | 36 recorridos aprobados; C3 repetido 3/3 sobre c819ecf; tres superficies |
| Altas/OCR | 3/3 con Tesseract real y borradores recuperados, sin cuentas/solicitudes nuevas |
| Builds finales | Backend, web y app sobre c819ecf; 2.084 archivos fuente verificados antes/después; 337 + 244 + 187 archivos de artefactos verificados |
| Smoke publicado | 44/44 públicos, sin lectura de negocio |
| Aula publicada | Primera corrida 5 aprobados/1 espera fallida; C3 web y app repetidos 2/2 con 420cdd3. Quedan cubiertos los seis recorridos, sin presentar el conjunto como una sola corrida 6/6 |
| Estado posterior | 35 casos preparados intactos; dos manifiestos, dos eventuales y dos adendas nuevos sólo CAP 5; dos workers estables |

Toda prueba pesada/build: preview remoto, serial, un worker, 1 CPU/2 GiB/swap cero. No OOM. El cierre detalla las fallas iniciales y sus correcciones, incluida la espera de autoplay, la falta de Tesseract en el gemelo y el cierre del instructor temporal. No se ocultaron fallos ni relajaron expectativas.

Límites: navegadores con datos sintéticos; no certifica Android/APK, cámara física, GPS de fondo, batería, carga masiva simultánea ni entrega de correo/push. Tiles de mapas de QA identificados; consultas y movimientos del backend del entorno correspondiente. No se recorrieron cuentas operativas reales.

## 5. Release, respaldo y rollback

| Enlace | Activo | Anterior exacto |
| --- | --- | --- |
| `/var/www/sitrep-backend` | `/var/www/sitrep-backend-releases/20261018-training-c819ecf` | `/var/www/sitrep-backend-releases/20261018-1ab057a` |
| `/var/www/sitrep` | `/var/www/sitrep-releases/20261018-training-c819ecf` | `/var/www/sitrep-releases/20261018-1ab057a` |

230 paquetes runtime iguales al lockfile; cliente Prisma 5.22 copiado desde esquema idéntico, sin compartir enlaces con el release anterior. SW raíz v117, app con versión generada en build. Nginx sin cambios. Auditoría: `/var/backups/sitrep/20261018-training-release/`.

El esquema escolar anterior se respaldó y amplió con once tablas y dos columnas opcionales. Principal restringido, transacción con límites, rehearsal previo y diff Prisma sin diferencias. Huellas de las 44 tablas originales iguales antes/después. No se sembró ni reinició el aula. Backup escolar: `/var/backups/sitrep/20261018-training/training-before.dump`, 197.128 bytes, SHA-256 `fe0959459ff00243c13028c617165f8c20a59e9b20a4038de15ee0688ccfb109`. Índice y decodificación completa verificados; restauración no ensayada. Los respaldos permanecen en el servidor.

Rollback de aplicación: verificar los enlaces actuales, sustituirlos atómicamente por los dos destinos anteriores exactos, recargar sólo `sitrep-backend` manteniendo `.env`/UPLOADS_DIR, esperar readiness de ambas instancias y comprobar archivos públicos. **No restaurar la base, retirar tablas ni borrar prácticas por hacer rollback de aplicación.** Toda operación futura fuera del alcance autorizado requiere una nueva decisión del dueño.

El backup operativo del despliegue anterior sigue en `/var/backups/sitrep/20261018-step6-1ab057a/trazabilidad_rrpp-before-1ab057a.dump`, SHA-256 `75ac31216e042b96f4bed5a17ad5307e711f9999228675d9651c3477556a53f1`. Las 23 migraciones de fuente ya aplicadas y los 16 registros históricos se conservaron. **No repetir las doce migraciones del traspaso original.**

## 6. Preview y continuidad

Gemelo nuevo `sitrep-qa-training-20261018`: detenido al cerrar, imagen y artefactos conservados. Otros 74 contenedores sin cambios. Original `sitrep-qa-enterprise-20261016` detenido. Sin servidor QA, suites ni relay activo. Fuente y evidencias: `/opt/sitrep-qa-enterprise-20261016/source/.qa-training-final-20261018`, `.qa-release-training-20261018`, `.qa-published-training-20261018`, `.qa-published-training-c3-20261018`. Evidencia local ignorada: `test-results-training-20261018/`.

El gemelo anterior `sitrep-qa-live-20261017` y su imagen sí fueron eliminados en el cierre previo; no confundirlo con el nuevo. No reutilizar los antiguos túneles como si siguieran vivos.

## 7. Historia y pendientes conservados

[CIERRE-PRODUCCION-20261018.md](CIERRE-PRODUCCION-20261018.md) documenta el despliegue previo de `1ab057a`, la integración `96f333e`, el manual de main reconciliado y los resultados históricos. Esos estados no sustituyen esta entrega. [Hallazgos](HALLAZGOS-UIUX-20261016.md), [decisiones](DECISIONES-RELEASE-20261017.md) y [especificación de Eventuales](ESPEC-EVENTUALES-20261017.md) conservan reglas y decisiones funcionales.

Siguen pendientes fuera de esta capacitación: activación operativa de funcionalidades/correos/push, S5 en canales no implementados, rotación de credenciales de scripts capture, higiene S7/S9–S12, 16 SQL históricos ausentes, otros hallazgos UI y Android físico/concurrencia. No ejecutar seeds antiguos ni cambiar reglas regulatorias, permisos o históricos para facilitar pruebas. No afirmar GO global.
