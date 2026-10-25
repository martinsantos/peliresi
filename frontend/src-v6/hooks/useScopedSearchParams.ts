import { useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

const fallbackOwners = new Map<string, string>();
function previousOwner(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return fallbackOwners.get(key) || null; }
}

/** Filters belong to a browser history entry and its verified account context.
 * This is presentation state only: API permissions and query scoping remain mandatory. */
export function useScopedSearchParams(namespace: string, keys: readonly string[], owner: string) {
  const location = useLocation();
  const [raw, setRaw] = useSearchParams();
  const storageKey = `sitrep:filter-owner:${namespace}`;
  const state = location.state && typeof location.state === 'object' ? location.state : {};
  const owners = state.filterOwners && typeof state.filterOwners === 'object' ? state.filterOwners : {};
  const stampedOwner = typeof owners[namespace] === 'string' ? owners[namespace] : null;
  const knownOwner = stampedOwner || previousOwner(storageKey);
  const mismatch = !!owner && !!knownOwner && knownOwner !== owner;
  // Discard another context's filters before the first query, not after a flash of stale work.
  const params = new URLSearchParams(raw);
  if (mismatch) keys.forEach(key => params.delete(key));
  const search = params.toString();
  const nextState = { ...state, filterOwners: { ...owners, [namespace]: owner } };

  useEffect(() => {
    if (!owner) return;
    fallbackOwners.set(storageKey, owner);
    try { sessionStorage.setItem(storageKey, owner); } catch { /* History still isolates this tab. */ }
    if (stampedOwner !== owner || mismatch) setRaw(new URLSearchParams(search), { replace: true, state: nextState });
  }, [owner, location.key, location.search, namespace]); // Each entry is stamped once, including login redirects.

  return [params, (next: URLSearchParams) => setRaw(next, { replace: true, state: nextState })] as const;
}
