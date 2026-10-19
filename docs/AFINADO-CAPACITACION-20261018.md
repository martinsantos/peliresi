# Capacitación — avisos, coordinación y certificaciones

**Estado final: `312d6f2` publicado el 18/10/2026 a las 22:24:44 Mendoza. Circuito publicado 2/2, eventual 2/2, manual 3/3 y smoke 44/44.** Los apartados intermedios conservan los intentos y releases anteriores.

## Pedido y alcance

El dueño probó operador, generador y transporte en teléfonos reales y encontró un circuito pasivo: debía buscar avisos, no distinguía aprobar de iniciar y encontraba descargas oficiales deshabilitadas junto a certificados escolares que volvían a pedir datos ya registrados. Autorizó corregir, probar y publicar en capacitación, sin main ni datos operativos.

Fuente única `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`. Cambios de flujo limitados a sesiones CAP autenticadas. Flags operativos, correos y push permanecen apagados. Sin migraciones, semillas, borrados, cambios de contraseñas ni workflows.

## Comportamiento nuevo

- **Avisos en vivo:** el aviso nuevo aparece sin abrir la bandeja, con enlace al manifiesto. Consulta cada cuatro segundos con la app visible. Reserva una franja propia, sin superponerse a formularios ni botones. Queda hasta abrirlo o descartarlo; descartar no lo marca leído. Los avisos previos no suenan al ingresar. No se cambia de rol. Cada teléfono habilita sonido mediante «Activar sonido»; el navegador exige ese gesto. No promete entrega con pantalla bloqueada, app cerrada ni push externo. No reproduce alertas por los propios actos.
- **Pendientes actuales:** Inicio muestra «Tu próximo paso» con número íntegro y explicación de lo que falta. Es independiente del contador de avisos históricos. Consulta hasta cien casos recientes y muestra cinco inicialmente; el listado conserva el resto.
- **Aprobaciones:** tres columnas con iconos, confirmación y contador. Indica qué partes faltan y cuándo te toca actuar. Rechazar con motivo detiene la propuesta y no permite retirar.
- **Inicio:** después de las tres aprobaciones, cualquiera de las tres partes vinculadas puede pulsar «Iniciar coordinación». Se registra una sola vez y notifica a los demás. Empieza el reloj de coordinación. Generador prepara la carga y operador coordina la recepción. El manifiesto sigue Aprobado: sólo el transportista confirma el retiro físico, que inicia viaje/GPS. El administrador no suplanta a ninguna parte. Propuestas nuevas o previas con marcador de tres partes requieren este paso antes de retirar; los casos históricos sin marcador conservan su circuito.
- **Programados:** sección desplegable dentro de Manifiestos, con los mismos expedientes ordenados por fecha. No es otra clase de manifiesto ni exige duplicar un alta. El recorrido de cuatro partes probado utiliza destino fijo; no se cambian las reglas del circuito in situ.
- **Certificaciones:** títulos «Certificación parcial» y «Certificación final total», marca C3 en PDF, datos de las partes y método registrado incorporados. Observaciones opcionales; firma explícita del operador conservada. Parcial solicita la cantidad certificada; final precarga el total recibido e incluye parciales. El destinatario recibe aviso y descarga el documento del mismo caso. Se retiran los botones deshabilitados de documentos oficiales de la vista CAP.
- **Controles conservados:** no exceder peso recibido, no certificar antes del tratamiento, final sólo después de Tratado y adendas aprobadas; sin nuevas adendas tras final. Documentos claramente identificados como capacitación, sin validez oficial. Eventuales y adendas conservan sus rutas y revisiones independientes.

## Manual y hojas

Manual existente actualizado sin cambiar su diseño. Sigue teniendo siete pasos. Antes de empezar: cuatro cuentas, banda CAP, activar sonido y permitir GPS al transporte. Las dos hojas privadas mantienen QR, usuarios y contraseñas simples; no se incorporan claves a Git ni al manual público.

## Punto de partida conservado

Lectura previa con principal `sitrep_training_role`, esquema escolar, transacción de sólo lectura y permiso SELECT público denegado: 62 manifiestos CAP. El dueño ya había llevado `CAP-1-ENTREGADO` a Tratado; se conserva ese cambio. Las pruebas sólo crean/modifican sus casos nuevos y comparan contra esta instantánea, sin exigir ni restaurar estados históricos preparados.

