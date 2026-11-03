/** Unsent text for the limited acta link and its staff replies.
 * One key per link (accesoId) or per staff context + dossier; never shared between them.
 * A draft is removed only after a confirmed submission, a terminal access error or link expiry. */
export type ActPresentationDraft = { v: 1; nombre: string; tipo: string; texto: string; clienteId: string; savedAt: string; expiresAt?: string };
export type ActReplyDraft = { texto: string; clienteId: string; savedAt: string };
type ActReplyDrafts = { v: 1; replies: Record<string, ActReplyDraft> };

export const actPresentationDraftKey = (accesoId: string) => accesoId ? `sitrep_acta_link_draft_v1:${accesoId}` : '';
export const actReplyDraftKey = (contextKey: string) => contextKey ? `sitrep_acta_reply_draft_v1:${contextKey}` : '';

function read(key: string): unknown {
  if (!key) return null;
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function write(key: string, value: unknown | null): boolean {
  if (!key) return false;
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;

export function readPresentationDraft(accesoId: string, now = Date.now()): ActPresentationDraft | null {
  const key = actPresentationDraftKey(accesoId), value = read(key) as ActPresentationDraft | null;
  if (!value || value.v !== 1 || !text(value.nombre, 200) || !text(value.tipo, 20) || !text(value.texto, 12000) || !text(value.clienteId, 64)) return null;
  // An expired link can no longer submit; its text must not outlive it on a shared device.
  if (value.expiresAt && Date.parse(value.expiresAt) <= now) { write(key, null); return null; }
  return value;
}
export function presentationDraftEmpty(draft: Pick<ActPresentationDraft, 'nombre' | 'texto'>) { return !draft.nombre.trim() && !draft.texto.trim(); }
export function savePresentationDraft(accesoId: string, draft: Omit<ActPresentationDraft, 'v' | 'savedAt'>): boolean {
  return write(actPresentationDraftKey(accesoId), presentationDraftEmpty(draft) ? null : { v: 1, ...draft, savedAt: new Date().toISOString() });
}
export function clearPresentationDraft(accesoId: string): boolean { return write(actPresentationDraftKey(accesoId), null); }

export function readReplyDrafts(contextKey: string): Record<string, ActReplyDraft> {
  const value = read(actReplyDraftKey(contextKey)) as ActReplyDrafts | null;
  if (!value || value.v !== 1 || !value.replies || typeof value.replies !== 'object') return {};
  return Object.fromEntries(Object.entries(value.replies).filter(([, reply]) => reply && text(reply.texto, 12000) && text(reply.clienteId, 64)));
}
export function saveReplyDraft(contextKey: string, presentationId: string, reply: ActReplyDraft | null): boolean {
  const replies = { ...readReplyDrafts(contextKey) };
  if (reply && reply.texto.trim()) replies[presentationId] = reply; else delete replies[presentationId];
  return write(actReplyDraftKey(contextKey), Object.keys(replies).length ? { v: 1, replies } : null);
}
