import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('reproduces a committed delivery whose response is lost', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-transition-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name]['admin-delivery'];
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'block' });
  const page = await context.newPage(), statuses: number[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { configurable: true,
    value: { watchPosition() { return 1; }, getCurrentPosition() {}, clearWatch() {} } }));
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByText(manifest.numero, { exact: true })).toBeVisible();
    await page.route(`**/api/manifiestos/${manifest.id}/confirmar-entrega`, async route => {
      const response = await route.fetch(); statuses.push(response.status());
      if (statuses.length === 1) await route.abort('failed'); else await route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirmar Entrega?', exact: true });
    await dialog.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('No se pudo confirmar la entrega');
    expect(statuses).toEqual([200]);
    await page.screenshot({ path: info.outputPath('respuesta-perdida.png'), animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('El manifiesto debe estar en transito');
    expect(statuses).toEqual([200, 400]);
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('delivery-lost-proof.json'), JSON.stringify({ surface: info.project.name,
      synthetic: true, acceptedButResponseLost: true, retryStatuses: statuses, genericFailureShown: true }));
  } finally { await context.close(); }
});
