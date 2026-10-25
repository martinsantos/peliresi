import { useAuth } from '../contexts/AuthContext';
import { companyCacheScope } from '../services/companyContext';

export function useAdmissionContext() {
  const { currentUser } = useAuth();
  const owner = JSON.stringify([currentUser?.id, currentUser?.rol, currentUser?.actorId, companyCacheScope(currentUser?.empresaContexto || null), currentUser?.empresaContexto?.autorizacionId, currentUser?.empresaContexto?.revision, !!currentUser?.training]);
  const role = currentUser?.rol || '';
  return { owner, role, ready: !!currentUser, actorType: role.startsWith('ADMIN_') ? role.slice(6) : '' };
}
