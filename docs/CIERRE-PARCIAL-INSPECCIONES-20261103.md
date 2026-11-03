# SITREP — cierre parcial y traspaso del rediseño de inspecciones

Fecha: 3 de noviembre de 2026. Estado: **preview; trabajo parcial, no autorizado como validación integral ni publicado en producción**.

## Referencia inequívoca

- Repositorio: https://github.com/martinsantos/peliresi
- Rama de continuación: `codex/inspection-field-model-20261103`.
- Código probado: `76f2c4709e8bb3c32934385d043e76fb47e16e3f`.
- Base de esta tanda: `3245f36573a6b18a74d26887cdaa34e453d19d9e`.
- Este cierre añade documentación/evidencias sobre ese código; no modifica lógica ni construye otra versión del producto.
- Delta de producto desde la base: 57 archivos, incluidos backend, frontend compartido web/app, manual y una migración. Sus hashes están en [candidate.json](evidence/inspection-redesign-20261103/candidate.json).
- Commits de la tanda: `2a5ccef7`, `3d5d4eb2`, `bb46e960`, `79f08700`, `76f2c470`. Continuar desde la rama completa; no aplicar solamente el último parche.
- El checkout histórico `peliresi` y las ramas antiguas NO son la fuente actual. No resetear, mezclar ni instalar dependencias allí. Este cierre no certifica cuál es el release actual de producción; los cierres anteriores son antecedentes fechados.

## Qué necesita el usuario

Una inspección que permita reconocer dónde está y qué sigue, sin encabezados que consuman la pantalla, botones escondidos ni campos que haya que adivinar. Un recorrido simple en web y app, acta legible, imágenes destacadas con descripción, ubicación, contraste con lo declarado y firma del inspeccionado. Los actores no acceden al módulo interno de Inspecciones: responden por el requerimiento/enlace autorizado.

El usuario sigue disconforme con la experiencia. Las pruebas técnicas no equivalen a aceptación de diseño. No declarar “perfecto”, “100 %” ni cerrado el rediseño.

## Implementado en este corte

1. Recorrido de cuatro pasos: **Visita → Constatar → Evidencias → Finalizar**. Una tarea abierta, formularios visitados conservados, sin segunda fila redundante de pestañas.
2. Encabezado y contenido desplazables; acciones inferiores con espacio propio. Ajustes para 320 px. Historial y funciones secundarias bajo “Expediente y seguimiento”.
3. Guardar y continuar espera confirmación del servidor; ante fallo mantiene texto y etapa. Recuperación del acta/visita al cerrar y reabrir.
4. Modelo de visita con persona que atiende, actividad, ampliación, entorno, corrientes declaradas/observadas y medidas. Basado en siete PDFs (28 páginas); no se incorporaron originales reales a la aplicación.
5. Punto manual/GPS, mapa y vista cartográfica guardada con el acta. No infiere restricciones ambientales por sí mismo.
6. Fotografías ampliables, descripción recuperable y fotografía grande por página en PDF.
7. Lectura y firma manuscrita sobre snapshot, control de versión e idempotencia. No equivale a firma digital certificada ni a conformidad. La firma del inspector no sustituye a la del inspeccionado.
8. Copia mediante enlace limitado, con vencimiento y revocación; consulta, descargo/apelación y respuesta del equipo sin exponer el expediente interno.
9. Función explícita `ADMIN_INSPECCIONES`, con asignación auditada. No se cambiaron cuentas reales.
10. Pendientes administrativos agrupados con destino concreto; lectura de expediente cerrado separada del formulario editable. Etiquetas humanas en el acta.
11. Manual actualizado: `docs/manual/inspeccion-de-campo.html`, índice y tutorial. Correo de entrega renderizado como muestra; sin envío.

## Pruebas y evidencia conservada

Resultados correspondientes al código `76f2c470`; en este cierre documental no se repitieron las suites.

