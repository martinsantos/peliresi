export interface ReceiptAnalysis {
  version: 1;
  duplicado: boolean;
  lectura: 'LEIDO' | 'SIN_TEXTO' | 'NO_DISPONIBLE';
  motor: 'PDF_TEXT' | 'TESSERACT' | null;
  texto: string;
  alcance: string;
  aviso: string | null;
}
