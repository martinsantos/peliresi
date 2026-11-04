# TEF: conciliación fiscal y retiro del cálculo heredado · 26/10/2026

Sólo análisis y producto en preview. No es una liquidación ni una nueva regla fiscal.

**Estado actual:** el segundo corte retira el importe automático y el desglose fiscal heredados; conserva la declaración y muestra «Importe pendiente de liquidación». Las secciones del primer corte documentan el antecedente y no describen la interfaz actual.

## Primer corte: advertencia de simulación (sustituido)

El contenedor administrativo advertía que fórmula y parámetros estaban pendientes de conciliación, pero la calculadora compartida presentaba su resultado como Tasa de Evaluación y Fiscalización, atribuía M=162 a la autoridad para 2026 y describía el factor ISO ×2 como un incentivo. Además remitía a un Paso 5 y un Paso 3 que no existen en todas sus pantallas. La cabecera de la versión en tarjeta repetía el importe.

En el primer corte el resultado se identificó como simulación junto al importe en todas sus superficies. M e ISO se describen como valores configurados y sujetos a verificación; las instrucciones remiten a la declaración del establecimiento sin inventar pasos. Se conserva la fórmula, los coeficientes, los callbacks y las entradas, sin modificar datos ni decisiones.

## Fuentes consultadas y límite del primer corte

- [Índice oficial de leyes impositivas de ATM](https://atm.mendoza.gov.ar/normativas/ley-impositiva/): distingue la ley 2026 y su anexo de tasas.
- [Ley Impositiva 2026, 9680](https://atm.mendoza.gov.ar/wp-content/uploads/2025/12/Ley-Impositiva-2026.pdf): documento principal leído; no contiene por sí solo el detalle TEF buscado.
- [Tasas retributivas 2026, enlace de ATM](https://atm.mendoza.gov.ar/wp-content/uploads/2025/12/Tasas-Retributivas.pdf): el lector web rechazó el archivo de 44.809.931 bytes por tamaño. Este corte no atribuye lectura íntegra ni validación del anexo.
- [Decreto 2625/1999, repositorio oficial de legislación sanitaria](https://e-legis-ar.msal.gov.ar/htdocs/legisalud/migration/pdf/10440.pdf): referencia histórica; no se considera prueba suficiente de importes vigentes.

## Pendiente concreto para cerrar la regla fiscal

Conciliar sobre el anexo oficial completo y sus modificaciones: período aplicable, M, composición de R, tratamiento ISO, mínimos y diferencias entre generador, operador y transporte. Contrastar al menos una liquidación artificial de referencia por caso con el criterio de la autoridad. Versionar una eventual regla por período; no recalcular registros históricos ni inferir una obligación a partir de una factura eléctrica.

El OCR eléctrico conserva tarifa, consumo y potencia contratada como evidencia. Esos datos no reemplazan la potencia instalada en HP declarada. La reserva de identidad ATM y la revisión de un comprobante siguen separadas de una liquidación TEF. La documentación previa y sus límites están en CONTROL-COMPROBANTES-ATM-Y-FACTURAS-20261020.md.


## Contraste directo del anexo publicado por ATM · segundo corte

Se descargó el PDF completo desde el enlace del índice oficial 2026. 97 páginas; 44.809.931 bytes; SHA-256 `6aed6725743599867917e62848fbd0ee1ff2a3ac9b5fbb9a97db6dbd8f0212b2`. Extracción y render en QA remoto limitado; inspección visual de páginas 14–15, artículo 19, documento registrado bajo Ley 9680. No se usa el proyecto legislativo como norma aprobada.

La extracción de texto del PDF contiene errores: lee M como 107 y el tramo alto como 540.000. Las imágenes originales muestran **162** y **640.000**. Esto refuerza la revisión contra original; no se importó el OCR a parámetros fiscales.

| Punto | Código heredado | Anexo consultado, páginas 14–15 |
|---|---|---|
| Riesgo R | Z × A × D × C | (Z + A) × C × D |
| M | 162 | 162 |
| Importe | M × R × ISO para todos | TEF=M×R; además establece tramos para generadores y valores específicos para operadores |
| ISO | multiplica por 2 si declarado | El artículo consultado no fundamenta ese multiplicador; no se afirma que no exista regulación complementaria |
| C | mayor coeficiente de corrientes Y | Describe características del tipo de empresa; requiere conciliar tabla reglamentaria |

El artículo enumera inscripción/renovación por separado de TEF anual: generador/NFU 26.600, operador fijo 170.500, operador in situ 58.500; TEF operador fijo 2.000.000 e in situ 1.500.000. Los tramos de generador visibles son R≤600:52.000; hasta1.000:145.000; hasta2.000 o alta de oficio:255.000; hasta3.000:413.000; hasta4.000:640.000; hasta6.000:878.000. Se registra lo leído como evidencia del anexo, **no como liquidación vigente aplicable automáticamente a un caso**. La redacción de límites usa «o»; su interpretación operativa, R>6.000, modificaciones y condiciones especiales requieren conciliación. No se extrapola una tasa para transportistas.

## Corrección de producto y límite restante

Una advertencia de «simulación» junto a un importe calculado con una fórmula divergente no es suficiente. Se retira el importe y el desglose fiscal de todas las instancias del componente administrativo, junto con el multiplicador ISO de la ficha de generador. Se conservan las entradas de la declaración y su recuperación. La pantalla indica Importe pendiente de liquidación y remite a la normativa oficial. El contrato del componente ya no expone resultados fiscales; el paso público legado tampoco exporta factorR ni montoMxR. El alta pública actual ya recoge únicamente magnitudes.

La utilidad de cálculo heredada permanece para trazabilidad del código, sin llamadas productivas desde la UI; no se reemplaza por una regla fiscal improvisada ni se recalculan datos históricos. Queda pendiente versionar la regla validada por período/actor, sus coeficientes, casos de referencia y excepciones. La reserva ATM, el estado fiscal registrado y las decisiones de alta no se alteran.

Evidencias externas al repositorio: uiux-onboarding-recheck-20261025/tef-official-20261026/{tasas-retributivas-2026.pdf,source.json,page-14.png,page-15.png}. La descarga local no ejecutó QA pesada; extracción y render se hicieron en el contenedor remoto existente.