| Verificación | Resultado y límite |
|---|---|
| Tipos backend/frontend | Aprobados |
| Unitarias/regresiones backend | 158 pruebas únicas en 12 archivos |
| Unitarias/regresiones frontend | 86 pruebas únicas en 9 archivos |
| Compilaciones | Backend, web y app aprobadas; comprobantes finales web/app incluidos |
| Navegador app | Visita, recuperación, hechos, controles, contraste Y8/Y12, foto/descripción, firma sintética, enlace, consulta y respuesta, envío a revisión |
| Navegador web | Devolución a campo, edición, firma, cierre de campo, informe técnico, plazo y aprobación administrativa artificial |
| Segundo caso | Creación web, recuperación de Persona que atiende tras cerrar/reabrir, inicio de visita |
| Responsive | Revisión a 320/393/768/1365/1920; medición de cuatro etapas a 320/393/768 sin desborde horizontal ni superposición de acciones |
| PDF | Inspección visual de encabezado, contenido, mapa y foto grande con descripción |
| Android físico | **Pendiente**, no equiparar PWA en navegador con teléfono real |
| Personas usuarias | **Pendiente**, todavía sin participantes |

[Resultados](evidence/inspection-redesign-20261103/verification.json), [tipos/tests](evidence/inspection-redesign-20261103/checks.json), [build web/app](evidence/inspection-redesign-20261103/builds-web-app.json), [mediciones](evidence/inspection-redesign-20261103/responsive.json).

[App](evidence/inspection-redesign-20261103/app.png), [web](evidence/inspection-redesign-20261103/web.png), [expediente final](evidence/inspection-redesign-20261103/closed-case-web.png). Todas las capturas incorporadas son de datos artificiales.

El [arnés de QA](evidence/inspection-redesign-20261103/qa-harness.mjs) conserva los comandos y archivos exactos probados; depende de las rutas del laboratorio, no es un instalador portable. No ejecutar sus builds en la Mac. Las comprobaciones API anteriores (20 de circuito y 7 de permisos) están descritas en [el informe de implementación](INSPECCION-CAMPO-PREVIEW-20261103.md); no sumarlas como nuevas pruebas de navegador de este cierre.

## Pendientes prioritarios para la otra AI

| Prioridad | Trabajo | Criterio de cierre |
|---|---|---|
| P0 | Recuperación de presentaciones y respuestas del enlace al cerrar/reabrir | Persistir texto con aislamiento por identidad, enlace y expediente; recuperar tras cierre/sesión vencida; limpiar sólo tras envío confirmado; resolver conflictos y adjuntos pendientes. Hoy conservar texto ante error de envío NO cubre cierre. |
| P0 | Correos automáticos de respuesta y confirmación | Completar destinatarios inspector/inspeccionado/jefatura según permisos, plantillas, enlaces y deduplicación; probar captura/render sin SMTP ni push real. Muestra de entrega actual NO es circuito completo de correos. |
| P1 | Validación visual exhaustiva del recorrido | Estados vacíos, lentos, errores, texto largo, teclado, zoom, todos los pasos y modos; cero botones ocultos/campos tapados; coherencia de nombres y ayuda. |
| P1 | Enlaces limitados y sesión | Revalidar expiración, revocación, cambio de identidad, no exposición de expediente, doble envío y conflicto de versión. |
| P1 | Prueba móvil de campo | Android real, firma táctil, cámara, GPS, reconexión, cierre y reapertura; aún falta dispositivo. |
| P1 | Validación con inspectores e institución | Observar tareas y revisar alcance de firma, entrega, descargo/apelación, jefatura y exigencias administrativas. No eliminar requisitos de negocio para simplificar la pantalla. |
| P2 | Extensión al resto del producto | Mantener el plan integral por roles; esta tanda no certifica altas, ATM, multirol, manifiestos, GPS de transporte ni certificados completos. No trasladarles la cobertura de inspecciones. |

## Cómo retomar sin perder el trabajo

