import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';

export interface ManifestFormData {
  generador: string; generadorId: string; modalidad: 'FIJO' | 'IN_SITU';
  transportista: string; vehiculoId: string; choferId: string; operador: string;
  fechaRetiro: string; observaciones: string;
  residuos: Array<{ tipo: string; cantidad: string; unidad: string }>;
}
export interface ManifestDraft { step: number; form: ManifestFormData }
type DraftOwner = { id: number | string; rol: string; actorId?: string; training?: boolean; empresaContexto?: { empresaId: string; actividadId: string; establecimientoId?: string } };
export function manifestDraftScope(user: DraftOwner | null) {
  return user ? JSON.stringify([user.id, user.rol, user.actorId || '', !!user.training, user.empresaContexto?.empresaId || '', user.empresaContexto?.actividadId || '', user.empresaContexto?.establecimientoId || '']) : '';
}
const lifetime = 7 * 24 * 60 * 60 * 1000;
// If browser storage is unavailable, preserve navigation within this open app.
// This fallback is deliberately not described as a saved draft.
const pendingDrafts = new Map<string, { draft: ManifestDraft; at: number }>();
function validDraft(value: unknown): value is ManifestDraft {
  if (!value || typeof value !== 'object') return false;
  const { step, form } = value as ManifestDraft;
  return [1, 2, 3].includes(step) && !!form && ['FIJO', 'IN_SITU'].includes(form.modalidad)
    && ['generador', 'generadorId', 'transportista', 'vehiculoId', 'choferId', 'operador', 'fechaRetiro', 'observaciones'].every(key => typeof form[key as keyof ManifestFormData] === 'string')
    && Array.isArray(form.residuos) && form.residuos.length > 0 && form.residuos.length <= 1000
    && form.residuos.every(row => row && ['tipo', 'cantidad', 'unidad'].every(key => typeof row[key as keyof typeof row] === 'string'));
}

/** Per-tab storage avoids two tabs overwriting one shared draft. No API calls.
 * The form is keyed by scope so role/company changes unmount this state first. */
export function useManifestDraft(scope: string, initial: ManifestDraft) {
  const key = 'sitrep:manifest-form:v1:' + scope;
  const [loaded] = useState(() => {
    const pending = pendingDrafts.get(key);
    if (pending && Date.now() - pending.at < lifetime) return { draft: pending.draft, restored: true, error: true };
    pendingDrafts.delete(key);
    try {
      const value = scope && JSON.parse(sessionStorage.getItem(key) || 'null');
      if (value?.version === 1 && Number.isFinite(value.savedAt) && value.savedAt <= Date.now()
        && Date.now() - value.savedAt < lifetime && validDraft(value.draft)) return { draft: value.draft as ManifestDraft, restored: true, error: false };
      return { draft: initial, restored: false, error: false };
    } catch { return { draft: initial, restored: false, error: true }; }
  });
  const [draft, setDraft] = useState(loaded.draft);
  const current = useRef(draft);
  const [restored, setRestored] = useState(loaded.restored);
  const [saved, setSaved] = useState(loaded.restored && !loaded.error);
  const [error, setError] = useState(loaded.error);
  const [dirty, setDirty] = useState(loaded.restored && loaded.error);
  const update = useCallback((change: SetStateAction<ManifestDraft>) => {
    const next = typeof change === 'function' ? change(current.current) : change;
    current.current = next;
    setDraft(next);
    setDirty(true);
    // Synchronous persistence also covers immediate navigation and SW reload.
    try {
      if (!scope) throw new Error('Missing owner');
      sessionStorage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), draft: next }));
      pendingDrafts.delete(key);
      setSaved(true); setError(false);
    } catch { pendingDrafts.set(key, { draft: next, at: Date.now() }); setSaved(false); setError(true); }
  }, [key, scope]);
  const clear = useCallback(() => {
    try { sessionStorage.removeItem(key); }
    catch { setError(true); return false; }
    pendingDrafts.delete(key);
    current.current = initial;
    setDraft(initial); setSaved(false); setRestored(false); setDirty(false); setError(false);
    return true;
  }, [initial, key]);
  useEffect(() => {
    if (!dirty || !error) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, error]);
  return { draft, update, clear, saved, restored, error, dirty };
}
