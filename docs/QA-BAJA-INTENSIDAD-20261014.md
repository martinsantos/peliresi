# Baja intensidad, adendas y conformidad posterior — candidato aislado

## Actualización 15/10 — adendas de manifiestos ordinarios

**GO del corte funcional aislado: validación cerrada, sin publicar.** Candidato `85ca66a26fa6cbaef02b7cbc5f3a7cd7d869f62a`, [corrida 38714116108](https://github.com/martinsantos/peliresi/actions/runs/38714116108) SUCCESS: 15/10, 09:35:58–09:50:45 UTC (06:35–06:50 Mendoza), 14m47s. Los resultados del 14/10 más abajo corresponden al corte anterior de baja intensidad.

### Qué cambia

- Transporte y operador vinculados pueden registrar una diferencia después de la aprobación inicial del manifiesto. Retiro, recepción y tratamiento no esperan su revisión. El generador vinculado consulta las adendas sin modificar ni aprobar por ese solo vínculo.
- Cada adenda conserva número y declaración originales en una instantánea canónica del servidor. La carga observada completa aparece separada: no se suma automáticamente ni reemplaza cantidades declaradas o pesos recibidos.
- Las revisiones son independientes por adenda. Aprobar una no aprueba las demás; observar/rechazar no borra hechos ni revierte el estado operativo. La decisión, nota, autor, fecha y versión quedan en historial.
- Rectificar crea otra adenda vinculada al antecedente. No existe edición destructiva del original.
- Guardar solicita revisión pendiente. El revisor explícito de QA resuelve sin impersonación ni autoaprobación; se reutiliza la lista autorizada de baja intensidad. Esto no define por inferencia la matriz productiva de autoridad.
- UUID y huella de petición reconocen reintentos exactos. Reutilizar una referencia con otro contenido devuelve conflicto; dos revisiones concurrentes no pisan el historial.

### Recorrido ordinario comprobable

1. Generador firma un manifiesto sintético con carga declarada.
2. Transportista abre **Adendas y revisión posterior** desde su viaje, registra la carga observada y vuelve al manifiesto; confirma retiro y entrega con la adenda pendiente.
3. Operador registra otra diferencia, recibe, pesa, trata y cierra operativamente con ambas revisiones pendientes.
4. Revisor designado aprueba la primera y rechaza la conformidad de la segunda. Al recargar, ambas resoluciones y la declaración original permanecen; la operación sigue TRATADO.
5. Generador consulta las resoluciones sin botones de modificación. El certificado vigente sigue accesible, **sin incorporar automáticamente adendas ni certificar conformidad pendiente**.

La UI compartida es lazy, paginada de a 20 y sin polling nuevo. Conserva motivo y referencia de reintento ante error; invalida caché al guardar. Ayuda en encabezado, no sobre los controles, también en /app y /mobile.

### Aislamiento y límites del corte

`MANIFEST_ADDENDA_ENABLED` y `VITE_MANIFEST_ADDENDA_ENABLED` están apagados por defecto; sólo habilitados en la VM. Tabla nueva `adendas_manifiesto`, con vínculos restrictivos: las APIs de adendas no actualizan manifiestos, residuos, firmas, números ni eventos originales. Migración aditiva probada sólo en DB sintética; no aplicada a producción.

No se incorporó un nuevo certificado, anexo PDF, aviso/correo, bandeja global de revisión, conciliación automática de cantidades ni validación legal de corrientes. La compatibilidad figura como no comprobada. Falta definir la matriz productiva de revisores y el cierre documental; registrar o tratar no implica habilitación ni conformidad completa. La variante Android es un APK debug separado con backend loopback, no una actualización del APK instalado.

### Fallos encontrados y corregidos durante esta tanda

- Corrida38710703619: builds y unitarias pasaron; HTTP detectó que dos altas simultáneas idénticas podían devolver409 por una carrera del upsert de Prisma. Se recupera únicamente P2002 leyendo la fila creada y verificando manifiesto, autor, impersonador y huella; no se acepta contenido diferente ni se rebajó la expectativa201. No llegó a E2E/Android.
- Corrida38711638045: builds, unit993 backend/1442 frontend, migración, HTTP y18 E2E pasaron. Android completó tratamiento y ambas resoluciones; falló la comprobación visual porque la ayuda flotante cubría el nuevo formulario. Captura nativa FAIL-device confirma el defecto. Se incluyeron las rutas de adendas en el patrón de ayuda de encabezado, con seis casos unitarios y comprobación E2E adicional; la guarda Android se conserva. Esta corrida NO cuenta como Android aprobado.
- Corrida38714116108: SUCCESS, con las comprobaciones originales conservadas y las nuevas guardas de ayuda en encabezado.

### Resultados finales del 15/10

| Comprobación | Resultado |
|---|---|
| Builds backend, web y app | 3 PASS |
| Unit backend con DB desconectada | 993/993, cero fallos/omitidas |
| Unit frontend | 1448/1448, cero fallos/omitidas; incluye seis casos nuevos de ayuda |
| HTTP real con PostgreSQL sintético | 5 grupos de asignación/regresión, 9 de baja intensidad y 9 de adendas PASS |
| E2E escritorio1440, web móvil360 y app390 | 18/18, cero fallos, omitidos o flaky; tres recorridos extendidos con adendas |
| Android15, APK debug separado | Completo PASS, adendas de transporte/operador, continuidad hasta tratado, aprobación/rechazo independientes, PDF y logout |
| Preservación histórica y migración aditiva | PASS, histórico sintético idéntico; compatibilidad de cliente anterior |
| Aislamiento | 0 correos, 0 errores JS e intentos inseguros registrados por Android, mutaciones200/201; APK original no modificado |

Revisadas capturas de escritorio, web responsive, app web y Android nativo: declaración y carga observada diferenciadas, estado operativo TRATADO separado de conformidad rechazada, ayuda única en encabezado sin cubrir el campo de resolución. Sin overflow horizontal en el recorrido. Las capturas son de viewport: los controles inferiores y el historial se consultan desplazándose. El aviso general de novedades sigue ocupando espacio en móvil y se puede cerrar; no se atribuye a este corte una auditoría visual global.

Entorno: `http://127.0.0.1:4177` y `/app/`, backend3037 y PostgreSQL55440/base sintética en VM efímera. Browser plugin not available: se utilizó Playwright existente en nube, un worker. Secuencia reproducible en `.github/workflows/manifiesto-qa.yml`: builds y unit completas → `addenda-integration.ts`/regresión HTTP → Playwright → `manifest-apk.ts` con Android15 → comparación histórica y cierre. Ninguna llamada productiva ni interacción con el formulario humano.

Evidencia fuera de Git: `sitrep-cloud-qa-20261002/manifiestos-v2-38714116108/` (13MB). Incluye resultados unit/HTTP/E2E, `manifest-migration.json`, `manifest-history-proof.json`, `closure.json`, `apk/result.json` y `apk/identity.json`. Capturas `manifest-e2e/*/ordinary-addenda-post-facto.png` y `apk/10-ordinary-addenda-post-facto-device.png`. Artefacto remoto con retención de tres días, copia local conservada; no se descargó el APK. Backend/server propios detenidos a09:50:40UTC; cierre de emulador/VM PASS, ninguna corrida pendiente. Muestra final de Chrome en VM PSS102040KiB/RSS215560KiB; no es medición del pico ni prueba de ausencia de fugas.

APK instalado `ar.com.ultimamilla.sitrep.manifestqa`, versión interna4, debug y no distribuible. Comprueba Custom Tab loopback, no confianza TWA/TLS productiva ni actualización del APK original. No cubre teléfonos físicos, GPS/cámara/batería/celular, reinicio completo de Chrome/OS ni todos los visores PDF. Sin producción, datos reales, envíos ni instalaciones locales.

## Corte anterior — baja intensidad (14/10)

## Alcance implementado

Dentro de Manifiestos, una variante con referencia interna BI permite al operador registrar participantes declarados sin alta, una patente y la carga. Admite generador externo, transportista externo o ambos; cuando uno ya existe, se selecciona del padrón y el servidor conserva su identidad canónica. No crea cuentas, aprobaciones ni números oficiales.

La operación avanza REGISTRADO → RETIRADO → RECIBIDO → TRATADO sin esperar conformidad. Original y diferencias conservan revisiones independientes. Cada diferencia guarda la carga observada completa: no se suma automáticamente a lo declarado. Una observación o rechazo posterior no borra un retiro, recepción o tratamiento ya registrado.

El operador solicita revisión; sólo un administrador expresamente designado en la configuración de QA, distinto del autor y del administrador que lo registró por impersonación, puede resolver desde su cuenta propia. Un actor vinculado puede consultar su operación, no modificarla ni aprobarla por ese solo vínculo. Los demás actores no acceden.

Registro y eventos son idempotentes; el control de versión evita perder una modificación concurrente. Se conserva autor, fecha del servidor y administrador impersonante cuando corresponde. Listas y búsqueda están limitadas a 20 resultados por consulta; sin polling nuevo.

## Seguridad del corte

- Flags backend/frontend apagados por defecto; habilitados únicamente en la VM sintética.
- Tabla nueva, sin migrar, reinterpretar ni escribir manifiestos existentes.
- Sin número oficial, certificado nuevo, habilitación legal implícita ni falsa unanimidad.
- Sin correo, push, blockchain, datos reales, formulario humano ni emulador local.
- El APK de QA tiene identidad separada y apunta a loopback; no actualiza ni reinstala el APK del usuario.

## Criterios comprobables

1. Registrar ambas identidades externas; conservar original y referencia al recargar.
2. Seleccionar uno del padrón sin crear duplicados; identidad canónica y lectura sólo por su titular.
3. Continuar con revisión pendiente; solicitar y resolver original/diferencia de forma independiente.
4. Observar/rechazar después de tratar sin borrar hechos ni simular conformidad.
5. Reintentar una acción sin duplicarla; conflicto de dos escritores sin pérdida de historial.
6. Permisos, esquema estricto, flag apagado, numeración no asignada.
7. Histórico sintético, usuarios y notificaciones sin cambios por este circuito.
8. Web escritorio, web móvil, app web y APK Android de QA con backend real aislado.

## Recorrido reproducible en QA

1. Operador sintético → Manifiestos → Baja intensidad · revisión posterior → Registrar operación.
2. Declarar al generador externo y seleccionar al transportista del padrón sintético (o declarar ambos externos). Registrar patente, carga original y motivo.
3. Registrar retirado; cargar una diferencia como carga observada completa, sin borrar la declaración. Registrar recibido y tratado aunque la conformidad siga pendiente.
4. Solicitar revisión del original y, por separado, de la diferencia. Agregar una nota breve que explique cada pedido.
5. Entrar con el revisor designado de QA: aprobar el original y observar la diferencia. Recargar: el hecho tratado sigue registrado, la diferencia queda observada y el original conserva su propia resolución.
6. Entrar como transportista vinculado: consultar esa operación sin botones de modificación/aprobación. Otro transportista no puede abrirla.

El menú está disponible sólo en el candidato habilitado de QA. No seguir este recorrido sobre la URL productiva ni crear cuentas reales para ensayarlo. En Android se instala exclusivamente el paquete debug separado, con destino loopback.

## Resultados

**GO del corte funcional aislado, no GO de publicación ni de todo Manifiestos V2.** Corrida [38667277622](https://github.com/martinsantos/peliresi/actions/runs/38667277622) SUCCESS sobre `f2e41848db63dfc47c6e690058ffb86ccaa961ae`, desde 01:44:32 hasta 02:00:15 UTC del 15/10 (22:44–23:00 Mendoza del 14/10), duración 15m43s. Todos los pasos, incluido cierre de procesos, terminaron correctamente.

| Comprobación | Resultado |
|---|---|
| Compilaciones backend, web y app | 3 PASS |
| Unit backend, DB desconectada | 987/987, cero fallos/omitidas |
| Unit frontend, proveedores simulados | 1437/1437, cero fallos/omitidas |
| HTTP real aislado | 5 grupos de regresión + 9 de baja intensidad PASS |
| E2E escritorio, web móvil y app web | 18/18, cero fallos, omitidos o flaky |
| APK debug separado, Android 15 en nube | Circuito completo PASS; cero errores JS/solicitudes inseguras; todas las mutaciones 2xx |
| Migración aditiva y cliente anterior | PASS en base sintética; histórico preservado |
| Manifiestos sintéticos preexistentes | Idénticos al finalizar |

Android comprobó ingreso con cuatro roles, selección explícita y teclado, reapertura del proceso SITREP con sesión conservada, ciclo ordinario, descarga de PDF con bytes exactos, contenido visible en visor nativo y regreso, baja intensidad con generador externo/transportista del padrón, continuación hasta tratado, revisión independiente del original/diferencia, persistencia y logout que impide volver a una ruta protegida. La selección del padrón no abrió automáticamente el teclado. No es una prueba de reinicio completo de Chrome/Android.

Se revisaron capturas finales de escritorio, móvil, operador Android, resolución post facto Android, visor PDF y login posterior al logout. No se observaron desbordes horizontales en los recorridos; las pantallas largas requieren desplazamiento. Las capturas de revisión son de viewport y no muestran todo el historial a la vez. Queda pulido visual no bloqueante: distinguir el dato histórico «Revisión solicitada» de la resolución actual para evitar redundancia, y reducir el espacio ocupado por el aviso general al ingresar en móvil. Esto no certifica uniformidad visual global.

Evidencias conservadas fuera del repositorio en `sitrep-cloud-qa-20261002/manifiestos-v2-38667277622/`: `backend-unit.json`, `frontend-unit.json`, `manifest-e2e.json`, `exceptional-http.json`, `manifest-http.json`, `manifest-migration.json`, `manifest-history-proof.json`, `closure.json`, `apk/result.json`. Capturas: `apk/08-exceptional-operator-device.png`, `apk/09-exceptional-post-facto-device.png`, `apk/06-certificate-requested-device.png`, `apk/07-logout-denies-protected-route-device.png` y `manifest-e2e/*/exceptional-post-facto.png`. El artefacto remoto de la corrida se conserva tres días; la copia local de evidencia permanece. No se descargó el APK ni se instalaron dependencias/emuladores locales.

### Historial de fallos y correcciones

- 38660082153: builds, unit backend984/frontend1436, HTTP y 13/15 E2E pasaron; dos pruebas nuevas fallaron por selector ambiguo entre estado operativo y aviso del sistema. Se corrigió la identificación accesible; no se retiró la comprobación. Android no llegó a ejecutarse.
- 38661143207: builds, unit, migración, HTTP y E2E web/móvil/app PASS. Cancelada durante compilación APK para no duplicar esa compilación y prueba nativa: la corrida final incluye los últimos cambios. No contar Android como probado en esta corrida.
- 38661667960 y 38661879129: canceladas aún en cola, sin ejecutar suites, reemplazadas por el candidato completo.
- 38661940674, commit 8c003f3bdcfeda3ff66a228b8125df014c08e933: builds, unit987+1436, migración, HTTP y18/18 E2E PASS (cero omitidos/flaky). Android completó cuatro roles, ciclo vigente, PDF exacto y regreso nativo; falló al intentar clic de ratón sobre «Transportista · Buscar en padrón» con teclado abierto. Captura nativa conserva botón visible, campo enfocado y teclado; cero errores JS/solicitudes inseguras. No contar el circuito excepcional Android como aprobado.
- 38663769021, commit 619e510148c0a34bfd2acec9d2dea3957ced7c69: builds, unit, HTTP y18 E2E PASS; Android abortó durante transición al visor PDF por respuesta nativa «null root node», antes del recorrido excepcional. Captura muestra visor todavía cargando, no evidencia de PDF renderizado completo. Se conserva el fallo.
- 38664553960, commit e634b84ca9b7ae7521ed95ccee039c504f828af5: cancelada al iniciar para incorporar la espera nativa antes de repetir suites. Añadió corrección real de caché: la configuración compartida guarda consultas frescas60s; se invalidan las listas al escribir para no esconder una operación recién creada o mostrar una etapa/revisión anterior. Nueva unitaria con caché fresca y comprobación E2E/APK de volver al listado sin recargar y abrir la referencia recién creada.
- 38665622967, commit ba460082ae22c6d4d3778aac2a8c9a46436fe1de: compilaciones, unit, migración, HTTP y18 E2E PASS; Android falló por raíz nativa todavía inexistente al abrir Chrome, antes del login. La corrección inicial de observación transitoria estaba aplicada al visor PDF, no a todas las transiciones. No certificar Android con esta corrida.
- 38667277622, commit f2e41848db63dfc47c6e690058ffb86ccaa961ae: SUCCESS, resultados arriba. El lector nativo aplica una política uniforme: máximo 3 observaciones nuevas dentro de 20s, sólo para el diagnóstico exacto de raíz aún inexistente; cada intento queda registrado. Nunca lee XML anterior tras fallar el dump. Desconexión, timeout, XML inválido y error de registro abortan; agotar los intentos también falla. 27 pruebas puras PASS en 74ms localmente y nuevamente en la guarda de nube; sin instalar dependencias ni emulador local. Se conservaron la aserción de PDF renderizado y las pruebas táctiles.

## Límites y siguiente alcance

El corte del 14/10 implementó registro y revisión posterior de operaciones de baja intensidad. No incorporaba adendas ordinarias; la actualización del 15/10 se detalla al principio de este documento. La variante de baja intensidad exige al menos un participante sin alta.

Quedaban pendientes al cierre del 14/10: numeración oficial excepcional; matriz productiva de revisores y evidencia; conciliación de participantes que luego se inscriben y estadísticas de regularización; fuente de compatibilidad de corrientes; adendas del circuito ordinario (avance del 15/10 arriba); agenda/plazos; sustituciones durante viaje; documentación/certificados y avisos de estos eventos. La UI indica compatibilidad no comprobada; no bloquea el hecho ni certifica aptitud.

La migración ensayada es aditiva y verifica compatibilidad del cliente Prisma anterior. No equivale a un despliegue/rollback completo ni a validación del APK original firmado, teléfonos físicos, GPS, cámara o batería.
