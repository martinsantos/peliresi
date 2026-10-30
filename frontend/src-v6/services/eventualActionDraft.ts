import { emptyEventualWaste, type EventualWaste } from './eventualDraft';

export type EventualActionBody = {
 tipo: 'AVANCE' | 'DIFERENCIA' | 'SOLICITAR_REVISION' | 'RESOLVER' | 'APROBAR_PARTE' | 'RECHAZAR_PARTE';
 version: number; nota: string; etapa?: string; parte?: string; objetivo?: string; decision?: string; residuos?: EventualWaste[];
};
export type PendingEventualAction = { id: string; body: EventualActionBody };
export type EventualActionDraft = { nota: string; residuos: EventualWaste[]; diferencia: boolean; version: number | null; pending?: PendingEventualAction };
export const emptyEventualActionDraft = (): EventualActionDraft => ({ nota:'', residuos:[emptyEventualWaste()], diferencia:false, version:null });
const object = (v:unknown): v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v:unknown, max:number) => typeof v === 'string' && v.length <= max;
const wastes = (v:unknown): v is EventualWaste[] => Array.isArray(v) && v.length > 0 && v.length <= 50
 && v.every(r => object(r) && text(r.corriente,1000) && typeof r.cantidad === 'number' && Number.isFinite(r.cantidad) && ['kg','l','t','m3'].includes(String(r.unidad)));
function pending(v:unknown): v is PendingEventualAction {
 if (!object(v) || typeof v.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.id) || !object(v.body)) return false;
 const b=v.body;
 return Object.keys(b).every(k => ['tipo','version','nota','etapa','parte','objetivo','decision','residuos'].includes(k))
  && ['AVANCE','DIFERENCIA','SOLICITAR_REVISION','RESOLVER','APROBAR_PARTE','RECHAZAR_PARTE'].includes(String(b.tipo))
  && typeof b.version === 'number' && Number.isInteger(b.version) && b.version >= 0 && text(b.nota,500)
  && ['etapa','parte','objetivo','decision'].every(k => b[k] === undefined || text(b[k],100))
  && (b.residuos === undefined || wastes(b.residuos));
}
export function validEventualActionDraft(v:unknown): v is EventualActionDraft {
 return object(v) && text(v.nota,500) && wastes(v.residuos) && typeof v.diferencia === 'boolean'
  && (v.version === null || (typeof v.version === 'number' && Number.isInteger(v.version) && v.version >= 0))
  && (v.pending === undefined || pending(v.pending));
}
export const eventualActionSubmissionKey = (key:string) => 'sitrep:eventual-action-submission:v1:' + encodeURIComponent(key);
export function readEventualActionSubmission(key:string): PendingEventualAction | null {
 const raw=localStorage.getItem(eventualActionSubmissionKey(key));
 if (raw === null) return null;
 const value=JSON.parse(raw);
 if (!value || value.version !== 1 || !pending(value.pending)) throw new Error('Acción pendiente ilegible');
 return value.pending;
}
/** Writers are called only while holding the per-record Web Lock. */
export function writeEventualActionSubmission(key:string, value:PendingEventualAction): void {
 const previous=readEventualActionSubmission(key);
 if (!pending(value) || (previous && JSON.stringify(previous) !== JSON.stringify(value))) throw new Error('Otra acción pendiente');
 localStorage.setItem(eventualActionSubmissionKey(key),JSON.stringify({version:1,pending:value}));
 if (JSON.stringify(readEventualActionSubmission(key)) !== JSON.stringify(value)) throw new Error('No se pudo guardar la referencia');
}
export function clearEventualActionSubmission(key:string, id:string): void {
 const value=readEventualActionSubmission(key);
 if (!value || value.id !== id) throw new Error('La acción cambió');
 localStorage.removeItem(eventualActionSubmissionKey(key));
 if (readEventualActionSubmission(key)) throw new Error('No se pudo limpiar la referencia');
}
export function mayReplaceEventualActionDraft(key:string, ownPending?:string): boolean {
 try {
  const raw=localStorage.getItem(key); if (raw === null) return true;
  const record=JSON.parse(raw);
  if (!record || record.version !== 1 || typeof record.revision !== 'string' || !Number.isFinite(record.savedAt)
    || (record.value !== null && !validEventualActionDraft(record.value))) return false;
  const saved=(record.value as EventualActionDraft | null)?.pending;
  return !saved || saved.id === ownPending;
 } catch { return false; }
}
