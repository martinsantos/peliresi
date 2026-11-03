import { getAllOffline, updateOffline } from './indexeddb';
import { readInspectionFieldCheckpoint } from './inspectionFieldCheckpoint';
import type { PendingInspectionEvidence } from './inspectionOfflineEvidence';

export interface LegacyFieldCopy { source: 'checkpoint' | 'journal'; raw: string }
export interface LegacyFieldCopies { texts: LegacyFieldCopy[]; files: PendingInspectionEvidence[] }

function sameText(left: string, right: string): boolean {
  if (left === right) return true;
  try {
    const content = (raw: string) => {
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return raw;
      const { checkpointAt: _time, ...fields } = value;
      return JSON.stringify(fields);
    };
    return content(left) === content(right);
  } catch { return false; }
}

/** Call only after a fresh authorized read of this case. Never infer its role
 * from a legacy key: the inspector must choose the destination explicitly. */
export async function readLegacyFieldCopies(userId: string, inspectionId: string): Promise<LegacyFieldCopies> {
  if (!userId || !inspectionId) throw new Error('No se identificó la cuenta y el expediente.');
  try {
    const key = `sitrep_inspection_draft_${userId}_${inspectionId}`;
    const checkpoint = await readInspectionFieldCheckpoint(key);
    const journal = localStorage.getItem(key);
    const texts: LegacyFieldCopy[] = [];
    if (checkpoint) texts.push({ source: 'checkpoint', raw: checkpoint });
    // Keep both versions, including malformed bytes, available for download.
    if (journal && (!checkpoint || !sameText(journal, checkpoint))) texts.push({ source: 'journal', raw: journal });
    const files = (await getAllOffline<PendingInspectionEvidence>('inspection_evidence_queue'))
      .filter(entry => entry.userId === userId && entry.inspectionId === inspectionId && !entry.owner);
    return { texts, files };
  } catch {
    // An unavailable local store is not proof that no previous copies exist.
    throw new Error('No se pudo completar la búsqueda en el almacenamiento de este dispositivo. Conservá esta pantalla y volvé a buscar; no se borró ninguna copia.');
  }
}

/** One IDB transaction claims the existing capture, preserving bytes, hash and
 * client ID. Two activities/tabs cannot import it twice. Never sends a request. */
export async function recoverLegacyFieldEvidence(userId: string, inspectionId: string, owner: string, id: string): Promise<void> {
  if (!userId || !inspectionId || !owner || !id) throw new Error('No se identificó el destino de la captura.');
  await updateOffline<PendingInspectionEvidence>('inspection_evidence_queue', id, current => {
    if (!current || current.userId !== userId || current.inspectionId !== inspectionId
      || (current.owner && current.owner !== owner)) {
      throw new Error('La captura ya no está disponible en este contexto. Actualizá la revisión.');
    }
    if (current.owner) return current;
    return { ...current, owner, recoveredManually: true };
  });
}
