# Inventario de formulas y calculos SITREP

Fecha de corte: 2026-08-10
Entorno de referencia: `sitrep.ultimamilla.com.ar`
Alcance: formularios web, PWA `/app`, API, reportes, analitica, monitoreo, GPS y documentacion.

## Veredicto ejecutivo

El error del estimador TEF puede repetirse en otros sectores del sistema porque varios calculos de negocio estan duplicados, carecen de una unidad canonica o mezclan agregados globales con datos paginados. El inventario localizo 28 familias de calculo. Diez requieren validacion o correccion antes de usarse como dato regulatorio o indicador oficial.

No se modificaron datos ni se desplegaron cambios durante este inventario.

## Estado de remediacion local

Aplicado y testeado despues del inventario:

- contrato canonico para `kg`, `tn`, `lt` y `un`, con aliases y separacion de dimensiones;
- validacion compartida de alta/edicion y pesaje completo de cantidades masicas;
- agregados globales y normalizados en reportes, analitica, actores, monitor y centro de control;
- correccion de `Entrega -> Recepcion`, tasas numericas y ranking de masa;
- detector GPS incremental con Haversine centralizado;
- retiro de la ETA ficticia;
- MxR separado del importe TEF oficial, sin inventar efecto ISO, y manual actualizado.

Pendiente externo: DGFA debe homologar categoria, vigencia anual de M y efecto monetario de ISO antes de implementar una liquidacion TEF oficial. No se ejecuto migracion destructiva de unidades historicas ni despliegue productivo.

## Escala

- `CRITICO`: puede producir un importe regulatorio o una magnitud fisica incorrecta.
- `ALTO`: puede alterar decisiones operativas, alertas o indicadores importantes.
- `MEDIO`: inconsistencia semantica, de precision o de presentacion.
- `BAJO`: calculo visual/operativo sin impacto directo sobre el dato de negocio.
- `OK`: formula coherente en codigo, pendiente solo de la validacion normal de regresion.

## Matriz completa

