import { test, expect, type APIRequestContext } from '@playwright/test';
import { loginWithCredentials } from './helpers/auth';

const password = process.env.QA_ADMIN_PASSWORD || '';
const adminEmail = process.env.QA_ADMIN_EMAIL || '';
const roles = [
  ['ADMIN', adminEmail], ['GENERADOR', 'qa.generador.a@sitrep.local'],
  ['TRANSPORTISTA', 'qa.transportista@sitrep.local'], ['OPERADOR', 'qa.operador@sitrep.local'],
  ['ADMIN_GENERADOR', 'qa.admin.generador@sitrep.local'], ['ADMIN_TRANSPORTISTA', 'qa.admin.transportista@sitrep.local'],
  ['ADMIN_OPERADOR', 'qa.admin.operador@sitrep.local'], ['AUDITOR', 'qa.auditor@sitrep.local'],
] as const;
const enabled = process.env.QA_CONFIRM_ISOLATED === 'YES' && process.env.QA_E2E_CONFIRM === 'YES' && process.env.DISABLE_EMAILS === 'true' && !!password;

async function loginApi(request: APIRequestContext, email: string) {
  const response = await request.post('/api/auth/login', { data: { email, password } });
  expect(response.status(), `login ${email}`).toBe(200);
  const body = await response.json();
  expect(body.data?.tokens?.accessToken).toBeTruthy();
  return { Authorization: `Bearer ${body.data.tokens.accessToken}` };
}

