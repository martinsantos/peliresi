# PSIP: seguimiento de Legales y comprobantes ATM

Revisión del 20/10/2026. Producto candidato **`2200e9555e8e97d394c342f9ef519604ed1f365a`**, sólo de preview sobre `de592fa2`; publicación conocida previa `25b0c30c`. No se accedió a producción, `main`, cuentas reales ni tickets reales. CAP cerrado; correos/push apagados. Las altas completas de actores quedan fuera de este cambio, salvo el análisis del comprobante y la aclaración de la simulación TEF.

## Qué debe hacer cada parte

| Situación | Quién actúa | Acción y evidencia |
| --- | --- | --- |
| Derivada a Legales | Administración competente | Registrar trámite legal: referencia y constancia interna, con versión del expediente. No presume recepción externa. |
| En trámite legal | Administración competente | Seguir el resultado y registrar finalización cuando esté documentada. El resumen se señala expresamente como visible al inspeccionado. |
| Inspeccionado | Cuenta de la entidad vinculada | Consultar estado, derivación y resultado público en Mis inspecciones. No tramita la derivación ni presenta nuevas respuestas en el intercambio cerrado. |
| Inspector asignado | Inspector | Consultar actuaciones; conserva sus permisos anteriores. No toma las decisiones administrativas. |
| Derivada a ATM | Administración: revisar su alcance | Se conserva el estado existente y sus antecedentes. No se ofrece una nueva derivación ATM ni se presenta como paso obligatorio. No es el control del pago de un alta. |

Se usan las transiciones y permisos existentes; no se agrega una regla legal ni una integración externa. El cambio de estado tiene control de versión. Un conflicto conserva el texto; no reenvía automáticamente. La vista avisa si el expediente cambió mientras se escribía y exige revisar antes de registrar otra actuación. No se muestra como vencimiento activo un plazo histórico después de la derivación.

El avance a En trámite legal queda interno. Para el resultado Finalizada, la API consulta exclusivamente el evento de finalización marcado `visibleActor=true`, después de comprobar el acceso a la entidad. Un evento privado no se expone. El registro administrativo no acredita sanción ni firmeza. La vista abierta de seguimiento se actualiza cada 30 segundos en primer plano; esto no es correo, push ni acreditación de notificación fehaciente. La campana de la derivación formal conserva el comportamiento anterior; los cambios administrativos genéricos no incorporan un nuevo canal de aviso.

## ATM: resultado de revisar el proceso real

No corresponde pedirle al solicitante que adivine qué identificador usa el sistema. Se revisó el flujo de altas en código y la documentación pública oficial:

