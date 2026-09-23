import { test, expect } from '@playwright/test';

test('Monitor loads the same keyless map as the rest of SITREP in regular and cinema modes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sitrep_access_token', 'qa-access-token');
    localStorage.setItem('sitrep_refresh_token', 'qa-refresh-token');
  });
  const requestedTiles: string[] = [];
  page.on('request', (request) => {
    if (/cartocdn|tile\.openstreetmap\.org/.test(request.url())) requestedTiles.push(request.url());
  });
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/auth/profile')) data = { user: { id: 'admin-qa', email: 'admin.qa@sitrep.local', nombre: 'QA', apellido: 'SITREP', rol: 'ADMIN', activo: true, forcePasswordChange: false } };
    else if (path.endsWith('/centro-control/active-days')) data = { days: [] };
    else if (path.endsWith('/centro-control/monitor-live')) data = {
      estadisticas: { porEstado: {}, total: 0, manifiestosHoy: 0, toneladas: 0, enTransitoActivos: 0 },
      enTransito: [], eventosRecientes: [], actores: { generadores: [], transportistas: [], operadores: [] },
      topGeneradores: [], topOperadores: [], porDia: [], topResiduos: [], tratamientosActivos: [],
    };
    else if (path.endsWith('/health')) return route.fulfill({ json: { status: 'ok' } });
    return route.fulfill({ json: { success: true, data } });
  });

  await page.goto('/monitor');
  await expect(page.locator('.leaflet-tile').first()).toHaveAttribute('src', /tile\.openstreetmap\.org/);
  await page.locator('button[title="Cinema mode (C)"]').click();
  await expect(page.locator('.wr-cinema .leaflet-tile').first()).toBeVisible();
  await expect(page.locator('.leaflet-tile').first()).toHaveAttribute('src', /tile\.openstreetmap\.org/);
  expect(requestedTiles.some((url) => url.includes('tile.openstreetmap.org'))).toBe(true);
  expect(requestedTiles.some((url) => url.includes('cartocdn'))).toBe(false);
});