test.describe('stabilization — isolated QA only', () => {
  test.skip(!enabled, 'Requires isolated QA fixture and disabled SMTP');
  test.beforeAll(async ({ baseURL, request }) => {
    expect(['127.0.0.1', 'localhost']).toContain(new URL(baseURL!).hostname);
    expect((await request.get('/api/health')).status()).toBe(200);
  });
  test.beforeEach(() => { test.setTimeout(90_000); });

  for (const [role, email] of roles) {
    test(`${role}: login, web/PWA manifests and role-aware actions`, async ({ page, request }, testInfo) => {
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await loginWithCredentials(page, { email, password, onboardingRole: role, startPath: '/app/login', clickLoginLink: false });
      await expect(page).toHaveURL(/\/app\/dashboard$/);
      await expect(page.getByRole('button', { name: /Total de manifiestos/ })).toBeVisible();
      if (!['ADMIN', 'GENERADOR', 'ADMIN_GENERADOR'].includes(role)) await expect(page.getByRole('button', { name: 'Nuevo Manifiesto', exact: true })).toHaveCount(0);
      await expect(page.getByText('No pudimos actualizar el resumen.', { exact: false })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`${role}-dashboard.png`), fullPage: false });
      for (const prefix of ['/app', '']) {
        await page.goto(`${prefix}/manifiestos`);
        await expect(page.locator('main')).toBeVisible();
        await expect(page.getByText(/Página no encontrada|Algo salió mal/i)).toHaveCount(0);
        await expect(page).not.toHaveURL(/login/);
      }
      if (role !== 'ADMIN') {
        const headers = await loginApi(request, email);
        expect((await request.get('/api/admin/usuarios', { headers })).status()).toBe(403);
        await page.goto('/app/admin/usuarios');
        await expect(page).toHaveURL(/\/app\/dashboard$/);
      }
      expect(errors).toEqual([]);
    });
  }

  test('PWA explains a failed dashboard query and recovers on retry', async ({ page }) => {
    await page.route('**/api/manifiestos/dashboard', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"QA temporary outage"}' }));
    await loginWithCredentials(page, { email: adminEmail, password, startPath: '/app/login', clickLoginLink: false });
    await expect(page.getByRole('alert').filter({ hasText: 'No pudimos actualizar' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('— en tránsito')).toBeVisible();
    await page.unroute('**/api/manifiestos/dashboard');
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'No pudimos actualizar' })).toHaveCount(0);
  });

  test('new actors remain inactive and cannot bypass documentary approval', async ({ request }) => {
    const headers = await loginApi(request, adminEmail);
    for (const [index, kind, entity] of [['1', 'generadores', 'generador'], ['2', 'transportistas', 'transportista'], ['3', 'operadores', 'operador']] as const) {
      const unique = `${Date.now()}${index}`;
      const created = await request.post(`/api/actores/${kind}`, { headers, data: {
        razonSocial: `QA pendiente ${unique}`, cuit: `30${unique.slice(-9)}`, email: `pending.${unique}@example.invalid`, domicilio: 'QA aislada', telefono: '2610000000', numeroInscripcion: `QA-${unique}`, numeroHabilitacion: `QA-${unique}`, categoria: 'QA',
      } });
      expect(created.status(), await created.text()).toBe(201);
      const actor = (await created.json()).data[entity];
      expect(actor.activo).toBe(false);
      const activate = await request.put(`/api/actores/${kind}/${actor.id}`, { headers, data: { activo: true } });
      expect([400, 409, 422]).toContain(activate.status());
      const detail = await request.get(`/api/actores/${kind}/${actor.id}`, { headers });
      expect((await detail.json()).data[entity].activo).toBe(false);
    }
  });

  test('scanner alias and review forms work at phone and desktop widths', async ({ page }, testInfo) => {
    await loginWithCredentials(page, { email: adminEmail, password, startPath: '/app/login', clickLoginLink: false });
    await page.goto('/app/escaner');
    await expect(page).toHaveURL(/\/app\/escaner-qr$/);
    for (const width of [360, 390, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/app/inscripcion/operador?modo=revision');
      await expect(page.getByText('Paso 1 de 8')).toBeVisible();
      await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
      await expect(page.getByText('Paso 2 de 8')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`review-${width}.png`), fullPage: false });
    }
  });

  test('national workflow uses all three actors and rejects cross-owner access', async ({ request, page }) => {
    test.setTimeout(120_000);
    const gen = await loginApi(request, 'qa.generador.a@sitrep.local');
    const otherGen = await loginApi(request, 'qa.generador.b@sitrep.local');
    const transport = await loginApi(request, 'qa.transportista@sitrep.local');
    const operator = await loginApi(request, 'qa.operador@sitrep.local');
    const created = await request.post('/api/manifiestos', { headers: gen, data: {
      generadorId: process.env.QA_ACTOR_ID, transportistaId: process.env.QA_TRANSPORTISTA_ID, operadorId: process.env.QA_OPERADOR_ID,
      residuos: [{ tipoResiduoId: process.env.QA_TIPO_RESIDUO_ID, cantidad: 42, unidad: 'kg' }], observaciones: 'QA aislada: ningún envío real',
    } });
    expect(created.status()).toBe(201);
    const manifest = (await created.json()).data.manifiesto;
    expect((await request.get(`/api/manifiestos/${manifest.id}`, { headers: otherGen })).status()).toBe(403);
    expect((await request.post(`/api/manifiestos/${manifest.id}/cerrar`, { headers: gen, data: {} })).status()).toBe(403);
    for (const [action, headers, data, state] of [
      ['firmar', gen, {}, 'APROBADO'],
      ['confirmar-retiro', transport, { latitud: -32.89, longitud: -68.84 }, 'EN_TRANSITO'],
      ['confirmar-entrega', transport, {}, 'ENTREGADO'],
      ['confirmar-recepcion', operator, { pesoReal: 42 }, 'RECIBIDO'],
      ['tratamiento', operator, { metodoTratamiento: 'QA-TRATAMIENTO' }, 'EN_TRATAMIENTO'],
      ['cerrar', operator, { metodoTratamiento: 'QA-TRATAMIENTO' }, 'TRATADO'],
    ] as const) {
      const response = await request.post(`/api/manifiestos/${manifest.id}/${action}`, { headers, data });
      expect(response.status(), `${action}: ${await response.text()}`).toBe(200);
      const detail = await request.get(`/api/manifiestos/${manifest.id}`, { headers: gen });
      expect((await detail.json()).data.manifiesto.estado).toBe(state);
    }
    const certificate = await request.get(`/api/pdf/certificado/${manifest.id}`, { headers: gen });
    expect(certificate.status()).toBe(200);
    expect(certificate.headers()['content-type']).toContain('application/pdf');
    await loginWithCredentials(page, { email: 'qa.operador@sitrep.local', password, startPath: '/app/login', clickLoginLink: false });
    for (const prefix of ['/app', '']) {
      await page.goto(`${prefix}/manifiestos/${manifest.id}`);
      await expect(page.getByText(manifest.numero, { exact: false }).first()).toBeVisible();
      await expect(page.getByText(/Tratado/i).first()).toBeVisible();
    }
  });
});