- [ATM: manual de pago de tasas retributivas](https://atm.mendoza.gov.ar/wp-content/uploads/2022/09/pago_online_tasa_retributiva.pdf), páginas 16–17: distingue el ticket informativo del ticket para la repartición. El segundo muestra ID Comprobante, transacción, control, fecha, código de tasa e importe. El ejemplo no acredita unicidad global de un número aislado.
- [ATM: índice oficial de Ley Impositiva 2026](https://atm.mendoza.gov.ar/normativas/ley-impositiva/) y [anexo de tasas 2026](https://atm.mendoza.gov.ar/wp-content/uploads/2025/12/Tasas-Retributivas.pdf), artículo 19, página 14: distingue inscripción/renovación de TEF anual. M figura como 162 y R como `(Z+A)×C×D`. No se cambiaron importes, coeficientes ni fórmulas.
- [ATM: manuales oficiales](https://atm.mendoza.gov.ar/instructivos/manuales-de-usuario/) separa pago de tasas de Sellos Web. La expresión coloquial “sellado” no identifica por sí sola el Impuesto de Sellos.

Limitaciones de lectura: Atención Ciudadana devolvió 403 al abrir la página de alta de generadores; no se infiere de ella una liquidación vigente. El anexo final supera el límite de descarga del lector web y se leyó dentro del contenedor del preview. El texto extraído confundió M con 107: la inspección visual del PDF confirma **162**. Se conserva tanto el texto defectuoso como la imagen original. No se usó el proyecto legislativo como ley definitiva ni valores de manuales anteriores como tarifas actuales.

### Lo que hace hoy SITREP

1. El solicitante carga `COMPROBANTE_PAGO` en su trámite. Se preservan los bytes originales, tamaño y SHA-256. El PDF/foto se lee con OCR local acotado; el documento queda pendiente de revisión.
2. La coincidencia de bytes se consulta bajo bloqueo transaccional entre documentos de solicitudes, documentos de actores y huellas persistentes. Renombrar o reemplazar el archivo no borra la advertencia del original repetido. No se revelan datos del otro titular.
3. Administración revisa el original y el trámite. La evaluación TEF es una simulación: no guarda una deuda, emite una liquidación ni confirma un pago.
4. Aprobar el documento o el alta no crea por sí solo un pago TEF ni un CAA. No hay consulta a ATM que confirme acreditación de fondos.

**Brecha pendiente:** otra fotografía o PDF recompuesto del mismo ticket tiene otra huella y puede no disparar duplicado. El control actual no impide que compartan el mismo pago mediante archivos distintos. Tampoco vincula un identificador de pago consumido con CUIT/obligado, concepto, período, liquidación y trámite. Se aclaró en la interfaz y el manual; no se presenta la ausencia de alerta como autenticidad o pago nuevo.

La calculadora usa `Z×A×D×C`, distinto de la expresión del anexo consultado. M coincide. Se agregó la indicación de fórmula y parámetros pendientes de conciliación para evitar usar la simulación como deuda determinada. La adecuación fiscal requiere confirmar con la autoridad la regla aplicable, mínimos, tramos y tipo de operador; no se reemplazó por una fórmula improvisada.

### Control necesario para cerrar la reutilización

La siguiente implementación debe registrar la identidad del pago además de la huella del archivo: comprobante original, canal/emisor, ID Comprobante y los campos de transacción/control disponibles, obligado, código/concepto, período e importe. Vincularla a la liquidación y al trámite; verificar primero el alcance y unicidad de esos identificadores con ATM. Reservar/aplicar el pago en una transacción para impedir dos usos simultáneos, preservando rechazos, reemplazos y anulaciones mediante historial. Una coincidencia dudosa necesita revisión administrativa, sin revelar otro contribuyente. OCR puede proponer los campos; no certifica pago ni autoriza su reutilización.

Esto es una especificación de control pendiente, **no una funcionalidad implementada o certificada**. No se creó una integración ATM, un registro fiscal ni una nueva obligación del solicitante en esta revisión.

## Validación y cierre

Manual candidato `2026.20.15`, mismas guías, diseño e imágenes previas; PSIP conserva siete pasos. No se alteraron históricos, permisos, coeficientes, migraciones ni cuentas CAP.


### Resultados actuales

| Control | Resultado |
| --- | --- |
| Backend dirigido, 8 archivos | 190/190 |
| Frontend dirigido, 7 archivos | 84/84 |
| Legales: tres actores × escritorio/web móvil/app | 9/9 |
| Comprobantes: tres altas, archivo compartido y OCR ocupado × tres superficies | 15/15 |
| Capturas adicionales: título, pasos y botón accesibles en la superficie real de desplazamiento | 3/3 |
| Contenido y empaquetado del manual | 20/20 |
| Manual abierto en navegador | 6/6 |
| TypeScript backend/frontend, builds web y app, lint crítico | PASS |
| Auditoría PostgreSQL, canales, fuentes y manual empaquetado | PASS |

Navegador real del preview, un worker, una fase por vez, 1 CPU / 2 GiB / swap cero. Sin suites globales ni certificación de Android físico. No estaba disponible el plugin Browser solicitado por la guía de frontend; se utilizó el Playwright existente del preview. No hubo instalaciones locales ni pruebas pesadas en la Mac.

Los nueve recorridos registraron derivación formal, avance interno y finalización pública. Se probaron rechazos 403 para actores y 409 para un inspector asignado, consultas de expediente ya abierto sin recarga, eventos privados excluidos y registros ATM sin nueva acción. Las 30 actuaciones originales de ambos lotes artificiales conservaron sus hashes; no se reseteó ni borró ningún caso. Las pruebas de altas verificaron el archivo original y su descarga autenticada, el aviso de duplicado sin identidad ajena, datos declarados y ausencia de un pago TEF creado al aprobar el alta. El bloqueo OCR fue real, con lectura posterior en español sobre el mismo documento.

La cola tenía **2 registros previos**; terminó con **21 SUPRIMIDO**, incluidos **19 nuevos** de las altas artificiales por `EMAIL_DISABLED`, todos con cero intentos y sin fecha de envío. **Cero pendientes y cero envíos**. No equivale a decir que la tabla esté vacía: preserva auditoría de los envíos suprimidos. SMTP y VAPID vacíos, CAP vencido, `DISABLE_EMAILS=true` y push false verificados en los dos procesos. Flags originales false y los dos de transporte true, sin cambios.

Fuentes verificadas: 2.215 archivos en el manifiesto final; **811 fuentes compiladas y del manual iguales al snapshot de build**. SHA-256 del manifiesto de ejecución: `22e0501981ebd7ff7b2ca8ddfc7fc53054e575d61aa9d161ae8582752fada8f9`. El único ajuste posterior al build en las fuentes de QA fue exigir el HTTP 200 que ya devuelve la decisión formal; no se cambió el contrato del producto. Los blobs del producto confirmado se compararon con el snapshot probado.

### Incidencias conservadas

- La primera pasada frontend dio 79/84: selector ambiguo al añadir ayuda de recibos, formato de fecha y aclaración de cierre en los tres estados de derivación. Se conservó el significado de las expectativas y se repitieron los siete archivos: 84/84.
- La primera prueba de Legales esperaba erróneamente 201; el endpoint existente responde 200. Se corrigió esa comprobación y se creó un segundo lote sin tocar el primero: 9/9 finales. Un intento de nombre de fase no admitido fue rechazado antes de ejecutar pruebas.
- En el primer recibo, `flock` devolvió permiso denegado al abrir un archivo anterior de otro UID en `/tmp`. Los temporales dentro del checkout también impedían al renderer de Chromium atravesar un padre 0700. Se conservaron dos fallos de arranque del navegador y el diagnóstico. El temporal propio `/tmp/sitrep-psip-legal-20261020`, con permisos temporales estándar 01777, se compartió sólo entre los procesos de esta ejecución. No se cambió el archivo anterior, el dueño del checkout ni el producto: 15/15 finales. No hubo OOM.
- La captura móvil inmediata a un toast dejaba parte del título detrás de la navegación en la toma automática. Una comprobación adicional desplazó la superficie real del expediente, sin editar CSS ni píxeles, y verificó por geometría/oclusiones el título, las palabras de los tres pasos y el botón. Tres capturas correctas, conservando la inicial.
- El primer lanzador visual externo al paquete frontend necesitó declarar su contexto ESM. La auditoría corrigió dos supuestos del propio script: una cola suprimida no está vacía y el root exportado lleva una barra final. Los controles finales verifican estados, intentos, fecha de envío y ruta normalizada completa; no se borraron filas ni se aflojaron permisos.
- El recolector opcional de archivo no encontró Python dentro del contenedor. Se recuperaron directamente por SFTP los informes, logs y capturas desde el volumen persistente. No se instaló ningún runtime.

### Evidencia y cierre operativo

Evidencia privada local: `test-results-psip-legales-atm-20261020/`, con informes en `remote-evidence/`, manifiestos, intentos y capturas originales. Remota: `/opt/sitrep-qa-enterprise-20261016/source/.qa-psip-legales-atm-20261020/`; PDFs públicos originales y trazas de intentos permanecen allí. No publicar trazas con sesiones aunque las cuentas sean artificiales.

Capturas revisadas: `desktop-legal-progress.png`, `app-visible-progress.png` y `mobile-visible-progress.png`; las dos últimas muestran el título completo, los tres pasos y la acción accesible. Imágenes originales del instructivo y artículo 19: `atm-ticket-reparticion.png` y `atm-2026-art19.png`.

Auditoría final: **20/10/2026 14:09:58 Mendoza**. API, servidor estático y PostgreSQL propios cerrados; contenedor `sitrep-qa-training-20261018` detenido a las **14:12:27 Mendoza** y evidencia recuperada del volumen persistente. Imagen, base artificial, fuentes, intentos y documentos preservados. `memory.events`: max=0, oom=0, oom_kill=0; límites sin ampliar. Fuente y documentación con `[skip ci]`, sin push ni workflows. `main` sigue `c8402190edfc36b5e5d0dee1337c24bd1689420d`.

**Sin publicación.** No hubo acceso a producción ni migraciones. Los bundles QA usan `/api` local y no son un paquete autorizado para desplegar. El último despliegue conocido sigue siendo `25b0c30c`; no se contactó para volver a verificarlo. Para retirar este candidato no hace falta restaurar una base productiva: no se modificó.
