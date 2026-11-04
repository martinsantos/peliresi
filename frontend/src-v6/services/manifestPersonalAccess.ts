import { api } from './api';
import { ACTIVITY_HEADER } from './actorActivity';

export type ManifestActivity = 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
export type ManifestPersonalAccess = { rol: ManifestActivity; actorId: string };
const fields: Record<ManifestActivity, string> = { GENERADOR: 'generadorId', TRANSPORTISTA: 'transportistaId', OPERADOR: 'operadorId' };
export const isManifestActivity = (value: string): value is ManifestActivity => Object.prototype.hasOwnProperty.call(fields, value);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);

/** These reads do not change the active context. The server authorizes each
 * activity and returns 404 both for a missing and an inaccessible manifest. */
export async function personalManifestAccess(manifestId: string, roles: string[], signal?: AbortSignal): Promise<{ accesses: ManifestPersonalAccess[]; incomplete: boolean }> {
  if (!validId(manifestId)) throw new Error('Manifiesto inválido');
  const activities = [...new Set(roles.filter(isManifestActivity))];
  const results = await Promise.allSettled(activities.map(async rol => {
    const response = await api.get('/manifiestos/' + encodeURIComponent(manifestId), { headers: { [ACTIVITY_HEADER]: rol }, signal });
    const manifest = response.data.data?.manifiesto || response.data.data;
    if (manifest?.id !== manifestId || !validId(manifest[fields[rol]])) throw new Error('Respuesta incompleta');
    return { rol, actorId: manifest[fields[rol]] as string };
  }));
  const accesses: ManifestPersonalAccess[] = []; let incomplete = false;
  for (const result of results) {
    if (result.status === 'fulfilled') accesses.push(result.value);
    else {
      const status = (result.reason as { response?: { status?: number } } | null)?.response?.status;
      if (status !== 403 && status !== 404) incomplete = true;
    }
  }
  return { accesses, incomplete };
}
