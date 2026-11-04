import type { ExchangeCommand, ExchangeCommandScope } from './inspectionExchangeCommand';
import type { OfflineExchangeDraftData } from './inspectionOfflineExchange';
import { exchangeCommandKey } from './inspectionExchangeCommand';
import { exchangeFileIdentity } from './inspectionCommandReceipt';
import { getOffline, updateOffline } from './indexeddb';
import { inspectionDeadlineFromInput } from '../pages/inspecciones/inspectionProcess';

type Alternative = { id: string; savedAt: string; draft: OfflineExchangeDraftData; files: File[] };
type StoredAlternative = Omit<Alternative, 'files'> & { files: Array<{ name: string; type: string; lastModified: number; blob: Blob }> };
type Record = { id: string; alternatives: StoredAlternative[] };
const store = 'inspection_exchange_drafts';
const key = (scope: ExchangeCommandScope) => exchangeCommandKey(scope) + ':alternatives';
const content = (draft: OfflineExchangeDraftData) => [draft.tipo, draft.asunto.trim(), draft.cuerpo.trim(), draft.respondeAId || null,
  draft.plazoRespuestaAt ? inspectionDeadlineFromInput(draft.plazoRespuestaAt) : null];
async function identity(draft: OfflineExchangeDraftData, files: File[]) {
  return JSON.stringify([content(draft), (await exchangeFileIdentity(files)).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
}
async function commandIdentity(command: ExchangeCommand) {
  if (command.kind !== 'presentation') return null;
  const input = command.input;
  return JSON.stringify([[input.tipo, input.asunto.trim(), input.cuerpo.trim(), input.respondeAId || null, input.plazoRespuestaAt || null],
    (await exchangeFileIdentity(input.files || [])).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
}
export async function isSentDraft(command: ExchangeCommand, draft: OfflineExchangeDraftData, files: File[]) {
  return await identity(draft, files) === await commandIdentity(command);
}
export async function preserveDraftAlternative(scope: ExchangeCommandScope, draft: OfflineExchangeDraftData, files: File[], command?: ExchangeCommand) {
  if (!draft.asunto.trim() && !draft.cuerpo.trim() && !files.length) return;
  const id = await identity(draft, files);
  if (command && id === await commandIdentity(command)) return;
  const recordKey = key(scope);
  const saved: StoredAlternative = { id, savedAt: new Date().toISOString(), draft: { ...draft },
    files: files.map(file => ({ name: file.name, type: file.type, lastModified: file.lastModified, blob: file.slice(0, file.size, file.type) })) };
  await updateOffline<Record>(store, recordKey, current => {
    if (current && current.id !== recordKey) throw new Error('No pudimos comprobar los borradores de esta actividad.');
    return { id: recordKey, alternatives: current?.alternatives.some(item => item.id === id)
      ? current.alternatives : [...(current?.alternatives || []), saved] };
  });
}
export async function loadDraftAlternatives(scope: ExchangeCommandScope): Promise<Alternative[]> {
  const record = await getOffline<Record>(store, key(scope));
  if (!record || record.id !== key(scope)) return [];
  return record.alternatives.map(item => ({ ...item, files: item.files.map(file =>
    new File([file.blob], file.name, { type: file.type, lastModified: file.lastModified })) }));
}
/** Only the content confirmed by the server is retired. All other revisions survive. */
export async function retireSentAlternatives(scope: ExchangeCommandScope, command: ExchangeCommand) {
  if (command.status !== 'confirmed' || command.kind !== 'presentation') return;
  const sent = await commandIdentity(command), recordKey = key(scope);
  await updateOffline<Record>(store, recordKey, current => current?.id === recordKey
    ? { ...current, alternatives: current.alternatives.filter(item => item.id !== sent) } : current);
}
