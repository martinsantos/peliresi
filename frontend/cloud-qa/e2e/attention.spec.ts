import { test, expect } from '@playwright/test';

for (const app of [false, true]) test(`pending versus unread, ${app ? 'app' : 'web'}`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: app ? 360 : 1440, height: 900 });
  await page.addInitScript(() => {
    const payload = btoa(JSON.stringify({ id: 'qa-attention', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) }));
    localStorage.setItem('sitrep_access_token', 'eyJhbGciOiJIUzI1NiJ9.' + payload + '.synthetic');
    localStorage.setItem('sitrep_refresh_token', 'synthetic-refresh');
  });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    // Isolated UI contract fixture. No connection to production, messages or writes.
    let data: unknown = {};
    if (url.pathname.endsWith('/auth/profile')) data = { user: { id: 'qa-attention', nombre: 'QA', email: 'qa@example.invalid', rol: 'ADMIN', activo: true, emailVerified: true } };
    else if (url.pathname.endsWith('/soporte/acceso')) data = { puedeGestionar: true, puedeConfigurar: false };
    else if (url.pathname.endsWith('/soporte')) data = { items: [], total: url.searchParams.get('estado') === 'ABIERTO' ? 32 : 7, page: 1, totalPages: 2 };
    else if (url.pathname.endsWith('/solicitudes')) {
      const totals: Record<string, number> = { ENVIADA: 24, EN_REVISION: 2, OBSERVADA: 4, APROBADA: 30 };
      data = { solicitudes: [], pagination: { total: totals[url.searchParams.get('estado') || ''] ?? 60, page: 1, totalPages: 3 } };
    } else if (url.pathname.endsWith('/notificaciones')) data = { notificaciones: [], noLeidas: 5, total: 0 };
    else if (url.pathname.endsWith('/admin/usuarios')) data = { usuarios: [], pagination: { total: 0 } };
    await route.fulfill({ json: { success: true, data } });
  });
  const base = app ? 'http://127.0.0.1:4188/app' : 'http://127.0.0.1:4187';
  await page.goto(base + '/admin/solicitudes');
  await expect(page.getByRole('heading', { name: 'Solicitudes de Inscripcion' })).toBeVisible();
  await expect(page.getByText('24', { exact: true })).toBeVisible();
  if (app) await page.getByRole('button', { name: 'Abrir menu' }).click();
  const applications = page.locator('a').filter({ hasText: /Solicitudes/ }).first();
  const support = page.locator('a').filter({ hasText: /Soporte/ }).first();
  await expect(applications.getByLabel('26 pendientes de atender')).toBeVisible();
  await expect(support.getByLabel('39 pendientes de atender')).toBeVisible();
  await page.screenshot({ path: `/tmp/sitrep-landing-qa/attention-${app ? 'app' : 'web'}.png` });
  await applications.click();
  await expect(page).toHaveURL(/\/admin\/solicitudes$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
