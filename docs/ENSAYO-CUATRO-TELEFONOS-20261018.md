# Capacitación: un manifiesto, cuatro teléfonos — 18/10/2026

**Publicado el 18/10/2026 a las 10:42:14 de Mendoza:** web, app y manual sobre `f19d024c534be146a4d7eb1a863410f556c2bf28`. Backend `c819ecf` conservado sin reinicio. Ensayo final CAP publicado aprobado en web y `/app`, con cuatro sesiones independientes por circuito.

## Para el lunes 19

Abrir [Un manifiesto, cuatro teléfonos](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=capacitacion-cuatro-telefonos). Siete pasos, unos 25 minutos, con el diseño existente del manual.

1. El instructor prepara cuatro teléfonos con ADMIN, GENERADOR, TRANSPORTISTA y OPERADOR CAP del mismo equipo. Cada persona conserva su rol. Equipo 1 para demostrar; 2–4 para practicar; 5 contiene los ensayos de QA.
2. Generador crea 10 kg de Y-CAP, selecciona vehículo y chofer del transportista y firma. Todos anotan ese número nuevo.
3. Transporte busca ese número, confirma retiro y espera «GPS activo» más la hora de «Sync». Mantiene la pantalla de viaje abierta y el teléfono desbloqueado.
4. Administrador abre C3 → Hoy → Viajes Activos, selecciona el mismo número y observa punto y recorrido. Envío más consulta pueden demorar alrededor de un minuto.
5. Transporte entrega. Operador recibe, pesa 10 kg, registra tratamiento y cierra. Los cuatro vuelven a abrir el mismo caso: debe decir Tratado. El viaje sale de activos; el historial queda.

Antes de clase, aceptar «Nueva versión disponible — Actualizar cuando termines» si aparece, tras guardar cualquier trabajo pendiente. Comprobar Internet y permiso de ubicación en el teléfono real de transporte. No borrar almacenamiento, reiniciar casos ni simular el avance abriendo otro manifiesto preparado.

[Eventuales y adendas](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=capacitacion-novedades) siguen como ejercicios adicionales. El recorrido anterior por rol, inspecciones y soporte permanece disponible. La nueva guía no reemplaza ni modifica esos circuitos.

## Hallazgo y corrección

El ensayo publicado encontró que el administrador podía conservar EN_TRANSITO después de que otro teléfono cerraba el caso: el detalle se consideraba fresco durante 60 segundos y no volvía a consultar al abrirse. Se corrigió `useManifiesto`: consulta al montar, al volver al primer plano y cada 30 segundos mientras el caso sigue activo y hay conexión. Detiene el intervalo en estados terminales y conserva la lectura offline. No cambian permisos, estados, validaciones regulatorias ni históricos. SW raíz v118; app versionada por build.

## Evidencia

- 22/22 pruebas de actualización, hooks, reconexión y manual; 58/58 de workflow offline, navegación de actores y service worker. Incluyen cierre desde otra sesión dentro del minuto de caché y actualización del detalle abierto.
- 15/15 controles estáticos del manual y empaquetado. El primer control tuvo 13/14 por el nuevo enlace añadido al taller (76 frente a 75); se actualizó el contrato exacto y se agregó la comprobación de la nueva guía.
- 9/9 recorridos del manual: guía nueva, taller existente y navegación general, en escritorio 1440 px, web 360 px y app 360 px. Se inspeccionaron capturas; después se acortó sólo el aviso inicial y se repitieron los 15 controles estáticos.
- Preview: 2/2 circuitos completos, web móvil y `/app`; cuatro contextos independientes por circuito, un worker. Creación, firma dibujada, vehículo/chofer, retiro, dos ubicaciones enviadas por la UI, consulta real de C3, ruta, entrega, recepción, pesaje, tratamiento y cierre visible en las cuatro sesiones. También se exige que C3 retire ese viaje de activos y que cada sesión conserve su rol.
- Build final web + app sobre `f19d024`: 2.090 archivos Git verificados antes/después; 244 archivos web y 187 app verificados por SHA-256. API del dominio final; todos los flags frontend aprobados en false. Sin OOM. Se conservan los avisos existentes de tamaño de chunks y CSS de exportación resuelto en runtime; este último pasó el smoke publicado.
- Publicación: 44/44 comprobaciones públicas y cinco archivos del manual verificados por hash. Los dos workers PM2 mantienen PID, estado y contador de reinicios; `.env` y enlace backend idénticos. Ensayo CAP final: 2/2 circuitos completos, sin reintentos ni omisiones; 3/3 pruebas del manual publicado. Recuperación: 1/1 ensayo que completa por la UI los dos casos propios interrumpidos, sin borrarlos ni restablecerlos.

