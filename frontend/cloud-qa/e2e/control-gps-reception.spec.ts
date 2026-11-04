import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('the office sees reception time and the unknown capture time for the selected trip', async ({ page }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'control-gps-reception-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name], errors: string[] = [], warnings: string[] = [], writes: string[] = [];
  await login(page, info, 'admin');
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('request', request => {
    if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
  });
  const activity = page.waitForResponse(response => response.url().includes('/api/centro-control/actividad') && response.status() === 200);
  await page.goto(`${prefix(info)}/centro-control`);
  const data = (await (await activity).json()).data;
  const trip = data.enTransito.find((item: { manifiestoId: string }) => item.manifiestoId === manifest.id);
  expect(trip?.ultimaPosicion?.timestamp).toBeTruthy();
  expect(Number.isFinite(Date.parse(trip.ultimaPosicion.timestamp))).toBe(true);
  await expect(page).toHaveURL(new RegExp(`${prefix(info)}/centro-control$`));
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Agenda y viajes' })).toBeVisible();
  const zoom = page.getByRole('group', { name: 'Zoom del mapa' });
  const zoomLevel = zoom.locator('[aria-live="polite"]');
  const initialZoom = Number((await zoomLevel.textContent())!.match(/\d+/)![0]);
  const zoomButton = zoom.getByRole('button', { name: 'Acercar mapa' });
  const zoomBox = await zoomButton.boundingBox();
  expect(zoomBox!.width).toBeGreaterThanOrEqual(44); expect(zoomBox!.height).toBeGreaterThanOrEqual(44);
  await zoomButton.click();
  await expect(zoomLevel).toHaveText(`Nivel de zoom ${initialZoom + 1}`);
  const filter = page.getByPlaceholder('Buscar por número o transportista...');
  await filter.fill(manifest.numero);
  await page.getByRole('button', { name: `Seleccionar viaje ${manifest.numero}`, exact: true }).click();
  const selected = page.getByRole('region', { name: 'Agenda y viajes' }).getByLabel('Última posición recibida');
  await expect(selected).toContainText('Última recepción');
  await expect(selected).toContainText('Hora de captura no disponible');
  await expect(selected.locator('time')).toHaveAttribute('datetime', trip.ultimaPosicion.timestamp);
  const marker = page.getByTitle(`Viaje en tránsito: ${manifest.numero}`, { exact: true });
  await expect(marker).toHaveCount(1);
  await marker.focus(); await marker.press('Enter');
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toContainText(manifest.numero);
  const detailLink = popup.getByRole('link', { name: 'Ver detalle', exact: true });
  await expect(detailLink).toHaveCSS('color', 'rgb(7, 79, 45)');
  const contrast = await detailLink.evaluate(element => {
    const values = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = (color: number[]) => color.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2)
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const foreground = luminance(values(getComputedStyle(element).color));
    const background = luminance(values(getComputedStyle(element.closest('.leaflet-popup-content-wrapper')!).backgroundColor));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await expect(popup.getByLabel('Última posición recibida')).toContainText('Hora de captura no disponible');
  await expect(popup.getByLabel('Última posición recibida').locator('time')).toHaveAttribute('datetime', trip.ultimaPosicion.timestamp);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const measure = () => popup.evaluate(element => {
    const content = element.getBoundingClientRect(), main = element.closest('main')!.getBoundingClientRect();
    const map = element.closest('.leaflet-container')!.getBoundingClientRect();
    const close = element.closest('.leaflet-popup')!.querySelector('.leaflet-popup-close-button')!.getBoundingClientRect();
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Navegación principal"]');
    const navTop = nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().top : innerHeight;
    return { contentTop: content.top, contentBottom: content.bottom, contentLeft: content.left, contentRight: content.right,
      closeTop: close.top, visibleTop: Math.max(main.top, map.top, 0), visibleBottom: Math.min(main.bottom, map.bottom, navTop, innerHeight),
      visibleLeft: Math.max(main.left, map.left, 0), visibleRight: Math.min(main.right, map.right, innerWidth) };
  });
  const fits = (g: Awaited<ReturnType<typeof measure>>) => g.contentTop >= g.visibleTop - 1 && g.closeTop >= g.visibleTop - 1
    && g.contentBottom <= g.visibleBottom + 1 && g.contentLeft >= g.visibleLeft - 1 && g.contentRight <= g.visibleRight + 1;
  await expect.poll(async () => {
    const g = await measure();
    return fits(g);
  }, { message: 'The popup must remain visible between the header, map and bottom navigation', timeout: 30000 }).toBe(true);
  const geometry = await measure();
  const close = page.locator('.leaflet-popup-close-button');
  const closeBox = await close.boundingBox();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44); expect(closeBox!.height).toBeGreaterThanOrEqual(44);
  expect(await close.evaluate(element => {
    const box = element.getBoundingClientRect();
    const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return !!target && element.contains(target);
  })).toBe(true);
  const coveredWords = () => popup.evaluate(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const obscured: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      for (const word of (node.textContent || '').matchAll(/\S+/gu)) {
        const range = document.createRange();
        range.setStart(node, word.index!); range.setEnd(node, word.index! + word[0].length);
        for (const box of range.getClientRects()) {
          if (!box.width || !box.height) continue;
          const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          if (!target || !element.contains(target)) obscured.push(word[0]);
        }
      }
    }
    return obscured;
  });
  const covered = await coveredWords();
  writeFileSync(info.outputPath('control-gps-geometry.json'), JSON.stringify(geometry));
  await page.screenshot({ path: info.outputPath('control-gps-recepcion.png'), animations: 'disabled', scale: 'css' });
  expect(covered, 'Map controls or other UI must not cover popup text').toEqual([]);
  const originalViewport = page.viewportSize()!;
  const widths: unknown[] = [];
  for (const width of [320, 393, 768, 1365, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await expect.poll(async () => fits(await measure()), { message: `Readable popup at ${width}px`, timeout: 30000 }).toBe(true);
    expect(await coveredWords(), `Uncovered popup words at ${width}px`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    widths.push({ width, geometry: await measure() });
  }
  writeFileSync(info.outputPath('control-gps-widths.json'), JSON.stringify(widths));
  await page.setViewportSize(originalViewport);
  await expect.poll(async () => fits(await measure()), { message: 'Popup remains readable after restoring the viewport', timeout: 30000 }).toBe(true);
  await close.focus(); await close.press('Enter');
  await expect(popup).toHaveCount(0);

  const monitorResponse = page.waitForResponse(response => response.url().endsWith('/api/centro-control/monitor-live') && response.status() === 200);
  await page.goto(`${prefix(info)}/monitor`);
  const monitorData = (await (await monitorResponse).json()).data;
  const monitorTrip = monitorData.enTransito.find((item: { manifiestoId: string }) => item.manifiestoId === manifest.id);
  expect(monitorTrip?.ultimaPosicion?.timestamp).toBe(trip.ultimaPosicion.timestamp);
  const monitorMarker = page.getByTitle(`Viaje en tránsito: ${manifest.numero}`, { exact: true });
  await expect(monitorMarker).toHaveCount(1);
  await monitorMarker.focus(); await monitorMarker.press('Enter');
  const monitorPopup = page.getByTestId('monitor-live-popup');
  await expect(monitorPopup).toContainText(manifest.numero);
  await expect(monitorPopup.getByLabel('Última posición recibida')).toContainText('Hora de captura no disponible');
  await expect(monitorPopup.getByLabel('Última posición recibida').locator('time')).toHaveAttribute('datetime', trip.ultimaPosicion.timestamp);
  await expect(monitorPopup.getByText('1 punto incluido en la consulta', { exact: true })).toBeVisible();
  const warning = monitorPopup.getByText('Hora de captura no disponible. El punto puede ser anterior a la recepción.', { exact: true });
  await expect(warning).toBeVisible();
  const measureWarning = () => warning.evaluate(element => {
    const text = element.getBoundingClientRect(), pane = element.closest('.leaflet-popup-content')!.getBoundingClientRect();
    const map = element.closest('.leaflet-container')!.getBoundingClientRect();
    return { top: text.top, bottom: text.bottom, visibleTop: Math.max(pane.top, map.top, 0), visibleBottom: Math.min(pane.bottom, map.bottom, innerHeight) };
  });
  const warningVisible = (bounds: Awaited<ReturnType<typeof measureWarning>>) => bounds.top >= bounds.visibleTop - 1 && bounds.bottom <= bounds.visibleBottom + 1;
  await expect.poll(async () => warningVisible(await measureWarning()), { timeout: 30000, message: 'The complete capture warning must be visible' }).toBe(true);
  await page.screenshot({ path: info.outputPath('monitor-gps-recepcion.png'), animations: 'disabled', scale: 'css' });
  const monitorWidths: unknown[] = [];
  for (const width of [320, 393, 768, 1365, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await expect.poll(async () => warningVisible(await measureWarning()), { timeout: 30000, message: `Readable GPS warning at ${width}px` }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    monitorWidths.push({ width, geometry: await measureWarning() });
  }
  writeFileSync(info.outputPath('monitor-gps-widths.json'), JSON.stringify(monitorWidths));
  expect(errors).toEqual([]); expect(writes).toEqual([]);
  writeFileSync(info.outputPath('control-gps-proof.json'), JSON.stringify({ surface: info.project.name, manifest: manifest.numero,
    responseTimestamp: trip.ultimaPosicion.timestamp, detailContrast: contrast, errors, warnings, writes, synthetic: true }));
});
