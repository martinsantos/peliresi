import type { SupportCreate } from '../types/support';
export type SupportDraft = { asunto: string; descripcion: string; categoria: SupportCreate['categoria'];
  pendiente?: { key: string; input: SupportCreate; files: Array<{ nombre: string; sha256: string }> } };
const storageKey = (owner: string) => 'sitrep-soporte:v1:' + encodeURIComponent(owner);
export function readSupportDraft(owner: string): SupportDraft | null {
  if (!owner) return null;
  try {
    const data = JSON.parse(localStorage.getItem(storageKey(owner)) || 'null');
    if (!data || typeof data.asunto !== 'string' || typeof data.descripcion !== 'string' || data.asunto.length > 180 || data.descripcion.length > 8000) return null;
    if (!['GENERAL', 'SESION', 'MANIFIESTOS', 'INSPECCIONES', 'GPS', 'QR', 'DOCUMENTOS', 'INTERFAZ'].includes(data.categoria)) return null;
    if (data.pendiente && (typeof data.pendiente.key !== 'string' || !Array.isArray(data.pendiente.files) || !data.pendiente.input)) return null;
    return data;
  } catch { return null; }
}
export function writeSupportDraft(owner: string, draft: SupportDraft): boolean {
  if (!owner) return false;
  try { localStorage.setItem(storageKey(owner), JSON.stringify(draft)); return true; } catch { return false; }
}
export function clearSupportDraft(owner: string): void { try { localStorage.removeItem(storageKey(owner)); } catch { /* state remains in memory */ } }
export async function supportFileDigests(files: File[]): Promise<Array<{ nombre: string; sha256: string }>> {
  return Promise.all(files.map(async file => ({ nombre: file.name, sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(byte => byte.toString(16).padStart(2, '0')).join('') })));
}
