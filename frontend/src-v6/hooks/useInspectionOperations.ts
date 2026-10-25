import { useQuery } from '@tanstack/react-query';
import { inspectionWorkspaceOwner } from '../utils/inspectionWorkspace';
import { useAuth } from '../contexts/AuthContext';
import { canUseInspectionOperations, inspectionOperationsService, type InspectionOperationsParams } from '../services/inspectionOperations.service';

export function useInspectionOperations(params: InspectionOperationsParams = {}, enabled = true) {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: ['inspecciones', 'operaciones', currentUser?.id, inspectionWorkspaceOwner(currentUser), params],
    queryFn: () => inspectionOperationsService.list(params),
    enabled: enabled && canUseInspectionOperations(currentUser),
    staleTime: 15_000, refetchInterval: 30_000, refetchIntervalInBackground: false, retry: 1,
  });
}
