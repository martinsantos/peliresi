/**
 * SITREP — flujo seguro de administradores sectoriales.
 *
 * Este E2E usa las cuentas reales de Ivana, Santiago y Marcia mediante
 * impersonación del ADMIN raíz. No crea usuarios, no cambia estados, no
 * modifica alertas y no llama a endpoints de envío de correo.
 *
 * Uso:
 *   SITREP_ADMIN_EMAIL=... SITREP_ADMIN_PASSWORD=... \
 *   npx ts-node --transpile-only backend/tests/sector-admin-flow-smoke.ts
 *
 * El password se suministra por entorno y nunca se imprime.
 */

type Json = Record<string, any>;

const BASE = (process.env.SITREP_BASE_URL || 'https://sitrep.ultimamilla.com.ar').replace(/\/$/, '');
const API = `${BASE}/api`;
const ADMIN_EMAIL = process.env.SITREP_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SITREP_ADMIN_PASSWORD;

const TARGETS = [
  {
    label: 'Ivana / administradora de generadores',
    email: 'ipintos@mendoza.gov.ar',
    role: 'ADMIN_GENERADOR',
    probeAction: 'firmar',
  },
  {
    label: 'Santiago Bracellis / ADMIN + transporte',
    email: 'sbracelis@gmail.com',
    role: 'ADMIN',
    probeAction: 'confirmar-retiro',
  },
  {
    label: 'Marcia / administradora de operadores',
    email: 'mardengo@mendoza.gov.ar',
    role: 'ADMIN_OPERADOR',
    probeAction: 'confirmar-recepcion',
  },
] as const;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('Faltan SITREP_ADMIN_EMAIL y SITREP_ADMIN_PASSWORD. No se aceptan credenciales en argumentos ni en el archivo.');
}

async function request(path: string, token?: string, init: RequestInit = {}): Promise<{ status: number; body: Json }> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const text = await response.text();
  let body: Json = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 200) }; }
  return { status: response.status, body };
}

function tokenFrom(body: Json): string {
  return body?.data?.tokens?.accessToken || body?.data?.accessToken || '';
}

function usersFrom(body: Json): Json[] {
  return body?.data?.usuarios || body?.data?.users || body?.usuarios || body?.users || [];
}

function manifestsFrom(body: Json): Json[] {
  return body?.data?.manifiestos || body?.data?.items || body?.manifiestos || body?.items || [];
}

function check(condition: boolean, message: string, detail?: unknown): void {
  if (!condition) throw new Error(`${message}${detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`);
  console.log(`PASS ${message}`);
}

async function main(): Promise<void> {
  const health = await fetch(`${API}/health`);
  check(health.status === 200, 'SITREP API health responde 200');

  const login = await request('/auth/login', undefined, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const adminToken = tokenFrom(login.body);
  check(login.status === 200 && Boolean(adminToken), 'ADMIN raíz puede iniciar sesión');

  const usersResponse = await request('/admin/usuarios?activo=true&limit=200', adminToken);
  check(usersResponse.status === 200, 'ADMIN raíz puede consultar usuarios activos');
  const users = usersFrom(usersResponse.body);

  const cancelProbe = manifestsFrom((await request('/manifiestos?estado=CANCELADO&limit=1', adminToken)).body)[0];
  check(Boolean(cancelProbe?.id), 'Existe un manifiesto CANCELADO para una sonda no mutante');

  const checks = [
    ['/auth/profile', 200],
    ['/manifiestos/dashboard', 200],
    ['/manifiestos?limit=1', 200],
    ['/notificaciones?limit=1', 200],
    ['/alertas?limit=1', 200],
    ['/centro-control/actividad?capas=generadores,transportistas,operadores,transito', 200],
    ['/catalogos/generadores', 200],
    ['/catalogos/transportistas', 200],
    ['/catalogos/operadores', 200],
  ] as const;

  for (const target of TARGETS) {
    const user = users.find((candidate) => candidate.email === target.email);
    check(Boolean(user?.id), `${target.label}: cuenta real encontrada`, target.email);
    check(user.activo === true, `${target.label}: cuenta activa`);
    const impersonation = await request(`/admin/impersonate/${encodeURIComponent(user.id)}`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const token = tokenFrom(impersonation.body);
    check(impersonation.status === 200 && Boolean(token), `${target.label}: impersonación emitió sesión`);

    const profile = await request('/auth/profile', token);
    const profileUser = profile.body?.data?.usuario || profile.body?.data?.user || profile.body?.usuario || profile.body?.user;
    check(profile.status === 200 && profileUser?.rol === target.role, `${target.label}: perfil devuelve ${target.role}`);

    for (const [path, expected] of checks) {
      const result = await request(path, token);
      check(result.status === expected, `${target.label}: GET ${path} -> ${expected}`, result.status);
    }

    // Sonda de autorización sectorial: cada administración intenta únicamente
    // la transición que corresponde a su tramo del workflow. Un manifiesto
    // CANCELADO nunca admite el paso, por lo que esperamos 400 sin mutación.
    const action = await request(`/manifiestos/${encodeURIComponent(cancelProbe.id)}/${target.probeAction}`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    check(
      action.status === 400,
      `${target.label}: ${target.probeAction} pasa autorización y CANCELADO bloquea transición (400)`,
      action.status,
    );
  }

  console.log('RESULT OK — sin cambios de workflow, sin correos, sin push y sin avisos in-app.');
  console.log('Nota: la impersonación registra únicamente sus auditorías/sesiones normales.');
}

main().catch((error) => {
  console.error(`RESULT FAIL — ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
