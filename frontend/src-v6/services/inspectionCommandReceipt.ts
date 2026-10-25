import type { InspectionExchange, InspectionExchangeParty } from '../types/inspection';
import type { ExchangeCommand } from './inspectionExchangeCommand';

const digests = new WeakMap<Blob, Promise<string>>();
export function fileDigest(file: Blob): Promise<string> {
  const existing = digests.get(file);
  if (existing) return existing;
  const pending = digestBytes(file).catch(error => { digests.delete(file); throw error; });
  digests.set(file, pending);
  return pending;
}
async function digestBytes(file: Blob): Promise<string> {
  const bytes = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function exchangeFileIdentity(files: File[]) {
  return Promise.all(files.map(async file => [file.name, file.size, await fileDigest(file)] as const));
}
const fileSet = (files: ReadonlyArray<readonly [string, number, string]>) =>
  JSON.stringify([...files].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
const date = (value?: string | null) => value ? new Date(value).toISOString() : null;

/** A successful authorized read can acknowledge an exact command, never a similar act. */
export async function matchingExchangeReceipt(command: ExchangeCommand, entries: InspectionExchange[], party: InspectionExchangeParty): Promise<InspectionExchange | null> {
  const entry = entries.find(item => item.clienteId === command.input.clienteId);
  if (!entry || entry.inspeccionId !== command.scope.inspectionId || entry.autorId !== command.scope.userId ||
      entry.parte !== party || entry.versionExpediente !== command.input.version + 1) return null;
  const input = command.input;
  if (command.kind === 'presentation') {
    const presentation = command.input;
    if (entry.tipo !== presentation.tipo || entry.asunto !== presentation.asunto || entry.cuerpo !== presentation.cuerpo ||
        (entry.respondeAId || null) !== (presentation.respondeAId || null) || date(entry.plazoRespuestaAt) !== date(presentation.plazoRespuestaAt)) return null;
  } else {
    const decision = command.input;
    const type = decision.decision === 'CERRADA_CONFORME' ? 'CIERRE_CONFORME' : 'DERIVACION_LEGALES';
    const subject = decision.decision === 'CERRADA_CONFORME' ? 'Cierre conforme del intercambio' : 'Derivación del expediente a Legales';
    const body = [decision.fundamento, decision.expedienteLegal ? `Expediente legal: ${decision.expedienteLegal}` : null].filter(Boolean).join('\n\n');
    if (entry.parte !== 'AUTORIDAD' || entry.tipo !== type || entry.asunto !== subject || entry.cuerpo !== body ||
        entry.respondeAId || entry.plazoRespuestaAt) return null;
  }
  return fileSet(await exchangeFileIdentity(input.files || [])) ===
    fileSet(entry.adjuntos.map(file => [file.nombreOriginal, file.bytes, file.sha256])) ? entry : null;
}
