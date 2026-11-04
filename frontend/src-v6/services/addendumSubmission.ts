export type AddendumWaste = { corriente: string; cantidad: number; unidad: string };
export type AddendumCommand =
  | { id: string; kind: 'create'; body: { motivo: string; residuos: AddendumWaste[]; rectificaId?: string } }
  | { id: string; kind: 'review'; adendaId: string; body: { version: number; decision: 'APROBADA' | 'OBSERVADA' | 'RECHAZADA'; nota: string } };
export type AddendumSubmission = { command: AddendumCommand; phase: 'prepared' | 'dispatched' };
export type LegacyAddendumSubmission = { id: string; signature: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const recordId = /^[a-zA-Z0-9_-]{1,100}$/;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));
const text = (value: unknown) => typeof value === 'string' && !!value.trim() && value.length <= 500;
const units = ['kg', 'lt', 'tn', 'un', 'l', 't', 'm3'];
function validWaste(value: unknown): value is AddendumWaste {
  return object(value) && exactKeys(value, ['corriente', 'cantidad', 'unidad'])
    && typeof value.corriente === 'string' && /^Y\d{1,3}$/.test(value.corriente.trim())
    && typeof value.cantidad === 'number' && Number.isFinite(value.cantidad) && value.cantidad > 0 && value.cantidad <= 1e12
    && typeof value.unidad === 'string' && units.includes(value.unidad);
}
export function validAddendumCommand(value: unknown): value is AddendumCommand {
  if (!object(value) || typeof value.id !== 'string' || !uuid.test(value.id) || !object(value.body)) return false;
  const body = value.body;
  if (value.kind === 'create') return exactKeys(value, ['id', 'kind', 'body'])
    && exactKeys(body, ['motivo', 'residuos', 'rectificaId']) && text(body.motivo)
    && Array.isArray(body.residuos) && body.residuos.length > 0 && body.residuos.length <= 50 && body.residuos.every(validWaste)
    && (body.rectificaId === undefined || (typeof body.rectificaId === 'string' && uuid.test(body.rectificaId)));
  return value.kind === 'review' && exactKeys(value, ['id', 'kind', 'adendaId', 'body'])
    && typeof value.adendaId === 'string' && recordId.test(value.adendaId)
    && exactKeys(body, ['version', 'decision', 'nota']) && Number.isSafeInteger(body.version) && (body.version as number) >= 0
    && ['APROBADA', 'OBSERVADA', 'RECHAZADA'].includes(String(body.decision)) && text(body.nota);
}

/** Retain personal drafts created by earlier versions; temporary views receive
 * a separate key and never read the represented person's personal draft. */
export function addendumDraftScope(base: string, userId: string | number, token: string | null): { scope: string; impersonator: string | null } | null {
  if (!base || !userId || !token) return null;
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    if (String(claims.id) !== String(userId) || claims.restricted) return null;
    const impersonator = claims.impersonatedBy;
    if (impersonator !== undefined && (typeof impersonator !== 'string' || !impersonator)) return null;
    return { scope: impersonator ? JSON.stringify([base, 'temporary', impersonator]) : base, impersonator: impersonator || null };
  } catch { return null; }
}

