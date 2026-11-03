# Inspección de campo — corte de preview 03/11/2026

## Alcance implementado
- Modelo de cuatro secciones basado en la comparación de siete PDFs entregados (28 páginas). Los originales no se importaron a la aplicación.
- Visita/persona presente, actividad y ampliación, contraste declarado/observado, entorno, medidas y responsables. Datos adicionales conservados como opcionales.
- Punto GPS/manual/mapa, vista cartográfica guardada con el acta. El mapa no evalúa ni certifica restricciones por sí mismo.
- Fotos ampliables con descripción recuperable y una fotografía por página en PDF. Sin miniatura duplicada en Evidencias.
- Lectura y firma manuscrita vinculada a snapshot inmutable; conflicto de versión y reintento idempotente. No es firma digital certificada ni equivale a conformidad.
- Enlace limitado, vencimiento/revocación, descargo/apelación/consulta y respuesta del equipo. Sin acceso al expediente interno.
- Jefatura explícita ADMIN_INSPECCIONES, asignación auditada. Sin alterar el rol base de cuentas reales.
- Muestra HTML del correo de entrega, sin envío. Aviso interno al equipo cuando ingresa una presentación.

## Verificación realizada
- Tipos backend/frontend: aprobados.
- Regresiones backend: 156 pruebas / 12 archivos, aprobadas.
- Regresiones frontend: 32 pruebas / 4 archivos, aprobadas. Se actualizaron dos expectativas antiguas de presentación; no se eliminaron pruebas.
- Compilaciones web y app: aprobadas con minificación, dependencias reutilizadas en laboratorio.
- Circuito API artificial: 20 comprobaciones, incluyendo firma, PDF, copia, apelación, respuesta, aislamiento, revocación y reintentos.
- Permisos/jefatura API: 7 comprobaciones. Generador denegado en expediente, firma interna y administración de inspectores.
- Navegador real: web de escritorio 1365 px; app a 393 y 320 px. Mapa capturado/guardado, descripción recuperada tras recarga, firma sintética dibujada y registrada en app, respuesta visible en enlace web/app. Confirmado ancho 320 sin desborde de página en Visita.
- PDF inspeccionado visualmente: encabezado, contenido, mapa guardado y foto grande con descripción.
- Fallo encontrado/corregido: orden de claves JSONB anidadas producía falso “sin guardar” y bloqueaba la firma. Regresión semántica agregada.
- Fallo encontrado/corregido: etiquetas de etapas se solapaban a 320/393 px. Etiquetas breves visibles con nombre accesible completo.

## Límites y pendientes explícitos
- Sólo preview privado en esta Mac, puerto 4188; no publicación. No equivale a validación en Android físico ni de GPS de campo.
- Correo de ida preparado; automatización completa de correos de respuesta/confirmación a todas las partes aún pendiente. Ningún correo/push enviado ni activado.
- Las nuevas presentaciones y respuestas del enlace conservan texto ante errores de envío, pero su recuperación al cerrar la pantalla no está terminada.
- La validación institucional del alcance de firma/apelación y las sesiones observadas con inspectores permanecen pendientes.
- Falta revisión exhaustiva de todos los estados y formatos extremos; las pruebas listadas no son certificación del producto completo.

## Seguridad operativa
Producción, main y workflows intactos. CAP directo cerrado. Base nueva y aislada inspection_field_20261103 en PostgreSQL efímero de QA; todos los registros artificiales. API 3048 y relay privado propios, sin alterar las cuentas/servicios de capacitación existentes. Trabajos automáticos y canales salientes pausados. QA remota, un worker por suite y contenedores limitados a 1 CPU/2 GiB sin swap; hubo un solapamiento breve entre la comprobación final de tipos/tests y una compilación, documentado sin presentarlo como ejecución serial completa.
