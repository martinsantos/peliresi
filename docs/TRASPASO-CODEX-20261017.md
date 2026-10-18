# SITREP — traspaso vigente después del despliegue

**Actualizado el 18/10/2026. Producto desplegado: `1ab057a57e07237625b3f9fb34d5e80623ecd4bf` en `sitrep.ultimamilla.com.ar`, backend, web y `/app`, a las 08:01:26 de Mendoza.** Integración a `main` completada. Este documento reemplaza el estado de candidato del 17/10; el cierre documental posterior no cambia el producto publicado.

Última comprobación productiva: 18/10, 08:03:04 de Mendoza, dos instancias online sin reinicios imprevistos. Este cierre se elaboró desde la evidencia guardada: **no volvió a contactar producción**. Detalle, hashes, incidencias y rollback: [CIERRE-PRODUCCION-20261018.md](CIERRE-PRODUCCION-20261018.md).

## 1. Fuente exacta y continuidad

| Referencia | Estado |
| --- | --- |
| Repositorio | `https://github.com/martinsantos/peliresi.git` |
| Único checkout autorizado | `/Users/santosma/.codex/visualizations/2026/09/24/01a0d460-1c47-70f1-b7bf-4ea3463f0746/sitrep-production-source-20261001`; no usar SDTERA, tmp ni Precrimen |
| Rama del checkout | `main`; el cierre documental avanza desde `1ab057a`, sin nuevo build ni despliegue |
| Producto publicado | `1ab057a57e07237625b3f9fb34d5e80623ecd4bf` |
| Revisión UI/UX y candidato | `codex/sitrep-uiux-review-20261016` y `codex/sitrep-manifiestos-v2-20261014`, ambos publicados en `222ccbb` |
| Integración | `96f333e`, árbol idéntico a `222ccbb`; `1ab057a` añade únicamente la versión del service worker |
| Manual de `main` | `7e1460b` y `3b67c24` tienen el mismo patch-id y árbol de manual. Se preservaron las mejoras posteriores del candidato al resolver seis conflictos; ambos commits quedan en la historia |
| CI | Commits con `[skip ci]`; sin workflows ni despliegues automáticos. Actions no tiene crédito |

No repetir integración, migraciones ni despliegue por encontrar instrucciones históricas en otros documentos. Cada nueva operación productiva necesita autorización específica del dueño.

## 2. Qué se publicó y qué permanece apagado

- Interfaz: errores en español, formularios que conservan lo cargado, listado compacto de manifiestos, un título por página, menú sin selector demo, `/app` con zoom y ErrorBoundary; correcciones de carga masiva, contraseña y vehículos.
- Backend: actualización del perfil propio con auditoría; suscripciones push ligadas a la persona; scripts de seed/demo protegidos contra producción.
- Eventuales v2: creación por cualquier parte o ADMIN, aprobación de participantes con cuenta y operador externo. Código y migración publicados, **funcionalidad apagada por decisión del dueño**, igual que empresa, adendas y multirol.
- Detalle funcional: [hallazgos](HALLAZGOS-UIUX-20261016.md), [decisiones](DECISIONES-RELEASE-20261017.md) y [especificación aprobada de Eventuales](ESPEC-EVENTUALES-20261017.md).

Configuración aprobada y verificada en `.env` y en ambas instancias PM2:

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

Frontend compilado con `VITE_API_URL=https://sitrep.ultimamilla.com.ar/api`; `VITE_ENTERPRISE_ENABLED`, `VITE_MANIFEST_EXCEPTIONAL_ENABLED`, `VITE_MANIFEST_ADDENDA_ENABLED`, `VITE_ACTOR_MULTIROLE_ENABLED` y `VITE_DEMO_MODE`, todos `false`. Cambiarlos requiere otro build autorizado. Las demás variables del servidor conservaron sus valores anteriores.

**Conservar `/var/lib/sitrep-uploads`**, fuera de releases. No sustituirlo por el default documental `/var/www/sitrep-uploads`. No se movieron archivos históricos; se preservó también el enlace fallback `uploads` del backend.

## 3. Validación y límites

| Validación | Fuente y resultado |
| --- | --- |
| Unitarias completas backend | `21d9753`: **1.064/1.064**, 100 archivos |
| Unitarias completas frontend | `21d9753`: **1.558/1.558**, 216 archivos, con flags de funcionalidad false |
| Integraciones HTTP y perfil/push | `21d9753`: **7/7 + 4/4**, sin entrega externa |
| E2E del candidato | `21d9753`: **45/45**, sin omisiones, inestables ni reintentos |
| Pantallas | `222ccbb`: **20 aprobadas + 1 omisión prevista**, cero fallos/inestables/reintentos |
| Builds finales web y `/app` | `1ab057a`: aprobados, API final y flags false; 243 y 186 archivos |
| Backend final | `1ab057a`: compilado en preview en 26,44 s; 335 archivos verificados al preparar el release |
| Smoke productivo final | **39/39**, sólo GET públicos y health (`SELECT 1`); sin login ni consultas de negocio |
| Comprobación HTTPS externa | **4/4**: web, `/app`, identificación de commit y health |
| Estabilidad posterior | Dos instancias online, mismos PID y contadores desde la activación final, comprobado a las 08:03:04 de Mendoza |

