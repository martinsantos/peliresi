# Control de pagos ATM y lectura de facturas eléctricas — 20/10/2026

**Actualización posterior: producto `a6a5c005` publicado a las 16:45:59 Mendoza**, con backup previo verificado, migración aditiva, CAP cerrado, canales y flags conservados. Smoke **95/95**, externo **9/9**, PWA PASS. Leer [publicación, límites y reversión actual](DESPLIEGUE-PAGOS-ATM-20261020.md). El resto de este documento conserva la validación previa en preview, anterior a la autorización de publicar. No se conciliaron ni modificaron comprobantes reales.

## Alcance y estado

Candidato de **preview**, producto **`a6a5c005e94aa68ee20b6f410313515f094cb897`**, desde `6a452158`, en `codex/sitrep-training-20261018`. Único checkout autorizado: `sitrep-production-source-20261001` del traspaso. Esta revisión no se conectó a producción, no publicó ni migró allí y no tocó `main` (`c8402190edfc36b5e5d0dee1337c24bd1689420d`). La última publicación anterior sigue documentada como `2200e955`; no se volvió a inspeccionar producción para esta tarea.

CAP permanece cerrado, correo suprimido sin intentos/envíos, SMTP/VAPID y demás proveedores vacíos, push apagado y flags previos conservados. Sin push Git ni workflows; commits con `[skip ci]`.

## Pago: identificar el ticket, no solamente la foto

La huella SHA-256 anterior detectaba el mismo archivo. Otra fotografía produce otra huella. Ahora se agrega un registro persistente de la **identidad revisada del pago**, con claves únicas por ID Comprobante y, cuando figuran ambos, transacción/control. CUIT, importe, período, otro año, otra solicitud o nombre de archivo no forman parte de la clave que permite reutilizarlo.

La administración competente abre **Identificar y reservar pago ATM**, contrasta la propuesta OCR con el original, completa CUIT del obligado, código de tasa, fecha, importe, período/concepto y referencia de liquidación o trámite, marca el original revisado y confirma. Luego revisa el documento y finalmente el alta. La identidad no puede confirmarse con el CUIT de otro obligado ni con una copia obsoleta del documento. El solicitante y otra administración sectorial no tienen esa facultad.

La reserva y sus alias se crean con bloqueos transaccionales ordenados y unicidad en PostgreSQL. Dos altas concurrentes no pueden consumir el mismo pago: una confirma y la otra recibe conflicto. El mensaje no revela el otro titular. Al aprobar el alta, se marca aplicado dentro de la misma transacción; **no se inventa una acreditación o un pago TEF**.

Reemplazar la foto dentro del trámite exige revisar los nuevos bytes y conserva la reserva y su historia. Rechazar o retirar el adjunto tampoco libera el pago para otro trámite. Las reservas y eventos no dependen de que sobreviva la fila del adjunto. Un comprobante histórico aprobado no puede retirarse/reemplazarse sin identificarlo antes. Su identificación conserva el estado y original históricos.

Se controlan también aprobados anteriores no indexados mediante sus metadatos OCR. Sin identidad legible, administración debe conciliarlos antes de confirmar pagos nuevos. Hasta 500 pendientes por fuente se revisan en cada operación; sobre ese límite se detiene la asignación nueva y hace falta conciliación por lotes antes de publicar/usar esa instalación. **No se incluye en esta entrega una herramienta de conciliación masiva.** Los ya indexados se excluyen antes del límite: más de 500 pagos conciliados no bloquean nuevas altas.

El adjunto opcional conserva su carácter opcional: no se agrega por esta revisión una obligación fiscal nueva a todos los roles. Si se presenta un comprobante, sí se exige identificarlo antes de aprobarlo. No se modifican las fórmulas, montos ni requisitos regulatorios previos.

### Límite de la garantía

Es un control de reutilización **dentro de SITREP sobre identificadores confirmados contra el original**, no una consulta de fondos a ATM, un detector infalible de documentos adulterados ni prueba de unicidad global de un número aislado. La normalización elimina separadores y ceros iniciales; no transforma una letra OCR en un número supuesto. Valores contradictorios requieren revisión. Las colisiones conservadoras se detienen para conciliación, sin reasignación automática. Históricos ya ausentes/ilegibles no se reconstruyen por inferencia.

