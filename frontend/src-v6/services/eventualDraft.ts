export type EventualSlot = 'generador' | 'transportista' | 'operador';
export type EventualWaste = { corriente: string; cantidad: number; unidad: string };
export type EventualParticipant = { nombre: string; identificacion: string; domicilio: string; nombreFantasia?: string; telefono?: string; padronId?: string };
export type EventualPayload = Partial<Record<EventualSlot, EventualParticipant>> & { patente: string; motivo: string; residuos: EventualWaste[] };
export type PendingEventualCreate = { id: string; body: EventualPayload };
export type EventualDraft = {
  declared: Record<EventualSlot, EventualParticipant>;
  external: Record<EventualSlot, EventualParticipant>;
  patente: string; motivo: string; residuos: EventualWaste[];
  pendingCreate?: PendingEventualCreate;
};
const slots: EventualSlot[] = ['generador', 'transportista', 'operador'];
export const emptyEventualParticipant = (): EventualParticipant => ({ nombre: '', identificacion: '', domicilio: '' });
export const emptyEventualWaste = (): EventualWaste => ({ corriente: '', cantidad: 0, unidad: 'kg' });
export function emptyEventualDraft(): EventualDraft {
 const participants = () => ({ generador: emptyEventualParticipant(), transportista: emptyEventualParticipant(), operador: emptyEventualParticipant() });
 return { declared: participants(), external: participants(), patente: '', motivo: '', residuos: [emptyEventualWaste()] };
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, length: number) => typeof v === 'string' && v.length <= length;
const optionalText = (v: unknown, length: number) => v === undefined || text(v, length);
function participant(v: unknown): v is EventualParticipant {
 return object(v) && text(v.nombre, 500) && text(v.identificacion, 500) && text(v.domicilio, 500)
  && optionalText(v.nombreFantasia, 500) && optionalText(v.telefono, 100) && optionalText(v.padronId, 100);
}
function wastes(v: unknown): v is EventualWaste[] {
 return Array.isArray(v) && v.length > 0 && v.length <= 50 && v.every(r => object(r) && text(r.corriente, 1000)
  && typeof r.cantidad === 'number' && Number.isFinite(r.cantidad) && ['kg', 'l', 't', 'm3'].includes(String(r.unidad)));
}
function payload(v: unknown): v is EventualPayload {
 return object(v) && Object.keys(v).every(k => [...slots, 'patente', 'motivo', 'residuos'].includes(k))
  && slots.every(slot => v[slot] === undefined || participant(v[slot])) && text(v.patente, 20) && text(v.motivo, 500) && wastes(v.residuos);
}
export function validEventualDraft(v: unknown): v is EventualDraft {
 if (!object(v) || !object(v.declared) || !object(v.external) || !slots.every(s => participant((v.declared as Record<string, unknown>)[s])
   && participant((v.external as Record<string, unknown>)[s])) || !text(v.patente, 20) || !text(v.motivo, 500) || !wastes(v.residuos)) return false;
 if (v.pendingCreate === undefined) return true;
 return object(v.pendingCreate) && typeof v.pendingCreate.id === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.pendingCreate.id) && payload(v.pendingCreate.body);
}
/** Do not silently discard an unfinished operation or an unconfirmed send. */
export const retainEventualDraft = (_draft: EventualDraft) => true;

/** Separate from editable drafts: editing another tab cannot replace an
 * unconfirmed request. Call writers only while holding the submission lock. */
export const eventualSubmissionKey = (draftKey: string) => 'sitrep:eventual-submission:v1:' + encodeURIComponent(draftKey);
export function readEventualSubmission(draftKey: string): PendingEventualCreate | null {
 const raw = localStorage.getItem(eventualSubmissionKey(draftKey));
 if (raw === null) return null;
 const record = JSON.parse(raw);
 if (!record || record.version !== 1 || !record.pending || !validEventualDraft({ ...emptyEventualDraft(), pendingCreate: record.pending })) throw new Error('Envío ilegible');
 return record.pending;
}
export function writeEventualSubmission(draftKey: string, pending: PendingEventualCreate): void {
 const current = readEventualSubmission(draftKey);
 if (current && JSON.stringify(current) !== JSON.stringify(pending)) throw new Error('Otro envío sin confirmar');
 if (!validEventualDraft({ ...emptyEventualDraft(), pendingCreate: pending })) throw new Error('Envío inválido');
 localStorage.setItem(eventualSubmissionKey(draftKey), JSON.stringify({ version: 1, pending }));
 const saved = readEventualSubmission(draftKey);
 if (JSON.stringify(saved) !== JSON.stringify(pending)) throw new Error('No se pudo guardar el envío');
}
export function clearEventualSubmission(draftKey: string, id: string): void {
 const current = readEventualSubmission(draftKey);
 if (!current || current.id !== id) throw new Error('El envío cambió');
 localStorage.removeItem(eventualSubmissionKey(draftKey));
 if (readEventualSubmission(draftKey)) throw new Error('No se pudo limpiar el envío');
}

/** The JWT claim is used only to isolate local copies. The API validates every
 * request independently; a temporary view must not see the person's own draft. */
export function eventualDraftScope(owner: string, userId: string | number, token: string | null): string {
 if (!owner || !userId) return '';
 if (!token) return '';
 try {
  const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '=')));
  if (String(payload.id) !== String(userId)) return '';
  if (payload.impersonatedBy !== undefined && (typeof payload.impersonatedBy !== 'string' || !payload.impersonatedBy)) return '';
  return JSON.stringify([owner, payload.impersonatedBy ? ['temporary', payload.impersonatedBy] : ['personal']]);
 } catch { return ''; }
}

/** An unconfirmed send from another tab must not be overwritten by an older
 * form. A damaged or inaccessible record also fails closed. */
export function mayReplaceEventualDraft(key: string, ownPending?: string): boolean {
 try {
  const raw = localStorage.getItem(key); if (raw === null) return true;
  const record = JSON.parse(raw);
  if (!record || record.version !== 1 || typeof record.revision !== 'string' || !Number.isFinite(record.savedAt)
    || (record.value !== null && !validEventualDraft(record.value))) return false;
  const pending = (record.value as EventualDraft | null)?.pendingCreate;
  return !pending || pending.id === ownPending;
 } catch { return false; }
}
