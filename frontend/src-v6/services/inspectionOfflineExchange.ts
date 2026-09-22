import type { InspectionExchangeType } from '../types/inspection';
import { getOffline, removeOffline, saveOffline } from './indexeddb';

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

const key = (userId: string, inspectionId: string) => `${userId}:${inspectionId}`;

export async function saveOfflineExchangeDraft(
  userId: string,
  inspectionId: string,
  draft: OfflineExchangeDraftData,
  files: File[],
): Promise<void> {
  if (!userId || !inspectionId) throw new Error('El borrador offline requiere usuario y expediente');
  await saveOffline('inspection_exchange_drafts', {
    id: key(userId, inspectionId),
    userId,
    inspectionId,
    savedAt: new Date().toISOString(),
    draft,
    files: files.map((file) => ({
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      blob: file.slice(0, file.size, file.type),
    })),
  } satisfies StoredExchangeDraft);
}

export async function loadOfflineExchangeDraft(userId: string, inspectionId: string): Promise<RestoredExchangeDraft | null> {
  const stored = await getOffline<StoredExchangeDraft>('inspection_exchange_drafts', key(userId, inspectionId));
  if (!stored || stored.userId !== userId || stored.inspectionId !== inspectionId) return null;
  return {
    draft: stored.draft,
    savedAt: stored.savedAt,
    files: stored.files.map((file) => new File([file.blob], file.name, { type: file.type, lastModified: file.lastModified })),
  };
}

export async function removeOfflineExchangeDraft(userId: string, inspectionId: string): Promise<void> {
  await removeOffline('inspection_exchange_drafts', key(userId, inspectionId));
}
