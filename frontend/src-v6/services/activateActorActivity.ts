import { api } from './api';
import { ACTIVITY_HEADER, saveActorActivity } from './actorActivity';
import { clearOfflineSession } from './offlineSession';

/** Confirm permission before persisting a role choice. The caller navigates only
 * after this resolves, so the next screen cannot use the old role's queries. */
export async function activateActorActivity(userId: string | number, role: string, expectedActorId?: string, stillRelevant?: () => boolean): Promise<void> {
  if (!['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(role)) throw new Error('Actividad incompatible');
  const result = await api.get('/auth/profile', { headers: { [ACTIVITY_HEADER]: role } });
  const user = result.data.data.user;
  if (String(user.id) !== String(userId) || user.rol !== role
    || (expectedActorId && user[role.toLowerCase()]?.id !== expectedActorId)) throw new Error('Actividad incompatible');
  // A screen that has been closed must not switch the user's context later.
  if (stillRelevant && !stillRelevant()) return;
  saveActorActivity(String(userId), role);
  clearOfflineSession();
}
