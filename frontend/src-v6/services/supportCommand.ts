import type { SupportMutation } from '../types/support';
import { readSupportCommandRecord, updateSupportCommandRecord } from './supportCommandStore';

export type SupportCommandScope = { userId: string; context: string; ticketId: string };
export type SupportCommandInput = { key: string; input: SupportMutation; files: File[] };
export type SupportReceipt = { id: string; version: number; replay: boolean };
export type SupportCommand = SupportCommandInput & { id: string; scope: SupportCommandScope; status: 'pending' | 'confirmed' | 'rejected'; rejection?: string; receipt?: SupportReceipt };
type Stored = Omit<SupportCommand, 'files'> & { files: { name: string; type: string; lastModified: number; blob: Blob }[] };
export const supportCommandKey = (scope: SupportCommandScope) => {
  if (!scope.userId || !scope.context || !scope.ticketId) throw new Error('Falta el contexto del ticket.');
  return JSON.stringify([scope.userId, scope.context, scope.ticketId]);
};
function verify(record: Stored, scope: SupportCommandScope) {
  if (record.id !== supportCommandKey(scope) || record.scope?.userId !== scope.userId || record.scope.context !== scope.context || record.scope.ticketId !== scope.ticketId
    || !record.key || !['pending', 'confirmed', 'rejected'].includes(record.status) || !record.input || !Array.isArray(record.files)
    || !['RESPONDER', 'NOTA', 'TOMAR', 'DERIVAR', 'ESPERAR', 'CERRAR', 'REABRIR', 'CLASIFICAR'].includes(record.input.accion)
    || typeof record.input.cuerpo !== 'string' || !Number.isSafeInteger(record.input.version)
    || record.files.some(file => !(file.blob instanceof Blob) || typeof file.name !== 'string')) {
    throw new Error('No pudimos verificar el envío guardado. No se enviará otro contenido.');
  }
}
const restore = (record: Stored, scope: SupportCommandScope): SupportCommand => {
  verify(record, scope);
  return { ...record, files: record.files.map(file => new File([file.blob], file.name, { type: file.type, lastModified: file.lastModified })) };
};
export async function loadSupportCommand(scope: SupportCommandScope) {
  const record = await readSupportCommandRecord<Stored>(supportCommandKey(scope));
  return record ? restore(record, scope) : null;
}
export async function claimSupportCommand(scope: SupportCommandScope, input: SupportCommandInput) {
  const proposed: Stored = { ...input, input: { ...input.input }, id: supportCommandKey(scope), scope: { ...scope }, status: 'pending',
    files: input.files.map(file => ({ name: file.name, type: file.type, lastModified: file.lastModified, blob: file.slice(0, file.size, file.type) })) };
  verify(proposed, scope);
  const record = await updateSupportCommandRecord<Stored>(proposed.id, current => {
    if (current) { verify(current, scope); return current; }
    return proposed;
  });
  if (!record) throw new Error('No se confirmó la copia del envío.');
  return restore(record, scope);
}
export async function confirmSupportCommand(scope: SupportCommandScope, key: string, receipt: SupportReceipt) {
  if (receipt.id !== scope.ticketId || !Number.isSafeInteger(receipt.version)) throw new Error('La respuesta no identifica este ticket.');
  const record = await updateSupportCommandRecord<Stored>(supportCommandKey(scope), current => {
    if (!current || current.key !== key) throw new Error('El envío guardado cambió en otra pestaña.');
    verify(current, scope);
    return current.status === 'confirmed' ? current : { ...current, status: 'confirmed', receipt };
  });
  return restore(record!, scope);
}
export async function releaseSupportCommand(scope: SupportCommandScope, key: string) {
  await updateSupportCommandRecord<Stored>(supportCommandKey(scope), current => {
    if (!current) return null;
    verify(current, scope);
    if (current.key !== key || current.status === 'pending') throw new Error('Primero confirmá el resultado del envío anterior.');
    return null;
  });
}

export async function rejectSupportCommand(scope: SupportCommandScope, key: string, rejection: string) {
  const record = await updateSupportCommandRecord<Stored>(supportCommandKey(scope), current => {
    if (!current || current.key !== key) throw new Error('El envío guardado cambió en otra pestaña.');
    verify(current, scope);
    return current.status === 'confirmed' ? current : { ...current, status: 'rejected', rejection };
  });
  return restore(record!, scope);
}
