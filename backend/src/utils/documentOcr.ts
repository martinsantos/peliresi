import { normalizeDocumentIdentifier } from './documentNormalization';

export interface OcrFieldSuggestion {
  key: string;
  label: string;
  value: string;
  confidence: number;
}

export interface StructuredOcrData {
  texto: string;
  idioma: string;
  motor: string;
  tipoDetectado: string;
  campos: OcrFieldSuggestion[];
  revision: 'PENDIENTE_CONFIRMACION';
}

const cleanText = (value: string) => value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
const upper = (value: string) => cleanText(value).toUpperCase();

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return '';
}

function addField(fields: OcrFieldSuggestion[], key: string, label: string, value: string, confidence: number) {
  const normalized = cleanText(value);
  if (!normalized || fields.some((field) => field.key === key)) return;
  fields.push({ key, label, value: normalized, confidence });
}

export function extractDocumentOcrFields(tipo: string, rawText: string): OcrFieldSuggestion[] {
  const text = upper(rawText);
  const fields: OcrFieldSuggestion[] = [];

  if (tipo === 'LICENCIA_CONDUCIR' || /LICENCIA\s+(?:NACIONAL\s+DE\s+)?CONDUCIR/.test(text)) {
    addField(fields, 'apellido', 'Apellido', firstMatch(text, [/(?:APELLIDO|SURNAME)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ ]{2,})/]), 88);
    addField(fields, 'nombre', 'Nombre', firstMatch(text, [/(?:NOMBRE|GIVEN\s+NAMES?)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ ]{2,})/]), 88);
    addField(fields, 'dni', 'DNI', firstMatch(text, [/(?:DNI|DOCUMENTO|DOCUMENT)\s*(?:N[°O]|NUMERO|NUMBER)?\s*[:\-]?\s*([0-9.\-]{7,12})/]), 92);
    addField(fields, 'licencia', 'Número de licencia', firstMatch(text, [/(?:LICENCIA|LICENSE)\s*(?:N[°ºO']|NUMERO|NUMBER)\s*[:\-]?\s*([A-Z0-9\-]{5,})/]), 82);
    addField(fields, 'clase', 'Clase', firstMatch(text, [/(?:CLASE|CLASS)\s*[:\-]?\s*([A-Z0-9+]{1,8})/]), 84);
    addField(fields, 'vencimiento', 'Vencimiento', firstMatch(text, [/(?:VENCIMIENTO|VALIDEZ|EXPIRY|EXP)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/]), 86);
  }

  if (tipo === 'TARJETA_IDENTIFICACION_VEHICULO' || /CEDULA\s+(?:AZUL|DE\s+AUTORIZADO)|TARJETA\s+DE\s+IDENTIFICACION/.test(text)) {
    addField(fields, 'patente', 'Dominio / patente', firstMatch(text, [/(?:DOMINIO|PATENTE|PLACA|PLATE)\s*[:\-]?\s*([A-Z0-9\-]{5,8})/]), 92);
    addField(fields, 'titular', 'Titular', firstMatch(text, [/(?:TITULAR|AUTHORIZED\s+DRIVER|AUTORIZADO)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ0-9 .,'-]{3,})/]), 84);
    addField(fields, 'dni', 'DNI / CUIT', firstMatch(text, [/(?:DNI|CUIT|DOCUMENTO)\s*[:\-]?\s*([0-9.\-]{7,13})/]), 88);
    addField(fields, 'marca', 'Marca', firstMatch(text, [/(?:MARCA|MAKE)\s*[:\-]?\s*([A-Z0-9 .'-]{2,})/]), 82);
    addField(fields, 'modelo', 'Modelo', firstMatch(text, [/(?:MODELO|MODEL)\s*[:\-]?\s*([A-Z0-9 .'-]{2,})/]), 82);
    addField(fields, 'vencimiento', 'Vencimiento', firstMatch(text, [/(?:VENCIMIENTO|VALIDEZ|EXPIRY|EXP)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/]), 84);
  }

  if (fields.length === 0) {
    addField(fields, 'numero', 'Número / identificador', firstMatch(text, [/(?:N[°O]|NUMERO|NUMBER|EXPEDIENTE|RESOLUCION)\s*[:\-]?\s*([A-Z0-9\/-]{4,})/]), 70);
    addField(fields, 'vencimiento', 'Vencimiento', firstMatch(text, [/(?:VENCIMIENTO|VALIDEZ|EXPIRY|EXP)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/]), 76);
  }
  return fields.map((field) => field.key === 'dni' || field.key === 'patente' || field.key === 'licencia'
    ? { ...field, value: normalizeDocumentIdentifier(field.value) }
    : field);
}

export function buildStructuredOcrData(input: { tipo: string; text: string; language: string; engine: string }): StructuredOcrData {
  const normalized = cleanText(input.text).slice(0, 20_000);
  const text = upper(normalized);
  const tipoDetectado = /LICENCIA\s+(?:NACIONAL\s+DE\s+)?CONDUCIR/.test(text)
    ? 'LICENCIA_CONDUCIR'
    : /CEDULA\s+(?:AZUL|DE\s+AUTORIZADO)|TARJETA\s+DE\s+IDENTIFICACION/.test(text)
      ? 'TARJETA_IDENTIFICACION_VEHICULO'
      : input.tipo;
  return {
    texto: normalized,
    idioma: input.language,
    motor: input.engine,
    tipoDetectado,
    campos: extractDocumentOcrFields(tipoDetectado, normalized),
    revision: 'PENDIENTE_CONFIRMACION',
  };
}
