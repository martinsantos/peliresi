import { useEffect, useRef, useState, type SetStateAction } from 'react';
import { draftConflicts, type DraftConflict } from '../utils/draftConflicts';

type RecordValue<T> = { version: 1; revision: string; savedAt: number; value: T | null };
const pendingConflicts = new Map<string, { value: unknown; revision: string | null; savedAt: number }>();
/** A keyed form must remount when its verified account/role/record scope changes.
 * Saves input immediately (mobile shutdown has no reliable unload event). Never stores files. */
export function useRecoverableForm<T>(key: string, initial: T, validate: (value: unknown) => value is T) {
  const journal = draftConflicts(key, validate);
  const writer = useRef(crypto.randomUUID());
  const read = (): RecordValue<T> | null => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return data.version === 1 && typeof data.revision === 'string' && Number.isFinite(data.savedAt)
        && data.savedAt <= Date.now() && Date.now() - data.savedAt < 7 * 86400000
        && (data.value === null || validate(data.value)) ? data : null;
    } catch { return null; }
  };
  const [loaded] = useState(() => { try { return { record: read(), error: false }; } catch { return { record: null, error: true }; } });
  const [recovery] = useState(() => {
    const pending = pendingConflicts.get(key);
    if (pending && Date.now() - pending.savedAt < 7 * 86400000 && validate(pending.value)) return { ...pending, entry: null, durable: false, count: 1 };
    try {
      const entries = journal.list();
      return entries[0] ? { value: entries[0].value, revision: loaded.record?.revision ?? null, entry: entries[0], durable: true, count: entries.length } : null;
    } catch { return null; }
  });
  const selected = useRef<DraftConflict<T> | null>(recovery?.entry ?? null);
  const written = useRef<DraftConflict<T> | null>(null);
  const [conflictSaved, setConflictSaved] = useState(!!recovery?.durable);
  const [conflictCount, setConflictCount] = useState(recovery?.count ?? 0);
  const [value, setValue] = useState<T>(recovery ? recovery.value as T : loaded.record?.value ?? initial);
  const current = useRef(value), revision = useRef(recovery ? recovery.revision : loaded.record?.revision ?? null), edited = useRef(!!recovery);
  const [saved, setSaved] = useState(!!loaded.record?.value && !recovery);
  const [error, setError] = useState(loaded.error), [conflict, setConflict] = useState(!!recovery);
  const conflicted = useRef(!!recovery);
  const [restored, setRestored] = useState(!!loaded.record?.value);
  const preserveConflict = () => {
    pendingConflicts.set(key, { value: current.current, revision: revision.current, savedAt: Date.now() });
    conflicted.current = true; setConflict(true); setSaved(false);
    try {
      written.current = journal.save(current.current, writer.current);
      journal.remove(selected.current); selected.current = null;
      pendingConflicts.delete(key); setConflictSaved(true); setConflictCount(journal.list().length); setError(false);
    } catch { setConflictSaved(false); setError(true); }
  };
  const resolveConflict = () => {
    journal.remove(written.current); journal.remove(selected.current);
    written.current = null; selected.current = null; pendingConflicts.delete(key);
    const entries = journal.list(); const next = entries[0];
    setConflictCount(entries.length); setConflictSaved(!!next);
    if (!next) return false;
    selected.current = next; writer.current = crypto.randomUUID();
    current.current = next.value; edited.current = true; conflicted.current = true;
    setValue(next.value); setConflict(true); setSaved(false); setRestored(true);
    return true;
  };
  const persist = (next: T | null, force = false) => {
    try {
      const latest = read();
      if (!force && (conflicted.current || (latest?.revision ?? null) !== revision.current)) {
        preserveConflict(); return false;
      }
      const record: RecordValue<T> = { version: 1, revision: crypto.randomUUID(), savedAt: Date.now(), value: next };
      localStorage.setItem(key, JSON.stringify(record));
      revision.current = record.revision; conflicted.current=false; setSaved(next !== null); setError(false); setConflict(false);
      return !resolveConflict();
    } catch { setError(true); setSaved(false); return false; }
  };
  const update = (change: SetStateAction<T>) => {
    const next = typeof change === 'function' ? (change as (v: T) => T)(current.current) : change;
    current.current = next; edited.current = true; setValue(next); const saved=persist(next);return {saved,conflict:conflicted.current};
  };
  const reload = () => {
    try {
      const latest = read(); const next = latest?.value ?? initial;
      current.current = next; revision.current = latest?.revision ?? null; edited.current = false;
      conflicted.current=false;setValue(next); setSaved(!!latest?.value); setRestored(!!latest?.value); setConflict(false); setError(false);
      resolveConflict();
    } catch { setError(true); }
  };
  const clear = () => {
    if (!persist(null)) return false;
    current.current = initial; edited.current = false; setValue(initial); setRestored(false); return true;
  };
  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key !== key) return;
      try {
        const latest = read();
        if ((latest?.revision ?? null) === revision.current) return;
        if (edited.current) preserveConflict(); else reload();
      } catch { setError(true); }
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, [key]);
  useEffect(() => {
    if (!(error || (conflict && !conflictSaved)) || !edited.current) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [error, conflict, conflictSaved]);
  return { value, update, clear, saved, error, restored, conflict, conflictSaved, conflictCount, reload, overwrite: () => persist(current.current, true) };
}