Release anterior exacto: backend y web/app `20261018-circuito-930d3e6`. `.env` SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`; vencimiento de accesos `2026-10-20T03:00:00Z`. UPLOADS_DIR y flags sin cambios. Rollback de la nueva publicación: volver ambos enlaces a ese release y recargar sólo backend conservando ese vencimiento; no restaurar base ni credenciales.

## Evidencia de los intentos previos

Primera suite backend: 1.117 pruebas pasaron; el archivo de propuestas no pudo importarse por una llave faltante en la consulta nueva de pendientes. Se corrigió el código y se repite completa, conservando la evidencia del fallo. No se publicó esa versión.

Los resultados de preview, build y dominio publicado se documentan al cierre. No equivalen a certificación de Android, sonido físico, GPS físico, segundo plano o concurrencia masiva.


## Resultados previos al ensayo de navegador

Backend completo repetido: 1.132/1.132 y build correcto. Frontend completo: 1.570/1.572; dos expectativas antiguas sobre versión del manual y botones oficiales deshabilitados se actualizaron al comportamiento solicitado. La primera repetición acotada detectó una carrera en la preparación del test nuevo de avisos: intentaba enviar la novedad antes de confirmar la carga inicial. Se sincronizó con la finalización observable de esa carga, manteniendo la expectativa de aparición del aviso. Repetición: 59/59, incluidos permisos/acciones, avisos, bandeja y manual. Manual estático: 16/16. No se presenta como una suite completa final de frontend.


## Ajustes encontrados en el ensayo completo

La primera pasada web/app encontró una interacción incorrecta del test: cerraba el desplegable de programados si ya estaba abierto. Se condicionó la apertura a su estado real, conservando la expectativa de ver el caso exacto. La repetición encontró un defecto del producto: un aviso flotante podía cubrir «Siguiente» durante otro alta. Se interrumpió la segunda superficie de esa repetición y se conservó su evidencia; el aviso ahora reserva espacio en el layout, sin bloquear controles. Se repiten controles de avisos/acciones, ambos builds y el circuito completo antes de publicar.


## Preview y artefacto final

Después de reservar espacio para los avisos: 59/59 controles frontend, 16/16 del manual, build web y app correctos. Recorrido integral 2/2 (web y app, cuatro contextos independientes), eventual 2/2 y manual 3/3 (escritorio, web móvil y app); cero omitidos, fallos o reintentos automáticos. Se revisaron capturas de avisos/retirada/certificaciones y el PDF final con C3. Evidencias: `.qa-proactivo-visible-20261018/` en el gemelo, conservando `.qa-proactivo-20261018/` y `.qa-proactivo-retry-20261018/` para los intentos anteriores.

Commit de producto publicado: `0e5ad039fac1c510002f19a02c81443b30b443b5`. La preparación verificó los 2.116 blobs de Git antes y después del build remoto serial. Backend, web y app compilaron; manual estático 16/16. API final `https://sitrep.ultimamilla.com.ar/api`; VITE_DEMO_MODE y los cuatro flags frontend false. Límites 1 CPU/2 GiB/swap cero y memoria sin eventos OOM. Artefactos y hashes en `.qa-release-proactivo-20261018/`.

## Publicación

Activación terminada el **18/10/2026 a las 21:56:56 de Mendoza**. Backend `/var/www/sitrep-backend-releases/20261018-proactivo-0e5ad03`; web/app `/var/www/sitrep-releases/20261018-proactivo-0e5ad03`. SW raíz v121 y app 20261019005502. Manual contenido 2026.20.6, conservando CSS/JS 2026.20.4 y el diseño existente. Smoke no mutante **44/44**, con contenido estático verificado por hash y ambos workers listos. No se ejecutaron migraciones, semillas ni instalaciones en producción; cliente Prisma reutilizado sólo después de comprobar esquema y paquetes idénticos. `.env` y uploads conservados.

Auditoría privada: `/var/backups/sitrep/20261018-proactivo/` (`stage.json`, `deployment.json`, hashes/paquetes y baseline CAP). La verificación de circuitos publicados se añade al cierre; no confundir el smoke con una prueba del flujo autenticado.

## Rollback del producto

Conservar los releases activos anteriores `20261018-circuito-930d3e6` de backend y frontend. Ante un rollback autorizado, cambiar atómicamente `/var/www/sitrep-backend` a `/var/www/sitrep-backend-releases/20261018-circuito-930d3e6`, recargar únicamente `sitrep-backend` y comprobar readiness de ambos workers; cambiar `/var/www/sitrep` a `/var/www/sitrep-releases/20261018-circuito-930d3e6`. Mantener el mismo `.env`, `UPLOADS_DIR`, flags false, DISABLE_EMAILS=true, VAPID vacío y `TRAINING_DIRECT_LOGIN_UNTIL=2026-10-20T03:00:00Z` en PM2. No restaurar la base, hashes de contraseñas ni borrar los eventos nuevos. El script de activación conserva esta recuperación automática si falla su smoke.


## Carrera de GPS encontrada en el dominio

