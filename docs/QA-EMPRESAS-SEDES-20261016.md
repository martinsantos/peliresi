# Empresas, establecimientos y personas — candidato no publicado

16/10/2026. Alcance: empresa titular por CUIT, domicilios legal/productivos separados, varias personas autorizadas por responsable validado por DGFA y preparación segura del padrón.

## Ampliación: paginación y conciliación — candidato no publicado

Runtime candidato `de059094c6a020ab8af9f5a6b9f26e2ad47ee2b2`, mismo contenedor de preview, sin Actions ni instalaciones nuevas. API con25 empresas por defecto/máximo100, búsqueda por razón social/nombre/CUIT, total filtrado de servidor y orden razón social+ID. Se elimina el corte silencioso de200 empresas/autorizaciones. Selección y borrador no se pierden al paginar/buscar, fallar la red o renombrar la primera empresa. El detalle carga sus permisos propios aunque esté fuera de la página visible.

| Comprobación | Evidencia actual |
| --- | --- |
| Guardas/afectados | 29 guardas y ambas tandas unitarias afectadas aprobadas |
| Builds | Backend aprobado en99bf90a (backend idéntico a de05909); web/app de05909 aprobados |
| HTTP/PDF/migración | Siete guiones+PDF+compatibilidad aditiva aprobados;215 empresas y211 permisos, páginas completas sin duplicados, búsquedas y aislamiento |
| E2E | 39/39:13 por escritorio1440×900, móvil360×800 y app web390×844; cero omitidas/inesperadas/flaky/retries,9m42s |
| UI | Nueve adjuntos de URL/título/consola/errores analizados: consola vacía; raíz con contenido y sin overlay. Tres capturas de paginación revisadas |
| Unit backend | 1.037/1.037,99 archivos, cero fallos/omitidas |
| Unit frontend | 1.486/1.486,207 archivos, cero fallos/omitidas/errores de colección; una invocación completa verde,8m09s |
| Histórico/cierre de servicios | Histórico sintético íntegro; backend/frontend/PG9 detenidos antes de unitarias,21:24:17UTC |

Conciliación privada del archivo de generadores contra snapshot READ ONLY16/10/2026 18:08:59UTC:1.627 fuentes=1.278 coincidencias de ficha+277 certificados distintos de entidad conocida+1 nueva candidata+71 pendientes(66 CUIT,2 certificados,3 conciliaciones). Cero propuestas nuevas al repetir las mismas fuentes. Se conservan2.016 diferencias y164 entidades con revisiones (incluyen127 conflictos legales). Los1.556 registros de sede/certificado no se convierten automáticamente en plantas. Fichas inactivas no se habilitan. Plan sin SQL/apply, cuentas ni sobrescrituras; los datos reales nunca se subieron a preview/GitHub. Los12 pendientes de operadores/transportistas del plan anterior se conservan aparte, sin aplicarlos.

Hashes de los originales inalterados: staging `520eb9f2fae13f43ff24b23047f24f4e682bf3ea3bb79a920ea747c1a2a2e0da`; snapshot `999109bd00439b40e2bed09443487dac4221d7741deca5a3d77058ca7005771e`. El plan privado registra también SHA256 del módulo compilado/testeado. No certifica vigencia posterior del padrón: antes de aplicar requiere revisión de dudas, snapshot vigente y autorización.

Incidencias conservadas: primer build detuvo frontend por uso de `exact` no admitido en tipos de Testing Library; se corrigieron sólo las pruebas y se recompilaron web/app. HTTP8 reprodujo `Ú/ú` distintas por locale C del clúster; SQL confirmó `lower('Última')='Última'`. Se detuvo ese clúster sin borrarlo y se creó9 con C.utf8, Unicode existente, manteniendo la misma aserción y producto sin cambios. Antes de una migración futura comprobar también collation Unicode del destino. Los avisos act()/jsdom de fixtures unitarios antiguos se conservan; no equivalen a consola de navegador limpia ni se ocultaron para conseguir verde.

