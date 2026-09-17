import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { loginWithCredentials } from './helpers/auth';

/**
 * Production-readiness acceptance gates.
 *
 * This suite is deliberately unable to run against a public deployment. It
 * uses only the disposable QA fixture and leaves SMTP disabled. The tests
 * exercise the failure modes that a normal happy-path UI test does not cover:
 * duplicate delivery, PWA reload persistence, and the actual actor handoffs.
 */
const enabled = process.env.QA_CONFIRM_ISOLATED === 'YES'
  && process.env.QA_E2E_CONFIRM === 'YES'
  && process.env.QA_E2E_ENABLED === 'true'
  && process.env.DISABLE_EMAILS === 'true'
  && Boolean(process.env.QA_ADMIN_PASSWORD);

const password = process.env.QA_ADMIN_PASSWORD || '';
const ids = {
  generator: process.env.QA_ACTOR_ID || '',
  transportista: process.env.QA_TRANSPORTISTA_ID || '',
  operador: process.env.QA_OPERADOR_ID || '',
  residuo: process.env.QA_TIPO_RESIDUO_ID || '',
};

async function loginApi(request: APIRequestContext, email: string) {
  const response = await request.post('/api/auth/login', { data: { email, password } });
  expect(response.status(), `login ${email}`).toBe(200);
  const body = await response.json();
  return { Authorization: `Bearer ${body.data.tokens.accessToken}` };
}

