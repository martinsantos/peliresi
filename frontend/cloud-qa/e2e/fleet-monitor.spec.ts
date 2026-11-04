import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { login, prefix } from './helpers';

test('the monitor displays the location received for a simultaneous handoff', async ({ page }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fleet-private.json'), 'utf8'));
  const load = fixture.cases[info.project.name].incoming;
  await login(page, info, 'admin');
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(request.method() + ' ' + new URL(request.url()).pathname);
    }
  });
  const received = page.waitForResponse(response => response.url().endsWith('/api/centro-control/monitor-live') && response.status() === 200);
  await page.goto(prefix(info) + '/monitor');
  const data = (await (await received).json()).data;
  const trip = data.enTransito.find((item: { manifiestoId: string }) => item.manifiestoId === load.id);
  expect(trip, 'The selected artificial trip must be present in the real monitor response').toBeTruthy();
  expect(trip.ultimaPosicion.latitud).toBeCloseTo(-33.22, 2);
  expect(trip.ultimaPosicion.longitud).toBeCloseTo(-68.92, 2);
  expect(Number.isFinite(Date.parse(trip.ultimaPosicion.timestamp))).toBe(true);
  const marker = page.getByTitle('Viaje en tránsito: ' + load.numero, { exact: true });
  await expect(marker).toHaveCount(1);
  await marker.focus(); await marker.press('Enter');
  const popup = page.getByTestId('monitor-live-popup');
  await expect(popup).toContainText(load.numero);
  await expect(popup.getByLabel('Última posición recibida')).toContainText('Última recepción');
  await expect(popup.getByLabel('Última posición recibida')).toContainText('puede ser anterior');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const frame = page.locator('.leaflet-popup');
  await expect.poll(() => frame.evaluate(element => {
    const box = element.getBoundingClientRect(), map = element.closest('.leaflet-container')!.getBoundingClientRect();
    const header = element.closest('.wr-layout')!.querySelector('.wr-layout-header')!.getBoundingClientRect();
    return box.left >= Math.max(0, map.left) - 1 && box.right <= Math.min(innerWidth, map.right) + 1
      && box.top >= Math.max(0, map.top, header.bottom) - 1 && box.bottom <= Math.min(innerHeight, map.bottom) + 1;
  }), { message: 'The complete popup frame must remain inside the visible map' }).toBe(true);
  const close = frame.locator('.leaflet-popup-close-button');
  const closeBox = (await close.boundingBox())!;
  expect(closeBox.width).toBeGreaterThanOrEqual(44); expect(closeBox.height).toBeGreaterThanOrEqual(44);
  expect(await close.evaluate(element => {
    const box = element.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit === element || element.contains(hit);
  })).toBe(true);
  const content = frame.locator('.leaflet-popup-content');
  await expect(content).toHaveAttribute('tabindex', '0');
  const scrollable = await content.evaluate(element => element.scrollHeight > element.clientHeight);
  if (scrollable) {
    await content.focus(); await content.press('End');
    await expect.poll(() => content.evaluate(element => element.scrollTop + element.clientHeight >= element.scrollHeight - 1)).toBe(true);
    await expect.poll(() => popup.evaluate(element => {
      const last = element.lastElementChild!.getBoundingClientRect(), bounds = element.closest('.leaflet-popup-content')!.getBoundingClientRect();
      return last.bottom <= bounds.bottom + 1;
    })).toBe(true);
    await page.screenshot({ path: info.outputPath('monitor-gps-relevo-final.png'), animations: 'disabled', scale: 'css' });
    await content.press('Home');
  }
  await page.screenshot({ path: info.outputPath('monitor-gps-relevo.png'), animations: 'disabled', scale: 'css' });
  await close.click(); await expect(popup).toHaveCount(0);
  expect(errors).toEqual([]); expect(writes).toEqual([]);
});
