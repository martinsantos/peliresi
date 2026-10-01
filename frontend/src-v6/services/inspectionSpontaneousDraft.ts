import { getAllOffline, removeOffline, saveOffline } from './indexeddb';
import { validateInspectionEvidence } from './inspectionOfflineEvidence';
import type { InspectionActorType } from '../types/inspection';

const STORE = 'inspection_spontaneous_drafts' as const;
const RECOVERY_PREFIX = 'sitrep_finding_recovery_v1:';

export interface SpontaneousFindingPhoto {
  id: string;
  file: Blob;
  fileName: string;
  mimeType: string;
  lastModified: number;
  capturedAt: string;
}

export interface SpontaneousFindingDraft {
  id: string;
  userId: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  actorType?: InspectionActorType;
  actorId?: string;
  inspectionType?: 'ESPONTANEA' | 'PETROLEO' | 'AIRE';
  photos: SpontaneousFindingPhoto[];
  createdAt: string;
  updatedAt: string;
  serverInspectionId?: string;
  serverInspectionNumber?: string;
  lastError?: string;
}

const randomId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function newSpontaneousFinding(userId: string | number): SpontaneousFindingDraft {
  const now = new Date().toISOString();
  return { id: randomId(), userId: String(userId), inspectionType: 'ESPONTANEA', description: '', location: '', photos: [], createdAt: now, updatedAt: now };
}

const recoveryKey = (draft: Pick<SpontaneousFindingDraft, 'userId' | 'id'>) => `${RECOVERY_PREFIX}${encodeURIComponent(draft.userId)}:${draft.id}`;
export const findingHasContent = (draft: SpontaneousFindingDraft) => Boolean(draft.description.trim() || draft.location.trim() || draft.photos.length);
const recoveryValue = (draft: { photos: SpontaneousFindingPhoto[] }) => JSON.stringify({ ...draft, photos: undefined, photoIds: draft.photos.map((photo) => photo.id) });

/** A synchronous text journal protects the last keystroke; photos stay in IndexedDB. */
export function protectSpontaneousText(draft: SpontaneousFindingDraft): void {
  localStorage.setItem(recoveryKey(draft), recoveryValue(draft));
}

export async function spontaneousPhoto(file: File): Promise<SpontaneousFindingPhoto> {
  const mimeType = await validateInspectionEvidence(file);
  if (!mimeType.startsWith('image/')) throw new Error('El hallazgo espontáneo admite fotos JPG, PNG o WEBP.');
  return { id: randomId(), file, fileName: file.name, mimeType, lastModified: file.lastModified, capturedAt: new Date(file.lastModified || Date.now()).toISOString() };
}

export async function saveSpontaneousFinding(input: Omit<SpontaneousFindingDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string }): Promise<SpontaneousFindingDraft> {
  if (!input.userId) throw new Error('No se pudo identificar al inspector.');
  const now = new Date().toISOString();
  const draft: SpontaneousFindingDraft = { ...input, id: input.id || randomId(), createdAt: input.createdAt || now, updatedAt: now, description: input.description.trim(), location: input.location.trim() };
  await saveOffline(STORE, draft);
  // Do not erase typing that arrived while the IndexedDB write was pending.
  try {
    const saved = localStorage.getItem(recoveryKey(draft));
    if (saved === recoveryValue(input)) localStorage.removeItem(recoveryKey(draft));
  } catch { /* Leave the recovery record intact if it cannot be inspected. */ }
  return draft;
}

export async function listSpontaneousFindings(userId: string | number): Promise<SpontaneousFindingDraft[]> {
  const drafts = new Map((await getAllOffline<SpontaneousFindingDraft>(STORE)).filter((draft) => draft.userId === String(userId)).map((draft) => [draft.id, draft]));
  const prefix = `${RECOVERY_PREFIX}${encodeURIComponent(String(userId))}:`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const recovery = JSON.parse(localStorage.getItem(key) || 'null');
      if (!recovery || recovery.userId !== String(userId) || typeof recovery.id !== 'string' || typeof recovery.description !== 'string' || typeof recovery.location !== 'string' || typeof recovery.updatedAt !== 'string') continue;
      const stored = drafts.get(recovery.id);
      if (!stored || recovery.updatedAt >= stored.updatedAt) drafts.set(recovery.id, { ...recovery, photos: (stored?.photos || []).filter((photo) => !Array.isArray(recovery.photoIds) || recovery.photoIds.includes(photo.id)) });
    } catch { /* One malformed journal must not hide the other findings. */ }
  }
  return [...drafts.values()].filter(findingHasContent).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function removeSpontaneousFinding(id: string): Promise<void> {
  await removeOffline(STORE, id);
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(RECOVERY_PREFIX) && key.endsWith(':' + id)) localStorage.removeItem(key);
  }
}

export function spontaneousFindingFile(photo: SpontaneousFindingPhoto): File {
  return new File([photo.file], photo.fileName, { type: photo.mimeType, lastModified: photo.lastModified });
}
