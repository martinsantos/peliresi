/** EPRE/provincial distributor catalogue, checked 20/10/2026. No tariff inference. */
export const MENDOZA_DISTRIBUTORS = [
  { id: 'EDEMSA', nombre: 'EDEMSA', pattern: /\bEDEMSA\b|DISTRIBUIDORA DE ELECTRICIDAD DE MENDOZA/ },
  { id: 'EDESTE', nombre: 'EDESTE / EDESTESA', pattern: /\bEDESTESA?\b|\bEDESTE\b|DISTRIBUIDORA DE ELECTRICIDAD DEL ESTE/ },
  { id: 'GODOY_CRUZ', nombre: 'Cooperativa Eléctrica de Godoy Cruz', pattern: /\bCEGC\b|COOPERATIVA[^\n]{0,60}GODOY CRUZ|EMPRESA ELECTRICA DE GODOY CRUZ/ },
  { id: 'ALTO_VERDE', nombre: 'Alto Verde y Algarrobo Grande', pattern: /(?:COOPERATIVA|ELECTRICA)[^\n]{0,60}ALTO VERDE|\bCOOPEALTOVERDE\b/ },
  { id: 'POPULAR_RIVADAVIA', nombre: 'Cooperativa Popular Rivadavia', pattern: /COOP(?:ERATIVA)?\.?[^\n]{0,40}POPULAR[^\n]{0,30}RIVADAVIA|\bCOOPERATIVAPOPULAR\b/ },
  { id: 'CECSAGAL', nombre: 'CECSAGAL / General Alvear', pattern: /\bCECSAGAL\b|COOPERATIVA[^\n]{0,70}GENERAL ALVEAR/ },
  { id: 'MEDRANO', nombre: 'Cooperativa Eléctrica Medrano', pattern: /(?:COOPERATIVA|ELECTRICA)[^\n]{0,50}MEDRANO|\bCELECMEDRANO\b/ },
  { id: 'MONTE_COMAN', nombre: 'Cooperativa Eléctrica Monte Comán', pattern: /(?:COOPERATIVA|ELECTRICA)[^\n]{0,50}MONTE COMAN/ },
  { id: 'BOWEN', nombre: 'COSPAC Bowen', pattern: /\bCOSPAC\b|COOPERATIVA[^\n]{0,60}BOWEN/ },
  { id: 'SANTA_ROSA', nombre: 'Cooperativa Eléctrica Santa Rosa', pattern: /(?:COOPERATIVA|ELECTRICA)[^\n]{0,50}SANTA ROSA/ },
  { id: 'SUD_RIO_TUNUYAN', nombre: 'Cooperativa Sud Río Tunuyán', pattern: /(?:SUD|SUR) RIO TUNUYAN/ },
] as const;

