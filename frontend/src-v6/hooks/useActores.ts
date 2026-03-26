/**
 * SITREP v6 - Actores Hooks (barrel re-export)
 * ==============================================
 * Individual hooks live in useGeneradores.ts, useTransportistas.ts, useOperadores.ts.
 * This barrel file re-exports everything for backward compatibility.
 */

import { useQuery } from '@tanstack/react-query';
import { actoresService } from '../services/actores.service';

export * from './useGeneradores';
export * from './useTransportistas';
export * from './useOperadores';

// Historial de cambios (shared across actor types)
export function useHistorialActor(tipo: string, id: string, filters?: { anio?: number; modulo?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['historial-actor', tipo, id, filters] as const,
    queryFn: () => actoresService.getHistorialActor(tipo, id, filters),
    enabled: !!tipo && !!id,
  });
}
