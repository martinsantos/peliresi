import { getAllOffline, removeOffline, replaceOffline, saveOffline } from './indexeddb';

export interface PendingInspectionEvidenceFields {
  tipo?: string;
  descripcion?: string;
  transcripcion?: string;
  latitud?: number;
  longitud?: number;
  comparacionId?: string;
  eventoId?: string;
  itemId?: string;
}

export interface PendingInspectionEvidence {
  id: string;
  inspectionId: string;
  userId: string;
  file: Blob;
  fileName: string;
  mimeType: string;
  lastModified: number;
  fields: PendingInspectionEvidenceFields;
  capturedAt: string;
  sha256: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
  failureKind?: 'retryable' | 'terminal';
  nextRetryAt?: string;
  uploaded?: boolean;
}

const STORE = 'inspection_evidence_queue' as const;
export const INSPECTION_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
export const INSPECTION_EVIDENCE_ACCEPT = `${INSPECTION_PHOTO_ACCEPT},application/pdf,audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/x-wav,audio/webm,.pdf,.mp3,.m4a,.ogg,.wav,.webm`;
const FORMAT_MESSAGE = 'Formato no permitido. Use JPG, PNG, WEBP, PDF, MP3, M4A, OGG, WAV o WEBM. Las fotos GIF, HEIC y HEIF deben convertirse a JPG, PNG o WEBP.';
const MAX_AUTO_ATTEMPTS = 3;
const runningSyncs = new Map<string, Promise<InspectionEvidenceSyncResult>>();
const pendingChanges = new Map<string, Promise<unknown>>();

export class InspectionEvidenceValidationError extends Error {}
export class InspectionEvidenceStorageError extends Error {
  constructor() {
    super('No se pudo confirmar la copia en este dispositivo. Puede faltar espacio. Conservá el archivo original y verificá la captura antes de volver a intentar.');
  }
}