async function createQaManifest(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.post('/api/manifiestos', {
    headers,
    data: {
      generadorId: ids.generator,
      transportistaId: ids.transportista,
      operadorId: ids.operador,
      residuos: [{ tipoResiduoId: ids.residuo, cantidad: 42, unidad: 'kg' }],
      observaciones: `QA continuity gate ${Date.now()}`,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data.manifiesto as { id: string; numero: string };
}

async function waitForState(request: APIRequestContext, headers: Record<string, string>, id: string, estado: string) {
  await expect.poll(async () => {
    const response = await request.get(`/api/manifiestos/${id}`, { headers });
    if (!response.ok()) return `HTTP ${response.status()}`;
    return (await response.json()).data.manifiesto.estado;
  }, { timeout: 25_000, intervals: [250, 500, 1000] }).toBe(estado);
}

async function replaceSession(page: Page, email: string) {
  await page.goto('/app/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await loginWithCredentials(page, { email, password, startPath: '/app/login', clickLoginLink: false });
}

async function createQaManifestThroughUi(page: Page) {
  await page.goto('/app/manifiestos/nuevo');
  await expect(page.getByRole('main').getByRole('heading', { name: 'Nuevo Manifiesto', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await page.getByRole('button', { name: 'Buscar tipo de residuo...', exact: true }).click();
  await page.getByRole('button', { name: /QA-Y1 - Residuo sintético de prueba/i }).click();
  await page.locator('input[type="number"]').fill('42');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();

  await page.getByRole('button', { name: /Buscar transportista por nombre o CUIT/i }).click();
  await page.getByRole('button', { name: /Transporte QA/i }).click();
  await page.getByRole('button', { name: /Buscar operador por nombre o CUIT/i }).click();
  await page.getByRole('button', { name: /Operador QA/i }).click();
  await page.getByPlaceholder('Observaciones adicionales...').fill(`QA UI continuity gate ${Date.now()}`);

  await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).click();
  await page.waitForURL(
    (url) => /^\/app\/manifiestos\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/nuevo'),
    { timeout: 25_000 },
  );
  const id = page.url().match(/\/app\/manifiestos\/([^/?#]+)/)?.[1];
  expect(id).toBeTruthy();
  return { id: id! };
}

test.describe('production readiness — isolated QA only', () => {
  test.skip(!enabled, 'Requires an explicitly confirmed isolated QA database with SMTP disabled');
  test.skip(Object.values(ids).some((id) => !id), 'QA fixture IDs are required');
  test.beforeEach(() => test.setTimeout(120_000));

  test('a concurrent retry commits exactly one signature event', async ({ request }) => {
    const generator = await loginApi(request, 'qa.generador.a@sitrep.local');
    const manifest = await createQaManifest(request, generator);

    const [first, replay] = await Promise.all([
      request.post(`/api/manifiestos/${manifest.id}/firmar`, { headers: generator, data: {} }),
      request.post(`/api/manifiestos/${manifest.id}/firmar`, { headers: generator, data: {} }),
    ]);
    expect([first.status(), replay.status()].sort()).toEqual([200, 400]);

    const detail = await request.get(`/api/manifiestos/${manifest.id}`, { headers: generator });
    expect(detail.status()).toBe(200);
    const saved = (await detail.json()).data.manifiesto;
    expect(saved.estado).toBe('APROBADO');
    expect(saved.eventos.filter((event: { tipo: string }) => event.tipo === 'FIRMA')).toHaveLength(1);
  });

  test('PWA keeps session and a pending local queue after a reload', async ({ page, request }) => {
    const worker = await request.get('/app/sw-app.js');
    expect(worker.status()).toBe(200);
    expect(await worker.text()).toContain('sync-manifiestos');
    await loginWithCredentials(page, {
      email: 'qa.transportista@sitrep.local', password, startPath: '/app/login', clickLoginLink: false,
    });
    await expect(page).toHaveURL(/\/app\/dashboard$/);

    const before = await page.evaluate(async () => {
      const serviceWorkerSupported = 'serviceWorker' in navigator;
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('sitrep_offline_db');
        open.onerror = () => reject(open.error);
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains('sync_queue')) {
            open.result.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
          }
        };
        open.onsuccess = () => {
          try {
            const transaction = open.result.transaction('sync_queue', 'readwrite');
            transaction.objectStore('sync_queue').add({
              type: 'POST', endpoint: '/manifiestos/qa-continuity-noop', data: { gate: 'reload' },
              userId: 'qa-continuity', createdAt: new Date().toISOString(),
            });
            transaction.oncomplete = () => { open.result.close(); resolve(); };
            transaction.onerror = () => reject(transaction.error);
          } catch (error) {
            open.result.close();
            reject(error);
          }
        };
      });
      return { serviceWorkerSupported, token: Boolean(localStorage.getItem('sitrep_access_token')) };
    });
    expect(before.serviceWorkerSupported).toBe(true);
    expect(before.token).toBe(true);

    await page.reload();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    const after = await page.evaluate(async () => {
      const persisted = await new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('sitrep_offline_db');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const transaction = open.result.transaction('sync_queue', 'readonly');
          const count = transaction.objectStore('sync_queue').count();
          count.onsuccess = () => { open.result.close(); resolve(count.result); };
          count.onerror = () => reject(count.error);
        };
      });
      return { persisted, token: Boolean(localStorage.getItem('sitrep_access_token')) };
    });
    expect(after.token).toBe(true);
    expect(after.persisted).toBeGreaterThan(0);
  });

  test('three actors complete the national workflow through PWA controls', async ({ page, request }, testInfo) => {
    const adminApi = await loginApi(request, process.env.QA_ADMIN_EMAIL || 'admin@dgfa.mendoza.gov.ar');

    await replaceSession(page, 'qa.generador.a@sitrep.local');
    const manifest = await createQaManifestThroughUi(page);
    await page.getByRole('button', { name: 'Firmar Manifiesto', exact: true }).click();
    const signature = page.locator('canvas').last();
    await expect(signature).toBeVisible();
    const box = await signature.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 12, box!.y + 18);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width - 20, box!.y + box!.height - 18, { steps: 8 });
    await page.mouse.up();
    // The pad has its own explicit confirmation before the legal workflow
    // action. This is intentional: a stroke alone must not become a signature.
    await page.getByRole('button', { name: 'Confirmar Firma', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirmar y Firmar', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Confirmar y Firmar', exact: true }).click();
    await waitForState(request, adminApi, manifest.id, 'APROBADO');

    await replaceSession(page, 'qa.transportista@sitrep.local');
    await page.goto(`/app/transporte/viaje/${manifest.id}`);
    await page.getByRole('button', { name: 'Confirmar Retiro', exact: true }).click();
    await waitForState(request, adminApi, manifest.id, 'EN_TRANSITO');
    await page.getByRole('button', { name: 'Confirmar Entrega', exact: true }).click();
    await page.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
    await waitForState(request, adminApi, manifest.id, 'ENTREGADO');

    await replaceSession(page, 'qa.operador@sitrep.local');
    await page.goto(`/app/manifiestos/${manifest.id}`);
    await page.getByRole('button', { name: 'Confirmar Recepcion', exact: true }).click();
    await waitForState(request, adminApi, manifest.id, 'RECIBIDO');
    await page.getByRole('button', { name: 'Registrar Tratamiento', exact: true }).click();
    await page.getByText('QA-TRATAMIENTO', { exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar Tratamiento', exact: true }).click();
    await waitForState(request, adminApi, manifest.id, 'EN_TRATAMIENTO');
    await page.getByRole('button', { name: 'Cerrar Manifiesto', exact: true }).click();
    await waitForState(request, adminApi, manifest.id, 'TRATADO');
    await expect(page.getByRole('button', { name: 'Descargar Certificado', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('manifiesto-tratado.png'), fullPage: true });
  });
});
