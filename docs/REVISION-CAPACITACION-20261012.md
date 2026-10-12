# Revisión previa a capacitación — 12/10/2026 UTC

## Hallazgo real en Gmail

Se abrió el ejemplo de inspección enviado en la tanda autorizada del 11/10.
Gmail lo identifica como Spam. En el DOM del mensaje, los dos elementos `img`
del encabezado carecen de `src` y tienen `naturalWidth=0`. Las miniaturas de
los adjuntos sí cargan: Mendoza 178×57 y SITREP 192×192. El MIME recibido tiene
las referencias CID y ambas partes PNG inline dentro de multipart/related.

Por tanto, el fallo reportado se reproduce. Tener las imágenes embebidas en MIME
no demuestra que se vean en el cliente. La prueba anterior de 58 variantes en
Chromium no era una prueba de renderizado en Gmail. No se cambió la clasificación
Spam, configuración de imágenes ni filtros de la cuenta; tampoco se reenvió el lote.

Google documenta que puede ocultar imágenes de mensajes sospechosos:
https://support.google.com/mail/answer/145919
Es consistente con lo observado, pero no demuestra que Spam sea la única causa
del tratamiento de estos CID. Sigue pendiente demostrar el renderizado en un
mensaje entregado normalmente a la bandeja de entrada.

## Entrega: problemas independientes del diseño

- Mensaje recibido: SPF y DMARC pasan; no hay firma DKIM.
- El salto de aplicación a Postfix fue ESMTPS. El salto de Postfix a Gmail fue
  ESMTP sin TLS, confirmado por encabezados y el aviso del propio Gmail.
- Postfix: `smtp_use_tls=no`, `smtp_tls_security_level` vacío,
  `smtpd_milters` y `non_smtpd_milters` vacíos.
- OpenDKIM está activo y escucha en loopback 8891, pero no conectado a Postfix.
- `opendkim-testkey` con la clave configurada para ultimamilla.com.ar devuelve
  **keys do not match** y advertencia de permisos. No se copió ni mostró la clave.
  No conectar ese firmador sin resolver antes la discrepancia con DNS.
- El test sin `-k` falla por una ruta de clave por defecto ausente; la comprobación
  específica anterior es la relevante para el dominio.

No se modificaron SMTP, DNS, claves ni otros sitios del servidor compartido.
Se pidió autorización específica para TLS/firma; cambios de DNS y otro envío
necesitan acordar su alcance. No se promete Inbox por modificar una plantilla.
Guía de remitentes: https://support.google.com/mail/answer/81126

## Corrección acotada del candidato

Versión de plantilla 20261012.3, commits 37065fc y 74ebfa6:

- Gobierno de Mendoza figura como texto real en el encabezado además del PNG;
  SITREP ya conserva su nombre en texto. La identidad no depende de imágenes.
- Se corrige la separación de párrafos en la versión de texto, cuyo pie unía
  «Fiscalización AmbientalEste aviso».
- Dos nuevos unit tests y un escenario de imágenes bloqueadas para las 58
  variantes en escritorio, responsive y `/app`. Es tolerancia a imágenes
  bloqueadas, no una corrección certificada del cliente Gmail.

La reproducción mínima antes de modificar dio false en ambos controles y true
después. No se instalaron dependencias localmente: Vitest no estaba disponible
en el enlace de dependencias, por lo que las suites se ejecutan en nube.
Primera corrida 38195712317: 918 unit aprobados y 1 fallido por el origen HTTP
de QA en la nueva expectativa. Se aisló FRONTEND_URL en ese test, sin modificar
el comportamiento de producto para satisfacerlo. Esa corrida no es aprobada.
Corrida correctiva 38195985444 en commit 74ebfa6: **APROBADA**. JSON descargados
y leídos: 919 unit backend, 8 unit frontend afectados, 17 grupos de integración
con 52 mensajes SMTP internos, 8 grupos HTTP y 21 E2E. Cero fallos, omitidos o
flaky. Builds y chequeo de tipos aprobados. Las 58 variantes se probaron con
imágenes y con `src` retirado, en escritorio, responsive y `/app`. Capturas de
inspección móvil con imágenes y escritorio sin imágenes revisadas visualmente.
Los enlaces y el texto permanecen utilizables; los recuadros de imagen bloqueada
no equivalen a una marca visible ni se dan como solución final para Gmail.

Evidencia: `ROOT/sitrep-correos-rotonda/review-20261012-backend/` y
`SDTERA/peliresi/tmp/sitrep-go-evidence-20261003/mail-evidence-38195985444/`.
La revisión pública está en `ROOT/sitrep-correos-rotonda/review-20261012-production/`.
ROOT es el directorio de visualizaciones del hilo del 24/09/2026; SDTERA/peliresi
es el checkout externo utilizado sólo como almacenamiento de artefactos.

El candidato NO está desplegado. La URL pública `/mail-sitrep-rotonda.png`
todavía devuelve HTML de la SPA (200), no PNG. Esto bloquea usar esa imagen
por HTTPS hasta publicar el recurso, pero no explica las muestras CID enviadas.
El recurso oficial de Mendoza sí devuelve image/png. Debe comprobarse tipo MIME,
decodificación y dimensiones de ambos recursos antes de una publicación.

## Producción: revisión pública actual

Run 38195530426 aprobado contra la URL final, en VM:

- Escritorio, móvil 360 px y `/app` 360 px.
- Ingreso: alternar visibilidad de contraseña y redirigir una ruta protegida.
- Apertura de alta de generador, transportista y operador: nueve combinaciones;
  formulario visible, ayuda de modo prueba abre/cierra, sin TEF público ni
  desborde horizontal. No se presentaron solicitudes.
- Cero `pageerror` y cero recursos fallidos en estos recorridos; avisos de
  Service Worker registrados como consecuencia del bloqueo deliberado del SW
  por el test. Esta prueba no certifica offline ni instalación PWA.
- Salud API: `ok`, base `connected`. Dos workers online, correos y push apagados
  verificados por el guard de inspección, sin cambios de configuración.
- Capturas de generador escritorio y operador/transportista móvil inspeccionadas.

La pestaña nueva de Chrome que intentó abrir dashboard fue al login: no se usó
una contraseña antigua ni se tomó la sesión del formulario. La revisión actual
no incluye roles autenticados reales ni teléfonos físicos.

Evidencia anterior, no nueva certificación: run 38178366785 había aprobado
17 Android sintéticos, 9 APK original y 3 sesiones web/app reales. La cuenta QA
fue retirada y su secreto eliminado. No se la reactivó en esta revisión.

## Decisión para capacitación

No declarar GO global ni correo operativo. Los accesos públicos revisados pasan.
Para una jornada que dependa de verificar nuevas cuentas por email, el correo
es un pendiente bloqueante: resolver transporte/firma y demostrar recepción y
marcas en Gmail. Para los roles existentes, falta reconfirmar acceso autenticado
con las cuentas de capacitación. Mantener separado ese control de la QA sintética.

Formularios personales, borradores, trámites y sesiones ajenas preservados.
Sin nuevas instalaciones, Docker ni emuladores locales. Una sola pestaña temporal.
