# Auditoría contractual y probatoria — Informes SITREP Etapas 3 y 4

**Fecha de corte:** 12 de septiembre de 2026
**Documentos a presentar:** Notas N.º 04/2026 y 05/2026, fechadas para el 14 de septiembre de 2026.
**Contrato base:** $ 27.400.000,00 IVA incluido.

## Dictamen ejecutivo

Los informes nuevos **no deben reproducir** los Certificados de Avance N.º 3 y 4 preparados el 27 de marzo de 2026. Esos archivos fueron creados antes del tramo contractual de la Etapa 3 y contienen afirmaciones que no cuentan con constancia suficiente o contradicen la coordinación actual: capacitación de 20 horas finalizada, diez asistentes certificados, seis videos publicados, transferencia completa, UAT concluida, soporte iniciado y recepción definitiva.

La versión corregida conserva el formato de las Notas N.º 01/2026 y 02/2026, usa la denominación ministerial del pliego y del acta aprobatoria, separa la Nota N.º 03/2026 de adicionales y diferencia tres niveles: **verificado**, **en cierre** y **pendiente**. No solicita certificar como terminado aquello que aún requiere prueba o acta.

## Fuentes y jerarquía utilizada

1. **Pliego PLIEG-2025-07544314-GDEMZA-DGFA#SAYOT:** fuente contractual principal.
2. **Acta de Recepción y Aprobación de Etapas 1 y 2:** prueba de aprobación y montos ya autorizados.
3. **Oferta final de ULTIMA MILLA S.A.:** amplía el detalle técnico, pero su tabla interna de montos no respeta matemáticamente los porcentajes; prevalecen el total, los porcentajes y los montos ya aceptados.
4. **Notas de avance N.º 01/2026, 02/2026 y Nota N.º 03/2026:** antecedente formal y visual. La Nota 03 es un pedido adicional separado del contrato base.
5. **Código, compilación, pruebas y endpoints en línea:** evidencia técnica de existencia y operación.
6. **Mensajes de Santiago Bracelis del 11 de septiembre de 2026:** evidencia de coordinación operativa, no adenda contractual.
7. **Certificados 3 y 4 del 27 de marzo de 2026:** borradores históricos útiles como índice, no como prueba de ejecución ni recepción.

## Conciliación del alcance

| Fuente | Etapa 3 | Etapa 4 |
|---|---|---|
| Pliego | Reportes estadísticos; exportación de datos; manuales y soporte por tres meses. 20 %, máximo 60 días. | Sistema instalado y funcionando. 15 %, máximo 30 días. |
| Oferta | BI; PDF, CSV y XML; manuales; videos; inicio del soporte. Días 91–150. | Capacitación; despliegue gubernamental; transferencia; UAT; acta definitiva. Días 151–180. |
| Santiago | Presentar con urgencia informes 3 y 4, equivalentes formalmente a los 1 y 2; por razones prácticas incluir manuales y soporte de tres meses en Etapa 4. | Cierre conjunto de manuales, soporte y capacitación; reunión final todavía sin salón confirmado. |
| Informe corregido | Reporta como verificados BI, reportes, PDF y CSV; identifica XML como pendiente; documenta el criterio de llevar manuales/soporte al cierre sin afirmar que el mensaje modifica el pliego. | Reporta instalación operativa; condiciona cierre a capacitación, UAT, transferencia, recursos del manual, soporte y recepción definitiva. |

## Matriz de evidencia y brechas

| Requisito | Evidencia encontrada | Estado | Tratamiento en los informes |
|---|---|---|---|
| Reportes estadísticos / BI | Módulo `/reportes`, controladores de reportes y endpoints en ambos dominios. | Verificado | Etapa 3 — completado/verificado. |
| Reportes de manifiestos | API y UI por período, estado y detalle. | Verificado | Etapa 3 — completado. |
| Residuos tratados | Endpoint y pestaña específica. | Verificado | Etapa 3 — completado. |
| Transporte y operadores | Endpoint de transporte y vistas sectoriales. | Verificado | Etapa 3 — completado. |
| Territorio y actores | Pestañas por establecimientos, departamentos y mapa. | Verificado | Etapa 3 — completado. |
| Exportación CSV | Backend exporta manifiestos, generadores, transportistas y operadores; respuesta `text/csv`. | Verificado | Etapa 3 — verificado. |
| Exportación PDF | Exportación cliente con jsPDF; PDF de manifiesto y certificado desde API. | Verificado | Etapa 3 — verificado. |
| Exportación XML | No se encontró controlador, ruta ni prueba XML de reportes. | **Pendiente contractual** | Etapa 3 — pendiente explícito. |
| Manual de usuario | `/manual/` responde en ambos dominios y existe manual por perfiles. | Verificado con observación | Etapa 4 — disponible con ajuste. |
| Recursos audiovisuales del manual | Ocho WebP locales; las URLs públicas probadas devuelven fallback HTML, no `image/webp`. No hay evidencia de seis videos de 95 minutos. | **Pendiente técnico** | No se afirma entrega de videos; se registra el ajuste. |
| Swagger/OpenAPI | Código y UI en `/api/docs/` responden en ambos dominios. | Verificado | Soporta entrega técnica, sin afirmar transferencia formal. |
| Instalación SITREP espejo | Web, PWA, API, manual y reportes responden. | Verificado | Etapa 4 — implementado. |
| Instalación RPTRAZAR gubernamental | Web, PWA, API, manual, reportes y documentación API responden por VPN. | Verificado | Etapa 4 — implementado. |
| Capacitación mínima 10 personas / 20 h | El pliego y la oferta la exigen; no se encontró planilla firmada, total de horas ni certificados. La última reunión sigue sin fecha/salón confirmados. | **En cierre** | Etapa 4 — en cierre, sin afirmar cumplimiento. |
| Referente Alfa Service | Santiago indicó que pediría los datos; no están en el chat revisado. | Pendiente operativo | Etapa 4 — coordinación pendiente. |
| Registros actualizados de actores | Santiago indicó que el equipo los revisaría. No hay constancia adjunta del resultado. | Pendiente operativo | Etapa 4 — coordinación pendiente. |
| Transferencia de fuentes y credenciales | Repositorio versionado y documentación disponible; no se encontró acta de transferencia. | **En cierre** | Etapa 4 — en cierre. |
| UAT | Hay pruebas técnicas; no se encontró acta UAT firmada por la Comisión. | **En cierre** | Etapa 4 — en cierre. |
| Soporte por tres meses | Compromiso contractual; no existe fecha de inicio documentada. | Programado | Etapa 4 — programado desde la recepción formal. |
| Acta de recepción definitiva | No identificada. | **Pendiente** | Etapa 4 — condición previa a cierre/certificación. |

