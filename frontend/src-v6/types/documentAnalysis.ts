export interface ReceiptAnalysis {
  version: 1;
  duplicado: boolean;
  lectura: 'LEIDO' | 'SIN_TEXTO' | 'NO_DISPONIBLE';
  motor: 'PDF_TEXT' | 'TESSERACT' | null;
  texto: string;
  alcance: string;
  aviso: string | null;
  documentKind?: 'LICENCIA' | 'FACTURA_ELECTRICA' | 'ARCA';
  arca?: { cuit: string | null; razonSocial: string | null };
  electricidad?: ElectricityReading;
  pago?: { propuesta?: { campos: Partial<PaymentIdentity>; conflictos: string[] }; revision: 'PENDIENTE' | 'CONFIRMADO'; coincidencia: boolean;
    registroId?: string; identidad?: PaymentIdentity; sha256?: string };
}

export interface PaymentIdentity {
  emisor: 'ATM_TASAS'; idComprobante: string; transaccion: string; control: string; cuit: string; codigoTasa: string;
  fechaPago: string; importe: string; periodo: string; referenciaLiquidacion: string;
}
export type ConfirmPaymentInput = PaymentIdentity & { originalRevisado: true; expectedSha256: string };
export interface ElectricityReading {
  version: 1; distribuidora: string | null; nombreDistribuidora: string | null;
  campos: Partial<Record<'categoriaTarifaria' | 'consumoKwh' | 'potenciaContratadaKw' | 'potenciaRegistradaKw' | 'suministro' | 'periodo' | 'nivelSubsidio', string>>;
  evidencias: Array<{ campo: string; texto: string }>; conflictos: string[]; aviso: string;
}
