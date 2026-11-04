import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useQueryOwner } from './useQueryOwner';
import { supportPending, applicationTotals } from '../services/attention.service';

export type AttentionState = 'hidden' | 'loading' | 'error' | 'ready';

export function useAttentionCounts() {
  const { currentUser } = useAuth();
  const owner = useQueryOwner();
  const enabled = Boolean(owner);
  const admin = Boolean(currentUser && ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'].includes(currentUser.rol));
  const support = useQuery({ queryKey: ['attention', owner, 'support'], queryFn: supportPending,
    enabled, staleTime: 25_000, refetchInterval: 30_000, refetchIntervalInBackground: false });
  const applications = useQuery({ queryKey: ['attention', owner, 'applications'], queryFn: applicationTotals,
    enabled: enabled && admin, staleTime: 25_000, refetchInterval: 30_000, refetchIntervalInBackground: false });
  const supportState: AttentionState = !enabled ? 'hidden' : support.isError ? 'error' : support.isPending ? 'loading' : 'ready';
  const applicationsState: AttentionState = !enabled || !admin ? 'hidden' : applications.isError ? 'error' : applications.isPending ? 'loading' : 'ready';
  const totals = applicationsState === 'ready' ? applications.data : undefined;
  return { support: supportState === 'ready' ? support.data : undefined, applications: totals,
    supportState, applicationsState,
    applicationPending: totals ? totals.ENVIADA + totals.EN_REVISION : undefined };
}