La primera comprobación publicada de `0e5ad03` completó ambos recorridos, pero **web falló su control final** por un POST GPS 404 durante la transición de entrega; app aprobó. No se excluyó ese error de las expectativas. Ambos casos terminaron tratados (000031 y 000036) y sus documentos permanecen conservados. El operador había completado el flujo, pero la comprobación web no se declara aprobada.

El cliente podía confirmar entrega mientras quedaba un envío GPS en vuelo. La corrección detiene nuevos envíos y espera los pendientes antes del POST de entrega; ante un fallo de entrega reanuda el seguimiento. Los puntos guardados no se reenvían si el caso ya está entregado. El servidor conserva sus verificaciones de pertenencia y EN_TRANSITO, incluido el bloqueo entre workers. No se permite GPS posterior a la entrega ni se modifica la regla para hacer pasar QA.

Pruebas unitarias GPS: 15/15, incluyendo espera de un envío pendiente, ausencia de envíos posteriores y reanudación. Se añadió al recorrido real una retención temporal de un request GPS (sin falsear su respuesta): mientras está pendiente la entrega no puede salir; luego se deja llegar al servidor y se exige la entrega correcta, manteniendo cero errores HTTP inesperados. SW raíz se incrementa a v122 para el paquete corregido. Resultados de repetición y release final se agregan abajo.


## Cierre final verificado

`312d6f2` repitió 51/51 controles de GPS/service worker, 16/16 del manual, builds web/app y circuito completo **2/2 en preview** con el envío GPS retenido. Paquete final: backend, web y app compilados serialmente y 2.116 blobs de Git verificados antes/después. El overlay se generó por Git sobre `0e5ad03` y se comprobó el árbol completo, no sólo archivos modificados. Sin OOM ni kill; `memory.events max=12` registrado sin exceder 2 GiB.

Publicado el 18/10/2026 a las 22:24:44 Mendoza: backend y frontend en sus releases `20261018-proactivo-gps-312d6f2`; SW v122/app 20261019012304. Smoke **44/44**. Segunda comprobación publicada completa **2/2**, eventual **2/2**, manual **3/3**, cero omitidos/fallos/reintentos automáticos. Casos finales CAP-2026-000046, CAP-2026-000041; incluye espera real de envío GPS antes de entrega, sin quitar la expectativa de cero HTTP inesperados. Evidencias `.qa-proactivo-gps-20261018/`, `.qa-release-proactivo-gps-20261018/` y `.qa-proactivo-gps-published-20261018/` en preview. La pasada fallida anterior permanece en `.qa-proactivo-published-20261018/`.

Auditoría de sólo lectura a las 22:34:26, con principal escolar y SELECT sobre usuarios públicos denegado: 40 usuarios CAP, **62 manifiestos anteriores sin cambios de estado ni updatedAt**, incluidos los ensayos humanos. Veinte manifiestos propios de los dos intentos publicados conservados; cuatro Tratados, ocho certificados firmados (parcial 4 kg/final 10 kg), originales/pesajes de 10 kg intactos y adenda de 12 kg revisada independientemente; dos eventuales Tratados. Workers sin reinicios posteriores; `.env` idéntico. No se consultaron datos empresariales reales.

Rollback inmediato del ajuste GPS: ambos enlaces a sus releases `20261018-proactivo-0e5ad03`, recarga exclusiva backend y misma configuración/vencimiento. Ese estado conserva la carrera GPS, por lo que la recuperación debe valorar ese límite. Rollback del afinamiento completo: releases `20261018-circuito-930d3e6` conservados. No restaurar base, cuentas o contraseñas, ni borrar prácticas. Auditoría final `/var/backups/sitrep/20261018-proactivo-gps/`; auditoría de primer despliegue `/var/backups/sitrep/20261018-proactivo/`.

Gemelo propio detenido y relay cerrado; imagen/evidencias conservadas. Hojas A4 privadas actualizadas: `test-results-proactivo-20261018/output/pdf/SITREP-capacitacion-cuatro-telefonos-19-10-2026.pdf` y `SITREP-practica-eventual-adenda-19-10-2026.pdf`; una página cada una, QR decodificado y diseño inspeccionado. Claves no incluidas en Git/manual. El manual público conserva diseño y contiene el mismo recorrido.

Para iniciar la clase: actualizar web/app, entrar cada persona con su cuenta, verificar banda CAP, tocar «Activar sonido», crear un caso nuevo y compartir su número. Permitir ubicación al transporte, mantener pantalla/Viaje en Curso abiertos y comprobar en C3/Hoy el mismo número y cambio de posición antes de entregar. La prueba automatizada emula coordenadas; no acredita sensor físico, audio físico, Android instalado, segundo plano ni carga masiva. No se promete GO global.