Comprobación posterior a las **10:49:30 de Mendoza**: 40 cuentas CAP activas y los 35 casos preparados en su estado original. Los seis casos nuevos de esta etapa, CAP-2026-000003 a 000008, son del equipo 5 y están TRATADO. Instructor temporal QA suspendido con contraseña rotada. Misma configuración y mismos dos procesos backend, sin reinicios. Consulta de auditoría sólo lectura, sin tablas de negocio operativo.

No se repitieron las suites unitarias completas sobre `f19d024`: se ejecutaron las 80 pruebas afectadas y los 15 controles estáticos indicados, además de los recorridos de navegador. Los baselines completos anteriores permanecen identificados en el traspaso.

Pruebas y builds seriales en `76.13.234.213`: 1 CPU, 2 GiB, swap cero. La Mac sólo edita, empaqueta y orquesta. No workflows; commits `[skip ci]`. Main conserva `c840219`.

Fallos conservados: primera prueba interrumpida por navegación de test que consideraba visible un menú trasladado fuera de pantalla; segunda prueba falló al buscar dentro de Viajes Activos cerrado y al esperar un enlace todavía ausente en el menú de app. Se corrigieron esas acciones para seguir la UI normal. La tercera prueba reprodujo el defecto real de caché en web y app. No se relajó la expectativa de cierre. El primer inventario del build interpretó mal un nombre Unicode emitido entre comillas por Git; se corrigió con `ls-tree -z` antes de compilar. El intento y su lock se conservan archivados.

Límites: GPS emulado por navegador, dos puntos enviados al backend real del entorno correspondiente; tiles de mapa de QA identificados y fuentes originales cacheadas. No certifica GPS físico, segundo plano, cámara, batería, APK/Android ni concurrencia masiva. Sin excepciones JavaScript ni HTTP 5xx en los circuitos aprobados; se registran los 403 esperados de servicios externos bloqueados en CAP y los bloqueos del guard de QA. No se consultaron datos operativos reales ni se habilitaron correo, push o documentos oficiales.

## Release y rollback

Se publicó sólo frontend y manual. Backend, procesos PM2, `.env`, UPLOADS_DIR, esquema de base y migraciones se conservan. SHA-256 de `.env`: `d34cc69b6c61d60059206ec58ba4a63eee2e3f50b5abddeb8aff17fc071d5815`. Enterprise, Eventuales, adendas, revisión de participantes y multirrol siguen apagados para operación real; excepción de aula exclusivamente en sesiones CAP autenticadas.

Destino activo: `/var/www/sitrep-releases/20261018-four-phones-f19d024`. Anterior exacto: `/var/www/sitrep-releases/20261018-training-c819ecf`. Backend continúa en `/var/www/sitrep-backend-releases/20261018-training-c819ecf`.

Rollback de esta entrega: comprobar el destino actual de `/var/www/sitrep`, sustituir únicamente ese enlace de forma atómica por el anterior exacto y comprobar web, app, manual y service workers. No reiniciar backend ni restaurar base. Las prácticas y los respaldos del [cierre anterior](CIERRE-CAPACITACION-20261018.md) permanecen.

Auditoría: `/var/backups/sitrep/20261018-four-phones-release`. Evidencia local ignorada: `test-results-four-phones-20261018/`. En preview: `.qa-four-phones-20261018` (interrupción), `-r2` y `-r3` (fallos conservados), `.qa-four-phones-preview-20261018` (corrección y manual), `.qa-release-four-phones-20261018` (build final) y `.qa-four-phones-20261018-r4` (ensayo publicado), bajo `/opt/sitrep-qa-enterprise-20261016/source`.

Al cierre: gemelo `sitrep-qa-training-20261018` detenido; imagen y evidencias conservadas. Sin suite, servidor QA ni relay escuchando. Los contenedores ajenos no se modificaron. Este cierre documental no cambia el producto `f19d024` publicado.
