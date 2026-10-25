import type { InspectionExchangeType } from '../types/inspection';
import { getOffline, removeOffline, saveOffline } from './indexeddb';
import { inspectionContextKey } from '../utils/inspectionWorkspace';

export interface OfflineExchangeDraftData {
  tipo: InspectionExchangeType;
  asunto: string;
  cuerpo: string;
  respondeAId: string;
  plazoRespuestaAt: string;
}

type StoredExchangeFile = {
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
};

type StoredExchangeDraft = {
  id: string;
  userId: string;
  owner: string;
  inspectionId: string;
  savedAt: string;
  draft: OfflineExchangeDraftData;
  files: StoredExchangeFile[];
};

export type RestoredExchangeDraft = {
  draft: OfflineExchangeDraftData;
  files: File[];
  savedAt: string;
};

const pendingWrites = new Map<string, Promise<void>>();

export async function saveOfflineExchangeDraft(
  userId: string,
  inspectionId: string,
  owner: string,
  draft: OfflineExchangeDraftData,
  files: File[],
): Promise<void> {
  if (!userId || !inspectionId || !owner) throw new Error('El borrador offline requiere usuario, actividad y expediente');
  const id = inspectionContextKey(userId, owner, inspectionId);
  const record = {
    id,
    userId,
    owner,
    inspectionId,
    savedAt: new Date().toISOString(),
    draft,
    files: files.map((file) => ({
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      blob: file.slice(0, file.size, file.type),
    })),
  } satisfies StoredExchangeDraft;
  const write = (pendingWrites.get(id) || Promise.resolve()).catch(() => undefined)
    .then(() => saveOffline('inspection_exchange_drafts', record));
  pendingWrites.set(id, write);
  try { await write; } finally { if (pendingWrites.get(id) === write) pendingWrites.delete(id); }
}

export async function loadOfflineExchangeDraft(userId: string, inspectionId: string, owner: string): Promise<RestoredExchangeDraft | null> {
  const id = inspectionContextKey(userId, owner, inspectionId);
  if (!id) return null;
  // Returning immediately to a role must wait for its departing editor's flush.
  await pendingWrites.get(id);
  const stored = await getOffline<StoredExchangeDraft>('inspection_exchange_drafts', id);
  if (!stored || stored.id !== id || stored.userId !== userId || stored.owner !== owner || stored.inspectionId !== inspectionId) return null;
  return {
    draft: stored.draft,
    savedAt: stored.savedAt,
    files: stored.files.map((file) => new File([file.blob], file.name, { type: file.type, lastModified: file.lastModified })),
  };
}

export async function removeOfflineExchangeDraft(userId: string, inspectionId: string, owner: string): Promise<void> {
  const id = inspectionContextKey(userId, owner, inspectionId);
  if (id) { await pendingWrites.get(id); await removeOffline('inspection_exchange_drafts', id); }
}
