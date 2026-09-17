/** End-to-end smoke test for the isolated training environment. */
const base = process.env.DEMO_BASE_URL || 'https://www.ultimamilla.com.ar/demoambiente/api';
const password = process.env.DEMO_TRAINING_PASSWORD;
if (!password) throw new Error('DEMO_TRAINING_PASSWORD is required');

type Json = Record<string, any>;

async function request(path: string, init: RequestInit = {}, token?: string): Promise<Json> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({})) as Json;
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function login(email: string) {
  const response = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  return response.data as { user: Json; tokens: { accessToken: string; refreshToken: string } };
}

async function manifestCount(token: string): Promise<number> {
  const response = await request('/manifiestos?limit=100', {}, token);
  return Number(response.data.pagination.total);
}

async function main() {
  const results: Json = {};
  results.health = (await request('/health')).status === 'ok';

  const profiles = [
    ['capacitacion.admin@sitrep.invalid', 'ADMIN', 36],
    ['alfa.generador@sitrep.invalid', 'GENERADOR', 9],
    ['alfa.transporte@sitrep.invalid', 'TRANSPORTISTA', 18],
    ['alfa.operador@sitrep.invalid', 'OPERADOR', 12],
  ] as const;

  let admin: Awaited<ReturnType<typeof login>> | null = null;
  for (const [email, role, count] of profiles) {
    const session = await login(email);
    const profile = await request('/auth/profile', {}, session.tokens.accessToken);
    const visible = await manifestCount(session.tokens.accessToken);
    if (profile.data.user.rol !== role || visible !== count) {
      throw new Error(`${email}: expected ${role}/${count}, got ${profile.data.user.rol}/${visible}`);
    }
    results[email] = { role, visibleManifests: visible };
    if (role === 'ADMIN') admin = session;
  }
  if (!admin) throw new Error('Admin session missing');

  const refreshed = await request('/auth/refresh-token', {
    method: 'POST', body: JSON.stringify({ refreshToken: admin.tokens.refreshToken }),
  });
  results.refreshToken = Boolean(refreshed.data.accessToken && refreshed.data.refreshToken);

  const dashboard = await request('/manifiestos/dashboard', {}, admin.tokens.accessToken);
  results.dashboardTotal = dashboard.data.estadisticas.total;
  if (Number(results.dashboardTotal) !== 36) throw new Error(`Dashboard total ${results.dashboardTotal} != 36`);

  const from = new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const report = await request(`/reportes/manifiestos?fechaInicio=${from}&fechaFin=${to}&limit=100`, {}, admin.tokens.accessToken);
  results.reportRows = report.data.manifiestos.length;
  if (results.reportRows !== 36) throw new Error(`Report rows ${results.reportRows} != 36`);

  const users = await request('/admin/usuarios?limit=100&search=alfa.', {}, admin.tokens.accessToken);
  for (const email of ['alfa.generador@sitrep.invalid', 'alfa.operador@sitrep.invalid']) {
    const target = users.data.usuarios.find((item: Json) => item.email === email);
    if (!target) throw new Error(`Impersonation target not found: ${email}`);
    const impersonation = await request(`/admin/impersonate/${target.id}`, { method: 'POST' }, admin.tokens.accessToken);
    const profile = await request('/auth/profile', {}, impersonation.data.tokens.accessToken);
    if (profile.data.user.email !== email) throw new Error(`Impersonation failed for ${email}`);
    results[`impersonation:${email}`] = await manifestCount(impersonation.data.tokens.accessToken);
  }

  console.log(JSON.stringify({ ok: true, base, results }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