La primera corrida de unitarias frontend tuvo una falla por heredar un flag encendido del preview: se repitió completa con flags false y pasó sin cambiar producto ni expectativas. La primera corrida de pantallas dio 19 aprobadas, 1 fallida y 1 omitida por leer «Cargando SITREP…» antes del render. `222ccbb` corrigió únicamente la espera del test mediante `expect.poll`, manteniendo el umbral `rootText > 30`; la repetición completa pasó. No se ocultan esas fallas iniciales.

Las suites completas no se repitieron bajo el SHA final `1ab057a`: desde `21d9753` sólo cambió la espera del test, el merge conservó el árbol del candidato y se versionó el service worker. Sí se compilaron y verificaron los artefactos finales de `1ab057a`. Las pruebas pesadas fueron seriales, un worker, 1 CPU/2 GiB/swap cero en el preview; no hubo OOM. Antes del último build se corrigió una divergencia del límite efectivo de swap del gemelo, detectada por el guard antes de compilar.

No certificados: Android físico/APK, login y flujos por rol en producción, entrega de correos/push. `inbox.spec` y su fixture pendiente siguen fuera de la configuración E2E ejecutada. La asociación Android disponible no certifica el APK. No es un GO global.

## 4. Pasos autorizados: completados

1. **Destino:** confirmado por el dueño `sitrep.ultimamilla.com.ar`; inspección inicial de sólo lectura. No se desplegó en `rptrazar.mendoza.gov.ar`.
2. **Suites completas:** resultados y corrección aislada de pantallas en la sección 3.
3. **Integración:** candidato avanzado a `222ccbb`; merge `96f333e` publicado en `main`; manual faltante reconciliado sin perder sus cambios posteriores.
4. **Service worker:** commit `1ab057a`; cachés raíz `trazabilidad-rrpp-v116` y `runtime-cache-v116`. App versionada por build: `20261018001836`.
5. **Build frontend:** web y `/app` de `1ab057a`, API final y cinco flags false, seriales en preview. Esos mismos paquetes fueron publicados.
6. **Backup y migraciones:** backup verificado antes de cambios. De las 12 del lote, 2 ya estaban registradas; 4 ya existían físicamente y se reconciliaron con `migrate resolve --applied` tras comparar el esquema; 6 se aplicaron con `prisma migrate deploy`. Las 23 de la fuente tienen checksum exacto y estado aplicado; `Database schema is up to date!`. Se conservaron 16 registros históricos cuyos SQL no están en el checkout. No reejecutar las 12 como si estuvieran pendientes.
7. **Entorno:** valores de la sección 2, `.env` conservado exactamente al desplegar. Correos y push apagados; archivos subidos intactos.
8. **Preparación y despliegue:** backend compilado en preview; dependencias de runtime coincidentes con el lockfile copiadas a un release independiente; Prisma 5.22.0 generado para el servidor sin alterar el cliente anterior. Activación mediante enlaces atómicos y reload exclusivo de `sitrep-backend`. Manual incluido; Nginx sin cambios. Smoke final 39/39 y externo 4/4. Hubo dos rollbacks preventivos detallados abajo; el tercer intento quedó publicado.

## 5. Rollback y respaldos

| Componente | Activo tras el despliegue | Anterior conservado |
| --- | --- | --- |
| Backend (`/var/www/sitrep-backend`) | `/var/www/sitrep-backend-releases/20261018-1ab057a` | `/var/www/sitrep-backend-releases/20261012-training-r1` |
| Web + app (`/var/www/sitrep`) | `/var/www/sitrep-releases/20261018-1ab057a` | `/var/www/sitrep-releases/20261013-attention-r1` |

Los dos primeros intentos restauraron esos destinos anteriores automáticamente:

1. El smoke esperaba JavaScript para un SVG del precache. Se corrigió el MIME del verificador, sin relajar el hash esperado.
2. Readiness se comprobó cuando la segunda instancia aún tenía unos nueve segundos. Se agregó espera tras el reload de ambas; el contrato `uptime > 10s` y el producto no cambiaron.

