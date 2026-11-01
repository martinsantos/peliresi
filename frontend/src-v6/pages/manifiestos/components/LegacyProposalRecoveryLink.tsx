import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useImpersonation } from '../../../contexts/ImpersonationContext';
import { useMobilePrefix } from '../../../hooks/useMobilePrefix';
import { manifestProposalsVisible } from '../../../utils/manifestFeatures';
import { manifestWorkspaceReturn, previousManifestReturn } from '../../../utils/manifestListReturn';

/** Opens a separate form, preserving its existing per-context draft. The
 * server continues to authorize every read and creation independently. */
export function LegacyProposalRecoveryLink({ manifestId }: { manifestId: string }) {
  const { currentUser, isRestricted } = useAuth();
  const { impersonationData } = useImpersonation();
  const location = useLocation();
  const mp = useMobilePrefix();
  const listPath = mp('/manifiestos');
  const validSource = previousManifestReturn({ manifestPreviousId: manifestId }, listPath);
  const roleCanCreate = currentUser?.rol === 'ADMIN' ||
    (['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(currentUser?.rol || '') && !!currentUser?.actorId);
  if (!validSource || !currentUser || !roleCanCreate || isRestricted ||
      impersonationData || !manifestProposalsVisible(currentUser)) return null;

  const origin = manifestWorkspaceReturn(location.state, listPath);
  const originState = origin.label === 'Inicio' ? { manifestHomeReturn: origin.path } : { manifestListReturn: origin.path };
  return <Link to={mp('/manifiestos/nuevo')} state={{ ...originState, manifestPreviousId: manifestId }}
    className="mt-2 inline-flex min-h-11 items-center rounded-lg font-semibold text-primary-800 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
    Abrir nueva propuesta
  </Link>;
}
