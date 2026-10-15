# Baja intensidad, actividades múltiples y contrapartes — candidato 15/10

Estado: implementación en rama de QA, **sin publicación**. Los resultados se completan al cerrar la corrida exacta; no heredar el GO del candidato anterior.

## Cambios

- Baja intensidad admite razón social, identificación, domicilio y patente vacíos. Nombre de fantasía y teléfono opcionales; advertencia breve. No inventa una identidad, cuenta, permiso o número oficial. Mantiene autenticación, pertenencia, límites de tamaño y consistencia del residuo/cantidad.
- Una cuenta verificada puede solicitar varias actividades, incluso mientras espera la primera aprobación. Cada solicitud conserva borrador, documentos, revisión y estado propios. Una cuenta suspendida no participa; el token inicial anterior a verificar correo conserva su restricción al borrador original.
- Aprobar otra actividad no reemplaza el rol vigente. Se reutilizan las asociaciones y solicitudes aprobadas existentes, sin migración destructiva ni duplicación de usuario/CUIT. La mera presencia de una ficha no otorga otra actividad.
- El selector «Mis actividades» pide validación al servidor en cada solicitud. Contexto por pestaña, no cambio global de Usuario.rol, impersonación ni ampliación del JWT. Perfil, permisos, actor y caché offline siguen la actividad elegida. Elegir otra actividad descarta únicamente las consultas en memoria mediante navegación; los borradores guardados conservan su propietario.
- «Mi solicitud» permite seleccionar cada actividad y no mezcla mensajes todavía sin enviar.
- Contrapartes vinculadas pueden resolver adendas ordinarias y registros excepcionales; no autores, actores ajenos ni sesiones impersonadas. Se mantiene el camino de autoridad designada para operaciones sin contraparte inscripta. No confundir esta resolución con unanimidad del manifiesto original.
- Aprobar una corriente nueva crea un aviso interno para autoridad designada en la misma transacción. Un reintento no duplica el aviso. No envía correo/push ni modifica habilitaciones. Falta de autoridad configurada impide confirmar esa resolución, no registrar ni continuar los hechos operativos.
- Declaración original, historial de decisiones y anexos anteriores permanecen inmutables. Una rectificación agrega otra adenda; no reescribe ni borra la anterior.

## Guardas y superficies

Flags de candidato: MANIFEST_EXCEPTIONAL_ENABLED, MANIFEST_ADDENDA_ENABLED, MANIFEST_PARTY_REVIEW_ENABLED, ACTOR_MULTIROLE_ENABLED y equivalentes VITE. Por defecto apagados; habilitados sólo en el workflow aislado.

VM GitHub Actions, rama codex/sitrep-manifiestos-v2-20261014, PostgreSQL sintético en 127.0.0.1:55440/sitrep_night_qa_20260926. Backend y web sólo loopback. DISABLE_EMAILS=true, proveedores externos vacíos, blockchain/push desactivados. Un worker; ninguna instalación local.

Pruebas: unit backend y frontend; HTTP real de permisos, aprobación, rechazo, suspensión, concurrencia y replay; Playwright escritorio/móvil/web-app; APK QA separado en Android 15. APK no distribuible, sin firma de producción ni reinstalación del APK humano.

## Registro de ejecuciones

- 38731577386, SHA4779a09: builds3 PASS; backend1016/1016 y frontend1457/1457 PASS, sin omitidos. HTTP de asignación/baja intensidad/adendas PASS; nueva fixture multirol FAIL por correo faltante en generador sintético. Corregido en97802dd. No E2E/APK de ese intento. Histórico sintético conservado; procesos cerrados12:09:09.780UTC.
- 38732580670, SHA97802dd: en ejecución al redactar este bloque. No atribuir resultados finales todavía.

## No incluido ni certificado

Numeración oficial excepcional, unanimidad/agenda/caducidad del manifiesto original, compatibilidad regulatoria de Y, agregación/búsqueda transversal de antecedentes, cierre documental oficial y certificados finales continúan en el backlog. La revisión conserva sus antecedentes dentro de cada registro; no existe aún una búsqueda global que los relacione automáticamente.

Pendientes externos: matriz productiva de autoridad designada, identidad/aprobación del generador no inscripto para numeración oficial, destino documental de adendas rechazadas, firma original del APK y teléfonos físicos. No usar la prueba cloud como certificación de firma, confianza TWA/TLS, GPS, cámara o batería reales.
