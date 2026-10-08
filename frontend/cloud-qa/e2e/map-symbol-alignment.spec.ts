import { expect, test, type Locator } from '@playwright/test';
import { login, prefix, readableMapLayers, readablePageHeading } from './helpers';

/** Measure rendered SVG frames in the background's local axes, including diamonds. */
async function symbolGeometry(symbols: Locator) {
  return symbols.evaluateAll(elements => elements.map(element => {
    const background = element.querySelector('[data-map-symbol-background]') || element;
    const glyph = element.querySelector('svg')!;
    const box = background.getBoundingClientRect();
    const icon = glyph.getBoundingClientRect();
    const transform = getComputedStyle(background).transform;
    const inverse = new DOMMatrix(transform === 'none' ? undefined : transform).inverse();
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
      stroke: getComputedStyle(glyph).stroke,
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
  const rowMeasurements: Record<string, Awaited<ReturnType<typeof readableMapLayers>>> = {};
  await login(page, info);
  await page.goto(`${prefix(info)}/centro-control`);
  await expect(page.getByRole('heading', { name: 'Mapa de Actividad', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('control-first-viewport.png'), animations: 'disabled' });
  const layers = page.getByRole('group', { name: 'Capas del mapa', exact: true });
  await expect(layers).toHaveCount(1);
  await layers.scrollIntoViewIfNeeded();
  rowMeasurements.control = await readableMapLayers(layers);
  measurements.control = await symbolGeometry(layers.locator('[data-map-symbol]'));
  await page.screenshot({ path: info.outputPath('control-map-symbols.png'), animations: 'disabled' });
  await layers.screenshot({ path: info.outputPath('control-map-controls.png'), animations: 'disabled' });
  for (const [label, key, glyph] of [
    ['Generadores', 'generadores', 'svg path[d^="M2 20"]'],
    ['Transportistas', 'transportistas', 'svg path[d^="M14 18"]'],
    ['Operadores', 'operadores', 'svg path[d^="M10 2"]'],
    ['En Tránsito', 'transito', 'svg polygon[points="3 11 22 2 13 21 11 13 3 11"]'],
  ]) {
    const toggle = layers.getByRole('button', { name: label, exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const old = await toggle.boundingBox();
    const markers = page.locator('.leaflet-marker-icon').filter({ has: page.locator(glyph) });
    const originalCount = await markers.count();
    expect(originalCount, `${label}: actual seeded symbols must exist before toggling`).toBeGreaterThan(0);
    for (const pressed of [false, true]) {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', String(pressed));
      await expect(markers).toHaveCount(pressed ? originalCount : 0);
      // Refresh still fetches real canonical operational data, independent of
      // visible map layers. A refresh must preserve the chosen visibility.
      const activity = page.waitForResponse(response => new URL(response.url()).pathname === '/api/centro-control/actividad' && response.status() === 200);
      await page.getByTitle('Actualizar ahora', { exact: true }).click();
      const response = await activity;
      expect(new URL(response.url()).searchParams.get('capas')?.split(',').sort()).toEqual(['generadores', 'operadores', 'transito', 'transportistas']);
      await expect(toggle).toHaveAttribute('aria-pressed', String(pressed));
      await expect(markers).toHaveCount(pressed ? originalCount : 0);
      rowMeasurements[`control-${key}-${pressed}`] = await readableMapLayers(layers);
      measurements[`control-${key}-${pressed}`] = await symbolGeometry(toggle.locator('[data-map-symbol]'));
      const next = (await toggle.boundingBox())!;
      expect.soft(Math.abs(next.width - old!.width), 'A map toggle must not jump when its state changes').toBeLessThanOrEqual(.5);
      expect.soft(Math.abs(next.height - old!.height)).toBeLessThanOrEqual(.5);
    }
  }

  if (info.project.name !== 'web-desktop') {
    await page.setViewportSize({ width: 320, height: 800 });
    await readablePageHeading(page);
    await layers.scrollIntoViewIfNeeded();
    rowMeasurements.control320 = await readableMapLayers(layers);
    measurements.control320 = await symbolGeometry(layers.locator('[data-map-symbol]'));
    await layers.screenshot({ path: info.outputPath('control-map-controls-320.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 360, height: 800 });
  }

  await page.goto(`${prefix(info)}/reportes`);
  await page.getByRole('navigation', { name: 'Tipos de reporte' }).getByRole('button', { name: 'Mapa de Actores', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  const reportLayers = page.getByRole('group', { name: 'Capas del mapa', exact: true });
  await reportLayers.scrollIntoViewIfNeeded();
  rowMeasurements.reports = await readableMapLayers(reportLayers);
  measurements.reports = await symbolGeometry(reportLayers.locator('[data-map-symbol]'));
  await page.screenshot({ path: info.outputPath('report-map-symbols.png'), animations: 'disabled' });
  await reportLayers.screenshot({ path: info.outputPath('report-map-controls.png'), animations: 'disabled' });
  if (info.project.name !== 'web-desktop') {
    await page.setViewportSize({ width: 320, height: 800 });
    await readablePageHeading(page);
    await reportLayers.scrollIntoViewIfNeeded();
    rowMeasurements.reports320 = await readableMapLayers(reportLayers);
    measurements.reports320 = await symbolGeometry(reportLayers.locator('[data-map-symbol]'));
    await reportLayers.screenshot({ path: info.outputPath('report-map-controls-320.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 360, height: 800 });
  }
  const carrier = reportLayers.getByRole('button', { name: 'Transportistas', exact: true });
  const marker = page.locator('.leaflet-marker-icon[title="QA Transporte 1"]');
  await expect(marker).toHaveCount(1);
  await carrier.focus();
  await carrier.press('Space');
  await expect(carrier).toHaveAttribute('aria-pressed', 'false');
  await expect(marker).toHaveCount(0);
  rowMeasurements.reportsHidden = await readableMapLayers(reportLayers);
  await carrier.press('Space');
  await expect(carrier).toHaveAttribute('aria-pressed', 'true');
  await expect(marker).toHaveCount(1);
  rowMeasurements.reportsRestored = await readableMapLayers(reportLayers);
  const actor = page.getByRole('button', { name: /^QA Transporte 1/ })
    .filter({ has: page.locator('[data-map-symbol="transportista"]') });
  await expect(actor).toHaveCount(1);
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
      expect.soft(symbol.stroke, name + ' visible foreground').toBe('rgb(255, 255, 255)');
    }
  }
  // Public QR verification must retain the same actor identity without adding
  // links to private fichas. This is the real seeded document and real API.
  const verified = page.waitForResponse(response => new URL(response.url()).pathname === '/api/manifiestos/verificar/2026-990001');
  await page.goto(`${prefix(info)}/manifiestos/verificar/2026-990001`);
  const verification = await verified;
  expect(verification.status()).toBe(200);
  const verifiedRecord = (await verification.json()).data.manifiesto;
  const publicHeading = page.getByRole('heading', { name: verifiedRecord.numero, exact: true });
  await expect(publicHeading).toBeVisible();
  await expect.poll(() => publicHeading.evaluate(element => getComputedStyle(element).color), 'The manifest number must render white on its green header').toBe('rgb(255, 255, 255)');
  const publicHeader = await publicHeading.evaluate(element => {
    const caption = element.parentElement!.querySelector('span')!;
    const headingBox = element.getBoundingClientRect();
    const captionBox = caption.getBoundingClientRect();
    return { color: getComputedStyle(element).color, columnOffset: Math.abs(headingBox.left - captionBox.left), separated: headingBox.top >= captionBox.bottom, text: element.textContent };
  });
  expect(publicHeader.columnOffset, 'Public header caption and document number share one text column').toBeLessThanOrEqual(.5);
  expect(publicHeader.separated, 'The document number must not overlap its caption').toBe(true);
  for (const [label, actor, glyph] of [
    ['Generador', 'generador', 'factory'],
    ['Transportista', 'transportista', 'truck'],
    ['Operador', 'operador', 'flask-conical'],
  ]) {
    const row = page.getByText(label, { exact: true }).locator('..').locator('..');
    await expect(row.getByText(verifiedRecord[actor].razonSocial, { exact: true })).toBeVisible();
    await expect(row.locator(`svg.lucide-${glyph}`)).toHaveCount(1);
    await expect(row.locator('svg.lucide-building-2')).toHaveCount(0);
    await expect(row.getByRole('link')).toHaveCount(0);
  }
  await page.screenshot({ path: info.outputPath('public-manifest-actor-icons.png'), animations: 'disabled' });
  await info.attach('rendered-symbol-geometry', { body: JSON.stringify({ url: page.url(), viewport: page.viewportSize(), measurements, rowMeasurements, publicHeader, errors, warnings, businessAPIIntercepted: false }, null, 2), contentType: 'application/json' });
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
