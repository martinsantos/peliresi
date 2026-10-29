import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
test.use({ timezoneId: 'UTC' });

test('el historial distingue el retiro del GPS recibido y conserva su hora', async ({ page }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'monitor-history-private.json'), 'utf8'));
  const errors: string[] = [], writes: string[] = [];
  await login(page, info, 'admin');
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
  });
  await page.goto(prefix(info) + '/monitor');
  const responsePromise = page.waitForResponse(response => response.url().includes('/api/centro-control/timeline?') && response.status() === 200);
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  const payload = (await (await responsePromise).json()).data;
  expect(payload.paginacion?.siguiente, 'El ensayo usa una sola página real del historial').toBeNull();
  const events = payload.eventos.sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp) || (a.id || '').localeCompare(b.id || ''))
    .filter((entry: any) => entry.type === 'EVENTO');
  const before = events.findIndex((entry: any) => entry.id === 'EVENTO:' + fixture.beforeGpsId);
  const after = events.findIndex((entry: any) => entry.id === 'EVENTO:' + fixture.afterGpsId);
  expect(before).toBeGreaterThanOrEqual(0); expect(after).toBeGreaterThan(before);
  expect(events.length).toBeLessThan(1000);
  const slider = page.getByRole('slider', { name: 'Recorrer historial' });
  await expect(slider).toBeVisible();
  // Let the product's initial autoplay start, then drive its actual range input.
  await expect(page.getByRole('button', { name: 'Pausar historial' })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar historial' }).click();
  const seek = async (index: number) => {
    const value = Math.round(index * 1000 / (events.length - 1));
    await slider.evaluate((element, next) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(element, String(next));
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  };
  const marker = page.getByTitle('Viaje en historial: ' + fixture.numero, { exact: true });
  const unobstructed = async () => expect.poll(() => page.locator('.leaflet-popup').evaluate(element => {
    const box = element.getBoundingClientRect();
    const event = element.closest('.wr-layout-map')!.querySelector('.wr-current-event')!.getBoundingClientRect();
    return Math.min(box.right, event.right) - Math.max(box.left, event.left) <= 1
      || Math.min(box.bottom, event.bottom) - Math.max(box.top, event.top) <= 1;
  }), { message: 'El evento actual no debe tapar el detalle abierto', timeout: 20000 }).toBe(true);
  await seek(before);
  await expect(marker).toHaveCount(1);
  await marker.focus(); await marker.press('Enter');
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toContainText(fixture.numero);
  await expect(popup).toContainText('Retiro registrado · sin GPS recibido');
  await expect(popup).not.toContainText('1 punto GPS recibido');
  await unobstructed();
  await page.screenshot({ path: info.outputPath('historial-retiro.png'), animations: 'disabled', scale: 'css' });
  await page.locator('.leaflet-popup-close-button').click();
  const fallbackMarker = page.getByTitle('Viaje en historial: ' + fixture.fallbackNumero, { exact: true });
  await expect(fallbackMarker).toHaveCount(1);
  await fallbackMarker.focus(); await fallbackMarker.press('Enter');
  await expect(popup).toContainText(fixture.fallbackNumero);
  await expect(popup).toContainText('datos actuales del generador');
  await expect(popup).toContainText('sin GPS recibido');
  await unobstructed();
  await page.screenshot({ path: info.outputPath('historial-generador.png'), animations: 'disabled', scale: 'css' });
  await page.locator('.leaflet-popup-close-button').click();
  const tripButton = page.getByRole('button', { name: 'Abrir viaje ' + fixture.numero, exact: true });
  await tripButton.click();
  const detail = page.locator('.fp-window').filter({ hasText: fixture.numero });
  await expect(detail).toContainText('Historial · detalle al abrir');
  await expect(detail).toContainText('Sin GPS recibido en el historial cargado');
  await expect(detail).not.toContainText('Última recepción hace');
  await detail.getByTitle('Cerrar detalle').click();
  await seek(after);
  await expect(marker).toHaveCount(1);
  const expectedHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Mendoza', hour: '2-digit', hourCycle: 'h23' }).format(new Date(events[after].timestamp));
  await expect(page.getByText(expectedHour + 'h', { exact: true })).toBeVisible();
  await marker.focus(); await marker.press('Enter');
  await expect(popup).toContainText('1 punto GPS recibido');
  await expect(popup).toContainText('Hora de captura no disponible');
  await expect(popup).toContainText('no prueban el recorrido');
  const expectedTime = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Mendoza', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(fixture.gpsReceivedAt));
  await expect(popup).toContainText(expectedTime);
  await unobstructed();
  const note = popup.getByText('Hora de captura no disponible. Las líneas no prueban el recorrido.', { exact: true });
  await expect(note).toBeVisible();
  expect(await note.evaluate(element => {
    const box = element.getBoundingClientRect(), parent = element.closest('.leaflet-popup-content')!.getBoundingClientRect();
    return box.top >= parent.top - 1 && box.bottom <= parent.bottom + 1;
  }), 'La aclaración debe leerse sin desplazamiento en esta ventana').toBe(true);
  await page.screenshot({ path: info.outputPath('historial-gps.png'), animations: 'disabled', scale: 'css' });
  const bounds = await page.locator('.leaflet-popup').evaluate(element => {
    const box = element.getBoundingClientRect(), map = element.closest('.leaflet-container')!.getBoundingClientRect();
    const header = element.closest('.wr-layout')!.querySelector('.wr-layout-header')!.getBoundingClientRect();
    return { left: box.left >= Math.max(0, map.left) - 1, right: box.right <= Math.min(innerWidth, map.right) + 1,
      top: box.top >= Math.max(0, map.top, header.bottom) - 1, bottom: box.bottom <= Math.min(innerHeight, map.bottom) + 1 };
  });
  expect(bounds).toEqual({ left: true, right: true, top: true, bottom: true });
  const closeBox = (await page.locator('.leaflet-popup-close-button').boundingBox())!;
  expect(closeBox.width).toBeGreaterThanOrEqual(44); expect(closeBox.height).toBeGreaterThanOrEqual(44);
  await expect(popup).toHaveAttribute('tabindex', '0');
  if (await popup.evaluate(element => element.scrollHeight > element.clientHeight)) {
    await popup.focus(); await popup.press('End');
    await expect.poll(() => popup.evaluate(element => element.scrollTop + element.clientHeight >= element.scrollHeight - 1)).toBe(true);
    await page.screenshot({ path: info.outputPath('historial-gps-final.png'), animations: 'disabled', scale: 'css' });
  }
  await page.locator('.leaflet-popup-close-button').click();
  await tripButton.click();
  await expect(detail).toContainText('Última recepción en el historial cargado');
  await expect(detail.locator('time')).toHaveAttribute('datetime', fixture.gpsReceivedAt);
  await expect(detail).not.toContainText('Última recepción hace');
  await page.screenshot({ path: info.outputPath('historial-gps-detalle.png'), animations: 'disabled', scale: 'css' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]); expect(writes).toEqual([]);
  writeFileSync(info.outputPath('monitor-history-proof.json'), JSON.stringify({ surface: info.project.name, synthetic: true,
    actualApi: true, numero: fixture.numero, pickupWithoutGps: true, generatorFallbackIdentified: true, gpsReceivedAt: fixture.gpsReceivedAt,
    captureTimeUnknown: true, errors, writes }, null, 2));
});