**Procedimiento para un rollback futuro, sólo con nueva autorización:** verificar primero los destinos actuales y los releases conservados; reemplazar atómicamente ambos enlaces por los destinos anteriores exactos; recargar únicamente `sitrep-backend` conservando los flags y `UPLOADS_DIR` aprobados; esperar que ambas instancias superen diez segundos y comprobar health/readiness y archivos públicos. No deducir el release anterior por orden de directorios ni borrar releases. **Rollback de aplicación no significa deshacer migraciones ni restaurar la base.**

- Backup de base: `/var/backups/sitrep/20261018-step6-1ab057a/trazabilidad_rrpp-before-1ab057a.dump`, 23.033.797 bytes, SHA-256 `75ac31216e042b96f4bed5a17ad5307e711f9999228675d9651c3477556a53f1`. Se verificaron índice y descompresión completa; no se ensayó restauración en otra base. Hash vuelto a verificar antes del deploy.
- Respaldo previo del entorno: `/var/backups/sitrep/20261018-step7-env-1ab057a/.env.before`. Contiene el estado **anterior** a explicitar los cinco flags; no usarlo para rollback sin conservar la configuración aprobada.
- `.env` desplegado: SHA-256 `d34cc69b6c61d60059206ec58ba4a63eee2e3f50b5abddeb8aff17fc071d5815`, permisos 0600. Mismo contenido que el paso 7.
- Auditoría productiva guardada durante el despliegue: `/var/backups/sitrep/20261018-step8-1ab057a/`.

Los respaldos con secretos y datos permanecen sólo en producción. Este cierre no los leyó ni modificó.

## 6. Preview: gemelo retirado

Limpieza autorizada y completada el **18/10/2026, 08:09:39 de Mendoza**, únicamente en `76.13.234.213`:

- Eliminado `sitrep-qa-live-20261017`, ID `cc9c132b55efa02a7ea9683b5db2c014b77a1c944896d42da92ec84b4d615cb5`, después de cerrar QA y detenerlo.
- Eliminada su imagen `sitrep-qa-enterprise-20261016:live-20261017`, ID `sha256:904b70752338dc0cc43a682f2c96d06352c348178798825e4983f207994fa5ca`.
- Conservado el original `sitrep-qa-enterprise-20261016`, detenido, y su imagen. Los otros 74 contenedores mantuvieron identidad, imagen y estado; demás imágenes, redes y volúmenes sin cambios. Sin prune global, force ni eliminación de volúmenes.
- Conservados la fuente y artefactos montados en `/opt/sitrep-qa-enterprise-20261016/source`; también los archivos de entorno del preview. El estado efímero dentro de la capa escribible del gemelo desapareció al eliminarlo; no afirmar que esa base viva sigue disponible.
- **El antiguo túnel y las instrucciones de acceso al gemelo ya no sirven.** Para nueva QA hace falta preparar un entorno autorizado; no reiniciar el original ni recrear el gemelo automáticamente.
- Evidencia local: `test-results-close-20261018/preview-cleanup.json`. No se contactó producción en esta limpieza ni se tocaron otros proyectos.

## 7. Evidencia y pendientes

El [cierre de producción](CIERRE-PRODUCCION-20261018.md) versiona el resumen operativo. Los artefactos completos se conservan en directorios ignorados del checkout: `test-results-step2-21d9753`, `test-results-screen-wait-222ccbb`, `test-results-integration-96f333e`, `test-results-sw-v116-1ab057a`, `test-results-build-1ab057a`, `test-results-migrations-1ab057a`, `test-results-env-1ab057a`, `test-results-deploy-1ab057a` y `test-results-close-20261018`. No son archivos publicados en Git; cada carpeta incluye resultados o evidencia JSON.

Pendientes que este despliegue no resuelve:

- Decisión futura del dueño para activar funcionalidades, correos o push; actualmente apagados según la sección 2.
- Log de teléfono y chat de canales no implementados en `notification-dispatcher.service.ts` (S5), rotación de credenciales de scripts `capture-*` (S8), higiene S7/S9–S12 y 16 migraciones históricas sin SQL en este checkout.
- Patrón compacto en otros listados, «Editar» en tratados, O3/O4/O5 y H03/H04/H13/H17/H19 según los hallazgos.
- Instrucciones antiguas de seed en `DEPLOY-NUEVO-SERVIDOR.md` y `SETUP.html`: no ejecutarlas. Scripts de seed no son parte de un redeploy.
- Android/APK, `inbox.spec`, correos y pruebas productivas por rol conservan los límites de la sección 3.

Reglas vigentes: sin datos reales en QA, proveedores externos apagados, sin alterar reglas regulatorias/permisos/históricos para UI, Mac sólo verificaciones livianas, QA pesada remota serial con 1 CPU/2 GiB/swap cero. Cualquier nueva operación productiva o cambio de alcance requiere OK del dueño. No afirmar GO global ni certificar Android desde un viewport.