El [instructivo oficial de ATM](https://atm.mendoza.gov.ar/wp-content/uploads/2022/09/pago_online_tasa_retributiva.pdf), página 17, muestra el ticket para presentar en la repartición: ID Comprobante, transacción/control, código, fecha e importe. Distingue ese ticket del recibo informativo y no acredita por sí solo fondos ni unicidad universal del ID. CUIT, concepto/período y referencia también se contrastan con el obligado y la liquidación del trámite.

## Factura eléctrica: evidencia separada de la TEF

Generador y Operador pueden adjuntar **Factura eléctrica** en el alta; también se muestra su análisis en la revisión administrativa y en los documentos de actor. PDF/JPG/PNG, hasta 10 MiB conforme al límite existente. OCR nativo de español con los componentes ya instalados, sin enviar documentos a terceros ni agregar dependencias.

La lectura propone distribuidora, categoría tarifaria literal, NIC/NIS/suministro, período, consumo en kWh, potencia contratada/registrada en kW y nivel de subsidio si están expresamente rotulados. La interfaz distingue **No leído**, evidencia y conflictos. Conserva el original y permite reintentar una lectura incompleta. Un PDF con capa digital parcial también pasa por OCR de la primera página; si falla esa etapa, se conserva la lectura parcial y se avisa.

El código actual del test/TEF utiliza **potencia instalada en HP**. Una categoría tarifaria, kWh, subsidio o potencia contratada en kW no determina por sí sola ese dato. **No se convierte ni se reemplaza la declaración ni se cambia automáticamente la TEF.** Una regla para incorporar categoría eléctrica al test exige definir y aprobar ese criterio por separado. La diferencia fiscal de la fórmula R documentada anteriormente sigue pendiente de conciliación; no se modificó aquí.

### Catálogo de Mendoza y fuentes

La empresa es **EDEMSA**, no EDENSA. El catálogo provincial comprende once distribuidoras:

1. EDEMSA.
2. EDESTE / EDESTESA.
3. Cooperativa Eléctrica de Godoy Cruz.
4. Alto Verde y Algarrobo Grande.
5. Cooperativa Popular Rivadavia.
6. CECSAGAL / General Alvear.
7. Cooperativa Eléctrica Medrano.
8. Cooperativa Eléctrica Monte Comán.
9. COSPAC Bowen.
10. Cooperativa Eléctrica Santa Rosa.
11. Cooperativa Sud Río Tunuyán.

Fuentes primarias consultadas el 20/10/2026:

- [Listado provincial de distribuidoras y contactos](https://www.mendoza.gov.ar/prensa/wp-content/uploads/sites/5/2020/08/anexo-16-Distribuidoras-de-servicios-el%C3%A9ctricos-de-Mendoza-y-contactos.pdf).
- [Informe anual de demanda EPRE 2025](https://epremendoza.gov.ar/2019/informesT/ev-demanda-Vigente/Anual2025.pdf), que vuelve a distinguir EDEMSA, EDESTE, Godoy Cruz y las ocho cooperativas menores.
- [Cuadro tarifario EPRE, Resolución 189/2026, vigente desde septiembre de 2026](https://epremendoza.gob.ar/2019/informesT/cuadrosT-Vigentes/CT%20Res%20189-2026.pdf), enlazado en [EPRE](https://epremendoza.gob.ar/home/): categorías y subsidio SEF se distinguen de consumo/potencia. No se incorporaron sus precios a una fórmula.
- [Régimen tarifario general](https://epremendoza.gob.ar/2019/resoluciones-anexos/Regimen_Tarifario.pdf), como descripción de categorías; no como precios vigentes.
- [EDESTE](https://edeste.com.ar/) y su [guía pública](https://edeste.com.ar/assets/pdf/institucional/guiadereferencia-2630.pdf), con alcance documental limitado.

**Catálogo y reconocimiento no equivalen a certificar todas las facturas.** Los portales EDEMSA/Godoy Cruz y algunas cooperativas no entregaron una colección pública accesible de originales de cada formato. No se usaron facturas privadas ni datos reales. Se probaron once composiciones artificiales con sus encabezados y un PDF híbrido artificial, no once facturas reales de distribuidoras. Un emisor desconocido, una captura parcial, reflejos o formatos históricos distintos requieren revisar el original. El domicilio del cliente en Godoy Cruz no basta para elegir esa distribuidora; EDERSA/EDENOR/EDENSA no se atribuyen a EDEMSA.

La extracción mantiene los límites existentes: hasta tres páginas de texto, OCR sólo de la primera página escaneada, hasta 16 millones de píxeles de entrada y un plazo compartido de 15 segundos. No se promete leer un anexo en otra página ni un campo ilegible. No se deduce una tarifa del monto, consumo o subsidio.

## Manual e interfaz

Manual **2026.20.16**, guía existente **Alta, borradores y OCR** ampliada con la reserva ATM, conciliación histórica y lectura eléctrica. Se conservan estructura, cuatro pasos, diseño, CSS y renderer. Los tres puntos HTML actualizan sólo la versión de contenido.

La revisión del pago se abre a demanda para no agregar un formulario completo a cada documento. Los errores conservan los valores ingresados. La evidencia eléctrica usa los encabezados, iconos y componentes existentes y una cuadrícula compacta en móvil. Se verifica escritorio, web móvil y `/app`; esto no certifica hardware Android ni sensores físicos.

## Validación y evidencia

Validación final del 20/10, serial, un worker, **1 CPU / 2 GiB / swap cero**, en el contenedor propio `sitrep-qa-training-20261018` de `76.13.234.213`. En la Mac sólo lecturas, edición, Git y verificación de hashes.

| Control | Resultado | Alcance |
|---|---:|---|
| Backend dirigido | **166/166** | Diez archivos: identidad, OCR eléctrico, moderación, aprobación, límites, recuperación, certificados y requisitos existentes |
| Frontend dirigido | **37/37** | Cinco archivos: reserva, errores/reintento, evidencia, TEF y altas |
| API real + OCR nativo | **11/11 grupos** | Reutilización con otra foto/alta/CUIT/año, operación con otro ID, permisos, bytes obsoletos, concurrencia, reemplazo/retiro e históricos; once imágenes de facturas y un PDF híbrido artificiales |
| Volumen histórico | **3/3 grupos** | 501 indexados no bloquean; 501 sin identificar sí; los 1.002 documentos y sus reservas/eventos temporales revierten completos |
| Migración final | **3/3 grupos + diff vacío** | SQL final con rollback, índice alineado con Prisma y siete tablas propias con hashes iguales; ensayo/aplicación inicial 4/4 conservados por separado |
| Navegador nuevo | **12/12** | Cuatro recorridos × escritorio 1440×900, web móvil 360×800 y app 360×800; backend real, cero reintentos/flaky/omitidos |
| Regresión de comprobantes | **15/15** | Tres tipos de alta en las tres superficies, archivo repetido entre cuentas y recuperación de OCR ocupado |
| Manual | **21/21** | Contenido y copia exacta; tres recorridos de navegador del manual incluidos en los 12 anteriores |
| Tipos, builds y lint | **PASS** | TypeScript efectivo backend/frontend, web y app compiladas en serie y lint crítico |
| Auditoría final | **5/5 grupos** | QA compartido intacto, pagos aplicados y originales, factura separada de recibos, entregas apagadas y fuentes de producto exactas |

La auditoría final incluye **32 altas artificiales aprobadas** con pagos reservados/aplicados, **12 facturas eléctricas adjuntas**, cero pagos TEF inventados y **81 registros de correo SUPRIMIDO**, con cero intentos y cero fechas de envío. Los cuatro alias CAP devuelven 403. El registro de pagos y sus índices nuevos sólo existen en el esquema propio. No se inspeccionaron ni modificaron registros reales.

Se guardaron doce capturas finales y se revisaron visualmente en contexto la reserva/conflicto, la evidencia eléctrica compacta y el manual con sus fuentes originales en caché. Las pruebas comprueban que los campos/errores persistan, el botón de confirmación alcance contraste 4,5:1, no haya desborde horizontal ni errores de página y la potencia declarada **120 HP** permanezca igual después de subir/recargar la factura. No se declara una auditoría visual global del producto.

Los **48 archivos** del commit de producto coinciden por hash con el preview. **1.202 fuentes de backend, frontend, Prisma y manual** coinciden con las usadas para los builds aceptados. CSS/renderer del manual y archivos de dependencias coinciden con el baseline. El SQL final tiene SHA-256 **`dedb359b650598167610a0ffc334d0f879a5d3efa1fe1546903c70fa8cc1506e`**. El cierre posterior sólo agrega documentación.

La herramienta de navegador del plugin no estaba disponible; se utilizó Playwright instalado en el preview con backend real, tres superficies y un worker. Las capturas y trazas privadas no se incorporan al repositorio. No se corrieron suites globales ni se afirma un GO global.

El SQL aditivo `20261020180000_payment_identity` agrega tres tablas e índices. Se ensayó con rollback y después se aplicó una sola vez al esquema nuevo **`payment_identity_20261020`** de la base artificial existente. La comparación con Prisma detectó el nombre de un índice truncado por PostgreSQL: se corrigió la migración aún no publicada, se volvió a ensayar el SQL final completo con rollback y se renombró únicamente ese índice del esquema propio. La comparación posterior no muestra diferencias y los hashes de sus siete tablas documentales/de pagos quedaron iguales. No se aplicó en `public` del QA compartido, CAP ni producción. Los hashes de todas las filas previas de documentos, solicitudes y pagos TEF del QA compartido se comparan antes/después; no se reseteó esa base. El volumen artificial temporal se revierte completamente.

Artefactos privados: `test-results-payment-electricity-20261020/` local y `.qa-payment-electricity-20261020/` del preview. Fuentes cotejadas por SHA-256; los builds aceptados usan `/api` local y **no son un paquete de producción**. La imagen QA y los archivos se conservan.

### Incidencias de QA resueltas o conservadas

- La regla de ignore excluía la migración nueva: se incluyó explícitamente en el índice y en el manifiesto de fuentes antes de ensayar su SQL.
- Se corrigió el empaquetado incremental para compararlo con el primer envío y no perder cambios intermedios.
- Se adaptaron mocks a la transacción documental y la regresión de altas a la identificación y aprobación explícitas del pago. Una expectativa de CUIT se corrigió a dígitos normalizados; no se relajó el control del obligado.
- Una repetición de navegador reutilizó casos ya aprobados. Se preservó esa evidencia y se creó un lote nuevo, sin resetear ni editar los anteriores.
- Se corrigió el límite de históricos para que cuente sólo pendientes de identificar; se agrega la prueba de más de 500 indexados y más de 500 pendientes.
- Se agregó la lectura de PDF híbrido y el aviso/reintento de lectura parcial antes de la aceptación final.
- Se corrigió el nombre largo del índice único de eventos para coincidir con Prisma, antes de cualquier publicación. Se conservan el ensayo inicial y el final; no se repitió `db push` sobre el esquema poblado.
- La primera captura anónima del manual no cargó las fuentes de iconos. Se agregó el mismo montaje de caché verificada de Google Fonts y bloqueo de producción usado por los tests autenticados, también a las páginas anónimas. No se cambió la tipografía ni el renderer del producto.
- Los avisos locales del índice AppleDouble de Git se conservan en evidencia; no se reparó ni se trabajó en el checkout SDTERA.

## Antes de una publicación futura

No está autorizada por este pedido. Requiere identificar y dimensionar los históricos pendientes sin consultar datos reales durante este QA, plan de conciliación cuando corresponda, backup verificado antes de la migración aditiva, versiones nuevas del service worker y builds nuevos con API del dominio final. Conservar CAP cerrado, correos/push apagados y flags/uploads. La unicidad conservadora no se debe desactivar para facilitar una aprobación.

Una reversión de interfaz no debe borrar reservas, alias ni auditoría ni restaurar una base anterior. El backend anterior no aplica este control; regresar a él reabriría el riesgo de reutilización, aunque las tablas permanezcan. No se preparó ni ejecutó un rollback productivo para este candidato de preview.

Cierre QA **20/10/2026, 16:23:08 Mendoza**: API, estático y PostgreSQL propios cerrados; contenedor detenido (`Running=false`, `Pid=0`, `OOMKilled=false`), límites conservados, `max=0`, `oom=0`, `oom_kill=0`. Imagen, base artificial e incidencias/evidencias preservadas. Sin túneles nuevos, producción, main, push Git ni workflows. Producto `a6a5c005` y cierre documental con `[skip ci]`; este documento no autoriza publicar el candidato.
