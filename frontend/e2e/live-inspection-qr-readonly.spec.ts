import fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

/**
 * Read-only production/QA gate for inspection QR traceability.
 *
 * It is intentionally disabled unless explicitly enabled. The access token is
 * read from a local file and is never printed, embedded in screenshots, or
 * included in assertion messages.
 */
const enabled = process.env.QR_LIVE_E2E_ENABLED === 'true';
const tokenPath = process.env.QR_LIVE_TOKEN_FILE || '/private/tmp/sitrep-qa-access-20260922.token';
const inspectionId = process.env.QR_LIVE_INSPECTION_ID || 'cmu5o9ub5001u7k6eae8yak4g';
const expectedNumber = process.env.QR_LIVE_INSPECTION_NUMBER || 'I-2026-000006';
const configuredToken = enabled && fs.existsSync(tokenPath) ? fs.readFileSync(tokenPath, 'utf8').trim() : '';
const gateReady = enabled && Boolean(configuredToken);

test.describe('LIVE inspection QR traceability — read-only', () => {
  test.skip(!gateReady, 'Opt-in only: set QR_LIVE_E2E_ENABLED=true and provide the local token file');
  test.setTimeout(60_000);

  let accessToken = '';
  let detail: any;
  let publicVerification: any;
  let traceToken = '';

  test.beforeAll(async ({ request }) => {
    accessToken = configuredToken;
    const response = await request.get(`/api/inspecciones/${encodeURIComponent(inspectionId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(response.ok(), 'inspection detail must be readable with the QA token').toBeTruthy();
    const body = await response.json();
    detail = body.data ?? body;
    expect(detail.id).toBe(inspectionId);
    expect(detail.numero).toBe(expectedNumber);
    expect(detail.numeroActa).toMatch(/^DEMO/);
    expect(detail.verificacion?.url).toBeTruthy();
    traceToken = String(detail.verificacion.url).split('/').pop() || '';
    expect(traceToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const verificationResponse = await request.get(`/api/inspecciones/verificar/${encodeURIComponent(traceToken)}`);
    expect(verificationResponse.ok(), 'public verification endpoint must accept the signed trace token').toBeTruthy();
    publicVerification = (await verificationResponse.json()).data;
    expect(publicVerification.numero).toBe(expectedNumber);
    expect(publicVerification.verificacion?.huella).toMatch(/^[a-f0-9]{64}$/);
    expect(publicVerification.verificacion?.version).toBe(detail.version);
    expect(publicVerification.verificacion?.huella).toBe(detail.verificacion.huella);
  });

  test('detail exposes the canonical QR URL and timeline anchor', async () => {
    expect(detail.verificacion.url).toContain(`/verificar/inspecciones/${traceToken}`);
    expect(publicVerification.authorizedPath).toBe(`/inspecciones/${inspectionId}#trazabilidad`);
  });

  test('public web and PWA landings validate without private dossier data', async ({ page }) => {
    await assertPublicLanding(page, `/verificar/inspecciones/${traceToken}`, 'web');
    await assertPublicLanding(page, `/app/verificar/inspecciones/${traceToken}`, 'pwa');
  });

  test('public response does not disclose private dossier fields', async ({ request }) => {
    const response = await request.get(`/api/inspecciones/verificar/${encodeURIComponent(traceToken)}`);
    expect(response.ok()).toBeTruthy();
    const raw = await response.text();
    for (const forbidden of ['evidencias', 'comparaciones', 'items', 'eventos', 'domicilio', 'cuit', 'email', 'observaciones']) {
      expect(raw.toLowerCase()).not.toContain(`"${forbidden}"`);
    }
  });

  test('field act and technical report PDFs are readable and non-empty', async ({ request }) => {
    for (const kind of ['acta', 'informe-tecnico']) {
      const response = await request.get(`/api/inspecciones/${encodeURIComponent(inspectionId)}/${kind}.pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(response.ok(), `${kind} PDF should be available`).toBeTruthy();
      expect(response.headers()['content-type']).toMatch(/application\/pdf/i);
      const body = await response.body();
      expect(body.byteLength).toBeGreaterThan(1_000);
      expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  test('authorized staff trace opens with the QR target anchor', async ({ page }, testInfo) => {
    await page.addInitScript((tokenValue) => {
      localStorage.setItem('sitrep_access_token', tokenValue);
      localStorage.removeItem('sitrep_refresh_token');
    }, accessToken);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${testInfo.project.name === 'mobile' ? '/app' : ''}${publicVerification.authorizedPath}`);
    await expect(page.locator('#trazabilidad')).toBeVisible();
    await expect(page).toHaveURL(/#trazabilidad$/);
    expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: '/tmp/sitrep-live-inspection-trace-mobile.png', fullPage: false });
  });
});

async function assertPublicLanding(page: Page, path: string, label: string) {
  await page.setViewportSize({ width: label === 'pwa' ? 390 : 1280, height: label === 'pwa' ? 844 : 900 });
  await page.goto(path, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Inspección registrada en SITREP' })).toBeVisible();
  await expect(page.getByText(expectedNumber, { exact: true }).first()).toBeVisible();
  await expect(page.locator('div[aria-label="Código QR de verificación pública"] svg')).toHaveCount(1);
  await expect(page.getByText(/fotografías|domicilios|documentos ni datos personales/i)).toBeVisible();
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/sitrep-live-inspection-verification-${label}.png`, fullPage: true });
}
