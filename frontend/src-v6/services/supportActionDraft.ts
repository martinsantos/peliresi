import type { SupportAction, SupportCategory, SupportPriority, SupportType } from '../types/support';
import { supportCategories, supportPriorities, supportTypes } from '../types/support';
import type { SupportCommand, SupportCommandScope } from './supportCommand';
import { supportCommandKey } from './supportCommand';
import { readSupportCommandRecord, updateSupportCommandRecord } from './supportCommandStore';

export type SupportActionDraft = {
  body: string; files: File[]; audio: File | null; version: number;
  target?: string; category?: SupportCategory; type?: SupportType; priority?: SupportPriority;
};
export type SupportDraftWorkspace = { action: SupportAction; drafts: Partial<Record<SupportAction, SupportActionDraft>> };
type FileCopy = { name: string; type: string; lastModified: number; blob: Blob };
type Stored = { id: string; scope: SupportCommandScope; savedAt: number; action: SupportAction;
  drafts: Partial<Record<SupportAction, Omit<SupportActionDraft, 'files' | 'audio'> & { files: FileCopy[]; audio: FileCopy | null }>> };
const actions: SupportAction[] = ['RESPONDER', 'NOTA', 'CLASIFICAR', 'DERIVAR', 'ESPERAR', 'CERRAR', 'REABRIR', 'TOMAR'];
const key = (scope: SupportCommandScope) => 'draft:' + supportCommandKey(scope);
export const emptySupportWorkspace = (): SupportDraftWorkspace => ({ action: 'RESPONDER', drafts: {} });
export const emptySupportActionDraft = (version: number): SupportActionDraft => ({ body: '', files: [], audio: null, version });
const storeFile = (file: File): FileCopy => ({ name: file.name, type: file.type, lastModified: file.lastModified, blob: file.slice(0, file.size, file.type) });
const restoreFile = (file: FileCopy) => new File([file.blob], file.name, { type: file.type, lastModified: file.lastModified });
function verify(record: Stored, scope: SupportCommandScope) {
  const invalid = () => { throw new Error('No pudimos verificar el borrador de este ticket. Conservamos la copia sin reemplazarla.'); };
  if (record.id !== key(scope) || supportCommandKey(record.scope) !== supportCommandKey(scope)
    || !actions.includes(record.action) || !record.drafts || typeof record.savedAt !== 'number') invalid();
  for (const [action, draft] of Object.entries(record.drafts)) {
    if (!actions.includes(action as SupportAction) || !draft || typeof draft.body !== 'string' || draft.body.length > 8000
      || !Number.isSafeInteger(draft.version) || draft.version < 1 || !Array.isArray(draft.files)
      || (draft.target !== undefined && typeof draft.target !== 'string')
      || (draft.category !== undefined && !Object.hasOwn(supportCategories, draft.category))
      || (draft.type !== undefined && !Object.hasOwn(supportTypes, draft.type))
      || (draft.priority !== undefined && !Object.hasOwn(supportPriorities, draft.priority))) invalid();
    const files = [...draft!.files, ...(draft!.audio ? [draft!.audio] : [])];
    if (files.length > 3 || files.some(file => !(file.blob instanceof Blob) || file.blob.size > 5 * 1024 * 1024
      || typeof file.name !== 'string' || typeof file.type !== 'string' || typeof file.lastModified !== 'number')) invalid();
  }
}
export async function readSupportActionDraft(scope: SupportCommandScope): Promise<SupportDraftWorkspace | null> {
  const record = await readSupportCommandRecord<Stored>(key(scope));
  if (!record) return null;
  verify(record, scope);
  return { action: record.action, drafts: Object.fromEntries(Object.entries(record.drafts).map(([action, draft]) =>
    [action, { ...draft, files: draft.files.map(restoreFile), audio: draft.audio ? restoreFile(draft.audio) : null }])) };
}
/** Guard is rechecked inside the atomic write: a released tab must never overwrite its successor. */
export async function writeSupportActionDraft(scope: SupportCommandScope, workspace: SupportDraftWorkspace, canWrite: () => boolean) {
  const record: Stored = { id: key(scope), scope: { ...scope }, savedAt: Date.now(), action: workspace.action,
    drafts: Object.fromEntries(Object.entries(workspace.drafts).map(([action, draft]) =>
      [action, { ...draft, files: draft.files.map(storeFile), audio: draft.audio ? storeFile(draft.audio) : null }])) };
  verify(record, scope);
  await updateSupportCommandRecord<Stored>(record.id, current => {
    if (!canWrite()) throw new Error('La edición cambió de pestaña o de cuenta. No se reemplazó el borrador.');
    if (current) verify(current, scope);
    return record;
  });
}
export function resolveSupportDraft(workspace: SupportDraftWorkspace, command: SupportCommand): SupportDraftWorkspace {
  if (command.status === 'pending') throw new Error('Primero comprobá el resultado del envío.');
  const drafts = { ...workspace.drafts }, action = command.input.accion;
  if (command.status === 'confirmed') delete drafts[action];
  else drafts[action] = { body: command.input.cuerpo, files: command.files, audio: null, version: command.input.version,
    target: command.input.responsableId, category: command.input.categoria, type: command.input.tipo, priority: command.input.prioridad };
  return { action: command.status === 'rejected' ? action : 'RESPONDER', drafts };
}
