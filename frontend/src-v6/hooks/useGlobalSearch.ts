import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { searchService, SearchResult } from '../services/search.service';

const RECENT_KEY = 'sitrep_recent_searches';
const MAX_RECENT = 5;

export function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistRecent(q: string) {
  const prev = loadRecent();
  const next = [q, ...prev.filter((s) => s !== q)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export interface FlatResult {
  type: 'manifiesto' | 'generador' | 'transportista' | 'operador';
  id: string;
  label: string;
  sublabel: string;
  estado?: string;
  href: string;
}

function flatten(data: SearchResult | undefined): FlatResult[] {
  if (!data) return [];
  const results: FlatResult[] = [];
  for (const m of data.manifiestos) {
    results.push({ type: 'manifiesto', id: m.id, label: m.numero, sublabel: m.generador?.razonSocial || '', estado: m.estado, href: `/manifiestos/${m.id}` });
  }
  for (const g of data.generadores) {
    results.push({ type: 'generador', id: g.id, label: g.razonSocial, sublabel: g.cuit, href: '/actores?tipo=generadores' });
  }
  for (const t of data.transportistas) {
    results.push({ type: 'transportista', id: t.id, label: t.razonSocial, sublabel: t.cuit, href: `/actores/transportistas/${t.id}` });
  }
  for (const o of data.operadores) {
    results.push({ type: 'operador', id: o.id, label: o.razonSocial, sublabel: o.cuit, href: `/actores/operadores/${o.id}` });
  }
  return results;
}

interface UseGlobalSearchOptions {
  onClose: () => void;
}

export function useGlobalSearch({ onClose }: UseGlobalSearchOptions) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [activeEstado, setActiveEstado] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecent);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [query]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['global-search', debouncedQuery, activeEstado],
    queryFn: () => searchService.search(debouncedQuery, activeEstado || undefined),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const flatResults = flatten(data);

  const navigateTo = useCallback((href: string) => {
    if (query.trim().length >= 2) {
      persistRecent(query.trim());
      setRecentSearches(loadRecent());
    }
    onClose();
    navigate(href);
  }, [query, onClose, navigate]);

  // Keyboard handler — always active while panel is mounted
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (flatResults.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        navigateTo(flatResults[focusedIndex].href);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [flatResults, focusedIndex, onClose, navigateTo]);

  // Reset focused index when results change
  useEffect(() => { setFocusedIndex(-1); }, [debouncedQuery, activeEstado]);

  return {
    query, setQuery,
    activeEstado, setActiveEstado,
    isLoading: isLoading && debouncedQuery.length >= 2,
    isError: isError && debouncedQuery.length >= 2,
    data,
    flatResults,
    focusedIndex, setFocusedIndex,
    recentSearches,
    navigateTo,
  };
}