## Control económico

| Concepto | Porcentaje | Monto correcto |
|---|---:|---:|
| Contrato total | 100 % | $ 27.400.000,00 |
| Etapa 1 aprobada | 30 % | $ 8.220.000,00 |
| Etapa 2 aprobada | 35 % | $ 9.590.000,00 |
| Total aprobado Etapas 1 y 2 | 65 % | $ 17.810.000,00 |
| Etapa 3 sujeta a recepción | 20 % | $ 5.480.000,00 |
| Etapa 4 sujeta a recepción final | 15 % | $ 4.110.000,00 |

La tabla económica de la oferta asigna $ 9.200.000,00, $ 9.200.000,00, $ 6.000.000,00 y $ 3.000.000,00 a las cuatro etapas. Aunque suma $ 27.400.000,00, no coincide con los porcentajes 30/35/20/15. Los informes corregidos usan los montos matemáticamente correctos y ya reconocidos en las Notas y el Acta de Etapas 1 y 2.

### Verificación en SGI al 12/09/2026

| Etapa | Factura emitida | Fecha | Total | Estado visible en SGI |
|---|---|---|---:|---|
| Etapa 1 | Factura B 00002-00000853 | 01/06/2026 | $ 8.220.000,00 | Pendiente; sin fecha de cobro; cancelado $ 0 |
| Etapa 2 | Factura B 00002-00000854 | 01/06/2026 | $ 9.590.000,00 | Pendiente; sin fecha de cobro; cancelado $ 0 |

El prestador informó que ambas facturas ya fueron pagadas. SGI confirma su emisión y la correspondencia exacta con los montos aprobados, pero **no corrobora aún el cobro**: tampoco se localizaron movimientos vinculados o por importes exactos en `libro_bancos`, `libro_cajas` o `flujo_caja`. Por eso los informes externos dicen “aprobada y facturada”, no “pagada”. La conciliación del cobro en SGI es una tarea administrativa separada y no altera el estado contractual de las Etapas 3 y 4.

## Inconsistencias históricas que no se propagan

- Las Notas 1 y 2 nombran al antiguo “Ministerio de Ambiente y Ordenamiento Territorial”; el pliego y el acta aprobatoria identifican al **Ministerio de Energía y Ambiente**.
- La Nota 2 asigna sólo del 27 de febrero al 27 de marzo a un tramo de 45 días. Los nuevos informes usan días contractuales 91–150 y 151–180, sin inventar fechas calendario ante la falta de un Acta de Inicio completa.
- Los Certificados 3 y 4 del 27 de marzo se presentan como 100 % completos pese a estar fechados antes del tramo correspondiente y carecer de firmas/actas de soporte.
- No se usa la cifra “200+ páginas”, “6 videos / 95 minutos”, “100 % de cobertura” ni “garantía iniciada” porque no quedó probada.
- La Nota N.º 03/2026 de adicionales se mantiene separada; no aumenta ni reemplaza los montos del contrato base.

## Condiciones para convertir los informes en certificados de cumplimiento íntegro

1. Implementar y probar exportación XML o documentar aceptación formal de una alternativa equivalente.
2. Publicar y verificar los recursos audiovisuales o ajustar la obligación mediante conformidad expresa.
3. Completar la capacitación comprometida y adjuntar temario, fechas, 20 horas, nómina de al menos diez personas y asistencia.
4. Firmar constancia UAT y acta de transferencia de fuentes, credenciales y documentación.
5. Fijar por acta el inicio y fin del soporte de tres meses, canales y responsables.
6. Obtener el Acta de Recepción Definitiva de la Comisión.

## Conclusión

Las Notas N.º 04/2026 y 05/2026 corregidas son aptas para presentar como **informes de avance transparentes y conciliados**, no como certificados de cumplimiento íntegro. La Etapa 3 tiene un pendiente técnico concreto —XML— y la Etapa 4 requiere evidencias administrativas y operativas de cierre. Esta formulación coincide con el pliego, evita perpetuar inconsistencias de los borradores de marzo y recoge lo pedido por Santiago sin atribuirle valor de modificación contractual.