/** Mirrors the backend's content signatures, including the 25 MB limit. */
export async function validateInspectionEvidence(file: Blob, fields: PendingInspectionEvidenceFields = {}): Promise<string> {
  if (!file.size) throw new InspectionEvidenceValidationError('El archivo está vacío. Seleccioná otro archivo.');
  if (file.size > 25 * 1024 * 1024) throw new InspectionEvidenceValidationError('La evidencia supera el límite de 25 MB.');
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const begins = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  let mime: string | null = null;
  if (ascii(0, 4) === '%PDF') mime = 'application/pdf';
  else if (begins(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) mime = 'image/png';
  else if (begins(0xff, 0xd8, 0xff)) mime = 'image/jpeg';
  else if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') mime = 'image/webp';
  else if (ascii(0, 3) === 'ID3' || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) mime = 'audio/mpeg';
  else if (bytes.length >= 12 && ascii(4, 8) === 'ftyp') {
    // HEIF images share the MP4 container header, but are not supported photos.
    const brands = ascii(8, 64);
    if (/(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif|avis)/.test(brands) || file.type.startsWith('image/')) throw new InspectionEvidenceValidationError(FORMAT_MESSAGE);
    mime = 'audio/mp4';
  } else if (ascii(0, 4) === 'OggS') mime = 'audio/ogg';
  else if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') mime = 'audio/wav';
  else if (begins(0x1a, 0x45, 0xdf, 0xa3)) mime = 'audio/webm';
  if (!mime) throw new InspectionEvidenceValidationError(FORMAT_MESSAGE);
  if ((fields.itemId || fields.comparacionId) && !mime.startsWith('image/')) throw new InspectionEvidenceValidationError('Para este control seleccioná una imagen JPG, PNG o WEBP.');
  return mime;
}

export function inspectionEvidenceFailure(entry: PendingInspectionEvidence, error: unknown): PendingInspectionEvidence {
  const response = (error as { response?: { status?: number; data?: { message?: string } } } | null)?.response;
  const status = response?.status;
  const terminal = error instanceof InspectionEvidenceValidationError || (status !== undefined && status >= 400 && status < 500 && ![408, 425, 429].includes(status));
  const message = response?.data?.message;
  const lastError = typeof message === 'string' && message.trim() ? message : error instanceof Error ? error.message : 'No se pudo sincronizar la evidencia.';
  return { ...entry, failureKind: terminal ? 'terminal' : 'retryable', lastError, nextRetryAt: new Date(Date.now() + 30_000 * 2 ** Math.min(entry.attempts, 6)).toISOString() };
}

function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function sha256(file: Blob): Promise<string> {
  if (!crypto.subtle) return '';
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function buildPendingInspectionEvidence(
  inspectionId: string,
  userId: string,
  file: File,
  fields: PendingInspectionEvidenceFields = {},
): Promise<PendingInspectionEvidence> {
  if (!inspectionId || !userId) throw new Error('La captura requiere una inspección y una sesión identificadas.');
  const mimeType = await validateInspectionEvidence(file, fields);
  const capturedAt = new Date(file.lastModified || Date.now()).toISOString();
  const pending: PendingInspectionEvidence = {
    id: randomId(),
    inspectionId,
    userId,
    file,
    fileName: file.name,
    mimeType,
    lastModified: file.lastModified,
    fields,
    capturedAt,
    sha256: await sha256(file),
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  return pending;
}

export async function queueInspectionEvidence(inspectionId: string, userId: string, file: File, fields: PendingInspectionEvidenceFields = {}): Promise<PendingInspectionEvidence> {
  const pending = await buildPendingInspectionEvidence(inspectionId, userId, file, fields);
  try { await saveOffline(STORE, pending); }
  catch { throw new InspectionEvidenceStorageError(); }
  return pending;
}

export async function listPendingInspectionEvidence(inspectionId: string, userId: string): Promise<PendingInspectionEvidence[]> {
  const entries = await getAllOffline<PendingInspectionEvidence>(STORE);
  return entries
    .filter((entry) => entry.inspectionId === inspectionId && entry.userId === userId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function updatePendingInspectionEvidence(entry: PendingInspectionEvidence): Promise<void> {
  await saveOffline(STORE, entry);
}

export async function removePendingInspectionEvidence(id: string): Promise<void> {
  await removeOffline(STORE, id);
}

export function pendingEvidenceFile(entry: PendingInspectionEvidence): File {
  return new File([entry.file], entry.fileName, { type: entry.mimeType, lastModified: entry.lastModified });
}

export interface InspectionEvidenceSyncResult {
  synchronized: number;
  failed: number;
  skipped: number;
}

interface SyncOptions {
  inspectionId: string;
  userId: string;
  upload: (entry: PendingInspectionEvidence) => Promise<unknown>;
  manual?: boolean;
  onlyId?: string;
  isActive?: () => boolean;
}

/** One bounded pass: failures remain visible while independent captures continue. */
export function syncPendingInspectionEvidence(options: SyncOptions): Promise<InspectionEvidenceSyncResult> {
  const key = JSON.stringify([options.userId, options.inspectionId]);
  const running = runningSyncs.get(key);
  if (running) {
    if (!options.onlyId) return running;
    // A capture added after the running pass read its snapshot still needs its own turn.
    return running.then(async (result) => {
      const stillPending = (await listPendingInspectionEvidence(options.inspectionId, options.userId)).some((entry) => entry.id === options.onlyId);
      return stillPending ? syncPendingInspectionEvidence(options) : result;
    });
  }
  const changing = pendingChanges.get(key);
  const run = async (): Promise<InspectionEvidenceSyncResult> => {
    const result = { synchronized: 0, failed: 0, skipped: 0 };
    const entries = await listPendingInspectionEvidence(options.inspectionId, options.userId);
    for (const entry of entries) {
      if (options.isActive?.() === false || !navigator.onLine) break;
      if (options.onlyId && entry.id !== options.onlyId) continue;
      if (!entry.uploaded && !options.manual && (entry.failureKind === 'terminal' || entry.attempts >= MAX_AUTO_ATTEMPTS || (entry.nextRetryAt && Date.parse(entry.nextRetryAt) > Date.now()))) {
        result.skipped += 1;
        continue;
      }
      const attempted = { ...entry, attempts: entry.attempts + 1, nextRetryAt: new Date(Date.now() + 30_000).toISOString() };
      // Persist the attempt before sending. A failed local write must not trigger a request.
      try { await updatePendingInspectionEvidence(attempted); }
      catch { throw new InspectionEvidenceStorageError(); }
      if (options.isActive?.() === false) break;
      let uploaded = entry.uploaded;
      try {
        if (!uploaded) {
          await validateInspectionEvidence(entry.file, entry.fields);
          if (options.isActive?.() === false) break;
          await options.upload(entry);
          uploaded = true;
          await updatePendingInspectionEvidence({ ...attempted, uploaded: true, lastError: undefined, failureKind: undefined });
        }
        await removePendingInspectionEvidence(entry.id);
        result.synchronized += 1;
      } catch (error) {
        const failed = uploaded
          ? { ...attempted, uploaded: true, failureKind: 'retryable' as const, lastError: 'El servidor recibió esta evidencia. Falta confirmar la limpieza de su copia local; reintentá para verificarla.' }
          : inspectionEvidenceFailure(attempted, error);
        try { await updatePendingInspectionEvidence(failed); }
        catch { throw new InspectionEvidenceStorageError(); }
        result.failed += 1;
        const status = (error as { response?: { status?: number } } | null)?.response?.status;
        if (status === 401 || status === 403 || (error instanceof Error && error.message === 'No refresh token')) break;
      }
    }
    return result;
  };
  // Web Locks coordinates tabs when available; the map also covers overlapping online events.
  const promise = Promise.resolve(changing).then(async () => navigator.locks
    ? await navigator.locks.request(`sitrep-evidence-${key}`, options.manual || options.onlyId ? {} : { ifAvailable: true }, (lock) => lock ? run() : { synchronized: 0, failed: 0, skipped: 0 })
    : await run()).finally(() => { runningSyncs.delete(key); });
  runningSyncs.set(key, promise);
  return promise;
}

/** Removes only this user's local pending copy; published evidence is never touched. */
export async function discardPendingInspectionEvidence(inspectionId: string, userId: string, evidenceId: string): Promise<void> {
  await changePendingEvidence(inspectionId, userId, async () => {
    const entry = await ownedUnpublishedEvidence(inspectionId, userId, evidenceId);
    await removePendingInspectionEvidence(entry.id);
  });
}

async function ownedUnpublishedEvidence(inspectionId: string, userId: string, evidenceId: string): Promise<PendingInspectionEvidence> {
  const entry = (await listPendingInspectionEvidence(inspectionId, userId)).find((candidate) => candidate.id === evidenceId);
  if (!entry || entry.uploaded) throw new Error('Esta captura ya cambió. Actualizá la lista antes de continuar.');
  return entry;
}

function changePendingEvidence<T>(inspectionId: string, userId: string, change: () => Promise<T>): Promise<T> {
  const key = JSON.stringify([userId, inspectionId]);
  const previous = [runningSyncs.get(key), pendingChanges.get(key)];
  const promise = Promise.all(previous).then(async () => navigator.locks ? await navigator.locks.request(`sitrep-evidence-${key}`, change) : await change()).finally(() => {
    if (pendingChanges.get(key) === promise) pendingChanges.delete(key);
  });
  pendingChanges.set(key, promise);
  return promise;
}

/** Caller must confirm loss of the original local copy before replacement. */
export async function replacePendingInspectionEvidence(inspectionId: string, userId: string, evidenceId: string, file: File): Promise<PendingInspectionEvidence> {
  return changePendingEvidence(inspectionId, userId, async () => {
    const entry = await ownedUnpublishedEvidence(inspectionId, userId, evidenceId);
    if (entry.failureKind !== 'terminal') throw new Error('Reintentá primero la captura para comprobar si el servidor ya la recibió.');
    // New bytes require a new idempotency key; both local changes commit together.
    const replacement = await buildPendingInspectionEvidence(inspectionId, userId, file, entry.fields);
    try { await replaceOffline(STORE, entry.id, replacement); }
    catch { throw new InspectionEvidenceStorageError(); }
    return replacement;
  });
}
