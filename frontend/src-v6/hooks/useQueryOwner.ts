import { useAuth } from '../contexts/AuthContext';
import { inspectionWorkspaceOwner } from '../utils/inspectionWorkspace';

/** Presentation cache identity, never a substitute for server authorization. */
export function useQueryOwner(): string {
  const { currentUser, isRestricted } = useAuth();
  return isRestricted ? '' : inspectionWorkspaceOwner(currentUser);
}