Evidencias nuevas fuera del repo: `ROOT/empresas-preview-20261016/pagination/`, JSON y desktop.png/mobile.png/app.png; failure8 conserva los reportes iniciales fallidos. El cierre unit terminó21:33:28UTC. Cuota agregada1CPU/2GiB/swap0, red interna sin salida ni puertos públicos; pico1.418GiB y cero OOM/eventos de límite. Contenedor confirmado `exited`, `Running=false`, `Restart=no`, `OOMKilled=false`, sin puertos; sin procesos de tests restantes ni consumo propio de RAM/CPU. Se retienen dependencias para reutilizarlas, no se reinstalan ni borran otros proyectos. Sin correos reales, datos productivos, formulario humano ni servicios ajenos. APK/Android no incluido: este preview no tiene KVM; las tres superficies son navegador y app web, no un APK certificado.

## Cierre previo en preview — histórico anterior a la paginación

Candidato `cb51e62da4907c554e7e963fb6569014e36cf5ff`, rama `codex/sitrep-manifiestos-v2-20261014`. El producto incluye la corrección de etiqueta de NativeSelect en d9f1ca7; commits posteriores de este corte modifican sólo QA. El cierre documental no cambia el runtime probado.

Entorno: contenedor propio en preview76.13.234.213, Node22.22.0/PostgreSQL15, base sintética `127.0.0.1:55440/sitrep_night_qa_20260926`, backend3037/frontend4177 sólo loopback del contenedor. No puertos públicos, secretos productivos ni datos del padrón. `Browser plugin not available`: Playwright existente remoto, un worker, sin navegador/emulador/pruebas pesadas locales.

| Capa | Resultado comprobado |
| --- | --- |
| Compilación | Backend, web y `/app` aprobados |
| Unit backend | 1.027/1.027, cero fallos/omitidas |
| Unit frontend | 1.475 aprobadas en suite completa + 7 recuperadas del manual = 1.482 verificadas, 205 archivos, cero aserciones fallidas/omitidas |
| HTTP/PDF | Siete guiones completos y texto real del PDF aprobados |
| Migración sintética | Aditiva, cliente anterior compatible e histórico conservado |
| E2E | 36/36: 12 escritorio1440×900, 12 móvil360×800, 12 `/app`390×844; cero omitidas, inesperadas o flaky; sin retries; 10m14s |
| UI | Seis pruebas empresariales con URL/título/contenido significativo y consola vacía; sin overlays/pageerror; capturas desktop/móvil/app revisadas |
| Android APK/físicos | No ejecutado en este corte: preview sin KVM; no instalar emulador local |

La primera suite completa frontend terminó con error de colección en dos archivos: la copia inicial omitía `docs/manual`. Sus 1.475 aserciones ejecutadas pasaron. Se copiaron los archivos versionados sin modificarlos, se corrigió su dueño dentro de la carpeta privada y se ejecutaron sólo las siete pruebas faltantes; todas pasaron. Se conservan el reporte completo original con `success:false`, el fallo inicial de permisos del recurso y el reporte de recuperación con `success:true`. No presentar esto como una única invocación completa verde ni repetir las 1.475 sin motivo. `consolidated.json` valida ambos conjuntos y sus 205 archivos sin eliminar casos.

Reproducción/fix visible: el select de empresa/sede incluía las opciones dentro del texto de su label y el E2E de nombre exacto no podía identificarlo. Se separó label/select mediante useId/htmlFor en componente nativo compartido, con dos unitarias; se mantuvieron las expectativas E2E y el control nativo sin búsqueda/autofoco. También se corrigieron únicamente guardas de QA para resolver el generador Prisma localmente, iniciar sobre puertos libres y esperar los PIDs propios mediante `/proc` (sin depender de `ps` instalado).

Proveedores del navegador: fuentes Google CSS/WOFF originales cacheadas (27 archivos/490.401bytes, SHA256 y MIME verificados). Sólo las teselas OSM usan SVG con leyenda «QA - MAPA SIMULADO», declarado en cada caso. Ninguna API de negocio o autenticación está interceptada. No se certifica red cartográfica real. Los fallos DNS de fuentes, la transición temporal de raíz vacía y los fallos anteriores se preservan; no se suprimieron errores de consola para conseguir verde.