export type ElectricityReading = {
  version: 1;
  distribuidora: string | null;
  nombreDistribuidora: string | null;
  campos: Partial<Record<'categoriaTarifaria' | 'consumoKwh' | 'potenciaContratadaKw' | 'potenciaRegistradaKw' | 'suministro' | 'periodo' | 'nivelSubsidio', string>>;
  evidencias: Array<{ campo: string; texto: string }>;
  conflictos: string[];
  aviso: string;
};
function number(raw: string): string | undefined {
  let value = raw.replace(/\s/g, '');
  if (value.includes(',')) {
    if (!/^\d+(?:\.\d{3})*(?:,\d{1,4})?$/.test(value)) return;
    value = value.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) value = value.replace(/\./g, '');
  return /^\d{1,12}(?:\.\d{1,4})?$/.test(value) ? value : undefined;
}
export function electricityReading(text: string): ElectricityReading {
  const source = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const issuers = MENDOZA_DISTRIBUTORS.filter(distributor => distributor.pattern.test(source));
  const result: ElectricityReading = { version: 1, distribuidora: issuers.length === 1 ? issuers[0].id : null,
    nombreDistribuidora: issuers.length === 1 ? issuers[0].nombre : null, campos: {}, evidencias: [], conflictos: issuers.length > 1 ? ['distribuidora'] : [],
    aviso: 'Lectura para revisar contra el original y el establecimiento. Tarifa, kWh y potencia contratada en kW no equivalen a potencia instalada en HP; no cambian la TEF.' };
  const rules: Array<[keyof ElectricityReading['campos'], RegExp, (value: string) => string | undefined]> = [
    ['categoriaTarifaria', /\b(?:TARIFA|CATEGORIA(?: TARIFARIA)?|ENCASILLAMIENTO)\s*[:=-]?\s*((?:T\s*)?[123]\s*[- .]?\s*(?:R\s*[123]?|NR|G|ES|RBT|B|BT|MT|AT|RE|ALP)(?:\s*[-.]?\s*(?:BT|MT(?:\s*\/\s*BT)?|AT(?:\s*\/\s*MT)?))?|T\s*[123]|T?RA(?:\s*(?:BT|MT))?|TP\s*(?:BT|MT(?:\s*\/\s*BT)?|AT(?:\s*\/\s*MT)?))\b/g, value => value.replace(/[\s.\-]/g, '').replace(/^(?=\d)/, 'T')],
    ['consumoKwh', /\b(?:CONSUMO(?:\s+(?:TOTAL|FACTURADO|DEL PERIODO))?|ENERGIA ACTIVA(?: TOTAL)?)\s*(?:\(\s*KWH\s*\)|KWH)?\s*[:=-]?\s*(\d[\d., ]*)\s*KWH\b/g, number],
    ['consumoKwh', /\bCONSUMO(?:\s+(?:TOTAL|FACTURADO|DEL PERIODO))?\s*\(\s*KWH\s*\)\s*[:=-]?\s*(\d[\d.,]*)/g, number],
    ['consumoKwh', /\bCONSUMO(?:\s+(?:TOTAL|FACTURADO|DEL PERIODO))?\s+KWH\s*[:=-]\s*(\d[\d.,]*)/g, number],
    ['potenciaContratadaKw', /\bPOTENCIA\s+(?:CONTRATADA|CONVENIDA)\s*(?:\(\s*KW\s*\))?\s*[:=-]?\s*(\d[\d., ]*)\s*KW\b/g, number],
    ['potenciaRegistradaKw', /\bPOTENCIA\s+(?:REGISTRADA|MAXIMA REGISTRADA|MEDIDA)\s*(?:\(\s*KW\s*\))?\s*[:=-]?\s*(\d[\d., ]*)\s*KW\b/g, number],
    ['potenciaContratadaKw', /\bPOTENCIA\s+(?:CONTRATADA|CONVENIDA)\s*\(\s*KW\s*\)\s*[:=-]?\s*(\d[\d.,]*)/g, number],
    ['potenciaRegistradaKw', /\bPOTENCIA\s+(?:REGISTRADA|MAXIMA REGISTRADA|MEDIDA)\s*\(\s*KW\s*\)\s*[:=-]?\s*(\d[\d.,]*)/g, number],
    ['suministro', /\b(?:NIC|NIS|N[°º.]?\s*(?:DE\s*)?(?:SUMINISTRO|USUARIO)|SUMINISTRO)\s*[:=-]?\s*([0-9][0-9 .-]{3,25})\b/g, value => value.trim().replace(/[ .-]/g, '')],
    ['periodo', /\bPERIODO(?:\s+(?:FACTURADO|DE CONSUMO))?\s*[:=-]?\s*(\d{2,4}[/-]\d{2,4}(?:[/-]\d{2,4})?(?:\s+(?:AL|A|HASTA)\s+\d{2,4}[/-]\d{2,4}(?:[/-]\d{2,4})?)?)/g, value => value.trim()],
    ['nivelSubsidio', /\bNIVEL(?:\s+DE\s+(?:SUBSIDIO|INGRESOS))?\s*[:=-]?\s*([123])\b/g, value => 'N' + value],
    ['nivelSubsidio', /\b((?:CON|SIN)\s+SEF)\b/g, value => value.replace(/\s+/g, ' ')],
  ];
  const candidates = new Map<string, Set<string>>();
  for (const [field, expression, convert] of rules) for (const match of source.matchAll(expression)) {
    const value = convert(match[1]); if (!value) continue;
    const values = candidates.get(field) || new Set<string>(); values.add(value); candidates.set(field, values);
    result.evidencias.push({ campo: field, texto: match[0].trim().slice(0, 180) });
  }
  for (const [field, values] of candidates) {
    if (values.size === 1) result.campos[field as keyof ElectricityReading['campos']] = [...values][0];
    else result.conflictos.push(field);
  }
  return result;
}
