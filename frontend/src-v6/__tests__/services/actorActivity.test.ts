import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activityOwner, readActorActivity, saveActorActivity } from '../../services/actorActivity';
import { OFFLINE_SESSION_KEY, saveOfflineSession, readOfflineSession } from '../../services/offlineSession';
import type { User } from '../../contexts/AuthContext';
const token = (id: string, extra = {}) => 'header.' + btoa(JSON.stringify({ id, exp: 4000000000, ...extra })) + '.signature';
describe('tab-scoped activity selection', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true'); });
  afterEach(() => vi.unstubAllEnvs());
  it('never confuses users, draft tokens or impersonation with an activity grant', () => {
    saveActorActivity('one', 'OPERADOR');
    expect(readActorActivity(token('one'))).toBe('OPERADOR');
    expect(readActorActivity(token('two'))).toBeNull();
    expect(readActorActivity(token('one', { restricted: true }))).toBeNull();
    expect(readActorActivity(token('one', { impersonatedBy: 'admin' }))).toBeNull();
    expect(activityOwner('broken')).toBeNull();
    expect(localStorage.length).toBe(0);
  });
  it('does not activate the feature by merely having a saved selection', () => {
    saveActorActivity('one', 'OPERADOR'); vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'false');
    expect(readActorActivity(token('one'))).toBeNull();
  });
  it('keeps the offline profile in the same tab, not the shared account cache', () => {
    const user: User = { id: 'one', rol: 'OPERADOR', nombre: 'QA', email: 'qa@test.invalid', sector: '', avatar: 'QA', telefono: '', ubicacion: '', permisos: [] };
    saveOfflineSession(user, token('one'));
    expect(readOfflineSession(token('one'))?.user.rol).toBe('OPERADOR');
    expect(localStorage.getItem(OFFLINE_SESSION_KEY)).toBeNull();
    sessionStorage.clear(); // a different tab must not inherit the offline role
    expect(readOfflineSession(token('one'))).toBeNull();
  });
});
