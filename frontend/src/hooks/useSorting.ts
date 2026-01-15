/**
 * Hook reutilizable para sorting de tablas
 * Implementado como parte de la mega tarea de mejoras SITREP
 */

import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

/**
 * Obtiene un valor anidado de un objeto usando notación de punto
 * Ejemplo: getNestedValue(obj, 'user.name') → obj.user.name
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;

  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }

  return value;
}

/**
 * Compara dos valores para ordenamiento
 */
function compareValues(a: any, b: any, direction: SortDirection): number {
  // Manejar valores nulos/undefined
  if (a === null || a === undefined) return direction === 'asc' ? 1 : -1;
  if (b === null || b === undefined) return direction === 'asc' ? -1 : 1;

  // Si son fechas (string ISO o Date)
  if (typeof a === 'string' && typeof b === 'string') {
    // Intentar parsear como fecha
    const dateA = Date.parse(a);
    const dateB = Date.parse(b);
    if (!isNaN(dateA) && !isNaN(dateB)) {
      return direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
    // Comparar como strings (case insensitive)
    const strA = a.toLowerCase();
    const strB = b.toLowerCase();
    if (strA < strB) return direction === 'asc' ? -1 : 1;
    if (strA > strB) return direction === 'asc' ? 1 : -1;
    return 0;
  }

  // Si son números
  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a;
  }

  // Fallback: convertir a string y comparar
  const strA = String(a).toLowerCase();
  const strB = String(b).toLowerCase();
  if (strA < strB) return direction === 'asc' ? -1 : 1;
  if (strA > strB) return direction === 'asc' ? 1 : -1;
  return 0;
}

interface UseSortingOptions {
  defaultKey?: string;
  defaultDirection?: SortDirection;
}

interface UseSortingReturn<T> {
  sortedData: T[];
  sortConfig: SortConfig;
  handleSort: (key: string) => void;
  resetSort: () => void;
  getSortIcon: (key: string) => 'asc' | 'desc' | null;
}

/**
 * Hook para manejar el sorting de arrays de datos
 *
 * @example
 * const { sortedData, sortConfig, handleSort, getSortIcon } = useSorting(manifiestos, {
 *   defaultKey: 'createdAt',
 *   defaultDirection: 'desc'
 * });
 *
 * // En el header de la tabla:
 * <th onClick={() => handleSort('numero')} className="sortable-header">
 *   Número {getSortIcon('numero') && <SortIcon direction={getSortIcon('numero')} />}
 * </th>
 */
export function useSorting<T>(
  data: T[],
  options: UseSortingOptions = {}
): UseSortingReturn<T> {
  const {
    defaultKey = 'createdAt',
    defaultDirection = 'desc'
  } = options;

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: defaultKey,
    direction: defaultDirection
  });

  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return [...data].sort((a, b) => {
      const aVal = getNestedValue(a, sortConfig.key);
      const bVal = getNestedValue(b, sortConfig.key);
      return compareValues(aVal, bVal, sortConfig.direction);
    });
  }, [data, sortConfig]);

  const handleSort = useCallback((key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  }, []);

  const resetSort = useCallback(() => {
    setSortConfig({
      key: defaultKey,
      direction: defaultDirection
    });
  }, [defaultKey, defaultDirection]);

  const getSortIcon = useCallback((key: string): 'asc' | 'desc' | null => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction;
  }, [sortConfig]);

  return {
    sortedData,
    sortConfig,
    handleSort,
    resetSort,
    getSortIcon
  };
}

export default useSorting;
