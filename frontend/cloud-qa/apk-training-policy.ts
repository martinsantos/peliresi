import assert from 'node:assert/strict';
import { apkOrigin } from './apk-auth-policy.ts';

export const trainingQaEmail = 'qa.apk.training.20261012@qa.invalid';
export function trainingCredentials(value: string | undefined) {
  const data = JSON.parse(value || '{}');
  assert.equal(data.email, trainingQaEmail);
  assert.match(data.id, /^[a-z0-9]{15,40}$/);
  assert.ok(typeof data.password === 'string' && data.password.length >= 40 && data.password.length <= 128);
  return data as { id: string; email: string; password: string };
}

/** An extra test-side guard, not application authorization. Never fabricate responses. */
export function trainingRequestAllowed(url: string, method: string, body: string | null, authorization: string | undefined, teacherId: string) {
  const target = new URL(url);
  if (target.origin !== apkOrigin || target.username || target.password) return false;
  const route = target.pathname.replace(/\/$/, '');
  if (method === 'POST' && route === '/api/auth/login') {
    try { return JSON.parse(body || '{}').email === trainingQaEmail; } catch { return false; }
  }
  if (method === 'POST' && ['/api/auth/logout', '/api/auth/refresh-token'].includes(route)) return true;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method) && ['/api/health', '/api/auth/profile', '/api/auth/roles', '/api/push/vapid-key'].includes(route)) return true;
  let claims: { id?: string; realm?: string; impersonatedBy?: string };
  try { claims = JSON.parse(Buffer.from((authorization || '').replace(/^Bearer /, '').split('.')[1], 'base64url').toString()); } catch { return false; }
  if (claims.id === teacherId && !claims.realm && !claims.impersonatedBy) {
    return method === 'GET' && ['/api/admin/training/usuarios', '/api/notificaciones'].includes(route)
      || method === 'POST' && /^\/api\/admin\/training\/impersonate\/cap-20261012-(?:transportista|generador|operador|inspector)-[1-5]$/.test(route);
  }
  if (claims.realm !== 'sitrep-capacitacion-v1' || claims.impersonatedBy !== teacherId || !/^cap-20261012-(?:transportista|generador|operador|inspector)-[1-5]$/.test(claims.id || '')) return false;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return /^\/api\/(?:manifiestos|inspecciones|actores|catalogos|notificaciones|soporte|analytics|centro-control|reportes|alertas)(?:\/|$)/.test(route);
  // The only business write in this APK run is an actor's synthetic reply.
  return method === 'POST' && /^\/api\/inspecciones\/cap-20261012-participacion-5-(?:TRANSPORTISTA|GENERADOR|OPERADOR)-abierta\/intercambios$/.test(route);
}
