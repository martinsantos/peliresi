import { createHash } from 'crypto';
import { AddendumReview } from './manifiestoAdenda';
export type DocumentaryCounts = { total: number; pendientes: number; observadas: number; rechazadas: number };
export function documentaryStatus(counts: DocumentaryCounts) {
  if (!counts.total) return 'SIN_ADENDAS';
  if (counts.rechazadas) return 'RECHAZADA';
  if (counts.observadas) return 'OBSERVADA';
  if (counts.pendientes) return 'PENDIENTE';
  return 'ADENDAS_REVISADAS';
}
type Record = { id: string; manifiestoId: string; creadoPorId: string; impersonadoPorId: string | null; createdAt: Date;
  motivo: string; rectificaId: string | null; version: number; declaracion: unknown; residuos: unknown; revisiones: unknown };
export function addendumDocument(record: Record, version: number) {
  if (!Number.isSafeInteger(version) || version < 0 || version > record.version) throw new Error('Versión de anexo inexistente');
  const reviews = (record.revisiones as AddendumReview[]).slice(0, version);
  if (reviews.length !== version) throw new Error('Historial de revisiones incompleto');
  const content = { formato: 'SITREP-ANEXO-ADENDA-1', id: record.id, manifiestoId: record.manifiestoId,
    version, creadoPorId: record.creadoPorId, impersonadoPorId: record.impersonadoPorId,
    fechaRegistro: record.createdAt.toISOString(), motivo: record.motivo, rectificaId: record.rectificaId,
    declaracion: record.declaracion, residuos: record.residuos, revisiones: reviews,
    estado: reviews[reviews.length - 1]?.decision || 'PENDIENTE' };
  return { ...content, huella: createHash('sha256').update(JSON.stringify(content)).digest('hex') };
}
