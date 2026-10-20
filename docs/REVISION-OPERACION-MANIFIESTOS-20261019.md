# Revisión de operación de manifiestos — 19–20/10/2026

Estado vigente: **web y app `6788c82c` publicados** en `sitrep.ultimamilla.com.ar` el **20/10/2026 a las 07:20:58 Mendoza**. Backend y manual **`d372ce6e` conservados**, sin reinicio ni migración. Smoke no mutante **62/62**, HTTPS externo **9/9** y PWA PASS. CAP cerrado, correos/push apagados, flags actuales y `main` intactos. Leer el cierre de publicación inmediato; las secciones de candidato/preparación conservan el registro histórico previo a publicar. La unanimidad y las certificaciones de escuela siguen limitadas a CAP.

## Publicación de web y app — 20/10/2026

Autorización explícita del dueño: publicar **`6788c82c6026dabf9eb9d342d738ffc39ade640e`** sólo en web/app, conservar flags actuales, CAP cerrado y canales externos apagados; sin tocar `main` ni datos reales, con smoke no mutante. El release incluye los ajustes de acciones/ayuda/reloj de `153ab704` y los dos pendientes del chofer resueltos abajo.

- Frontend activo: `/var/www/sitrep` → `/var/www/sitrep-releases/20261020-chofer-6788c82c-r2`.
- Backend conservado: `/var/www/sitrep-backend-releases/20261019-relevos-d372ce6e`. Mismos dos PIDs **507773/507788**, reinicios **26/26**, fecha de inicio y configuración; no se ejecutó reload, restart ni save de PM2, y Nginx no cambió.
- [Identificación pública](https://sitrep.ultimamilla.com.ar/release.json): `source=6788c82c…`, `backendSource=d372ce6e…`, `manualSource=d372ce6e…`. Manual completo conservado; versión de datos **2026.20.11**, CSS/renderer y las seis entradas principales idénticos por hash.
- `MANIFEST_TRANSPORT_HANDOFF_ENABLED` y `TRANSPORT_MULTI_GPS_ENABLED` siguen true, también en los builds Vite. Los cuatro flags Vite originales, demo y los cinco flags operativos originales siguen false.
- `TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z`, `DISABLE_EMAILS=true`, `PUSH_MANIFEST_NOTICES_ENABLED=false`, VAPID vacío y contraseña SMTP ausente. `UPLOADS_DIR=/var/lib/sitrep-uploads` conservado; no se accedió a documentos o registros de negocio.

Se verificaron **2176 blobs** del commit autorizado antes/después de compilar. Tipado frontend efectivo correcto, builds seriales en el preview propio: web **29,95 s**, app **30,86 s**, con `VITE_API_URL=https://sitrep.ultimamilla.com.ar/api` y los mismos flags. **1 CPU/2 GiB/swap cero**, sin OOM. No se recompiló ni publicó el backend. No hubo migraciones, seeds, respaldos o restauraciones de datos en esta entrega de interfaz.

Los paquetes y **253 archivos web + 195 app** se verificaron por SHA-256 antes de activar. Se conservaron assets anteriores para clientes abiertos. La única transformación posterior al build es el nombre de caché del SW raíz, **v127 → v128**, registrada con hash anterior/posterior en `build.json`; las fuentes y bundles de aplicación corresponden a `6788c82c`. SW app **20261020100715** generado por Vite. Se conserva la activación explícita del usuario para no forzar recargas de borradores o GPS.

El cambio fue atómico, sólo del enlace de frontend. Smoke publicado **62/62**, exclusivamente GET: shells/rutas web/app, chunks nuevos de listado/viajes/GPS, tipos MIME, ambos SW, precache, offline, manual, asociación PWA, 404 de asset inexistente, redirección `/app`, health/live/readiness y rechazo 401 de rutas de transporte sin sesión. Verificación externa desde la Mac **9/9** y `scripts/ops/check-pwa-assets.sh` PASS. No hubo login, ejercicios, envíos GPS, correos o push en producción. La aceptación funcional es la del preview: **146/146** dirigidas, **77 grupos API**, **12/12** navegador; no se repitieron suites completas ni se certificó un teléfono físico al publicar.

`.env` preservado exactamente: SHA-256 **`618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`**. Configuración guardada de SITREP en PM2 preservada: SHA-256 normalizado **`af3f8019519954da6a3dc5a70b0a6a455a3a27f5b2ba1910297a08df069bccfa`**, excluyendo únicamente la telemetría `axm_monitor`. Identidad de base/JWT y flags contrastados entre archivo, workers y configuración guardada, sin exponer secretos.

### Rollback de esta interfaz

Preparado y verificado, **no ejecutado**: `/var/www/sitrep-releases/20261020-chofer-6788c82c-r2-rollback`. Restaura la interfaz anterior **`d372ce6e`**, conserva también los assets de `6788c82c` para clientes abiertos y mantiene backend, flags y datos. Usa caché raíz **v129** y SW app **20261020102057** para distribuir el retorno sin reutilizar la caché activa. Inventario verificado de **4132 archivos** estáticos. Procedimiento privado y acotado a esta entrega:

```sh
ssh root@23.105.176.45 'node /var/backups/sitrep/20261020-chofer-6788c82c/deploy-frontend.js rollback'
```

Sólo admite como origen el release de esta publicación o el propio rollback; rechaza reemplazar otro release. Revalida backend/configuración y archivos, cambia únicamente frontend y comprueba la identificación pública. **No volver al backend anterior que desconoce tramos ni restaurar una base.** La contención del 19/10 que apaga entradas de transporte es otro procedimiento histórico; no es el rollback normal de esta publicación.

### Incidencias y cierre de publicación

Dos paradas de preparación conservaron el release anterior activo. Primero, una comparación del hash global de `dump.pm2` detectó la actualización periódica de `axm_monitor`; al comparar ambas instancias por `NODE_APP_INSTANCE`, el único cambio era telemetría. Se corrigió el guard para proteger todas las opciones guardadas de SITREP salvo ese objeto, además del `.env`, procesos y flags. Después, `tar --unlink-first` no pudo superponer directorios no vacíos de la copia inactiva. Se cambió a extracción normal sobre una copia nueva y se verificaron los mismos hashes; no se cambió producto ni se relajaron contratos funcionales.

La protección local bloqueó eliminar la primera copia inactiva. Se conservó `/var/www/sitrep-releases/20261020-chofer-6788c82c` como evidencia y se publicó el directorio `-r2`; aquélla nunca quedó activa. No se borraron releases anteriores ni se modificó el árbol activo para resolver la extracción.

Auditoría productiva privada: `/var/backups/sitrep/20261020-chofer-6788c82c/`, con preflights, paradas, paquetes/hashes, `deployment.json`, `final-state.json`, rollback y scripts. Copia local segura en `test-results-deploy-6788c82c/`, fuera de Git, sin dumps de base ni secretos. Artefactos de preview en `.qa-release-6788c82c-20261020` dentro de `/opt/sitrep-qa-enterprise-20261016/source`.

Preview propio detenido el **20/10 a las 07:23:42 Mendoza**, imagen y evidencia conservadas, sin túnel; no se iniciaron backend ni PostgreSQL allí durante estos builds. Contadores `max=0`, `oom=0`, `oom_kill=0`. Rama `codex/sitrep-training-20261018`, único checkout activo; `main` conserva **`c8402190edfc36b5e5d0dee1337c24bd1689420d`**, sin push ni workflows. El cierre posterior sólo documenta con `[skip ci]`.

## Pendientes del chofer resueltos — 20/10/2026, sólo preview

**Validación previa de `6788c82c6026dabf9eb9d342d738ffc39ade640e`**, sobre `4fe5e2e7`; publicado después como se registra arriba. Conserva las correcciones de `153ab704` y cierra los dos pendientes de usabilidad identificados en la revisión anterior. Único checkout `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`; commit `[skip ci]`, sin push ni workflows. Durante esta validación no se contactó ni modificó producción y `main` conservó `c8402190edfc36b5e5d0dee1337c24bd1689420d`.

| Antes | Después | Comprobación |
| --- | --- | --- |
| Los relevos asignados desplazaban los viajes propios hacia abajo. | La cola propia, tanto en tránsito como lista para retirar, aparece antes de **Relevos a mi cargo**. El acceso a **Cargas en este móvil** se conserva arriba. | Navegador comprueba el orden geométrico de ambos bloques, el encabezado propio dentro del viewport y la apertura de viajes/relevos. |
| Recuperar GPS denegado exigía detenerlo y volverlo a iniciar. | **Reintentar GPS** reinicia la captura con un toque, conserva las cargas marcadas y reemplaza el captor anterior. | Denegación sin envíos, reintento explícito, GPS recibido y un único captor después del reintento en las tres vistas. |

El reinicio de ubicación requiere una observación nueva, ignora callbacks del captor cerrado y conserva las recepciones anteriores y los errores terminales de acceso por carga. No habilita una carga relevada/revocada. La acción de una carga con error de envío ahora se llama **Reintentar envío**, con el número en su nombre accesible, para distinguirla del reintento del sensor. Si el teléfono tiene bloqueado el permiso, la persona debe permitir ubicación allí; la app no cambia ese permiso por su cuenta.

### Validación del candidato

Preview `76.13.234.213`, contenedor propio `sitrep-qa-training-20261018`; fases seriales, **un worker, 1 CPU, 2 GiB y swap cero**. Cuentas operativas artificiales y casos nuevos, sin abrir CAP ni consultar datos reales. Web/app compiladas secuencialmente con API relativa `/api`, demo apagado, los cuatro flags originales false y los dos de transporte true sólo para el ensayo. SMTP/VAPID vacíos, `DISABLE_EMAILS=true`, `PUSH_MANIFEST_NOTICES_ENABLED=false`, base CAP no conectada y vencimiento directo pasado. Las cuatro entradas CAP devolvieron 403 y sus rutas escolares operativas permanecieron cerradas.

| Comprobación | Resultado |
| --- | --- |
| Tipado y builds finales | Backend `tsconfig.build.json`, frontend `tsconfig.app.json` y builds web/app correctos. Ninguna API absoluta productiva en los bundles. |
| Unitarias dirigidas | **146/146**, 12 archivos. Incluyen reintento sin habilitar sesiones apagadas, cierre del captor previo, callbacks tardíos ignorados, observación nueva, carga relevada bloqueada y coexistencia de error de sensor/envío sin confundir botones. |
| API real de QA | **77 grupos correctos**: relevo 18, varias cargas 8 y fases/permisos/CAP cerrado 51. |
| Navegador del build final | **12/12 en un único pase**, cero reintentos automáticos o casos omitidos dentro de esa selección: cuatro escenarios por vista, web 1440×900, web móvil 360×800 y `/app` 360×800. |
| Recorridos | Cola propia primero; retiro, pausa, recarga, reanudación, cambio de viaje y entrega; tres cargas con una entrega y un relevo sin detener la restante; externo y reemplazo registrado, GPS/C3, revocación e historial; permiso denegado y recuperación con un toque. Quitar una selección detiene ese captor cuando queda vacío y no declara entrega. |
| Presentación y consola | 18 comprobaciones con captura, sin desborde horizontal; 18 mediciones de acciones primarias, contraste mínimo **7,74:1**, exigencia **4,5:1**. Cero errores JavaScript sin controlar. Tres 409 del emisor anterior y seis 403 de enlaces revocados son negativos esperados; los avisos de SW bloqueado proceden del aislamiento de Playwright. |

La primera compilación fue correcta. Antes de iniciar las pruebas se distinguió también el texto del reintento de envío por carga y se recompiló; las 146 unitarias y el pase único de 12 escenarios corresponden a esos builds definitivos. No se cambiaron expectativas ni umbrales para obtener estos resultados. Los tres escenarios de listados de la revisión anterior no se repitieron: no hubo cambios en esas pantallas. Tampoco se repitieron las suites completas históricas ni se certificaron sensores físicos, Android/iOS, segundo plano, SW offline o correo/push real. GPS emulado, mapa sintético etiquetado y tipografía original en caché; respuestas positivas de negocio de la API real de QA.

### Evidencia y cierre

Tres archivos de producto y tres de QA modificados. Los **2176 blobs** del manifiesto de fuentes coinciden entre checkout, preview y árbol Git de `6788c82c`. `source-proof.json` y `source-verified-final.json` identifican los bytes, junto con hashes de 416 artefactos web/app; el `source=4fe5e2e7…` de `runtime-proof.json` es la etiqueta del arranque/base, no la procedencia por sí sola. Sin cambios en backend, migraciones, permisos, custodia, históricos, código del SW ni manual.

Evidencias privadas fuera de Git: `test-results-driver-polish-20261020/` local y `.qa-driver-polish-20261020/` en `/opt/sitrep-qa-enterprise-20261016/source` del preview. Informes `verification-audit.json`, `units.json`, `handoff-http.json`, `fleet-http.json`, `review-api.json`, `review-browser.json` y `review-closure.json`. Capturas originales sin editar en `after/`, hashes/procedencia en `capture-provenance.json`; credenciales y tokens sólo en fixtures privados del preview. No hay nuevos accesos de pizarra.

Backend, servidor estático y PostgreSQL de QA cerrados sin forzar procesos; contenedor propio detenido el **20/10 a las 06:54:49 Mendoza**. Imagen, casos y evidencia conservados, sin túnel; `memory.events max=0`, `oom=0`, `oom_kill=0`. No hubo publicación ni rollback. Para descartar sólo estos ajustes puede revertirse `6788c82c` conservando `153ab704`, sin restaurar una base. El último despliegue conocido y su contención siguen siendo los de `d372ce6e`.

## Revisión posterior: agenda, listados y chofer — sólo preview

**Candidato `153ab7045ce4396ec8394772b1b050d6767c6ef6`, sin publicar**, sobre el cierre documental `91255329`. Revisión completada el 19/10 por la noche, después del despliegue anterior. Se trabajó únicamente en el checkout `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`. No se contactó producción durante esta revisión, no hubo push ni workflows y `main` conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`.

### Hallazgos corregidos

| Antes | Después | Motivo y comprobación |
| --- | --- | --- |
| El listado ofrecía crear a transporte/operador operativos y editar manifiestos terminados o de roles sin ese permiso. | Crear y editar se ofrecen según los permisos existentes del servidor; editar sólo en borrador para generador/administrador. La creación de propuestas por otros roles sigue limitada a sesiones CAP autenticadas. | Evitar botones que terminan en acceso restringido; navegador con cuatro roles, tres fases y tres vistas. No se ampliaron permisos. |
| La ayuda flotante tapaba filas del listado/perfil y el layout móvil agregaba otro botón de crear. | Ayuda en el encabezado de esas pantallas; la creación queda en la acción del listado. | Capturas antes/después y navegación real desde el botón de generador/administrador. |
| Al pausar, el reloj se congelaba y saltaba al recargar. | El tiempo transcurrido se calcula desde `fechaRetiro`, también durante las pausas; GPS y pausa conservan sus acciones. | Retiro, pausa, avance del reloj, recarga, reanudación, cambio de viaje y entrega en las tres vistas. No se agregaron plazos. |

Se conservaron la tipografía, colores, componentes y estructura del producto; no hubo un rediseño del manual ni cambios en backend, reglas regulatorias, cantidades, permisos o históricos.

### Resultado de las comprobaciones

Todo se ejecutó de forma serial en `76.13.234.213`, contenedor propio `sitrep-qa-training-20261018`, **un worker, 1 CPU, 2 GiB y swap cero**. Base exclusivamente sintética y cuentas operativas artificiales `@qa.invalid`; no se reutilizaron los accesos CAP ni se consultaron datos reales. Builds Vite de web y `/app` con modo producción y API relativa `/api`; los bundles no contienen la API absoluta productiva. Los dos flags de transporte estaban habilitados sólo para el ensayo, los cuatro originales apagados, demo apagado y proveedores externos desconectados.

| Comprobación | Resultado y alcance |
| --- | --- |
| Tipado y compilación | Backend `tsconfig.build.json` y frontend `tsconfig.app.json` correctos; builds web y app correctos, uno después del otro. |
| Unitarias dirigidas | **143/143**, 12 archivos: agenda, fechas/filtros/error/reintento, actualización al crear, cola de viajes, GPS simple/múltiple, selección/entrega, consultas, acciones y ayuda/layout. |
| API real de QA | **77 grupos correctos**: relevo 18, cargas múltiples 8 y revisión 51. Incluye cuatro roles × tres fases × tres conjuntos de casos, historial después de entrega y CAP cerrado. |
| Navegador | **15 escenarios distintos verificados**, cinco por vista: web 1440×900, web móvil 360×800 y `/app` 360×800, Chromium remoto. En el último pase conjunto pasaron 12/15; los tres de permiso GPS pasaron luego 3/3 sobre los mismos builds, tras corregir la espera de una transición del test. No se presenta como una única suite final 15/15. |
| Listados | Cuatro roles en cada vista: por iniciar/en curso/terminados, búsqueda, paginación real por scroll, vacío, acciones y acceso al formulario permitido. Tratado, rechazado y cancelado siguen diferenciados. |
| Chofer y varias cargas | Elegir entre viajes sin redirección automática, retiro, pausa persistente al recargar, reloj informativo, reanudación y entrega/historial. Tres cargas seleccionadas: entregar una, relevar otra y mantener la restante con GPS. Búsqueda conserva selecciones y sólo hay un captor. |
| Relevos y C3 | Externo con datos incompletos, reemplazo registrado, móvil/chofer, revocación y permisos; el transporte anterior deja de emitir para ese tramo. C3 espera GPS del reemplazo y conserva la secuencia de custodia. La entrega sigue a cargo del transporte original. |
| GPS denegado | Mensaje explícito y cero envíos antes del permiso; recuperación con **Detener GPS → Iniciar GPS** después de permitir ubicación. Quitar una selección no declara entrega: el manifiesto sigue en tránsito. |
| Interfaz y errores | 63 comprobaciones con captura; sin desborde horizontal en las pantallas medidas. 39 mediciones de acciones primarias habilitadas, contraste mínimo **7,74:1**, exigencia del test **4,5:1**. Cero errores JavaScript sin controlar. Los 403/409 corresponden a revocación o emisor anterior; avisos de SW bloqueado corresponden al aislamiento de Playwright. |

La **agenda de tres partes sigue restringida a CAP**. Se revisaron su presentación y comportamiento mediante componentes con datos artificiales: filtros, hoy/próximos en la fecha de Mendoza aun después de medianoche UTC, error visible/reintento y nuevo manifiesto primero para los cuatro roles. En la API operativa, sus dos rutas devolvieron 404 para los cuatro roles; los cuatro alias de la pizarra devolvieron 403. Esto no equivale a reabrir CAP ni a ejecutar de nuevo el circuito escolar completo autenticado.

Se conservaron los intentos fallidos. El diagnóstico inicial de listados reprodujo las acciones indebidas y el primer pase completo detectó el reloj congelado en las tres vistas. Después de corregir el producto, los tres fallos restantes del último pase eran lecturas de contraste durante los 150 ms de transición al habilitar un botón. El test ahora espera las transiciones finitas y exige la misma relación 4,5:1; no se modificó el color ni se relajó la expectativa. Las doce pruebas ya correctas no se repitieron sin un cambio que lo justificara.

La revisión no repitió las suites completas históricas de backend 1177/1177 y frontend 1615/1615: esos resultados pertenecen a `d372ce6e`, documentados más abajo. Tampoco certifica sensores físicos, Android/iOS, GPS en segundo plano, funcionamiento offline del SW ni entrega externa de correo/push. Fuentes originales verificadas de tipografía en caché y mapas sintéticos etiquetados; sin simular respuestas de negocio para los recorridos positivos. D10 y la habilitación regulatoria de externos siguen pendientes.

Observaciones de usabilidad que quedaron pendientes en esta etapa: con muchos relevos asignados, ese bloque antecedía y desplazaba la cola de viajes propios en el perfil; además, recuperar un permiso GPS denegado exigía los dos botones indicados arriba. **Ambas se resolvieron en `6788c82c`**, en el cierre del 20/10 registrado arriba, sin alterar custodia ni selección de cargas.

### Evidencia, cierre y continuación

Fuentes contrastadas por blob Git en ambos entornos: **2176 archivos**, cinco archivos de producto modificados y siete de QA. `source-proof-final.json` y `source-verified-final.json` identifican los bytes; el campo `source=91255329…` de `runtime-proof.json` es una etiqueta heredada del arranque, **no** la procedencia del build modificado. Los cinco blobs de producto corresponden a `153ab704`; después del build sólo cambió la espera del test de contraste y el nombre del reporte de su repetición. Se conservaron hashes de 416 artefactos de web/app.

Evidencias privadas fuera de Git: `test-results-review-circuito-20261019/` en el checkout y `.qa-review-circuito-20261019/` en `/opt/sitrep-qa-enterprise-20261016/source` del preview. Informes: `verification-audit.json`, `units.json`, `handoff-http.json`, `fleet-http.json`, `review-api.json`, `review-browser.json`, `gps-permission-browser.json` y `review-closure.json`. Capturas sintéticas originales en `after/`, con SHA-256 y procedencia en `capture-provenance.json`; fixtures con credenciales/tokens permanecen privados y no se incorporan al manual ni a Git. Orquestación local preservada en `runner.ts`; usa los guards de `frontend/cloud-qa/safety.ts` y las fases build/start/handoff-api/fleet-api/fixture/units/browser/gps-permission/close, siempre seriales.

El cierre del **19/10 a las 22:37:24 Mendoza** detuvo backend, servidor estático y PostgreSQL de QA; luego sólo el contenedor propio. Sin procesos forzados ni OOM, `memory.events max=0`, sin túnel abierto. Imagen y casos sintéticos conservados. CAP vencido (`2000-01-01T00:00:00Z` en este runtime de QA), base CAP no conectada, `DISABLE_EMAILS=true`, SMTP/VAPID vacíos y `PUSH_MANIFEST_NOTICES_ENABLED=false` durante todo el ensayo.

Estos cambios son **un candidato local pendiente de publicación**. No se cambió el service worker, no hubo migraciones ni configuración productiva y no se ejecutó rollback. Para descartar la revisión basta revertir su commit de interfaz/QA; no restaurar una base. El despliegue y la contención documentados de `d372ce6e` siguen siendo la última referencia productiva conocida. Los avisos Git de `._pack-…idx` se preservaron en el log local; no se repararon metadatos compartidos ni se usó otro checkout.

## Recorrido que debe entender cada persona

1. **Propuesta:** generador, transporte u operador crea el manifiesto. Aparece arriba en la agenda de los tres, con número, fecha prevista y tres iconos de aprobación. Cada parte ve claramente si debe decidir o si está esperando a otra.
2. **Aprobación unánime:** una negativa detiene la propuesta y queda en el historial. Las tres aprobaciones habilitan **iniciar coordinación**, que avisa a los demás. Este evento no inicia GPS ni declara retiro físico.
3. **Retiro y tránsito:** el transporte confirma el retiro cuando recibe la carga. Ahí comienza el tiempo transcurrido y el GPS del manifiesto. Una empresa puede tener varios manifiestos activos; la app muestra cada viaje y permite elegirlo sin redirigir siempre a uno solo.
4. **Entrega y tratamiento:** el operador registra recepción, pesaje y tratamiento, resuelve las adendas y libera parcial o final cuando corresponde. El estado del manifiesto y las certificaciones no se infieren de leer un aviso.
5. **Avisos:** la campana conserva el historial. Una novedad dirigida a una parte debe mostrarse de forma visible con la app abierta. El push del sistema operativo y el correo sólo se ofrecen a cuentas verificadas, suscritas y con los canales habilitados; nunca se anuncian como entregados si VAPID o SMTP están apagados.

Las listas de web y app deben distinguir **por iniciar**, **en curso** y **terminados** con el mismo nombre y estado real. La agenda de portada es una vista compacta del trabajo pendiente, con búsqueda y filtros; el listado completo sigue siendo el lugar para explorar todo el historial.

**Alcance del candidato:** agenda compacta, filtros por fase en el listado completo, cola de varios viajes y pantalla **Cargas en este móvil** para seleccionar físicamente qué manifiestos comparten el GPS. El tiempo transcurrido sigue siendo informativo, sin plazos nuevos. Las pruebas del relevo y las de varias cargas se informan por separado abajo.

## Rotura y relevo en tránsito: decisión del dueño e implementación candidata

Se admite el relevo por un móvil de la misma empresa, por otra transportista registrada o por una empresa **externa eventual con identidad declarada y seguimiento**, según la respuesta del dueño. No se sustituye silenciosamente `transportistaId` ni la asignación firmada: cada tramo conserva los datos disponibles de transportista, móvil y chofer, quién declaró el traspaso de custodia, motivo, fecha/hora, ubicación y evidencia disponible. Un relevo no supone habilitación regulatoria de la empresa eventual ni reescribe autorizaciones previas.

**Decisión recibida el 19/10:** la transportista del manifiesto original define y confirma cada traspaso, sin aceptación obligatoria del reemplazo ni aprobación previa del operador/administrador. Si el reemplazo no está registrado, se tolera una declaración incompleta: empresa, CUIT, patente, chofer, documento y contacto son opcionales; se conserva lo que se pudo cargar, sin crear un actor ficticio ni marcarlo como habilitado. El motivo del traspaso y la autoría de origen sí quedan registrados.

El modelo de datos debe separar el manifiesto de sus **tramos de transporte**. Un único tramo está activo por manifiesto; varios manifiestos pueden estar simultáneamente en el mismo vehículo. El GPS debe quedar atribuido al tramo y al dispositivo/cuenta que lo emitió. Al relevar, se cierra el tramo anterior y se abre uno nuevo en una transacción, con aviso a generador, operador, transporte previo, nuevo transporte si tiene cuenta y centro de control. El C3 muestra tanto el tramo vigente como los anteriores y señala las lagunas sin cobertura.

Para un externo sin cuenta se guarda la identidad disponible y se entrega un enlace/QR firmado, revocable y limitado al GPS de ese tramo durante un máximo de 24 horas. No es una cuenta de usuario ni permite aprobar, firmar, consultar el expediente completo o modificar la carga. El portador toca **Compartir ubicación**, permite GPS y mantiene esa pantalla abierta. El emisor se registra como acceso delegado del tramo; no se afirma verificar la identidad personal de quien sostiene el teléfono. La transportista de origen conserva la confirmación de entrega. Un nuevo relevo, la entrega, la cancelación, una reversión fuera de tránsito o la revocación invalidan el enlace anterior también entre workers. Volver a retirar después de una reversión no revive un acceso anterior; los permisos y las transiciones de cancelación/reversión existentes no cambian.

Una transportista registrada de reemplazo ve **Relevos a mi cargo** en su perfil y puede abrir ese mismo seguimiento limitado. Recibe un aviso dirigido al perfil; no obtiene por ese enlace acceso al expediente completo. La de origen puede renovar o revocar el acceso. Generador, operador y C3 reciben aviso interno del cambio.

**Integración:** `transportistaId`, `asignacionTransporte` y las aprobaciones siguen describiendo el acuerdo original. La tabla aditiva `tramos_transporte` conserva la secuencia de custodia; `tracking_gps.tramoId` y `emisor` atribuyen las nuevas posiciones. Los puntos históricos sin tramo siguen siendo históricos del transporte original, sin reescribirlos. GPS, relevo y entrega se serializan sobre el mismo manifiesto, además de la restricción de un único tramo activo. C3 muestra la empresa actual y los tramos anteriores; espera el primer GPS del reemplazo antes de usarlo como ubicación actual. El mapa del expediente separa las líneas de cada tramo.

## Casos que bloquearán la publicación del relevo

- Dos retiros o dos relevos concurrentes no pueden crear dos tramos activos ni perder un evento.
- Un transportista ajeno no puede leer, aceptar, cerrar ni enviar GPS para un tramo que no le pertenece. El transportista anterior deja de poder informar nuevas posiciones tras el relevo, pero conserva el historial que le corresponde.
- El relevo conserva las aprobaciones originales y las cantidades; no se usa para modificar carga, generador, operador o reglas de compatibilidad.
- Una empresa externa eventual queda identificada como declarada, no como habilitada. La vista distingue ambas condiciones y no presenta el registro como una habilitación; los documentos originales conservan el acuerdo firmado.
- Mismo móvil con varios manifiestos: cada posición recibida debe quedar atribuida explícitamente a cada manifiesto/tramo que se está transportando. No basta con abrir una sola pantalla y asumir cobertura de los demás.
- Sin conexión: se muestra qué tramo carece de GPS reciente. El sistema no inventa puntos ni continuidad.
- Web, app y C3 muestran el mismo responsable vigente, la secuencia de custodia y los avisos de cambio.

D04 queda precisada para esta capacidad por la decisión de arriba. D10 (compatibilidad y reparto móvil/carga) sigue pendiente: una selección registrada o una declaración eventual no certifican capacidad, habilitación ni aptitud. `MANIFEST_TRANSPORT_HANDOFF_ENABLED`, `TRANSPORT_MULTI_GPS_ENABLED` y sus pares Vite son opt-in, apagados por defecto; CAP autenticado puede ensayarlos en su esquema aislado. Publicar este backend requiere la migración aditiva `20261019180000_transport_handoffs`, también en el esquema CAP, incluso si se mantienen los flags apagados, porque C3 consulta los tramos. Nada de eso se aplicó a producción.

## Varias cargas y avisos

Una cuenta transportista entra a **Mis viajes → Cargas en este móvil**, marca únicamente las cargas que lleva ese vehículo y toca **Iniciar GPS**. Un solo captor geográfico envía la misma observación reciente a cada manifiesto original o relevo registrado seleccionado. Las selecciones se conservan al buscar otro número; cambiar de cuenta las borra y corta el captor. No hay selección automática ni atribución por pertenecer a la misma empresa.

Cada carga muestra su propia recepción GPS. Los envíos son secuenciales y no se reproducen coordenadas de más de un minuto como si fueran actuales. Al entregar una carga se espera sólo su envío pendiente, se confirma esa entrega y las restantes siguen. Un relevo o pérdida de acceso bloquea sólo el emisor de esa carga, con un mensaje para resolverlo. No hay transmisión prometida con la pantalla cerrada ni un nuevo plazo operativo. El externo sin cuenta conserva un acceso limitado por tramo; la selección de varias cargas corresponde a una cuenta transportista registrada.

La campana sigue siendo la historia persistente. Adenda creada/resuelta y relevo crean avisos para sus partes en la misma transacción de negocio. El push de esos avisos se intenta **después del commit**, únicamente para IDs nuevos, destinatario activo y verificado y recurso que todavía le corresponda; no se copian motivos o notas libres a la pantalla bloqueada. Es un canal de mejor esfuerzo: una interrupción del proceso puede perder ese intento, sin perder el aviso interno. El correo usa la cola durable existente, la familia `manifiestos`, el corte temporal y la preferencia de email, con reevaluación de cuenta/recurso antes de enviar. Los reemplazos registrados reciben un enlace a su perfil limitado, nunca al expediente original por vía de un aviso.

En **Avisos → Activar avisos del teléfono** se solicita permiso con una acción explícita. Una autorización local no se presenta como suscripción confirmada si falla el registro en el servidor. Web y app eligen el service worker de su ámbito exacto; tocar un push web no desvía la ventana del chofer en la app. CAP no solicita este canal. `PUSH_MANIFEST_NOTICES_ENABLED` queda apagado por defecto y no habilita VAPID ni SMTP por sí solo. Las tres aprobaciones siguen siendo una capacidad de CAP; este cambio no extiende esa regla a la operación real.

## Preparación para una publicación futura y reversión

Este es un candidato local, sin publicación ni integración en `main`. Para una entrega operativa se debe aprobar expresamente el alcance, confirmar versión/configuración activas en lectura y preparar artefactos con el dominio y flags elegidos. Antes del backend nuevo: respaldo verificado y migración aditiva en los esquemas correspondientes; sin seeds ni restablecer cuentas CAP. No repetir las doce migraciones históricas del despliegue de `1ab057a`. SMTP, VAPID, preferencias y permisos físicos requieren aceptación propia; las pruebas desconectadas no acreditan entrega real.

La reversión conserva tablas, eventos y GPS. Si ya existen relevos activos, **no volver a un backend que ignore tramos**, porque volvería a aceptar posiciones del transporte original y presentaría una responsabilidad incorrecta en C3. Se puede deshabilitar la creación de nuevos relevos manteniendo la lectura y el seguimiento de los existentes. Como referencia de código, `81c20f1d` conserva custodia/GPS por tramo antes de la pantalla de varias cargas; volver a esa interfaz detiene la sesión de GPS simultáneo y exige organizar el seguimiento de las cargas restantes. Los enlaces y releases concretos para un rollback se fijarán al preparar la entrega; hoy no existe un release desplegado de estos commits. No restaurar una base antigua para deshacer una interfaz.

## Verificación del relevo antes del GPS simultáneo (`81c20f1d`)

Todo se ejecutó en el contenedor propio del preview `76.13.234.213`, de forma serial, un worker, 1 CPU, 2 GiB y swap cero, con base sintética y proveedores externos desconectados. El relevo se habilitó sólo en ese proceso y sus builds de QA; los otros cuatro flags permanecieron apagados.

- Backend completo: **1165/1165**, 110 archivos. Tipado backend y builds Vite web y `/app` correctos. El comando inicial de tipos frontend apuntaba al `tsconfig.json` contenedor (sin archivos); no acredita el tipado de la app. En la validación conjunta se corrigió a `tsc --noEmit -p tsconfig.app.json` y pasó.
- API real: **16 grupos de comprobaciones correctos**, incluidos permisos de origen/reemplazo/ajeno, externo sin datos, asignación y aprobaciones intactas, reintentos idempotentes, relevos concurrentes, avisos transaccionales, GPS atribuido al tramo, revocación/renovación/expiración, instructor suspendido, entrega y historial propio. Un token de seguimiento no autentica como usuario.
- Navegador real: **2/2**, web y app, con cuatro contextos sintéticos. Traspaso externo desde el formulario, GPS limitado aun con una sesión de usuario vieja, C3 sin reutilizar posiciones previas, relevo registrado con móvil/chofer del catálogo, revocación del enlace anterior y entrega desde la pantalla del transporte original. GPS emulado, sin certificar sensores físicos, segundo plano ni Android.
- Migración aditiva ensayada en un esquema sintético independiente: impide dos tramos activos y borrar un tramo con GPS. El preview antiguo no tenía historia Prisma y `migrate deploy` devolvió P3005; no se falseó una línea de base ni se reseteó. Sólo allí se aplicó el SQL aditivo y se hizo el ensayo separado.
- Frontend completo más reciente: **1593/1594**; único fallo: las dos capturas nuevas del manual estaban bajo `screenshots/app/` y el contrato exige `desktop/` o `mobile/`. Se movieron a `mobile/`, conservando bytes y expectativas: manual **8/8** y contenido/procedencia **14/14** después de la corrección. El primer pase había expuesto cinco montajes con un hook de consulta cuando el flag estaba apagado; se corrigió el límite del componente y su control dirigido pasó. No se presenta ese pase como una suite completa final sin fallos.
- Manual con el diseño existente, versión de datos **2026.20.10**: tres capturas sintéticas sin editar, hashes y procedencia en `transport-handoff-capture-provenance.json`. Evidencias privadas de QA en `.qa-handoff-20261019` del preview y `test-results-handoff-20261019` del checkout, fuera de Git.

Las pruebas conjuntas posteriores se registran a continuación. No se hizo despliegue, migración ni cambio de configuración en producción; los accesos de la demo siguen cerrados y SMTP/VAPID apagados. No hay un GO global.

## Validación conjunta del candidato final

Producto **`d372ce6e2c62b21dc97a8a42a72d84a6de4d707b`**, posterior a `81c20f1d`, en `codex/sitrep-training-20261018`, únicamente en el checkout activo. Commits locales `[skip ci]`, sin push ni workflows; `main` conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Los artefactos se construyeron en el preview con `NODE_ENV=production`, API relativa `/api`, demo apagado, los cuatro flags de funcionalidad originales apagados y los dos flags de transporte habilitados sólo para la aceptación sintética. El código por defecto conserva esos flags de transporte apagados. No es un artefacto listo para publicar sin elegir la configuración operativa.

| Comprobación | Resultado |
| --- | --- |
| Backend completo, con los siete flags operativos apagados | **1177/1177**, 112 archivos |
| Frontend completo final | **1615/1615**, 228 archivos |
| Tipado efectivo | Backend `tsc`; frontend `tsc --noEmit -p tsconfig.app.json`, ambos correctos |
| Builds definitivos | Web 31,73 s; app 32,08 s. SW raíz **v127**, app **20261019234114** |
| Relevo, API/DB real de QA | **18 grupos correctos**, repetidos con el backend final: incluyen cierre/revocación al cancelar y al revertir, sin reactivar el enlace después de otro retiro |
| Cargas simultáneas, API real de QA | **8 grupos correctos**, permisos y datos limitados incluidos |
| Relevo, navegador del build final | **2/2**, web/app: externo, registrado, GPS, C3, revocación, entrega e historial |
| Cargas simultáneas, navegador del build final | **2/2**, web/app: tres cargas, una entrega, un relevo posterior y la restante con GPS; búsqueda conserva selección, un solo captor y ayuda en el encabezado |
| Manual, navegador | **2/2**, tres guías en cada vista, imágenes cargadas, índice, navegación y recarga; cero peticiones de negocio |
| Manual, contenido y procedencia | **15/15**, capturas sintéticas originales y hashes correctos |
| Deshabilitación, API real de QA | **3/3** rutas de transporte devuelven 404 con los flags apagados; clave push no disponible |

El primer pase de frontend de esta fase cerró 1604/1604. El build posterior detectó una llave faltante en la nueva vista que todavía no tenía una prueba de página; se corrigió y se agregó su recorrido de selección, búsqueda, entrega y cambio de cuenta. Los controles dirigidos posteriores cerraron 32/32 y 52/52. La inspección visual también detectó la ayuda flotante sobre una fila; pasó al encabezado y se repitió el navegador, sin editar sus capturas ni relajar los controles de GPS.

La revisión de cierres agregó cancelación y reversión a la revocación transaccional del GPS delegado. Backend completo y tipado repetidos sin fallos después de ese ajuste; la API comprobó los dos casos nuevos con los permisos de siempre.

El manual conserva **sin cambios de bytes** `manual.css` y `manual.js`, versión de datos **2026.20.11**. Agrega las guías de varias cargas, relevo y avisos, sin nuevas credenciales. `fleet-gps-capture-provenance.json` conserva los hashes de tres capturas del recorrido final; el recibo del relevo conserva sus tres capturas previas. GPS y mapas emulados, base sintética, SMTP/VAPID vacíos y ninguna entrega externa real.

Las pruebas no certifican Android, sensores físicos, GPS con la pantalla cerrada ni entrega a una casilla o proveedor push real. D10, los roles empresariales/multirrol apagados y la habilitación regulatoria de terceros no se dan por resueltos con esta interfaz. Las tres aprobaciones y las certificaciones escolares siguen dentro de CAP; no se amplían permisos operativos por ese motivo.

Evidencias: `.qa-handoff-20261019` en `/opt/sitrep-qa-enterprise-20261016/source` del preview y `test-results-handoff-20261019/` local, fuera de Git. Reportes finales `fleet-backend-unit-final.json`, `fleet-frontend-unit-final.json`, `handoff-http.json`, `fleet-http.json`, `handoff-browser.json`, `fleet-browser.json`, `operational-manual-browser.json` y `transport-default-off.json`. Las fuentes se contrastan por SHA-256 con `fleet-source-frozen-final.json`.

## Continuidad del preview

Sólo el contenedor propio `sitrep-qa-training-20261018`, con su límite de 1 CPU/2 GiB/swap cero; no copiar dependencias ni iniciar Docker en la Mac. Los procesos del backend/servidor estático se administran con `frontend/cloud-qa/start.ts` y `close.ts`, conservando `QA_ARTIFACTS=/work/sitrep/.qa-handoff-20261019`, los builds en `web` y `app` dentro de esa carpeta y el guard de `safety.ts`. Los archivos privados de fixture no se publican ni se incorporan a Git.

PostgreSQL de este gemelo usa `/tmp/sitrep-preview-run/pg-utf8-9`, usuario de SO `node`, base sintética `sitrep_night_qa_20260926` y loopback **55440**. Para retomarlo deben conservarse las opciones explícitas `-h 127.0.0.1 -p 55440 -k /tmp/sitrep-preview-run -c shared_buffers=32MB -c max_connections=20 -c work_mem=1MB`; un inicio sin ellas puede usar otro puerto o socket. No apuntar a ninguna base productiva ni aplicar una línea de base ficticia a Prisma.

Cierre confirmado: backend/servidor QA y PostgreSQL detenidos, contenedor `sitrep-qa-training-20261018` detenido, imagen y evidencia conservadas. Límites verificados: CPU `100000 100000`, memoria 2.147.483.648 bytes, swap cero; presión de memoria `max=259`, `oom=0`, `oom_kill=0`, sin ampliar límites. No quedó túnel ni servicio QA nuevo abierto.

Git emitió avisos de índice no monótono para un archivo auxiliar `._pack-…idx` en los metadatos compartidos del volumen SDTERA. Los comandos del checkout activo y la creación/lectura del commit terminaron correctamente; se conservaron los avisos en el registro local de QA y no se intentó reparar ni limpiar ese otro checkout o sus metadatos.
