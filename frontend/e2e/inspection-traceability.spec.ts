import { test, expect } from '@playwright/test';

const token = 'eyJ2IjoxLCJpbnNwZWNjaW9uSWQiOiJpbnNwZWN0aW9uLXFhIn0.signature';
const verification = {
  numero: 'I-2026-000001',
  numeroActa: 'ACTA-QA-001',
  estado: 'CERRADA_CONFORME',
  updatedAt: '2026-09-17T13:40:00.000Z',
  createdAt: '2026-09-17T13:20:00.000Z',
  authorizedPath: '/inspecciones/inspection-qa#trazabilidad',
  accesoDetallado: 'requiere_autorizacion',
  verificacion: {
    url: `https://sitrep.ultimamilla.com.ar/verificar/inspecciones/${token}`,
    huella: 'a'.repeat(64),
    version: 3,
  },
};

async function mockPublicApi(page: import('@playwright/test').Page, authenticated = false) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/profile')) {
      if (!authenticated) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'No autenticado' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { user: { id: 'qa-admin', nombre: 'QA', rol: 'ADMIN', activo: true } } }) });
    }
    if (url.pathname.endsWith(`/inspecciones/verificar/${token}`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: verification }) });
    }
    if (url.pathname.includes('/inspecciones/verificar/')) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Código de verificación inválido' }) });
    }
    if (authenticated && url.pathname === '/api/inspecciones/inspection-qa') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {
        id: 'inspection-qa', numero: verification.numero, numeroActa: verification.numeroActa,
        estado: 'CERRADA_CONFORME', tipoActor: 'GENERADOR', version: 3,
        inspectorId: 'qa-admin', inspector: { id: 'qa-admin', nombre: 'QA' },
        generador: { id: 'generator-qa', razonSocial: 'Generador de prueba', cuit: '30-12345678-9' },
        createdAt: verification.createdAt, updatedAt: verification.updatedAt,
        items: [], comparaciones: [], evidencias: [], verificacion: verification.verificacion,
        eventos: [{ id: 'event-qa', tipo: 'CAMBIO_ESTADO', titulo: 'Cierre conforme documentado', visibleActor: true, createdAt: verification.updatedAt, usuario: { id: 'qa-admin', nombre: 'QA' } }],
      } }) });
    }
    if (authenticated && url.pathname.endsWith('/intercambios')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {
        inspeccion: { id: 'inspection-qa', numero: verification.numero, estado: 'CERRADA_CONFORME', tipoActor: 'GENERADOR', version: 3 },
        parteActual: 'AUTORIDAD', intercambios: [], comunicacionExterna: false,
      } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
}

test.describe('public inspection QR traceability', () => {
  test('valid token renders official verification, real SVG QR and no overflow on web/mobile', async ({ page }, testInfo) => {
    await mockPublicApi(page);
    if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/verificar/inspecciones/${token}`);

    await expect(page.getByRole('heading', { name: 'Inspección registrada en SITREP' })).toBeVisible();
    await expect(page.getByText('Gobierno de Mendoza · DGFA · SITREP')).toBeVisible();
    await expect(page.getByTestId('inspection-verification')).toBeVisible();
    const qr = page.locator('[aria-label="Código QR de verificación pública"]');
    await expect(qr).toBeVisible();
    await expect(qr.locator('svg')).toHaveCount(1);
    await expect(qr.locator('svg')).toHaveAttribute('viewBox', /0 0/);
    await expect(page.getByRole('link', { name: 'Ingresar para ver trazabilidad' })).toHaveAttribute('href', '/login');
    expect(await page.locator('html').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/sitrep-inspection-verification-${testInfo.project.name}.png`, fullPage: true });
  });

  test('invalid/tampered token shows generic invalid state without dossier details', async ({ page }) => {
    await mockPublicApi(page);
    const tampered = `${token.slice(0, -1)}x`;
    await page.goto(`/verificar/inspecciones/${tampered}`);
    await expect(page.getByRole('heading', { name: 'Código no válido' })).toBeVisible();
    await expect(page.getByText('I-2026-000001')).toHaveCount(0);
    await expect(page.getByText(/fotografías|domicilios|evidencias privadas/i)).toHaveCount(0);
  });

  test('authenticated CTA preserves the authorized return anchor in web', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sitrep_access_token', 'qa-access-token'));
    await mockPublicApi(page, true);
    await page.goto(`/verificar/inspecciones/${token}`);
    const cta = page.getByRole('link', { name: 'Ver trazabilidad autorizada' });
    await expect(cta).toHaveAttribute('href', '/inspecciones/inspection-qa#trazabilidad');
    await cta.click();
    await expect(page).toHaveURL(/\/inspecciones\/inspection-qa#trazabilidad$/);
    await expect(page.getByRole('heading', { name: 'Historial de la inspección' })).toBeVisible();
    await expect(page.getByText('Cierre conforme documentado', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Resultado de la inspección' })).toHaveCount(0);
    await expect(page.getByTestId('inspection-action-bar')).toHaveCount(0);
  });

  test('PWA basename serves the same public verification route', async ({ page }) => {
    await mockPublicApi(page);
    await page.goto(`/app/verificar/inspecciones/${token}`);
    await expect(page.getByRole('heading', { name: 'Inspección registrada en SITREP' })).toBeVisible();
    await expect(page.locator('[aria-label="Código QR de verificación pública"] svg')).toHaveCount(1);
    expect(await page.locator('html').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});
