import type { ReceiptAnalysis } from '../types/documentAnalysis';

export function electricityReadingNeedsReview(analysis: ReceiptAnalysis): boolean {
  const reading = analysis.electricidad;
  return !reading?.campos.categoriaTarifaria || !reading.campos.consumoKwh || !reading.distribuidora ||
    reading.distribuidora === 'EDESTE' && !reading.campos.suministro ||
    reading.conflictos.length > 0 || Boolean(analysis.aviso);
}

/** Describes the returned reading, never document approval or payment settlement. */
export function documentReadingOutcome(analysis?: ReceiptAnalysis | null): string {
  if (!analysis || analysis.version !== 1 || analysis.lectura === 'NO_DISPONIBLE') {
    return 'No se pudo completar la lectura automática. Podés reintentar o revisar el original.';
  }
  if (analysis.lectura === 'SIN_TEXTO' || !analysis.texto.trim()) {
    return 'Lectura terminada sin texto legible. Revisá el original o adjuntá una copia más clara.';
  }
  if (analysis.documentKind === 'FACTURA_ELECTRICA' && electricityReadingNeedsReview(analysis)) {
    return 'Lectura terminada con datos por revisar. Consultá los campos pendientes o en conflicto debajo.';
  }
  if (analysis.aviso) return 'Lectura terminada con observaciones. Revisá el aviso y el original.';
  return 'Lectura terminada. Revisá los datos extraídos; el documento no se aprobó con esta lectura.';
}
