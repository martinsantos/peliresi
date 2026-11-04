export type DraftConflict<T> = { version: 1; id: string; revision: string; savedAt: number; value: T };
const lifetime = 7 * 86400000;

/** Separate keys prevent two tabs from overwriting each other's unresolved input.
 * Values are scoped by the caller's verified owner/role/record key. No File objects. */
export function draftConflicts<T>(ownerKey: string, validate: (value: unknown) => value is T, retainExpired?: (value: T) => boolean, rejectUnreadable = false) {
  const prefix = 'sitrep:draft-conflict:v1:' + encodeURIComponent(ownerKey) + ':';
  const parse = (raw: string | null): DraftConflict<T> | null => {
    try {
      const value = JSON.parse(raw || 'null');
      return value?.version === 1 && typeof value.id === 'string' && typeof value.revision === 'string'
        && Number.isFinite(value.savedAt) && validate(value.value)
        && ((value.savedAt <= Date.now() && Date.now() - value.savedAt < lifetime) || !!retainExpired?.(value.value)) ? value : null;
    } catch { return null; }
  };
  return {
    list(): DraftConflict<T>[] {
      const entries: DraftConflict<T>[] = [];
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (!key?.startsWith(prefix)) continue;
        const raw = localStorage.getItem(key);
        const entry = parse(raw);
        if ((!entry || key !== prefix + entry.id) && raw !== null && rejectUnreadable) throw new Error('Copia de conflicto ilegible');
        if (entry && key === prefix + entry.id) entries.push(entry);
      }
      return entries.sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id));
    },
    save(value: T, id: string): DraftConflict<T> {
      const entry: DraftConflict<T> = { version: 1, id, revision: crypto.randomUUID(), savedAt: Date.now(), value };
      localStorage.setItem(prefix + id, JSON.stringify(entry));
      return entry;
    },
    remove(entry: DraftConflict<T> | null) {
      if (!entry) return;
      const key = prefix + entry.id;
      // Resolving an older copy must never erase a newer edit made elsewhere.
      if (parse(localStorage.getItem(key))?.revision === entry.revision) localStorage.removeItem(key);
    },
  };
}