| ID | Dominio | Formula o transformacion | Ubicacion principal | Estado | Hallazgo / accion requerida |
|---|---|---|---|---|---|
| F-01 | TEF | `D = 0.15 x (personal + HP) + 0.005 x superficie` | `frontend/src-v6/utils/calculoTEF.ts` | MEDIO | Implementacion determinista. Confirmar oficialmente coeficientes y unidades de HP/m2. |
| F-02 | TEF | `A = suma(A1..A10)` | `calculoTEF.ts` | MEDIO | Suma correcta; las etiquetas/opciones regulatorias deben ser aprobadas por DGFA. |
| F-03 | TEF | `C = max(coeficiente de corrientes Y)` | `calculoTEF.ts` | ALTO | Normaliza mayusculas. No hay coeficiente configurado para Y1-Y3 ni Y46-Y47; hoy producen cero y anulan la tasa. |
| F-04 | TEF | `R = Z x A x D x C` | `calculoTEF.ts` | MEDIO | Coherente con la documentacion local; requiere homologacion regulatoria. |
| F-05 | TEF | `MxR = 162 x R` | `calculoTEF.ts`, `StepTEF.tsx` | ALTO | El resultado se etiqueta y persiste tambien como TEF final. El coeficiente anual `M=162` esta hardcodeado y no versionado por periodo. |
| F-06 | TEF | Factor ISO y categoria para importe final | `isoFactor()` y formularios de generador | CRITICO | Codigo usa `ISO=2` cuando hay certificado. El padron historico muestra como patron frecuente importe final certificado igual a `MxR x 0.5`. Ademas las categorias de importe no se aplican al calculo final. Requiere resolucion DGFA antes de cobrar/informar. |
| F-07 | TEF | Persistencia de calculo | `StepTEF.tsx`, `NuevoGeneradorPage.tsx`, solicitudes | ALTO | La inscripcion publica guarda snapshot automatico; el wizard admin muestra calculadora pero mantiene `factorR` y `montoMxR` manuales separados, que pueden divergir. |
| F-08 | TEF | Categoria individual | `StepEmpresa.tsx`, `NuevoGeneradorPage.tsx` | ALTO | UI solo ofrece `MINIMA`, `INDIVIDUAL`, `2000-3000`; el padron contiene tambien 600-1000, 1000-2000, 3000-4000, 4000-6000, EXENTO y otras variantes. |
| F-09 | Manifiestos | Suma de cantidades | `sumQuantities`, detalles y viaje | ALTO | Se corrigio concatenacion de strings, pero se siguen sumando magnitudes de unidades distintas. |
| F-10 | Manifiestos | Normalizacion de unidad | alta/edicion, controller, Prisma | CRITICO | La UI admite `kg`, `tn`, `lt`, `un`; API acepta cualquier string. No existe conversion canonica. Produccion ya contiene `kg`, `KG` y `lt`. |
| F-11 | Manifiestos | Validacion numerica al crear | `manifiesto.controller.ts` | MEDIO | Create exige cantidad positiva, pero `unidad` es texto libre. |
| F-12 | Manifiestos | Validacion numerica al editar | `updateManifiesto` | ALTO | Update no reutiliza el esquema de create; una llamada directa puede enviar negativos, NaN serializable/strings o unidades desconocidas. |
| F-13 | Pesaje | `diferencia % = (real - declarado) / declarado x 100` | `manifiesto-workflow.controller.ts` | CRITICO | Acepta subconjuntos, duplicados, negativos/no finitos y mezcla unidades. La alerta `>5%` puede calcularse sobre una parte de la carga. |
| F-14 | Reporte manifiestos | Total residuos del periodo | `reporte.controller.ts` | CRITICO | Suma todas las unidades y la UI lo rotula `kg`. |
| F-15 | Reporte manifiestos | Distribucion por tipo | `reporte.controller.ts` | ALTO | Se calcula solo sobre la pagina actual, mientras total y estados son globales. El grafico cambia al paginar sin indicarlo. |
| F-16 | Reporte tratados | Total y distribuciones | `reporteTratados` | CRITICO | Cantidad de manifiestos es global; kilos, generadores y tipos provienen solo de la pagina y mezclan unidades. |
| F-17 | Reporte transporte | Completitud | `reporteTransporte`, `TransporteTab.tsx` | ALTO | Solo pagina actual. Considera completos `RECIBIDO` y `TRATADO`, pero no `EN_TRATAMIENTO`; retorna porcentaje como string y la UI lo parsea de nuevo. |
| F-18 | Dashboard | Cumplimiento | `DashboardPage.tsx`, `EstadisticasPage.tsx` | MEDIO | Ambos usan `TRATADO/total`, pero con precision distinta. En transporte, "completitud" usa otra definicion. |
| F-19 | Dashboard | "Residuos tratados" | `EstadisticasPage.tsx` | ALTO | Presenta cantidad de manifiestos tratados como si fuese una cantidad de residuos. |
| F-20 | Analitica | Tiempo promedio por etapa | `analytics.controller.ts` | ALTO | `Entrega -> Recepcion` resta `fechaRecepcion - fechaRecepcion`; siempre da cero. Solo usa los ultimos 200 tratados y no lo declara como muestra. |
| F-21 | Centro de control | Toneladas del periodo | `tracking.controller.ts` | CRITICO | Filtra `kg` y `toneladas`, pero UI produce `tn`; luego divide toda la suma por 1000, incluso eventuales filas ya expresadas en toneladas. |
| F-22 | Monitor | Toneladas totales / top residuos | `monitor.controller.ts` | CRITICO | Suma `cantidad` sin filtrar ni convertir unidades y la presenta como toneladas/volumen. |
| F-23 | GPS | Distancia Haversine | `utils/geo.ts`, duplicada en `notification.controller.ts` | MEDIO | Formula estandar coherente, pero esta duplicada y sin pruebas unitarias especificas. |
| F-24 | GPS | Velocidad inferida `distancia/tiempo` | `notification.controller.ts` | ALTO | Umbral real es 120 km/h, pero la anomalia guarda esperado 100. El reproceso historico puede duplicar alertas. |
| F-25 | GPS | Parada y perdida de señal | `notification.controller.ts` | ALTO | Parada: `<0.1 km y >2 h`; perdida: `>30 min y >10 km`. Un gap estacionario no se clasifica como perdida. Umbrales deben parametrizarse/documentarse. |
| F-26 | GPS | Tiempo excesivo y desvio | `manifiesto-gps.controller.ts`, `utils/geo.ts` | ALTO | Tiempo usa reloj corrido >24 h. Desvio usa >50 km de un segmento recto, no corredor vial; es una aproximacion operacional. |
| F-27 | Viaje | Cronometro y ETA | `ViajeEnCursoTransportista.tsx`, `manifiesto-query.controller.ts` | ALTO | El cronometro puede reincorporar pausas al remontar. `etaEstimado` no calcula ETA: devuelve el texto `Calculando...`. |
| F-28 | Soporte UI | Paginacion, progreso, tamanos y porcentajes visuales | varias paginas/componentes | BAJO | Calculos de pagina, KB, barras y reproduccion no muestran fallas de negocio; mantener tests de limites y division por cero. |

