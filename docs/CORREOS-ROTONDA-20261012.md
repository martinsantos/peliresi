# Correos institucionales — rotonda aprobada

El usuario aprobó el símbolo de reciclaje circular para los correos y autorizó
un lote de diez ejemplos a su dirección personal. Este trabajo no despliega
la aplicación ni habilita avisos automáticos.

## Diseño y alcance

- Cabecera blanca: logo oficial existente de Mendoza y firma DGFA.
- Banda verde: SITREP y la rotonda de tres segmentos iguales, con giro de 120°.
- Tipografía Arial/Helvetica explícita en tablas y contenido; títulos verdes
  sobre blanco, marca blanca sobre verde y acciones de al menos 44 px.
- HTML de tablas, estilos en línea, texto alternativo. Sin fuentes remotas.
- Fuente de la marca de correo: `frontend/public/mail-sitrep-rotonda.svg`.
  PNG 192×192 de 5.067 bytes, generado/verificado por
  `scripts/qa/mail-brand-assets.ts`; no reemplaza todavía los íconos del APK.
- Plantilla compartida: `backend/src/services/email-templates.ts`,
  versión `20261012.2`. No se modificaron reglas de destinatarios ni permisos.

## Muestras recibidas

Diez mensajes enviados una sola vez: verificación, cuenta pendiente,
observación y aprobación de inscripción, inspección asignada, respuesta de
soporte, manifiesto en tránsito, certificado disponible, vencimiento y seguridad.

Los ejemplos usan datos ficticios, banner visible de muestra y botones que sólo
abren el login. No incluyen tokens funcionales, documentos, información de
personas ni referencias a trámites reales. Ambos logos se adjuntaron mediante
CID. El envío de muestra no usa ni reactiva la cola de negocio.

SMTP aceptó 10/10 y Gmail recibió 10/10 con ambos logos el 12/10/2026 a las
01:13 UTC (11/10, 22:13 Mendoza). Gmail clasificó los diez como Spam.
No confundir recepción con entrega en bandeja de entrada. No se modificaron
etiquetas del buzón, DNS, DKIM ni configuración del servicio de correo.

El emisor aislado verifica destinatario, hash del lote, TLS, configuración
sin cambios y avisos apagados. Persiste cada intento antes de enviar y bloquea
duplicados incluso ante timeout ambiguo. Sus cinco pruebas aisladas pasan,
además de diez comprobaciones de MIME, destinatario único y logos CID.

## Evidencia y límites

Primera corrida de diseño: 38190045570, commit 61f8de6, aprobada:
917 unit backend, 8 unit frontend afectados, 17 grupos de integración con
52 correos capturados sólo en SMTP local de la VM, 8 grupos HTTP y 18 E2E.
El recorrido visual contiene 58 variantes por tres perfiles: escritorio,
web responsive y app. No son 58 eventos distintos ni todos tienen envío activo:
incluye variantes por destinatario, plantillas históricas y helpers.

Las capturas iniciales motivaron explicitar la tipografía de las tablas.
La corrida 38190742306 se canceló al ajustar una aserción para admitir contenido
en listas además de párrafos; no constituye evidencia final.
La corrida final 38191005176, commit 427953a, terminó aprobada con los mismos
917 unit backend, 8 unit frontend afectados, 17 grupos de integración,
52 correos capturados en la VM, 8 grupos HTTP y 18 E2E sin fallos,
omitidos ni reintentos flaky. Se agregó la comprobación de familia tipográfica
en los títulos y contenedores de las 58 variantes, en los tres perfiles.
Capturas finales de inspección (escritorio) y soporte (móvil) inspeccionadas.

Catálogo local portátil: ROOT/sitrep-correos-rotonda/catalogo/index.html.
Una sola vista previa, imágenes incorporadas, sin requests externos ni enlaces
operativos. Evidencias privadas de entrega fuera del repositorio:
ROOT/sitrep-correos-rotonda/gmail-reception.json y
ROOT/sitrep-cloud-qa-20261002/mail-roundabout-send.json.
ROOT es el directorio de visualizaciones de este hilo del 24/09/2026.

Pendientes fuera del alcance de las muestras: entregabilidad Spam, aprobación
para publicar la nueva identidad en todo el sistema y matriz nativa de clientes
de correo (Outlook, Apple Mail, Gmail móvil y sus modos oscuros). Chromium
responsive no equivale a validar todos esos motores.

Se preservaron el formulario del usuario, sesiones, expedientes y configuración
de producción. No se instalaron navegadores, emuladores ni Docker locales.
