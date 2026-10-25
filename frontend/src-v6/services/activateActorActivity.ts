import { api } from './api';
import { ACTIVITY_HEADER, saveActorActivity } from './actorActivity';
import { clearOfflineSession } from './offlineSession';

/** Confirm permission before persisting a role choice. The caller navigates only
 * after this resolves, so the next screen cannot use the old role's queries. */
export async function activateActorActivity(userId: string | number, role: string): Promise<void> {
  if (!['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(role)) throw new Error('Actividad incompatible');
  const result = await api.get('/auth/profile', { headers: { [ACTIVITY_HEADER]: role } });
  if (String(result.data.data.user.id) !== String(userId) || result.data.data.user.rol !== role) throw new Error('Actividad incompatible');
  saveActorActivity(String(userId), role);
  clearOfflineSession();
}
