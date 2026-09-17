export interface OcrFieldSuggestion {
  key: string;
  label: string;
  value: string;
  confidence: number;
}

const clean = (value: string) => value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
const upper = (value: string) => clean(value).toUpperCase();

function first(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1];
    if (value) return clean(value);
  }
  return '';
}

function add(fields: OcrFieldSuggestion[], key: string, label: string, value: string, confidence: number) {
  if (value && !fields.some(field => field.key === key)) fields.push({ key, label, value: clean(value), confidence });
}

export function extractLocalOcrFields(tipo: string, rawText: string): OcrFieldSuggestion[] {
  const text = upper(rawText);
  const fields: OcrFieldSuggestion[] = [];
  if (tipo === 'LICENCIA_CONDUCIR' || /LICENCIA\s+(?:NACIONAL\s+DE\s+)?CONDUCIR/.test(text)) {
    add(fields, 'apellido', 'Apellido', first(text, [/(?:APELLIDO|SURNAME)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ ]{2,})/]), 88);
    add(fields, 'nombre', 'Nombre', first(text, [/(?:NOMBRE|GIVEN\s+NAMES?)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ ]{2,})/]), 88);
    add(fields, 'dni', 'DNI', first(text, [/(?:DNI|DOCUMENTO|DOCUMENT)\s*(?:N[°O]|NUMERO|NUMBER)?\s*[:\-]?\s*([0-9.\-]{7,12})/]), 92);
    add(fields, 'licencia', 'Número de licencia', first(text, [/(?:LICENCIA|LICENSE)\s*(?:N[°ºO']|NUMERO|NUMBER)\s*[:\-]?\s*([A-Z0-9\-]{5,})/]), 82);
    add(fields, 'clase', 'Clase', first(text, [/(?:CLASE|CLASS)\s*[:\-]?\s*([A-Z0-9+]{1,8})/]), 84);
    add(fields, 'vencimiento', 'Vencimiento', first(text, [/(?:VENCIMIENTO|VALIDEZ|EXPIRY|EXP)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/]), 86);
  }
  if (tipo === 'TARJETA_IDENTIFICACION_VEHICULO' || /CEDULA\s+(?:AZUL|DE\s+AUTORIZADO)|TARJETA\s+DE\s+IDENTIFICACION/.test(text)) {
    add(fields, 'patente', 'Dominio / patente', first(text, [/(?:DOMINIO|PATENTE|PLACA|PLATE)\s*[:\-]?\s*([A-Z0-9\-]{5,8})/]), 92);
    add(fields, 'titular', 'Titular', first(text, [/(?:TITULAR|AUTHORIZED\s+DRIVER|AUTORIZADO)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ0-9 .,'-]{3,})/]), 84);
    add(fields, 'dni', 'DNI / CUIT', first(text, [/(?:DNI|CUIT|DOCUMENTO)\s*[:\-]?\s*([0-9.\-]{7,13})/]), 88);
    add(fields, 'marca', 'Marca', first(text, [/(?:MARCA|MAKE)\s*[:\-]?\s*([A-Z0-9 .'-]{2,})/]), 82);
    add(fields, 'modelo', 'Modelo', first(text, [/(?:MODELO|MODEL)\s*[:\-]?\s*([A-Z0-9 .'-]{2,})/]), 82);
    add(fields, 'vencimiento', 'Vencimiento', first(text, [/(?:VENCIMIENTO|VALIDEZ|EXPIRY|EXP)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/]), 84);
  }
  if (fields.length === 0) {
    add(fields, 'numero', 'Número / identificador', first(text, [/(?:N[°O]|NUMERO|NUMBER|EXPEDIENTE|RESOLUCION)\s*[:\-]?\s*([A-Z0-9\/-]{4,})/]), 70);
    add(fields, 'vencimiento', 'Vencimiento', first(text, [/(?:VENCIMIENTO|VALIDEZ|EXPIRY|EXP)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/]), 76);
  }
  return fields.map(field => ['dni', 'patente', 'licencia'].includes(field.key)
    ? { ...field, value: field.value.replace(/[^A-Z0-9]/gi, '') }
    : field);
}

export function detectedDocumentType(tipo: string, rawText: string): string {
  const text = upper(rawText);
  if (/LICENCIA\s+(?:NACIONAL\s+DE\s+)?CONDUCIR/.test(text)) return 'LICENCIA_CONDUCIR';
  if (/CEDULA\s+(?:AZUL|DE\s+AUTORIZADO)|TARJETA\s+DE\s+IDENTIFICACION/.test(text)) return 'TARJETA_IDENTIFICACION_VEHICULO';
  return tipo;
}
