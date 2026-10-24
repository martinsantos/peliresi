import { useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/** URL-owned filters survive unmounts, reloads and browser history without sharing session state. */
export function useActorListNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const pending = useRef({ key: location.key, search: location.search, params: new URLSearchParams(params) });
  if (pending.current.key !== location.key || pending.current.search !== location.search) {
    pending.current = { key: location.key, search: location.search, params: new URLSearchParams(params) };
  }
  const set = (key: string, value: string | number | undefined) => {
    // Several setters (filter + page reset, or Restablecer) run in one event.
    // Merge them before React Router renders so none overwrites another.
    const next = new URLSearchParams(pending.current.params);
    if (value === '' || value === undefined) next.delete(key); else next.set(key, String(value));
    pending.current.params = next;
    setParams(next, { replace: true });
  };
  const text = (key: string, fallback = '') => params.get(key) || fallback;
  const number = (key: string, fallback: number) => {
    const raw = params.get(key);
    const value = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  };
  const open = (path: string) => {
    const query = pending.current.params.toString();
    navigate(path, { state: { actorReturn: location.pathname + (query ? '?' + query : '') } });
  };
  return { text, number, set, open };
}

/** Creation/editing may only return to the same actor list and router surface. */
export function actorListReturn(state: unknown, listPath: string): string {
  const value = (state as { actorReturn?: unknown } | null)?.actorReturn;
  if (typeof value !== 'string' || value.length > 6000 || /[\\\u0000-\u001f]/.test(value)) return listPath;
  try {
    const url = new URL(value, 'https://sitrep.invalid');
    return url.origin === 'https://sitrep.invalid' && url.pathname === listPath ? listPath + url.search : listPath;
  } catch { return listPath; }
}