Recursos: límite Docker total 1CPU/2GiB/swap0 para todos los procesos, una prueba a la vez. Última corrida pico1.621GiB, cero OOM; los builds anteriores también se mantuvieron bajo la misma cuota (reclamación de caché sin OOM). Cierre posterior a E2E verificó el histórico y detuvo backend/frontend/PG. Contenedor `sitrep-qa-enterprise-20261016` confirmado `exited`, `Running=false`, `Restart=no`, `OOMKilled=false` el16/10 después de20:39UTC. Queda detenido para reutilizar dependencias, sin consumo de RAM/CPU de sus procesos y sin reinstalaciones nuevas en Mac. No se detuvieron/alteraron otros proyectos.

Evidencias fuera del repo: `ROOT/empresas-preview-20261016/current/` contiene reportes JSON, tres capturas de contexto y archivo `qa-evidence-20261016.tgz`; `ROOT` es la carpeta de evidencia del hilo. Incluye intentos fallidos, recuperación y resumen comprobado. Sin APK ni dependencias en la descarga. Las suites completas no se disparan por push: workflow manual; no se consumieron nuevos minutos de Actions.

Plan privado ya generado: 1.627 fuentes, 1.279 empresas, 1.556 establecimientos propuestos, 71 filas pendientes y 127 conflictos de domicilio legal. Repetir idéntico agrega cero propuestas. Sin SQL/apply, cuentas automáticas ni sobrescrituras. Los datos reales no se suben a este preview ni a GitHub.

Este cierre aprueba sólo el circuito candidato probado. Antes de migración masiva falta resolver casos de padrón y paginación/búsqueda de la lista de empresas (límite actual200). La delegación por sede está cerrada sólo para GENERADOR; transporte/operador requieren alcance completo. Inspecciones delegadas, APK original, firma/actualización, TWA/TLS final y teléfonos/GPS/cámara/batería no se certifican aquí. No GO global, no100% de cobertura ni perfección; flags productivos siguen apagados.

## Contrato implementado

- Ocho tablas nuevas, sin reescribir IDs de cuentas, fichas operativas, inscripciones ni manifiestos anteriores. Migración aditiva versionada; rollback de aplicación sin borrar columnas ni datos.
- Empresa con actividades GENERADOR, TRANSPORTISTA y OPERADOR ya aprobadas, CUIT formalmente válido y coincidente. Vinculación y validación del responsable exclusivas de DGFA.
- Responsable validado: mantiene domicilio legal/establecimientos, autoriza/revoca personas verificadas, prepara invitaciones de un uso y 24 horas. Sin correo desde estos endpoints.
- Cada persona conserva ID/cuenta y rol base. Contexto empresa/actividad/sede por pestaña; servidor verifica autorización en cada petición. Revocar no borra ni desactiva la cuenta personal.
- Delegación por establecimiento de GENERADOR: sólo registros con origen/sede identificados. No se infieren sedes de históricos. TRANSPORTISTA y OPERADOR requieren alcance completo de empresa en este corte.
- Manifiesto nuevo en contexto empresarial conserva empresa, autorización/revisión, establecimiento y domicilio legal al declarar. Creador sigue siendo la persona. PDF distingue domicilio productivo/legal. Editar empresa no cambia la fotografía anterior.
- Ediciones con revisión y motivo; transacciones serializables y conflicto 409 antes de pisar versiones. Historial antes/después en base, últimos 50 eventos en interfaz.
- Invitación con token aleatorio 256 bits, sólo hash en base. Aceptación con contraseña y correo verificado, sin reemplazar sesión abierta. No activa suspendidos ni cuentas con CUIT/ficha/solicitud propia pendiente; puede activar cuenta personal nueva sin esos vínculos, mediante invitación válida.
- Flags ENTERPRISE_ENABLED/VITE_ENTERPRISE_ENABLED OFF por defecto, ON sólo en VM sintética.

## Preparación del padrón

Planificador puro sin cliente de base ni modo apply. Origen SHA256/hoja/fila y hash canónico de contenido. Repetir exactamente no duplica propuestas; misma identidad con contenido distinto falla. Conserva observaciones/celdas/estilos y separa inferencias del estado legal, nulo.

Agrupa por CUIT confirmado y conserva certificados/establecimientos candidatos sin elegir la primera ficha. CUIT dudoso, certificado duplicado o conciliación ambigua quedan pendientes con su origen. Domicilios legales divergentes se conservan como candidatos. Nunca crea cuentas desde contactos de Excel.