export const addendumSubmissionKey = (draftKey: string) => 'sitrep:adenda-submission:v1:' + encodeURIComponent(draftKey);
function validSubmission(value: unknown): value is AddendumSubmission {
  return object(value) && exactKeys(value, ['command', 'phase']) && validAddendumCommand(value.command)
    && (value.phase === 'prepared' || value.phase === 'dispatched');
}
export function readAddendumSubmission(draftKey: string): AddendumSubmission | null {
  const raw = localStorage.getItem(addendumSubmissionKey(draftKey));
  if (raw === null) return null;
  const record = JSON.parse(raw);
  if (!object(record) || record.version !== 1 || !validSubmission(record.submission)) throw Error('Referencia de adenda ilegible');
  return record.submission;
}
/** Writers must hold the corresponding addendum editor lock. */
export function writeAddendumSubmission(draftKey: string, submission: AddendumSubmission): void {
  if (!validSubmission(submission)) throw Error('Referencia de adenda inválida');
  const current = readAddendumSubmission(draftKey);
  if (current && JSON.stringify(current) !== JSON.stringify(submission)) throw Error('Otra adenda sin confirmar');
  const encoded = JSON.stringify({ version: 1, submission });
  localStorage.setItem(addendumSubmissionKey(draftKey), encoded);
  if (localStorage.getItem(addendumSubmissionKey(draftKey)) !== encoded) throw Error('No se pudo guardar la referencia');
}
export function dispatchAddendumSubmission(draftKey: string, submission: AddendumSubmission): AddendumSubmission {
  if (submission.phase !== 'prepared' || JSON.stringify(readAddendumSubmission(draftKey)) !== JSON.stringify(submission)) throw Error('El envío cambió');
  const next: AddendumSubmission = { ...submission, phase: 'dispatched' };
  const encoded = JSON.stringify({ version: 1, submission: next });
  localStorage.setItem(addendumSubmissionKey(draftKey), encoded);
  if (localStorage.getItem(addendumSubmissionKey(draftKey)) !== encoded) throw Error('No se pudo guardar la referencia');
  return next;
}
export function clearAddendumSubmission(draftKey: string, submission: AddendumSubmission): void {
  if (JSON.stringify(readAddendumSubmission(draftKey)) !== JSON.stringify(submission)) throw Error('El envío cambió');
  localStorage.removeItem(addendumSubmissionKey(draftKey));
  if (readAddendumSubmission(draftKey) !== null) throw Error('No se pudo limpiar la referencia');
}

/** Older versions kept the exact request as a JSON signature in the draft.
 * A malformed or foreign signature is not silently interpreted as unsent. */
export function legacyAddendumCommand(value: LegacyAddendumSubmission | undefined, endpoint: string): AddendumCommand | null {
  if (!value) return null;
  const parsed: unknown = JSON.parse(value.signature);
  if (!object(parsed) || !exactKeys(parsed, ['path', 'body']) || typeof parsed.path !== 'string' || !object(parsed.body)) throw Error('Referencia anterior ilegible');
  let command: unknown;
  if (parsed.path === endpoint) command = { id: value.id, kind: 'create', body: parsed.body };
  else {
    const prefix = endpoint + '/', suffix = '/revisiones';
    if (!parsed.path.startsWith(prefix) || !parsed.path.endsWith(suffix)) throw Error('Referencia anterior ajena');
    const adendaId = parsed.path.slice(prefix.length, -suffix.length);
    command = { id: value.id, kind: 'review', adendaId, body: parsed.body };
  }
  if (!validAddendumCommand(command)) throw Error('Referencia anterior ilegible');
  return command;
}
export function addendumCommandPath(endpoint: string, command: AddendumCommand): string {
  return command.kind === 'create' ? endpoint : endpoint + '/' + encodeURIComponent(command.adendaId) + '/revisiones';
}
export function legacyAddendumSignature(endpoint: string, command: AddendumCommand): string {
  return JSON.stringify({ path: addendumCommandPath(endpoint, command), body: command.body });
}

/** A selected, authorized GET may prove success; absence never proves failure. */
export function addendumCommandConfirmed(command: AddendumCommand, row: unknown, userId: string | number, impersonator: string | null): boolean {
  if (!object(row)) return false;
  if (command.kind === 'create') {
    if (row.id !== command.id || String(row.creadoPorId) !== String(userId) || (row.impersonadoPorId || null) !== impersonator
      || row.motivo !== command.body.motivo.trim() || (row.rectificaId || null) !== (command.body.rectificaId || null) || !Array.isArray(row.residuos)) return false;
    const expected = command.body.residuos.map(w => [w.corriente.trim(), w.cantidad, w.unidad]);
    const actual = row.residuos.map((w: unknown) => object(w) ? [w.corriente, w.cantidad, w.unidad] : null);
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
  if (row.id !== command.adendaId || !Array.isArray(row.revisiones)) return false;
  return row.revisiones.some((review: unknown) => object(review) && review.id === command.id && String(review.autorId) === String(userId)
    && (review.impersonadoPorId || null) === impersonator && review.version === command.body.version
    && review.decision === command.body.decision && review.nota === command.body.nota.trim());
}
