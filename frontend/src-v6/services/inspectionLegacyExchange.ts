import { getOffline } from './indexeddb';
import { exchangeFileIdentity } from './inspectionCommandReceipt';
import type { OfflineExchangeDraftData } from './inspectionOfflineExchange';
import type { InspectionExchangeTimeline } from '../types/inspection';
import { inspectionDeadlineFromInput } from '../pages/inspecciones/inspectionProcess';

export type LegacyExchangeCopy = { id: 'checkpoint' | 'journal'; raw: string; draft: OfflineExchangeDraftData | null; files: File[]; savedAt: string; unreadableFiles: boolean };
type Stored = { id: string; userId: string; inspectionId: string; owner?: string; savedAt: string; draft: unknown; files: Array<{ name: string; type: string; lastModified: number; blob: Blob }> };
const types = new Set(['REQUERIMIENTO', 'RESPUESTA', 'DESCARGO', 'SUBSANACION', 'PRONUNCIAMIENTO']);

function parse(raw: string): OfflineExchangeDraftData | null {
  try {
    const value = JSON.parse(raw);
    if (!value || !types.has(value.tipo) || ['asunto', 'cuerpo', 'respondeAId', 'plazoRespuestaAt'].some(key => typeof value[key] !== 'string')) return null;
    if (value.plazoRespuestaAt && !Number.isFinite(new Date(value.plazoRespuestaAt).getTime())) return null;
    return { tipo: value.tipo, asunto: value.asunto, cuerpo: value.cuerpo, respondeAId: value.respondeAId, plazoRespuestaAt: value.plazoRespuestaAt };
  } catch { return null; }
}

/** Invoke only after the current account/context has freshly read this exchange.
 * Keep old bytes untouched; an unscoped draft must never load automatically. */
export async function readLegacyExchangeCopies(userId: string, inspectionId: string): Promise<LegacyExchangeCopy[]> {
  if (!userId || !inspectionId) throw new Error('No se identificó la cuenta y el requerimiento.');
  const key = `${userId}:${inspectionId}`;
  const record = await getOffline<Stored>('inspection_exchange_drafts', key);
  const copies: LegacyExchangeCopy[] = [];
  if (record?.id === key && record.userId === userId && record.inspectionId === inspectionId && !record.owner) {
    const raw = JSON.stringify(record.draft) ?? 'null';
    const storedFiles = Array.isArray(record.files) ? record.files : [];
    const valid = storedFiles.filter(file => file && file.blob instanceof Blob && typeof file.name === 'string');
    copies.push({ id: 'checkpoint', raw, draft: parse(raw), savedAt: record.savedAt,
      files: valid.map(file => new File([file.blob], file.name, { type: file.type, lastModified: file.lastModified })),
      unreadableFiles: !Array.isArray(record.files) || valid.length !== storedFiles.length });
  }
  const raw = localStorage.getItem(`sitrep_exchange_draft_${userId}_${inspectionId}`);
  const draft = raw ? parse(raw) : null;
  if (raw && !copies.some(copy => copy.raw === raw || (draft && copy.draft && JSON.stringify(draft) === JSON.stringify(copy.draft)))) {
    copies.push({ id: 'journal', raw, draft, files: [], savedAt: '', unreadableFiles: false });
  }
  return copies;
}

/** Return a human-readable blocker, not a transformed draft. A legacy response
 * cannot silently become a different kind of act or answer another request. */
export async function legacyExchangeBlocker(copy: LegacyExchangeCopy, timeline: InspectionExchangeTimeline, userId: string): Promise<string | null> {
  const draft = copy.draft;
  if (!draft || copy.unreadableFiles) return 'Esta copia no se puede recuperar completa. Descargá el original y los archivos disponibles; no se modificaron.';
  if (!['NOTIFICADA', 'EN_DESCARGO', 'REQUIERE_SUBSANACION'].includes(timeline.inspeccion.estado)) return 'El expediente ya no admite presentaciones. Podés consultar y descargar esta copia.';
  const actor = timeline.parteActual === 'INSPECCIONADO';
  const allowed = actor ? ['RESPUESTA', 'DESCARGO', 'SUBSANACION'] : draft.respondeAId ? ['RESPUESTA', 'PRONUNCIAMIENTO', 'REQUERIMIENTO'] : ['REQUERIMIENTO'];
  if (!allowed.includes(draft.tipo)) return 'El tipo de actuación de esta copia no corresponde a tu actividad actual. No se cambió el contenido.';
  const parent = timeline.intercambios.find(item => item.id === draft.respondeAId);
  if ((actor && !draft.respondeAId) || (draft.respondeAId && (!parent || parent.parte === timeline.parteActual || ['CIERRE_CONFORME', 'DERIVACION_LEGALES'].includes(parent.tipo)))) return 'No se pudo vincular esta copia con un antecedente autorizado. Revisá el historial antes de preparar otra respuesta.';
  const files = JSON.stringify((await exchangeFileIdentity(copy.files)).sort());
  const matching = timeline.intercambios.find(item => item.autorId === userId && item.parte === timeline.parteActual && item.tipo === draft.tipo
    && item.asunto === draft.asunto.trim() && item.cuerpo === draft.cuerpo.trim() && (item.respondeAId || '') === draft.respondeAId
    && (item.plazoRespuestaAt ? new Date(item.plazoRespuestaAt).toISOString() : null) === (draft.plazoRespuestaAt ? inspectionDeadlineFromInput(draft.plazoRespuestaAt) : null)
    && JSON.stringify(item.adjuntos.map(file => [file.nombreOriginal, file.bytes, file.sha256]).sort()) === files);
  if (matching) return `Este contenido ya figura en la actuación #${matching.secuencia}. Consultá el historial; no hace falta presentarlo otra vez.`;
  return null;
}
