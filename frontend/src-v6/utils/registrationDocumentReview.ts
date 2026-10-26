import type { DocumentoSolicitud } from '../types/api';

/** Storage and OCR never imply an administrative approval. Unknown legacy states stay explicit. */
export function registrationDocumentReviewLabel(state: DocumentoSolicitud['estado'] | undefined): string {
  if (state === 'APROBADO') return 'Documento aprobado';
  if (state === 'RECHAZADO') return 'Documento rechazado';
  if (state === 'PENDIENTE') return 'Pendiente de revisión';
  return 'Revisión sin confirmar';
}
