import { expect, test, type Locator } from '@playwright/test';
import { login, prefix, readableMapLayers } from './helpers';

/** Measure rendered SVG frames in the background's local axes, including diamonds. */
async function symbolGeometry(symbols: Locator) {
  return symbols.evaluateAll(elements => elements.map(element => {
    const background = element.querySelector('[data-map-symbol-background]') || element;
    const glyph = element.querySelector('svg')!;
    const box = background.getBoundingClientRect();
    const icon = glyph.getBoundingClientRect();
    const inverse = new DOMMatrix(getComputedStyle(background).transform).inverse();
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const corners = [[icon.left, icon.top], [icon.right, icon.top], [icon.left, icon.bottom], [icon.right, icon.bottom]]
      .map(([x, y]) => new DOMPoint(x - center.x, y - center.y).matrixTransform(inverse));
    const localWidth = (background as HTMLElement).offsetWidth;
    const localHeight = (background as HTMLElement).offsetHeight;
    return {
      category: element.getAttribute('data-map-symbol'),
      dx: Math.abs(icon.x + icon.width / 2 - center.x),
      dy: Math.abs(icon.y + icon.height / 2 - center.y),
      padding: Math.min(...corners.flatMap(point => [localWidth / 2 - Math.abs(point.x), localHeight / 2 - Math.abs(point.y)])),
      width: icon.width, height: icon.height,
      color: getComputedStyle(background).backgroundColor,
      slotContainsBackground: (() => {
        const slot = element.getBoundingClientRect();
        return box.left >= slot.left - .5 && box.right <= slot.right + .5 && box.top >= slot.top - .5 && box.bottom <= slot.bottom + .5;
      })(),
    };
  }));
}

test('map symbols stay centered, padded and actionable in every shared map control', async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  const measurements: Record<string, Awaited<ReturnType<typeof symbolGeometry>>> = {};
  await login(page, info);
  await page.goto(`${prefix(info)}/centro-control`);
  await expect(page.getByRole('heading', { name: 'Mapa de Actividad', exact: true })).toBeVisible();
  const layers = page.getByRole('group', { name: 'Capas del mapa', exact: true });
  await expect(layers).toHaveCount(1);
  await layers.scrollIntoViewIfNeeded();
  await readableMapLayers(layers);
  measurements.control = await symbolGeometry(layers.locator('[data-map-symbol]'));
  await page.screenshot({ path: info.outputPath('control-map-symbols.png'), animations: 'disabled' });
  for (const [label, key] of [['Generadores', 'generadores'], ['Transportistas', 'transportistas'], ['Operadores', 'operadores'], ['En Tránsito', 'transito']]) {
    const toggle = layers.getByRole('button', { name: label, exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const old = await toggle.boundingBox();
    for (const pressed of [false, true]) {
      const activity = page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname === '/api/centro-control/actividad' && response.status() === 200
          && (url.searchParams.get('capas') || '').split(',').includes(key) === pressed;
      });
      await toggle.click();
      await activity;
      await expect(toggle).toHaveAttribute('aria-pressed', String(pressed));
      await readableMapLayers(layers);
      measurements[`control-${key}-${pressed}`] = await symbolGeometry(toggle.locator('[data-map-symbol]'));
      const next = (await toggle.boundingBox())!;
      expect.soft(Math.abs(next.width - old!.width), 'A map toggle must not jump when its state changes').toBeLessThanOrEqual(.5);
      expect.soft(Math.abs(next.height - old!.height)).toBeLessThanOrEqual(.5);
    }
  }

  await page.goto(`${prefix(info)}/reportes`);
  await page.getByRole('navigation', { name: 'Tipos de reporte' }).getByRole('button', { name: 'Mapa de Actores', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  const reportLayers = page.getByRole('group', { name: 'Capas del mapa', exact: true });
  await reportLayers.scrollIntoViewIfNeeded();
  await readableMapLayers(reportLayers);
  measurements.reports = await symbolGeometry(reportLayers.locator('[data-map-symbol]'));
  await page.screenshot({ path: info.outputPath('report-map-symbols.png'), animations: 'disabled' });
  const carrier = reportLayers.getByRole('button', { name: 'Transportistas', exact: true });
  const marker = page.locator('.leaflet-marker-icon[title="QA Transporte 1"]');
  await expect(marker).toHaveCount(1);
  await carrier.focus();
  await carrier.press('Space');
  await expect(carrier).toHaveAttribute('aria-pressed', 'false');
  await expect(marker).toHaveCount(0);
  await carrier.press('Space');
  await expect(carrier).toHaveAttribute('aria-pressed', 'true');
  await expect(marker).toHaveCount(1);
  const actor = page.getByRole('button', { name: /^QA Transporte 1/ });
  await actor.scrollIntoViewIfNeeded();
  measurements.rows = await symbolGeometry(page.locator('[data-map-symbol]').filter({ has: page.locator('svg.lucide-truck') }));
  await page.screenshot({ path: info.outputPath('report-actor-symbols.png'), animations: 'disabled' });

  const colors: Record<string, string> = { generador: 'rgb(124, 58, 237)', transportista: 'rgb(234, 88, 12)', operador: 'rgb(37, 99, 235)', inspeccion: 'rgb(15, 118, 110)', enTransito: 'rgb(239, 68, 68)' };
  for (const [surface, symbols] of Object.entries(measurements)) {
    expect.soft(symbols.length, surface).toBeGreaterThan(0);
    for (const symbol of symbols) {
      const name = `${surface}: ${symbol.category}`;
      expect.soft(symbol.dx, name + ' horizontal center').toBeLessThanOrEqual(.5);
      expect.soft(symbol.dy, name + ' vertical center').toBeLessThanOrEqual(.5);
      expect.soft(symbol.padding, name + ' inner padding').toBeGreaterThanOrEqual(symbol.category === 'transportista' ? 2 : 4);
      expect.soft(symbol.slotContainsBackground, name + ' reserved rotated space').toBe(true);
      expect.soft(symbol.width, name + ' glyph width').toBeCloseTo(14, 0);
      expect.soft(symbol.height, name + ' glyph height').toBeCloseTo(14, 0);
      expect.soft(symbol.color, name + ' institutional category color').toBe(colors[symbol.category!]);
    }
  }
  await info.attach('rendered-symbol-geometry', { body: JSON.stringify({ url: page.url(), viewport: page.viewportSize(), measurements, errors, warnings, businessAPIIntercepted: false }, null, 2), contentType: 'application/json' });
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