1. Obtener la rama indicada y comprobar el SHA de código. Leer este cierre y `docs/INSPECCION-CAMPO-PREVIEW-20261103.md` antes de editar.
2. Comparar lo que ve el usuario con las capturas y comprobar la disponibilidad del preview. Registrar defectos concretos con ruta, rol, ancho, pasos y resultado esperado.
3. Atacar primero los dos P0, luego recorrer de punta a punta con datos artificiales en web y app. Actualizar manual, pruebas y este registro sin atribuir resultados no ejecutados.
4. Reutilizar el laboratorio y dependencias. QA pesada remota: un worker, 1 CPU, 2 GiB, sin swap; serializar las suites/builds. No Docker ni emulador local ni workflows.
5. Publicación de producto separada, sólo con autorización sobre un SHA identificado, backup, migración revisada, reversión y smoke no mutante. El push de este cierre NO autoriza despliegue.

## Entorno existente y recuperación de acceso

- Artefactos locales: `/Users/santosma/.codex/visualizations/2026/10/17/01a14c11-b01f-7b40-87c5-1672e1d92833/inspection-model-20261103`.
- Git preservado: directorio hermano `recuperacion-integral-20261102/repositorio-restaurado.git` (bare).
- SSH del laboratorio: alias `ultimamilla`; directorio `/opt/sitrep-qa-isolated-16218-20261101/inspection-model-20261103`; contenedor `sitrep-training-20261103`; raíz interna `/qa/inspection-model-20261103`.
- El servidor aloja también producción: limitar toda operación a estas rutas de QA. No usar rutas históricas `/var/www` ni administrar otros proyectos.
- API aislada 3048; PostgreSQL efímero 55441, base `sitrep_ephemeral_qa_1a93`, esquema `inspection_field_20261103`. La capacitación anterior en 3038 es otro servicio y se preserva.
- Preview local: `http://127.0.0.1:4188/app/`; web en `/`; manual `/manual/inspeccion-de-campo.html`. Sólo accesible desde esta Mac, NO desde teléfonos externos.
- Túnel local 4188 → SSH `ultimamilla` → loopback remoto 17488 → socket `preview.sock`. El relay valida origen, caducidad y hash del candidato. El 3/11 se restableció el túnel y se verificó recarga real de la app con la inspección.
- Si falla el acceso: comprobar el túnel, bridge, socket, API y expiración por separado. El sandbox de herramientas puede producir falsos fallos al consultar loopback; confirmar desde navegador o red autorizada. No abrir un puerto público ni desactivar validaciones como solución implícita.
- `lab.mjs`, `start-relay.mjs`, `host-bridge.mjs` y `lab-secrets.json` existen en el laboratorio y/o artefactos locales. Los secretos no se incluyen en Git; no imprimirlos. No volver a ejecutar inicialización/seeds sobre la base existente para resolver acceso.
- Casos sintéticos: `qa-field-case` (circuito completo) y `cmw1372qv000kl0b983xbgc40` (nueva visita, en campo). No son registros reales.
- Esta variante tiene dos cuentas artificiales. No asumir que contiene las 31 cuentas de la capacitación anterior. Obtener credenciales desde el custodio del entorno, no de archivos públicos del repo.

## Guardas y migración

CAP directo cerrado; `DISABLE_EMAILS=true`, `PUSH_MANIFEST_NOTICES_ENABLED=false`, `EMAIL_EXTERNAL_ALERTS_ENABLED=false`, `SITREP_PAUSE_BACKGROUND_JOBS=true`; `TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z`. Preview sintético habilitado sólo en laboratorio. No activar estos flags de prueba en producción.

Existe migración `backend/prisma/migrations/20261103160000_inspection_management_role/migration.sql`: revisar junto al schema antes de una publicación. No inferir que sea una tanda sólo visual ni ejecutarla en producción por este cierre.

En esta entrega no se cambian producción, main, datos reales ni flags remotos, no se envían correos/push y no se ejecutan workflows. El push sólo preserva la rama. Las automatizaciones existentes se revisaron: push de deploy sólo main/master; mail QA sólo su rama específica; las demás son manuales. El commit documental lleva `[skip ci]` como resguardo adicional.
