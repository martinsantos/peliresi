export interface InspectionResume {
  hash: string;
  label: string;
  updatedAt: number;
}

const PREFIX = 'sitrep_inspection_resume_v1_';

function key(userId: string | number, inspectionId: string): string {
  return `${PREFIX}${encodeURIComponent(String(userId))}_${encodeURIComponent(inspectionId)}`;
}

/** Navigation only: never store a finding, actor data, or authentication here. */
export function saveInspectionResume(userId: string | number, inspectionId: string, hash: string, label: string): void {
  if (!userId || !inspectionId || !/^#[a-z-]+(?:\/[A-Za-z0-9_.~%+-]+)?$/.test(hash)) return;
  try {
    localStorage.setItem(key(userId, inspectionId), JSON.stringify({ hash, label: label.slice(0, 100), updatedAt: Date.now() } satisfies InspectionResume));
  } catch { /* Private mode or storage pressure must not interrupt field work. */ }
}

export function readInspectionResume(userId: string | number, inspectionId: string): InspectionResume | null {
  if (!userId || !inspectionId) return null;
  try {
    const value = JSON.parse(localStorage.getItem(key(userId, inspectionId)) || 'null') as InspectionResume | null;
    return value && /^#[a-z-]+(?:\/[A-Za-z0-9_.~%+-]+)?$/.test(value.hash)
      && typeof value.label === 'string' && Number.isFinite(value.updatedAt) ? value : null;
  } catch { return null; }
}

export function clearInspectionResume(userId: string | number, inspectionId: string): void {
  try { localStorage.removeItem(key(userId, inspectionId)); } catch { /* Best effort. */ }
}
