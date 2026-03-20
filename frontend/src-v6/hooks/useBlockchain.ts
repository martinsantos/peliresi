import { useQuery } from '@tanstack/react-query';
import { manifiestoService } from '../services/manifiesto.service';

export function useBlockchainStatus(manifiestoId: string, enabled = true) {
  return useQuery({
    queryKey: ['blockchain', manifiestoId],
    queryFn: () => manifiestoService.getBlockchainStatus(manifiestoId),
    enabled: enabled && !!manifiestoId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Refetch if legacy status is PENDIENTE
      if (data?.blockchainStatus === 'PENDIENTE') return 10_000;
      // Refetch if any sello is PENDIENTE
      if (data?.sellos?.some((s: { status: string }) => s.status === 'PENDIENTE')) return 10_000;
      return false;
    },
    staleTime: 30_000,
  });
}
