import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASS, loginWithCredentials } from './helpers/auth';

test.describe('QA: navigation and responsive surfaces', () => {
  test.skip(process.env.QA_CONFIRM_ISOLATED !== 'YES' || process.env.DISABLE_EMAILS !== 'true', 'Isolated QA only');
  test('administrative pages render in web and PWA without overflow or API failures', async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    expect(new URL(baseURL!).hostname).toBe('127.0.0.1');
    await loginWithCredentials(page, { email: ADMIN_EMAIL, password: ADMIN_PASS, startPath: '/app/login', clickLoginLink: false });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    const routes = ['dashboard', 'manifiestos', 'manifiestos/nuevo', 'reportes', 'alertas', 'notificaciones', 'configuracion', 'mi-perfil', 'ayuda', 'admin/usuarios', 'admin/actores/generadores', 'admin/actores/transportistas', 'admin/actores/operadores', 'admin/vehiculos', 'admin/residuos', 'admin/tratamientos', 'admin/auditoria', 'admin/solicitudes'];
    for (const prefix of ['', '/app']) {
      for (const route of routes) {
        await page.goto(`${prefix}/${route}`, { waitUntil: 'networkidle' });
        await expect(page.locator('main').first(), `${prefix}/${route}`).toBeVisible();
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByText(/Página no encontrada|Algo salió mal/i)).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${prefix}/${route} horizontal overflow`).toBe(true);
      }
    }
    expect(errors).toEqual([]);
  });
});
