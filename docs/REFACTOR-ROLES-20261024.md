# Espacios de trabajo por rol — 24/10/2026

## Alcance y estado

Implementación y validación en preview aislado sobre la rama `codex/sitrep-training-20261018`. No se publicó esta tanda. No se modificaron producción, main ni workflows. Android físico sigue pendiente.

La corrección trata permisos, destinos, orientación y duplicación de tareas como un único problema. No equivale a una certificación de toda la aplicación ni a una nueva prueba de carga.

## Reglas del producto

| Contexto | Acceso y tarea |
| --- | --- |
| Generador | Proponer/aprobar y seguir sus manifiestos; consultar documentos y avisos. |
| Transportista | Proponer/aprobar, coordinar viajes, GPS, incidentes y relevos. |
| Operador | Proponer/aprobar, recibir, tratar, registrar hallazgos y emitir certificados. |
| Los tres actores | Sin directorio ni módulo de Inspecciones. Desde un aviso pueden abrir el requerimiento propio publicado, responder y consultar su decisión. |
| Administradores | Inspecciones y administración correspondiente al sector. Usuarios y vista temporal reservados a ADMIN. |
| Inspector designado | Inspecciones y consulta de actores, sin conceder ABM administrativo por su designación. |
| Vista temporal | Conserva los permisos del actor representado. No administra empresas ni representantes. |

Un requerimiento ajeno sigue denegado por el servidor aunque se escriba su URL. El acceso limitado no incluye informes internos, actas de trabajo ni el listado de inspecciones. Se mantiene el registro de apertura del requerimiento propio.

## Cambios

- Ayuda queda en el encabezado de Inicio, sin cubrir las primeras tareas ni los iconos de aprobación.
- Un catálogo común define destinos, títulos, iconos y permisos de los menús web y app. La selección activa usa el destino más específico y los detalles conservan su sección.
- Inicio comparte implementación adaptable: trabajo pendiente, acciones del rol y resumen. Se elimina la repetición como Actividad reciente. El historial completo continúa en Manifiestos.
- La lista de pendientes conserva estados, tres iconos de aprobación, datos de las partes y filtros. Búsqueda y fecha se despliegan desde Filtrar. No se muestran filtros ni paginación vacía sin necesidad.
- Transporte conserva el acceso a GPS de varias cargas y la recuperación informada del último viaje guardado cuando falta conexión.
- El perfil sólo ofrece Empresas y establecimientos cuando la cuenta puede utilizarlos. Una consulta fallida se distingue de una lista vacía. La vista temporal informa cómo acceder desde la cuenta responsable.
- Requerimientos usa una ruta propia `/requerimientos/:id`, regreso a Avisos y una acción por pedido pendiente. Historial y documentación queda plegado mientras hay un pedido por responder. Las respuestas conservan su relación con el pedido y no aprueban automáticamente el expediente.
- Los enlaces anteriores `/mis-inspecciones/:id` redirigen al requerimiento concreto; el directorio anterior deja de estar disponible. Nuevos avisos y plantillas PSIP usan el destino limitado.
- Una cuenta sin acceso recibe orientación para volver a Avisos; los errores de red permiten reintentar sin abandonar la pantalla.
- Se unifican los nombres de cuenta y se incorporan perfil, configuración y salida en el menú del encabezado. Los menús de navegación se cierran al cambiar de sección.
- El aviso en vivo ya no trata como nuevo un aviso antiguo que entra en la primera página de pendientes al leer otro. Se conservan los avisos en la campana y los eventos simultáneos con igual fecha del servidor.
- Manual actualizado: espacio por rol, pendientes, vista temporal, empresas y respuesta limitada a requerimientos. Se quitaron capturas históricas que describían un directorio de inspecciones disponible para actores.

## Validación automatizada

- 330 pruebas frontend: navegación de los roles, títulos, permisos, cambio de contexto, lista única, filtros, empresas, avisos, ayuda, menú de cuenta y respuesta a requerimientos.
- 212 pruebas backend: acceso al intercambio, requerimientos/respuestas/decisiones y resolución de avisos/plantillas.
- 20 comprobaciones HTTP sobre el backend del preview: los tres actores reciben 403 en listado, participación general, expediente completo y requerimiento ajeno; 200 en el intercambio propio. ADMIN, tres administradores sectoriales e inspector conservan el listado.
- TypeScript frontend y compilación de backend, web y app correctos. Manual incorporado al build web.
- `git diff --check` sin errores.

## Recorridos comprobados en navegador

| Recorrido | Resultado |
| --- | --- |
| Inicio web de operador, vacío y con pendientes | Acciones del rol, una lista y estados identificables. |
| Cuenta multirol: operador → generador en web, generador → transporte en app | Menú y función cambian; no aparecen accesos administrativos heredados. |
| Actor entra directamente a Inspecciones | Vuelve al Inicio autorizado; el servidor deniega el módulo. |
| Generador en vista temporal, perfil y empresas | Sin enlace vacío; acceso directo explica el contexto y permite volver al perfil. |
| Generador: campana → requerimiento → respuesta desde web | Presentación registrada, una acción principal y siguiente responsable: Autoridad. |
| Misma respuesta del generador en app | Mismo caso y contenido persistido. |
| Operador: aviso → subsanación desde app | Presentación registrada sin correo; mismo contenido visible en web. |
| Administrador: avisos de respuesta y subsanación | Ambos llegan a la campana y abren el expediente en Comunicaciones. |
| Transportista: aviso → requerimiento propio en app | Un botón Responder, sin enlaces al módulo de Inspecciones. |
| Web 1365 px y app 319 px | Sin desbordamiento horizontal en los recorridos medidos. Manifiestos e Inspecciones comparten separación superior de 16 px en web. |

Se usaron exclusivamente cuentas `@night-qa.invalid`, tres casos `qa-role-navigation-*-20261024` y dos respuestas sintéticas. Ningún manifiesto fue creado o cambiado en esta tanda. Los avisos internos de prueba no salieron del preview.

## Controles del entorno

QA remota limitada a 1 CPU, 2 GiB, sin swap y un worker. Los archivos del preview se verificaron contra el baseline `75168a08` y el delta local por SHA-256.

La auditoría verifica los dos procesos del preview: CAP vencido/cerrado, `DISABLE_EMAILS=true`, push desactivado y credenciales SMTP/VAPID vacías. El total permanece en 515 manifiestos sintéticos; cero correos enviados y cero intentos de entrega. No hay contacto con producción para esta revisión.

## Límites y continuidad

- La app probada es el build `/app/` en navegador, con viewport móvil. No se atribuye esta evidencia a Android físico, GPS en campo o ejecución en segundo plano.
- Esta tanda verifica los límites de rol y los recorridos indicados. No vuelve a certificar cada ABM, PDF, estado de manifiesto o pantalla administrativa histórica.
- La misma matriz de permisos, vocabulario y jerarquía debe usarse en las siguientes revisiones de formularios, documentos y operación en campo. No debe reaparecer un segundo listado de tareas en Inicio ni un acceso sin destino autorizado.
- Publicación pendiente: necesita una instrucción de despliegue sobre el commit de cierre; no se ejecutó en esta tarea.

Evidencias locales: `roles-navigation-20261024`, con logs, resultados JSON, auditoría, hashes del delta y capturas. El registro detallado distingue las comprobaciones automatizadas de los recorridos manuales.