Datos reales en padrones-20261016/private, fuera del repositorio y de Actions. Snapshot productivo 16/10 sólo lectura, nunca usado para pruebas. Operadores/transportistas conservan planes privados anteriores; ninguno se aplica aquí.

## Historial anterior — superado por el cierre de preview

Primer intento38950498951/019593b detuvo compilación por dos estrechamientos de tipo y una variable de actividad. Corregidos en eb5496f. No se cuentan suites pasadas. Cleanup SUCCESS.

38950668018/eb5496f pasó compilación3, suites unitarias y migración; reprodujo fallo500 de aceptación de invitación: la autorización copiaba campos de invitación. c6af25b limita la proyección a tres campos de alcance, con prueba de regresión. 38951658104/c6af25b llegó a la comprobación final de históricos; comparaba eventos SQL sin orden explícito. bae3ebb conserva la comparación completa y ordena por ID antes/después. Cleanup SUCCESS en ambos.

38952820023 y38953885985 canceladas con cleanupSUCCESS para incorporar sede productiva correcta en formulario/mapa/detalle, recorrido de delegado y límite por enlace+IP. No se cuentan como validación completa. Sin corridas solapadas.

38954126969/ecf1c2d: builds3, backend1027/1027 y frontend1480/1480 sin fallos/omitidas, migración/cliente anterior/histórico y cleanupSUCCESS. HTTP429 correcto pero respuesta era texto plano; el guion esperaba JSON. d995a74 agrega respuestaJSON española y mantiene5intentos. Evidencia anterior descargada en empresas-qa-38954126969 (sinAPK). No se cuentan E2E/APK como ejecutados.

38955267515/d995a74 CANCELLED confirmado, sin runner asignado ni pruebas ejecutadas: el usuario informó agotamiento de crédito de GitHub Actions. No relanzar. Pendiente comprobar compilación3, suites completas, HTTP/PDF, E2E36 y APK Android15; luego capturas/histórico/cleanup. No afirmar GO por resultados del candidato anterior.

Control de consumo: manifiesto-qa.yml queda sólo con workflow_dispatch, sin disparador push. Se conservan íntegros los casos, guardas y asercciones: no confundir seleccionar pruebas afectadas durante una corrección con aprobar el cierre completo. La regresión completa se ejecutará una vez estabilizado el candidato, no por cada cambio menor.

Alternativa simple por comprobar: servidor de preview 76.13.234.213 documentado en INFRAESTRUCTURA.md. También aloja otros servicios; sus cifras antiguas no acreditan capacidad actual ni KVM. La consulta SSH de sólo lectura fue bloqueada por la protección local; no se reintentó para eludirla ni se instaló/ejecutó nada allí. Hace falta habilitar esa comprobación antes de decidir su uso. No se ha trasladado la QA a otra plataforma.

Recorrido delegado agregado: sólo Planta Norte, sin pestañas de personas/historial ni enlace a ficha corporativa completa; usa empresa/sede, crea manifiesto con dirección productiva y legal correctas y autoría personal. Ubicación desconocida no hereda coordenadas de la ficha antigua. Repetido en web/móvil/app/APK. Responsable prueba actualizar domicilios, revocar/reautorizar a una sede, aceptar invitación de otra persona conservando su sesión, auditar y volver a contexto personal.

Límite de aceptación: cinco intentos por IP+capacidad durante15min, clave sin token crudo. Prueba cinco rechazos+429 y aceptación de otro enlace con la misma IP, sin bloquear a todo un Wi-Fi. No se envía correo: la verificación usa una prueba sintética conocida y el endpoint real.

## Límites

Sin publicar, migrar producción, correos/push, datos reales ni formulario humano. Sin instalaciones/servicios/pruebas pesadas locales. APK QA debug separado: no acredita firma/actualización del instalado, TWA/TLS final ni cámara/GPS/batería físicos.

Browser plugin no disponible: Playwright existente en el contenedor aislado de preview (antes, Actions). No certifica GO global de pendientes V2 ni revisión legal de inferencias. Antes de activar: autorización y conciliación contra snapshot actualizado.
