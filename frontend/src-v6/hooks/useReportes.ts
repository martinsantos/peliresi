/**
 * SITREP v6 - Reportes Hooks
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { reporteService } from '../services/reporte.service';
import type { ReporteFilters, ExportFormat } from '../types/api';

export function useReporteManifiestos(filters?: ReporteFilters) {
  return useQuery({
    queryKey: ['reportes', 'manifiestos', filters],
    queryFn: () => reporteService.manifiestos(filters),
    enabled: !!filters,
    staleTime: 5 * 60_000, // 5 min — report data doesn't need real-time freshness
  });
}

export function useReporteTratados(filters?: ReporteFilters) {
  return useQuery({
    queryKey: ['reportes', 'tratados', filters],
    queryFn: () => reporteService.tratados(filters),
    enabled: !!filters,
    staleTime: 5 * 60_000,
  });
}

export function useReporteTransporte(filters?: ReporteFilters) {
  return useQuery({
    queryKey: ['reportes', 'transporte', filters],
    queryFn: () => reporteService.transporte(filters),
    enabled: !!filters,
    staleTime: 5 * 60_000,
  });
}

export function useExportarReporte() {
  return useMutation({
    mutationFn: ({ tipo, formato, filters }: { tipo: string; formato: ExportFormat; filters?: ReporteFilters }) =>
      reporteService.exportar(tipo, formato, filters),
    onSuccess: (blob, { tipo, formato }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${tipo}.${formato === 'excel' ? 'xlsx' : formato}`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
