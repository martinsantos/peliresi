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
type StoredDraft = { version: 1; savedAt: number; draft: ManifestDraft | null };
// Never describe the memory fallback as durable storage.
const pendingDrafts = new Map<string, StoredDraft>();
// Keep the local side of an unresolved conflict across SPA navigation/session expiry.
// This is not durable: beforeunload warns until the person chooses a version.
const pendingConflicts = new Map<string, StoredDraft>();
function validDraft(value: unknown): value is ManifestDraft {
  if (!value || typeof value !== 'object') return false;
  const { step, form } = value as ManifestDraft;
  return [1, 2, 3].includes(step) && !!form && ['FIJO', 'IN_SITU'].includes(form.modalidad)
    && ['generador', 'generadorId', 'transportista', 'vehiculoId', 'choferId', 'operador', 'fechaRetiro', 'observaciones'].every(key => typeof form[key as keyof ManifestFormData] === 'string')
    && Array.isArray(form.residuos) && form.residuos.length > 0 && form.residuos.length <= 1000
    && form.residuos.every(row => row && ['tipo', 'cantidad', 'unidad'].every(key => typeof row[key as keyof typeof row] === 'string'));
}

function parseRecord(raw: string | null): StoredDraft | null {
  try {
    const value = JSON.parse(raw || 'null');
    return value?.version === 1 && Number.isFinite(value.savedAt) && value.savedAt <= Date.now()
      && Date.now() - value.savedAt < lifetime && (value.draft === null || validDraft(value.draft)) ? value : null;
  } catch { return null; }
}

/** One durable draft per person/role/actor on this browser, shared by web/app.
 * The form is keyed by scope so role/company changes unmount this state first. */
export function useManifestDraft(scope: string, initial: ManifestDraft) {
  const key = 'sitrep:manifest-form:v1:' + scope;
  const [loaded] = useState(() => {
    let durable: StoredDraft | null = null, legacy: StoredDraft | null = null, error = false;
    if (!scope) return { record: null, error: false, migrate: false };
    try { durable = parseRecord(localStorage.getItem(key)); } catch { error = true; }
    try { legacy = parseRecord(sessionStorage.getItem(key)); } catch { /* Session storage is no longer required. */ }
    const conflict = pendingConflicts.get(key);
    if (conflict && Date.now() - conflict.savedAt < lifetime) return { record: conflict, reference: durable, error, migrate: false, conflict: true };
    pendingConflicts.delete(key);
    const pending = pendingDrafts.get(key);
    if (pending && Date.now() - pending.savedAt < lifetime) return { record: pending, reference: durable, error: true, migrate: true };
    pendingDrafts.delete(key);
    // A durable clear marker prevents old tabs from resurrecting legacy drafts.
    const migrate = !!legacy && (!durable || legacy.savedAt > durable.savedAt);
    return { record: migrate ? legacy : durable, error, migrate };
  });
  const initialRef = useRef(initial);
  const [draft, setDraft] = useState(loaded.record?.draft || initial);
  const current = useRef(draft);
  const edited = useRef(!!loaded.conflict);
  const fingerprint = useRef(JSON.stringify('reference' in loaded ? loaded.reference : loaded.record));
  const conflicted = useRef(!!loaded.conflict);
  const [conflict, setConflict] = useState(!!loaded.conflict);
  const [restored, setRestored] = useState(!!loaded.record?.draft);
  const [saved, setSaved] = useState(!!loaded.record?.draft && !loaded.error && !loaded.migrate && !loaded.conflict);
  const [error, setError] = useState(loaded.error);
  const errorRef = useRef(error);
  const [dirty, setDirty] = useState(!!loaded.record?.draft);
  const persist = useCallback((next: ManifestDraft | null, force = false) => {
    const record: StoredDraft = { version: 1, savedAt: Date.now(), draft: next };
    try {
      if (!scope) throw new Error('Missing owner');
      const latest = parseRecord(localStorage.getItem(key));
      if (!force && (conflicted.current || JSON.stringify(latest) !== fingerprint.current)) {
        pendingConflicts.set(key, { version: 1, savedAt: Date.now(), draft: current.current });
        conflicted.current = true; setConflict(true); setSaved(false); return false;
      }
      // Mobile shutdown does not guarantee unload. Persist on every input.
      localStorage.setItem(key, JSON.stringify(record));
      fingerprint.current = JSON.stringify(record); conflicted.current = false; setConflict(false); pendingConflicts.delete(key);
      pendingDrafts.delete(key);
      try { sessionStorage.removeItem(key); } catch { /* Durable record supersedes the legacy copy. */ }
      errorRef.current = false; setSaved(!!next); setError(false);
      return true;
    } catch {
      if (next) pendingDrafts.set(key, record);
      errorRef.current = true; setSaved(false); setError(true);
      return false;
    }
  }, [key, scope]);
  useEffect(() => {
    if (loaded.migrate && loaded.record?.draft) persist(loaded.record.draft, true);
  }, [loaded, persist]);
  const update = useCallback((change: SetStateAction<ManifestDraft>) => {
    let previous = current.current;
    if (!errorRef.current && !edited.current) {
      try {
        const latest = parseRecord(localStorage.getItem(key));
        fingerprint.current = JSON.stringify(latest);
        if (latest) previous = latest.draft || initialRef.current;
      } catch { /* Keep current input and retry persistence below. */ }
    }
    const next = typeof change === 'function' ? change(previous) : change;
    current.current = next; edited.current = true; setDraft(next); setDirty(true);
    persist(next);
  }, [key, persist]);
  const clear = useCallback(() => {
    // A tombstone also invalidates copies still open in other tabs.
    if (!persist(null)) return false;
    current.current = initialRef.current;
    edited.current = false;
    setDraft(initialRef.current); setRestored(false); setDirty(false);
    return true;
  }, [persist]);
  const checkConflict = useCallback(() => {
    try {
      const changed = JSON.stringify(parseRecord(localStorage.getItem(key))) !== fingerprint.current;
      if (changed) { pendingConflicts.set(key, {version:1,savedAt:Date.now(),draft:current.current}); conflicted.current = true; setConflict(true); setSaved(false); }
      return changed || conflicted.current;
    } catch { return false; } // Storage errors are reported by persistence; they do not erase input.
  }, [key]);
  const reload = useCallback(() => {
    try {
      const record = parseRecord(localStorage.getItem(key));
      const next = record?.draft || initialRef.current;
      fingerprint.current = JSON.stringify(record); current.current = next; edited.current = false;
      pendingDrafts.delete(key); pendingConflicts.delete(key); conflicted.current = false; errorRef.current = false;
      setDraft(next); setRestored(!!record?.draft); setSaved(!!record?.draft); setDirty(!!record?.draft); setConflict(false); setError(false);
    } catch { setError(true); }
  }, [key]);
  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      if (event.key !== key || (event.storageArea && event.storageArea !== localStorage) || errorRef.current) return;
      // Never replace input already edited here, including when another tab cleared its copy.
      if (edited.current) checkConflict(); else reload();
    };
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, [key, checkConflict, reload]);
  useEffect(() => {
    if (!dirty || !(error || conflict)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, error, conflict]);
  return { draft, update, clear, saved, restored, error, dirty, conflict, checkConflict, reload, overwrite: () => persist(current.current, true) };
}
