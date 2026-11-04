import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { activeGpsQueueKey, isolatedMapTiles, login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('a corrupt GPS queue remains available and explains why delivery is blocked', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-receipt-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name];
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes(`/api/manifiestos/${manifest.id}/`)) {
      writes.push(new URL(request.url()).pathname);
    }
  });
  await isolatedMapTiles(page, info);
  try {
    await login(page, info, 'transportista');
    const key = await activeGpsQueueKey(page, fixture.owner, manifest.id);
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(k => localStorage.setItem(k, ''), key);
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron leer las ubicaciones guardadas' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirmar Entrega?', exact: true });
    await expect(dialog.getByRole('alert')).toContainText('No se puede confirmar la entrega todavía');
    await expect(dialog.getByRole('alert')).toContainText('contactá a soporte');
    await expect(dialog.getByText('Podés continuar', { exact: false })).toHaveCount(0);
    await expect(dialog.getByText('Se confirmará la entrega en', { exact: false })).toHaveCount(0);
    await expect(dialog.getByText('Destino:', { exact: false })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeEnabled();
    expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('gps-copia-no-legible.png'), animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron leer las ubicaciones guardadas' }).first()).toBeVisible();
    expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('');
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('proof.json'), JSON.stringify({ surface: info.project.name, viewport: page.viewportSize(), preserved: true, deliveryRequests: writes.length }));
  } finally { await context.close(); }
});
