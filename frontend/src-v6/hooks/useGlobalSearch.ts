import { useState, useEffect, useMemo, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { searchService } from '../services/search.service';
import type { SearchResult } from '../services/search.service';
import { useQueryOwner } from './useQueryOwner';

const recentKey = (owner: string) => 'sitrep_recent_searches:v2:' + owner;
const MAX_RECENT = 5;
export function loadRecent(owner: string): string[] {
  if (!owner) return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(recentKey(owner)) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && v.trim().length >= 2 && v.length <= 200))].slice(0, MAX_RECENT) : [];
  } catch { return []; }
}
function persistRecent(owner: string, q: string) {
  const next = [q, ...loadRecent(owner).filter(s => s !== q)].slice(0, MAX_RECENT);
  try { localStorage.setItem(recentKey(owner), JSON.stringify(next)); } catch { /* History is optional; navigation must still work. */ }
  return next;
}
export interface FlatResult {
  type: 'manifiesto' | 'generador' | 'transportista' | 'operador';
  id: string; label: string; sublabel: string; estado?: string; href: string;
}
function flatten(data: SearchResult | undefined, prefix: string): FlatResult[] {
  if (!data) return [];
  return [
    ...data.manifiestos.map(m => ({ type: 'manifiesto' as const, id: m.id, label: m.numero, sublabel: m.generador?.razonSocial || '', estado: m.estado, href: `${prefix}/manifiestos/${encodeURIComponent(m.id)}` })),
    ...(['generador', 'transportista', 'operador'] as const).flatMap((type, index) => {
      const kind = (['generadores', 'transportistas', 'operadores'] as const)[index];
      return data[kind].map(actor => ({ type, id: actor.id, label: actor.razonSocial, sublabel: actor.cuit, href: `${prefix}/admin/actores/${kind}/${encodeURIComponent(actor.id)}` }));
    }),
  ];
}
export function useGlobalSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate(), location = useLocation(), owner = useQueryOwner();
  // React Router keeps /app in its basename; only embedded /mobile needs a prefix.
  const prefix = /^\/mobile(?:\/|$)/.test(location.pathname) ? '/mobile' : '';
  const [input, setInput] = useState({ owner, query: '', estado: '' });
  const query = input.owner === owner ? input.query : '';
  const activeEstado = input.owner === owner ? input.estado : '';
  const setQuery = (value: string) => setInput({ owner, query: value.slice(0, 200), estado: activeEstado });
  const setActiveEstado = (value: string) => setInput({ owner, query, estado: value });
  const [settled, setSettled] = useState({ owner, query: '' });
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [history, setHistory] = useState<{ owner: string; values: string[] } | null>(null);
  const storedHistory = useMemo(() => loadRecent(owner), [owner]);
  const recentSearches = history?.owner === owner ? history.values : storedHistory;
  useEffect(() => {
    const timer = setTimeout(() => setSettled({ owner, query: query.trim() }), 300);
    return () => clearTimeout(timer);
  }, [owner, query]);
  const ready = Boolean(owner) && query.trim().length >= 2 && settled.owner === owner && settled.query === query.trim();
  const result = useQuery({
    queryKey: ['global-search', owner, settled.query, activeEstado],
    queryFn: () => searchService.search(settled.query, activeEstado || undefined),
    enabled: ready, staleTime: 30_000,
  });
  const data = ready && !result.isError ? result.data : undefined;
  const flatResults = useMemo(() => flatten(data, prefix), [data, prefix]);
  useEffect(() => { setFocusedIndex(-1); }, [flatResults, query, activeEstado, owner]);
  const navigateTo = useCallback((href: string) => {
    if (!owner) return;
    if (query.trim().length >= 2) setHistory({ owner, values: persistRecent(owner, query.trim()) });
    onClose();
    const target = prefix && !href.startsWith(prefix + '/') ? prefix + href : href;
    navigate(target, { state: { actorReturn: location.pathname + location.search + location.hash } });
  }, [owner, query, prefix, location, onClose, navigate]);
  const onQueryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && flatResults.length) { event.preventDefault(); setFocusedIndex(i => Math.min(i + 1, flatResults.length - 1)); }
    else if (event.key === 'ArrowUp' && flatResults.length) { event.preventDefault(); setFocusedIndex(i => Math.max(i - 1, 0)); }
    else if (event.key === 'Enter' && flatResults[focusedIndex]) { event.preventDefault(); navigateTo(flatResults[focusedIndex].href); }
  };
  return { query, setQuery, activeEstado, setActiveEstado, data, flatResults, focusedIndex, setFocusedIndex, recentSearches, navigateTo, onQueryKeyDown,
    isLoading: Boolean(owner) && query.trim().length >= 2 && (!ready || result.isPending || result.isFetching),
    isError: ready && result.isError, retry: result.refetch,
  };
}
