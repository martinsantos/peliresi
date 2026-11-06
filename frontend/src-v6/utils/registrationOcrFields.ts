import type { ReceiptAnalysis } from '../types/documentAnalysis';

export type ReadingKind = 'receipt' | 'license' | 'document' | 'electricity' | 'arca';
export type Field = [string, string | undefined | null];

export function registrationOcrFields(kind: ReadingKind, analysis: ReceiptAnalysis): Field[] {
  if (kind === 'arca') return [['CUIT', analysis.arca?.cuit], ['Razón social', analysis.arca?.razonSocial]];
  if (kind === 'receipt') {
    const p = analysis.pago?.propuesta?.campos;
    return [['ID comprobante', p?.idComprobante], ['CUIT', p?.cuit], ['Código de tasa', p?.codigoTasa],
      ['Fecha de pago', p?.fechaPago], ['Importe', p?.importe], ['Período', p?.periodo], ['Referencia de liquidación', p?.referenciaLiquidacion]];
  }
  if (kind === 'electricity') {
    const e = analysis.electricidad;
    return [['Distribuidora', e?.nombreDistribuidora], ['Categoría tarifaria', e?.campos.categoriaTarifaria],
      ['Consumo facturado', e?.campos.consumoKwh], ...(e?.distribuidora === 'EDESTE' ? [['Ruta y folio', e.campos.suministro] as Field] : [])];
  }
  return [];
}
