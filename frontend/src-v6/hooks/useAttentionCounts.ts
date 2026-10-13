import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supportPending, applicationTotals } from '../services/attention.service';

export function useAttentionCounts() {
  const { currentUser, isRestricted } = useAuth();
  const enabled = Boolean(currentUser && !isRestricted);
  const admin = Boolean(currentUser && ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'].includes(currentUser.rol));
  const support = useQuery({ queryKey: ['attention', currentUser?.id, 'support'], queryFn: supportPending,
    enabled, staleTime: 25_000, refetchInterval: 30_000, refetchIntervalInBackground: false });
  const applications = useQuery({ queryKey: ['attention', currentUser?.id, 'applications'], queryFn: applicationTotals,
    enabled: enabled && admin, staleTime: 25_000, refetchInterval: 30_000, refetchIntervalInBackground: false });
  return { support: support.data, applications: applications.data,
    applicationPending: applications.data ? applications.data.ENVIADA + applications.data.EN_REVISION : undefined };
}
