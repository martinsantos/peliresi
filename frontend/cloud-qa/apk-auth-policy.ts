import assert from 'node:assert/strict';

export const apkOrigin = 'https://sitrep.ultimamilla.com.ar';
export const qaApkEmail = 'qa.apk.20261011@qa.invalid';
export function apkCredentials(value: string | undefined) {
  const data = JSON.parse(value || '{}');
  assert.equal(data.email, qaApkEmail);
  assert.match(data.id, /^[a-z0-9]{15,40}$/);
  assert.equal(typeof data.password, 'string');
  assert.ok(data.password.length >= 40 && data.password.length <= 128);
  return data as { id: string; email: string; password: string };
}

/** Production authentication only; no business writes, public recovery or emails. */
export function apkRequestAllowed(url: string, method: string, body: string | null, authenticated: boolean): boolean {
  const target = new URL(url);
  if (target.origin !== apkOrigin || target.username || target.password) return false;
  const route = target.pathname.replace(/\/$/, '');
  const reads = ['/api/health', '/api/auth/profile', '/api/auth/roles', '/api/manifiestos',
    '/api/manifiestos/dashboard', '/api/notificaciones', '/api/actores/generadores', '/api/actores/operadores',
    '/api/push/vapid-key'];
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return reads.includes(route);
  if (!authenticated || method !== 'POST') return false;
  if (route === '/api/auth/login') {
    try {
      const data = JSON.parse(body || '{}');
      return data.email === qaApkEmail && typeof data.password === 'string'
        && Object.keys(data).every(key => ['email', 'password'].includes(key));
    } catch { return false; }
  }
  return ['/api/auth/logout', '/api/auth/refresh-token'].includes(route);
}
