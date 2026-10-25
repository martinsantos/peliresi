import type { InspectionExchange } from '../types/inspection';
import type { inspeccionService } from './inspeccion.service';
import { getOffline, updateOffline } from './indexeddb';
import { inspectionContextKey } from '../utils/inspectionWorkspace';

export type ExchangeCommandInput =
  | { kind: 'presentation'; input: Parameters<typeof inspeccionService.presentExchange>[1] }
  | { kind: 'decision'; input: Parameters<typeof inspeccionService.decideExchange>[1] };
export type ExchangeCommandScope = { userId: string; owner: string; inspectionId: string };
export type ExchangeCommand = ExchangeCommandInput & {
  id: string; scope: ExchangeCommandScope; savedAt: string;
  status: 'pending' | 'confirmed' | 'rejected';
  receipt?: InspectionExchange; rejection?: string;
};
type StoredCommand = Omit<ExchangeCommand, 'input'> & {
  input: Omit<Extract<ExchangeCommandInput, { kind: 'presentation' }>['input'], 'files'> | Omit<Extract<ExchangeCommandInput, { kind: 'decision' }>['input'], 'files'>;
  files: Array<{ name: string; type: string; lastModified: number; blob: Blob }>;
};
const store = 'inspection_exchange_drafts';
export const exchangeCommandKey = (scope: ExchangeCommandScope) => {
  if (!scope.userId || !scope.owner || !scope.inspectionId) throw new Error('El envío requiere cuenta, actividad y expediente.');
  return inspectionContextKey(scope.userId, scope.owner, scope.inspectionId) + ':command';
};
function verify(record: StoredCommand, scope: ExchangeCommandScope) {
  if (record.id !== exchangeCommandKey(scope) || record.scope.userId !== scope.userId ||
      record.scope.owner !== scope.owner || record.scope.inspectionId !== scope.inspectionId ||
      !['presentation', 'decision'].includes(record.kind) || !record.input.clienteId ||
      !['pending', 'confirmed', 'rejected'].includes(record.status) || !Array.isArray(record.files)) {
    throw new Error('No pudimos verificar la copia del envío. Conservá esta pantalla y contactá a soporte.');
  }
}
function restore(record: StoredCommand, scope: ExchangeCommandScope): ExchangeCommand {
  verify(record, scope);
  const { files, ...rest } = record;
  return { ...rest, input: { ...record.input, files: files.map(file =>
    new File([file.blob], file.name, { type: file.type, lastModified: file.lastModified })) } } as ExchangeCommand;
}
export async function loadExchangeCommand(scope: ExchangeCommandScope): Promise<ExchangeCommand | null> {
  const record = await getOffline<StoredCommand>(store, exchangeCommandKey(scope));
  return record ? restore(record, scope) : null;
}
/** Claims one immutable command. An existing command is never overwritten. */
export async function claimExchangeCommand(scope: ExchangeCommandScope, command: ExchangeCommandInput): Promise<ExchangeCommand> {
  const { files = [], ...input } = command.input;
  const proposed: StoredCommand = {
    id: exchangeCommandKey(scope), scope: { ...scope }, kind: command.kind, input,
    savedAt: new Date().toISOString(), status: 'pending',
    files: files.map(file => ({ name: file.name, type: file.type, lastModified: file.lastModified, blob: file.slice(0, file.size, file.type) })),
  };
  const stored = await updateOffline<StoredCommand>(store, proposed.id, current => {
    if (current) { verify(current, scope); return current; }
    return proposed;
  });
  if (!stored) throw new Error('No se confirmó la copia del envío.');
  return restore(stored, scope);
}
export async function settleExchangeCommand(scope: ExchangeCommandScope, clientId: string, result:
  { status: 'confirmed'; receipt: InspectionExchange } | { status: 'rejected'; rejection: string }): Promise<ExchangeCommand> {
  const stored = await updateOffline<StoredCommand>(store, exchangeCommandKey(scope), current => {
    if (!current || current.input.clienteId !== clientId) throw new Error('La copia del envío cambió en otra pestaña.');
    verify(current, scope);
    // A late failed request must never undo an acknowledged receipt.
    return current.status === 'confirmed' ? current : { ...current, ...result };
  });
  return restore(stored!, scope);
}
/** Unconfirmed sends cannot be discarded or silently replaced by a new ID. */
export async function releaseExchangeCommand(scope: ExchangeCommandScope, clientId: string): Promise<void> {
  await updateOffline<StoredCommand>(store, exchangeCommandKey(scope), current => {
    if (!current) return null;
    verify(current, scope);
    if (current.input.clienteId !== clientId || current.status === 'pending') throw new Error('Primero confirmá el resultado del envío pendiente.');
    return null;
  });
}
