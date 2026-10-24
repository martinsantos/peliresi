import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activityOwner, readActorActivity, saveActorActivity, clearActorActivity } from '../../services/actorActivity';
import { OFFLINE_SESSION_KEY, saveOfflineSession, readOfflineSession } from '../../services/offlineSession';
import type { User } from '../../contexts/AuthContext';
const token = (id: string, extra = {}) => 'header.' + btoa(JSON.stringify({ id, exp: 4000000000, ...extra })) + '.signature';
const originalSet = Storage.prototype.setItem;
describe('durable activity preference with tab-scoped working context', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true'); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  it('never confuses users, draft tokens or impersonation with an activity grant', () => {
    saveActorActivity('one', 'OPERADOR');
    expect(readActorActivity(token('one'))).toBe('OPERADOR');
    expect(readActorActivity(token('two'))).toBeNull();
    expect(readActorActivity(token('one', { restricted: true }))).toBeNull();
    expect(readActorActivity(token('one', { impersonatedBy: 'admin' }))).toBeNull();
    expect(activityOwner('broken')).toBeNull();
    expect(localStorage.getItem('sitrep_activity:one')).toBe('OPERADOR');
  });
  it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'])('recovers %s after closing the tab without carrying another account role', role => {
    saveActorActivity('one', role);
    sessionStorage.clear();
    expect(readActorActivity(token('two'))).toBeNull();
    expect(readActorActivity(token('one'))).toBe(role);
    expect(sessionStorage.getItem('sitrep_activity:one')).toBe(role);
  });
  it('pins an open form to its role while a different tab selects another role', () => {
    saveActorActivity('one', 'OPERADOR');
    localStorage.setItem('sitrep_activity:one', 'TRANSPORTISTA'); // another tab
    expect(readActorActivity(token('one'))).toBe('OPERADOR');
    sessionStorage.clear();
    expect(readActorActivity(token('one'))).toBe('TRANSPORTISTA');
  });
  it('also pins the base role, so a background tab cannot change its request scope', () => {
    expect(readActorActivity(token('one'))).toBeNull();
    localStorage.setItem('sitrep_activity:one', 'OPERADOR');
    expect(readActorActivity(token('one'))).toBeNull();
    sessionStorage.clear();
    expect(readActorActivity(token('one'))).toBe('OPERADOR');
  });
  it('migrates an existing session once, preserving a newer durable choice', () => {
    sessionStorage.setItem('sitrep_activity:one', 'TRANSPORTISTA');
    expect(readActorActivity(token('one'))).toBe('TRANSPORTISTA');
    expect(localStorage.getItem('sitrep_activity:one')).toBe('TRANSPORTISTA');
    localStorage.setItem('sitrep_activity:one', 'OPERADOR');
    expect(readActorActivity(token('one'))).toBe('TRANSPORTISTA');
    expect(localStorage.getItem('sitrep_activity:one')).toBe('OPERADOR');
  });
  it('does not resurrect a revoked choice after reopening or legacy-tab migration', () => {
    saveActorActivity('one', 'OPERADOR');
    clearActorActivity('one');
    sessionStorage.clear();
    expect(readActorActivity(token('one'))).toBeNull();
    sessionStorage.setItem('sitrep_activity:one', 'OPERADOR'); // older tab
    expect(readActorActivity(token('one'))).toBe('OPERADOR'); // still server-validated
    expect(localStorage.getItem('sitrep_activity:one')).toBe('');
    sessionStorage.clear();
    expect(readActorActivity(token('one'))).toBeNull();
  });
  it.each(['ADMIN', 'SUPER_ADMIN', 'garbage'])('never restores invalid stored activity %s', role => {
    localStorage.setItem('sitrep_activity:one', role);
    expect(readActorActivity(token('one'))).toBeNull();
    expect(() => saveActorActivity('one', role)).toThrow('Actividad inválida');
  });
  it('keeps the validated tab usable if persistent storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, key, value) {
      if (this === localStorage) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      originalSet.call(this, key, value);
    });
    saveActorActivity('one', 'OPERADOR');
    expect(readActorActivity(token('one'))).toBe('OPERADOR');
    sessionStorage.clear();
    expect(readActorActivity(token('one'))).toBeNull();
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