## Evidencia de datos

La inspeccion agregada, sin exponer registros personales, encontro en el entorno SITREP:

| Unidad persistida | Filas | Cantidad cruda acumulada |
|---|---:|---:|
| `kg` | 266 | 200015 |
| `KG` | 6 | 550 |
| `lt` | 1 | 55 |

Esto confirma que la normalizacion de unidades no es un riesgo teorico.

En el padron historico de generadores se observaron 1.408 casos comparables de `R`/`MxR`; 1.157 cumplen `MxR = R x 162`. Los importes finales mas frecuentes forman escalas por categoria y los casos certificados revisados muestran habitualmente una reduccion a la mitad. Esta evidencia sirve para detectar la divergencia, pero la formula oficial final debe ser confirmada y versionada por DGFA.

## Cobertura automatizada existente

Ejecucion focalizada del inventario: frontend `44/44` y backend `45/45` en verde. Este resultado confirma que no se rompieron los comportamientos actualmente testeados; no valida las reglas regulatorias ni cubre las brechas enumeradas abajo.

| Area | Cobertura actual | Brecha |
|---|---|---|
| TEF | 4 unit tests: normalizacion Y, maximo C, Y sin coeficiente y caso determinista | No prueba categoria final, vigencia de M, certificacion contra padron ni casos limite. |
| Suma UI | 2 unit tests de `sumQuantities` | No prueba conversion/compatibilidad de unidades. |
| Reportes | Pruebas de forma y smoke | No prueban agregados globales vs paginados ni unidades. |
| Pesaje | Smoke/workflow y autorizacion | No prueba parciales, duplicados, negativos, NaN, mezcla de unidades ni umbral 5%. |
| Analitica | Sin prueba de formula por etapas | No detecta la resta de la misma fecha. |
| GPS | Smoke de alertas | Sin unit tests de Haversine, limites, deduplicacion o timestamps. |

## Plan de correccion recomendado

### Fase 1 — contrato de magnitudes

1. Definir unidades canonicas por tipo de residuo y prohibir sumas entre dimensiones incompatibles.
2. Normalizar aliases (`KG` -> `kg`, `toneladas` -> `tn`) en una migracion auditada.
3. Compartir un unico esquema Zod entre create, update, pesaje y cargas masivas.
4. Conservar cantidad y unidad originales, mas una cantidad normalizada cuando la conversion sea valida.

### Fase 2 — motor TEF versionado

1. Obtener de DGFA la tabla oficial por categoria, factor de certificacion y vigencia anual de `M`.
2. Implementar un motor puro en backend con `formulaVersion`, fecha de vigencia, inputs y desglose.
3. Hacer que web y PWA consuman el mismo resultado del backend; eliminar campos manuales divergentes.
4. Comparar masivamente contra el padron antes de activar el resultado como importe oficial.

### Fase 3 — agregados coherentes

1. Mover distribuciones de reportes a agregaciones globales filtradas, no a la pagina actual.
2. Devolver numeros y unidades estructurados; formatear `%`, `kg` y `tn` solo en UI.
3. Nombrar y documentar cada KPI: universo, periodo, estados incluidos y unidad.
4. Corregir `Entrega -> Recepcion` y declarar/retirar el limite de 200 registros.

### Fase 4 — pesaje y GPS

1. Exigir todos los residuos o declarar explicitamente pesaje parcial, con unidad por item.
2. Validar finitos, no negativos, IDs unicos y pertenencia al manifiesto antes de transaccion.
3. Centralizar Haversine/umbrales, deduplicar alertas y parametrizar reglas.
4. Separar duracion corrida de duracion efectiva y no presentar ETA hasta calcularla realmente.

### Fase 5 — certificacion

Agregar tests de tabla para cada formula, fixtures con unidades mixtas, comparacion contra padron anonimizado, tests de paginacion y E2E web/PWA que verifiquen el mismo resultado para los mismos inputs.

## Criterio de salida

No usar como cifra oficial hasta resolver F-06, F-10, F-13, F-14, F-16, F-21 y F-22. El resto puede corregirse en paralelo, pero debe entrar en la misma suite de regresion para evitar que web, PWA, API y reportes vuelvan a divergir.
