/**
 * SITREP v6 - Reportes Hooks
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { inspectionWorkspaceOwner } from '../utils/inspectionWorkspace';
import { useMutation, useQuery } from '@tanstack/react-query';
import { reporteService } from '../services/reporte.service';
import type { ReporteFilters, ExportFormat } from '../types/api';

export function useReporteManifiestos(filters?: ReporteFilters) {
  const { currentUser, isRestricted } = useAuth();
  const owner = isRestricted ? '' : inspectionWorkspaceOwner(currentUser);
  return useQuery({
    queryKey: ['reportes', 'manifiestos', owner, filters],
    queryFn: () => reporteService.manifiestos(filters),
    enabled: !!owner && !!filters,
    staleTime: 5 * 60_000, // 5 min — report data doesn't need real-time freshness
  });
}

export function useReporteTratados(filters?: ReporteFilters) {
  const { currentUser, isRestricted } = useAuth();
  const owner = isRestricted ? '' : inspectionWorkspaceOwner(currentUser);
  return useQuery({
    queryKey: ['reportes', 'tratados', owner, filters],
    queryFn: () => reporteService.tratados(filters),
    enabled: !!owner && !!filters,
    staleTime: 5 * 60_000,
  });
}

export function useReporteTransporte(filters?: ReporteFilters) {
  const { currentUser, isRestricted } = useAuth();
  const owner = isRestricted ? '' : inspectionWorkspaceOwner(currentUser);
  return useQuery({
    queryKey: ['reportes', 'transporte', owner, filters],
    queryFn: () => reporteService.transporte(filters),
    enabled: !!owner && !!filters,
    staleTime: 5 * 60_000,
  });
}

export function useExportarReporte() {
  const { currentUser, isRestricted } = useAuth();
  const owner = isRestricted ? '' : inspectionWorkspaceOwner(currentUser);
  const currentOwner = useRef(owner); currentOwner.current = owner;
  useEffect(() => { currentOwner.current = owner; return () => { currentOwner.current = ''; }; }, [owner]);
  return useMutation({
    mutationFn: async ({ tipo, formato, filters }: { tipo: string; formato: ExportFormat; filters?: ReporteFilters }) => {
      if (!owner) throw new Error('Volvé a ingresar para exportar el reporte.');
      return { blob: await reporteService.exportar(tipo, formato, filters), owner };
    },
    onSuccess: ({ blob, owner: requestedOwner }, { tipo, formato }) => {
      if (currentOwner.current !== requestedOwner) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${tipo}.${formato === 'excel' ? 'xlsx' : formato}`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
