/**
 * Hooks for lazy-loading enrichment data from backend API.
 * Data is fetched once per session (24h staleTime) and cached by React Query.
 * Replaces the previous static imports from data/*.ts files (~550KB removed from bundle).
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { GeneradorEnriched } from '../data/generadores-enrichment';
import type { OperadorEnriched } from '../data/operadores-enrichment';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export function useGeneradoresEnrichment() {
  return useQuery({
    queryKey: ['enrichment', 'generadores'],
    queryFn: async () => {
      const { data } = await api.get('/catalogos/enrichment/generadores');
      return {
        generadores: data.data as Record<string, GeneradorEnriched>,
        topRubros: data.topRubros as string[],
      };
    },
    staleTime: TWENTY_FOUR_HOURS,
    gcTime: TWENTY_FOUR_HOURS,
  });
}

export function useOperadoresEnrichment() {
  return useQuery({
    queryKey: ['enrichment', 'operadores'],
    queryFn: async () => {
      const { data } = await api.get('/catalogos/enrichment/operadores');
      return {
        operadores: data.data as Record<string, OperadorEnriched>,
        porCorriente: data.porCorriente as Record<string, string[]>,
      };
    },
    staleTime: TWENTY_FOUR_HOURS,
    gcTime: TWENTY_FOUR_HOURS,
  });
}
