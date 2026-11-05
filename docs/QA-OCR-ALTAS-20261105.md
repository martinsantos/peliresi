# OCR y altas — corte de corrección, 5 noviembre 2026

## Estado real

Base: 51adf7da7cd0ffd67a9690337121b91295131bab (incluye la mejora previa de orientación de jefatura). Producción observada: 65322ad39da3fd520dd234743ef96ebcb6b7d917. Este corte no se ha publicado. No se consultaron ni modificaron registros reales. CAP cerrado; correos, push y trabajos del laboratorio apagados.

## Causa y correcciones

- El PATH efectivo del backend de producción no encuentra tesseract, pdftotext ni pdftoppm (ENOENT). flock sí está disponible y existe el modelo spa empaquetado. La falta de ejecutables explica la indisponibilidad general, independientemente de la calidad de las facturas. No se ha demostrado en qué despliegue desaparecieron.
- El publicador no comprobaba estas dependencias del sistema. Ahora el candidato exige programas y español antes de stage/publish; prepare añade una lectura real de cuatro formatos. No instala nada en producción automáticamente.
- El mensaje diferencia servidor indisponible, plazo agotado y ausencia de texto. No muestra una tarjeta verde con todos los valores vacíos si el OCR no se ejecutó; el reintento queda visible antes de la evidencia.
- Licencias de transportista en revisión: el resultado se conserva de Flota a Documentos y usa el perfil LICENCIA también al reintentar.
- Un reintento fallido del mismo archivo conserva la lectura previa en el preview. También se preserva la licencia ya guardada en el servidor, verificando previamente la huella del original. No altera su estado de aprobación.
- Factura eléctrica sigue opcional. OCR no acredita pagos, no aprueba documentos ni sustituye la decisión del usuario sobre campos de licencia. No modifica TEF ni convierte kW en HP.

## Validación y evidencia

Laboratorio existente aislado: sitrep-inspection-20261103, 1 CPU, 2 GiB, swap 0, red none, un worker. API 3049; datos artificiales únicamente.

- Backend: 177 pruebas iniciales en ocho archivos; luego 74 pruebas de regresión del cambio final y 19 del controlador con el nuevo caso de licencia. Son ejecuciones solapadas, no se suman como pruebas únicas.
- Frontend: 164 pruebas iniciales; después 41 de los cuatro archivos afectados, incluidas continuidad web/app y conservación de la lectura anterior. No sumar repeticiones.
- Publicador: 60/60 con Node 22 y directorio temporal propio del laboratorio.
- TypeScript backend y frontend: aprobado. Builds web y app finales separados: aprobados, 35 y 36 s. Persisten avisos de tamaño de chunks y referencia CSS externa preexistente.
- OCR nativo real: JPG, PNG, PDF con texto y PDF escaneado. Los cuatro devuelven EDEMSA, tarifa T2 y 1250 kWh; hashes originales intactos. No usan mocks, base ni mensajería.
- Navegador, generador: factura JPG en app y PDF con texto más recibo ATM en web.
- Navegador, operador: PDF escaneado en app; reintento sin adjuntar de nuevo y texto de actividad intacto. PNG en web con servicio ocupado y recuperación correcta.
- Navegador, transportista: licencia y recibo ATM artificiales; lectura de cinco campos sin sobrescribir los declarados. Verificación final del paso Flota → Documentos conserva el texto leído.
- Capturas y logs completos conservados localmente en ocr-review del checkout de este hilo. El informe no contiene credenciales ni datos personales reales.

## Incidentes del laboratorio, separados del producto

El tmpfs /tmp de QA se llenó durante una prueba del publicador; se conservó evidencia y se asignó TMPDIR propio en el volumen QA. El reintento posterior recuperó el archivo. Una compilación de ambas superficies en un proceso agotó el límite de memoria: se repitieron secuencialmente en procesos separados sin ampliar recursos, ambas aprobadas. El servidor privado venció por TTL y el HTML de entrada app era anterior; se renovó el preview y se comprobó el hash del asset servido. No son pruebas de un fallo de OCR con los paquetes ya instalados en producción.

## Publicación pendiente

Requiere autorización del SHA exacto conforme al runbook vigente. Además de publicar código por el publicador, debe instalarse la dependencia nativa en el host AlmaLinux 9.8: tesseract, tesseract-langpack-spa y poppler-utils desde repositorios oficiales. La simulación dnf --assumeno propone 21 paquetes nuevos, 11 MB de descarga y 36 MB instalados; sin actualizaciones ni eliminaciones. La simulación no instaló paquetes. No usar instrucciones apt de Debian en este host.

Después: verificar versiones/modelo español y ejecutar el smoke nativo con documentos artificiales, sin base; publicación revisada y smoke de sólo lectura, sin reintentar adjuntos reales. Mantener flags, CAP y mensajería sin cambios.

## Límites y siguientes controles

No declarar todas las altas validadas de extremo a extremo: esta tanda cubre lectura/documentos, recuperación y contratos con pruebas automáticas; no se completó una nueva inscripción real ni una aprobación administrativa en navegador. Faltan una ronda completa de alta persistida por rol en QA, muestras representativas de cada proveedor y calidad de imagen y Android físico. El JPG original de la captura del usuario no fue adjuntado; se verificaron archivos artificiales, no esa factura exacta. AFIP, habilitación y seguros conservan su circuito documental; no se promete extracción especializada de campos que no existe en el contrato actual.
