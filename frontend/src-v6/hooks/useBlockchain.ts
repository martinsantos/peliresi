import { useQuery } from '@tanstack/react-query';
import { manifiestoService } from '../services/manifiesto.service';

export function useBlockchainStatus(manifiestoId: string, enabled = true) {
  return useQuery({
    queryKey: ['blockchain', manifiestoId],
    queryFn: () => manifiestoService.getBlockchainStatus(manifiestoId),
    enabled: enabled && !!manifiestoId,
    refetchInterval: (query) => {
      const status = query.state.data?.blockchainStatus;
      return status === 'PENDIENTE' ? 10_000 : false;
    },
    staleTime: 30_000,
  });
}
