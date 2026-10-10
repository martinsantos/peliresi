import api from './api';
import type { ReceiptAnalysis } from '../types/documentAnalysis';
import type { DriverDraft } from './registrationFleet';
export type LicensePreview = { analisis: ReceiptAnalysis; campos: Partial<Pick<DriverDraft, 'nombre' | 'apellido' | 'dni' | 'licencia' | 'vencimiento'>>; persistido: boolean };
export async function previewDocument(file: File, tipo: 'LICENCIA' | 'DOCUMENTO'): Promise<LicensePreview> {
  if (!file.size || file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error('Elegí un PDF, JPG o PNG de hasta 10 MB.');
  const body = new FormData(); body.append('file', file); body.append('tipo', tipo);
  const { data } = await api.post('/solicitudes/analizar-documento', body, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 25_000 });
  return data.data;
}
