import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
const fixture = () => JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'manifest-gps-context-private.json'), 'utf8'));

for (const role of ['admin', 'generador', 'transportista', 'operador']) {
  test(`the ${role} sees a bounded reception history without an invented route`, async ({ page }, info) => {
    test.skip(info.project.name === 'web-responsive' && role !== 'admin', 'Responsive check is repeated for admin; roles use the same component.');
    if (info.project.name !== 'web-desktop') await page.setViewportSize({ width: 320, height: 800 });
    const manifest = role === 'transportista' ? fixture().finished : fixture().active;
    const errors: string[] = [];
    await login(page, info, role);
    page.on('pageerror', error => errors.push(error.message));
    const detail = page.waitForResponse(response => response.url().includes(`/api/manifiestos/${manifest.id}`)
      && response.request().method() === 'GET' && response.status() === 200);
    await page.goto(`${prefix(info)}/manifiestos/${manifest.id}`);
    const data = (await (await detail).json()).data.manifiesto;
    expect(data.tracking).toHaveLength(100);
    expect(data.tracking[0].timestamp).toBe('2026-10-20T13:42:00.000Z');
    expect(data.tracking[1].timestamp).toBe(data.tracking[0].timestamp);
    expect(data.tracking[0].id > data.tracking[1].id).toBe(true);
    expect(data.tracking[99].timestamp).toBe('2026-10-20T12:03:00.000Z');
    const heading = page.getByRole('heading', { name: 'Ubicaciones GPS recibidas', exact: true });
    await expect(heading).toBeVisible();
    const card = heading.locator('xpath=../../..');
    await expect(card).toContainText('Últimos 100 puntos');
    await expect(card).toContainText('La hora de captura no está disponible.');
    await expect(card).toContainText('Las líneas no confirman el recorrido.');
    await expect(card).toContainText('Primera posición mostrada');
    await expect(card).toContainText('Última posición recibida');
    await expect(card).not.toContainText('Ruta realizada');
    await expect(card).not.toContainText('Fin GPS');
    const times = card.locator('time');
    await expect(times).toHaveCount(2);
    await expect(times.nth(0)).toHaveAttribute('datetime', '2026-10-20T12:03:00.000Z');
    await expect(times.nth(0)).toContainText('09:03:00');
    await expect(times.nth(1)).toContainText('10:42:00');
    await expect(card).toContainText('Mendoza');
    await card.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const geometry = await heading.evaluate(element => {
      const r = element.getBoundingClientRect(), parent = element.parentElement!.getBoundingClientRect();
      return { left: r.left, right: r.right, parentLeft: parent.left, parentRight: parent.right };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(geometry.parentLeft - 1);
    expect(geometry.right).toBeLessThanOrEqual(geometry.parentRight + 1);
    await heading.evaluate(element => element.scrollIntoView({ block: 'start' }));
    const topIsVisible = await heading.evaluate(element => {
      const heading = element.getBoundingClientRect(), main = element.closest('main')!.getBoundingClientRect();
      return heading.top >= main.top - 1 && heading.bottom <= main.bottom + 1;
    });
    expect(topIsVisible).toBe(true);
    await page.screenshot({ path: info.outputPath(`gps-encabezado-${role}.png`), animations: 'disabled' });
    const firstMarker = page.getByTitle('Primera posición mostrada', { exact: true });
    const lastMarker = page.getByTitle('Última posición recibida', { exact: true });
    await expect(firstMarker).toHaveCount(1); await expect(lastMarker).toHaveCount(1);
    for (const marker of [firstMarker, lastMarker]) {
      const size = await marker.boundingBox();
      expect(size!.width).toBeGreaterThanOrEqual(44); expect(size!.height).toBeGreaterThanOrEqual(44);
    }
    const zoom = page.locator('.manifest-gps-map .leaflet-control-zoom-in');
    const zoomSize = await zoom.boundingBox();
    expect(zoomSize!.width).toBeGreaterThanOrEqual(44); expect(zoomSize!.height).toBeGreaterThanOrEqual(44);
    await lastMarker.focus(); await lastMarker.press('Enter');
    await expect(page.locator('.leaflet-popup-content')).toContainText('Última posición recibida');
    const close = page.locator('.manifest-gps-map .leaflet-popup-close-button');
    const closeSize = await close.boundingBox();
    expect(closeSize!.width).toBeGreaterThanOrEqual(44); expect(closeSize!.height).toBeGreaterThanOrEqual(44);
    const overlap = await page.locator('.manifest-gps-map .leaflet-popup').evaluate(popup => {
      const text = popup.querySelector('.leaflet-popup-content')!.getBoundingClientRect();
      const close = popup.querySelector('.leaflet-popup-close-button')!.getBoundingClientRect();
      return Math.min(text.right, close.right) - Math.max(text.left, close.left) > 1
        && Math.min(text.bottom, close.bottom) - Math.max(text.top, close.top) > 1;
    });
    expect(overlap).toBe(false);
    await card.screenshot({ path: info.outputPath(`gps-${role}.png`), animations: 'disabled' });
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('manifest-gps-context-proof.json'), JSON.stringify({ surface: info.project.name,
      role, synthetic: true, window: 100, firstReceptionMendoza: '09:03', lastReceptionMendoza: '10:42', marker: true, errors }));
  });
}

test('one received position is described once, without a false start and end', async ({ page }, info) => {
  if (info.project.name !== 'web-desktop') await page.setViewportSize({ width: 320, height: 800 });
  const manifest = fixture().single;
  await login(page, info, 'admin');
  await page.goto(`${prefix(info)}/manifiestos/${manifest.id}`);
  const heading = page.getByRole('heading', { name: 'Ubicaciones GPS recibidas', exact: true });
  await expect(heading).toBeVisible();
  const card = heading.locator('xpath=../../..');
  await expect(card).toContainText('1 punto mostrado');
  await expect(card).toContainText('Única posición recibida');
  await expect(card).not.toContainText('Primera posición mostrada');
  await expect(card).not.toContainText('Última posición recibida');
  await expect(card.getByTitle('Única posición recibida', { exact: true })).toHaveCount(1);
  await card.screenshot({ path: info.outputPath('gps-una-posicion.png'), animations: 'disabled' });
  await page.goto('/manual/tutorial.html?guide=monitor-viaje-vigente');
  const guide = page.locator('.guide-step').filter({ has: page.getByRole('heading', { name: 'Leer un recorrido largo' }) });
  await expect(guide).toContainText('En el detalle del manifiesto se muestran como máximo las últimas 100 posiciones recibidas.');
  await expect(guide).toContainText('La primera mostrada no necesariamente indica el inicio del viaje');
});
