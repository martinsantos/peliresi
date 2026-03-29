/**
 * useTableState — shared hook for search + sort + pagination state.
 * Replaces ~500 lines of duplicate state management across 15+ pages.
 * Includes debounced search (300ms) to avoid API calls on every keystroke.
 */

import { useState, useCallback } from 'react';
import { useDebounce } from './useDebounce';

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface UseTableStateOptions {
  /** Initial search (e.g. from URL params) */
  initialSearch?: string;
  /** Items per page */
  pageSize?: number;
  /** Default sort */
  defaultSort?: SortConfig | null;
  /** Debounce delay for search (ms) */
  debounceMs?: number;
}

export function useTableState(options: UseTableStateOptions = {}) {
  const { initialSearch = '', pageSize = 20, defaultSort = null, debounceMs = 300 } = options;

  const [search, setSearchRaw] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [sort, setSortRaw] = useState<SortConfig | null>(defaultSort);

  // Debounced search value for API calls
  const debouncedSearch = useDebounce(search, debounceMs);

  // Setting search resets page to 1
  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPage(1);
  }, []);

  // Toggle sort: same key → flip direction, new key → desc
  const toggleSort = useCallback((key: string) => {
    setSortRaw(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
      }
      return { key, direction: 'desc' };
    });
    setPage(1);
  }, []);

  // Reset everything
  const resetAll = useCallback(() => {
    setSearchRaw('');
    setPage(1);
    setSortRaw(defaultSort);
  }, [defaultSort]);

  return {
    // Search
    search,
    setSearch,
    debouncedSearch,

    // Pagination
    page,
    setPage,
    pageSize,

    // Sort
    sort,
    toggleSort,

    // Utility
    resetAll,
  };
}
