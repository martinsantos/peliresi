import { getAllOffline, removeOffline, saveOffline } from './indexeddb';

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
}

const STORE = 'inspection_evidence_queue' as const;

function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function sha256(file: Blob): Promise<string> {
  if (!crypto.subtle) return '';
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function queueInspectionEvidence(
  inspectionId: string,
  userId: string,
  file: File,
  fields: PendingInspectionEvidenceFields = {},
): Promise<PendingInspectionEvidence> {
  const capturedAt = new Date(file.lastModified || Date.now()).toISOString();
  const pending: PendingInspectionEvidence = {
    id: randomId(),
    inspectionId,
    userId,
    file,
    fileName: file.name,
    mimeType: file.type,
    lastModified: file.lastModified,
    fields,
    capturedAt,
    sha256: await sha256(file),
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await saveOffline(STORE, pending);
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
