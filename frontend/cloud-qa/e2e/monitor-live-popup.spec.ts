import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { login, prefix } from './helpers';

test('live map details retain real actor identity, readable content and a reachable dismissal', async ({ page }, info) => {
  test.setTimeout(90000);
  const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  expect(fixture.database).toBe('sitrep_night_qa_20260926');
  expect(fixture.externalDelivery).toBe(false);
  await login(page, info);
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
  });
  const received = page.waitForResponse(response => response.url().endsWith('/api/centro-control/monitor-live') && response.status() === 200);
  await page.goto(prefix(info) + '/monitor');
  const actual = (await (await received).json()).data;
  const targets = [
    ['generador', 'Generador', actual.actores.generadores[0]],
    ['transportista', 'Transportista', actual.actores.transportistas[0]],
    ['operador', 'Operador', actual.actores.operadores[0]],
    ['enTransito', 'Viaje en tránsito', actual.enTransito.find((trip: { manifiestoId: string }) => trip.manifiestoId === fixture.deviceManifest.id)],
  ] as const;
  const records: unknown[] = [];
  for (const [category, label, actor] of targets) {
    expect(actor, 'A real seeded ' + category + ' is required, not an empty-map pass').toBeTruthy();
    const name = category === 'enTransito' ? actor.numero : actor.razonSocial;
    const marker = page.getByTitle(`${label}: ${name}`, { exact: true });
    await expect(marker).toHaveCount(1);
    // Keyboard operation also reaches a marker hidden under another at low
    // zoom, without forced coordinates, handler calls or fabricated responses.
    await marker.focus();
    await marker.press('Enter');
    const body = page.getByTestId('monitor-live-popup');
    await expect(body).toHaveCount(1);
    await expect(body.getByText(name, { exact: true })).toBeVisible();
    await expect(body.locator(`[data-map-symbol="${category}"]`)).toBeVisible();
    if (category === 'operador') await expect(body.locator('svg.lucide-flask-conical')).toBeVisible();
    if (actor.domicilio) await expect(body.getByText(actor.domicilio, { exact: true })).toHaveText(actor.domicilio);
    const popup = page.locator('.leaflet-popup');
    await expect.poll(() => popup.evaluate(el => {
      const box = el.getBoundingClientRect(), map = el.closest('.leaflet-container')!.getBoundingClientRect();
      return box.left >= Math.max(0, map.left) - 1 && box.right <= Math.min(innerWidth, map.right) + 1;
    })).toBe(true);
    // The older width-only contract missed clipped headings and data under
    // the 240px mobile map's bottom controls. A passing popup must fit BOTH
    // axes of the visible map, not merely exist in Leaflet's DOM.
    await expect.poll(() => popup.evaluate(el => {
      const box = el.getBoundingClientRect(), map = el.closest('.leaflet-container')!.getBoundingClientRect();
      const header = el.closest('.wr-layout')!.querySelector('.wr-layout-header')!.getBoundingClientRect();
      const visibleTop = Math.max(0, map.top, header.bottom);
      return box.top >= visibleTop - 1 && box.bottom <= Math.min(innerHeight, map.bottom) + 1;
    }), { message: 'Complete popup frame inside the visible map, without hidden title or bottom data' }).toBe(true);
    const close = popup.locator('.leaflet-popup-close-button');
    const geometry = await close.boundingBox();
    expect(geometry!.width).toBeGreaterThanOrEqual(44);
    expect(geometry!.height).toBeGreaterThanOrEqual(44);
    expect(await close.evaluate(el => {
      const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return el === hit || el.contains(hit);
    }), 'Dismissal must not be covered by the sticky header or bottom controls').toBe(true);
    const content = popup.locator('.leaflet-popup-content');
    await expect(content).toHaveAttribute('tabindex', '0');
    const before = await content.evaluate(el => ({ client: el.clientHeight, total: el.scrollHeight, start: el.scrollTop }));
    if (before.total > before.client) {
      await content.focus(); await content.press('End');
      await expect.poll(() => content.evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 1)).toBe(true);
      expect(await body.evaluate(el => {
        const tail = el.lastElementChild!.getBoundingClientRect(), frame = el.closest('.leaflet-popup-content')!.getBoundingClientRect();
        return tail.bottom <= frame.bottom + 1;
      }), 'Last data row remains reachable through normal keyboard scrolling').toBe(true);
      await page.screenshot({ path: info.outputPath(`monitor-popup-${category}-end.png`), animations: 'disabled', scale: 'css' });
      await content.press('Home');
      await expect.poll(() => content.evaluate(el => el.scrollTop)).toBe(0);
    }
    records.push(await body.evaluate((el, category) => ({ category, text: el.textContent, style: { width: getComputedStyle(el).width, font: getComputedStyle(el).fontFamily }, bounds: el.getBoundingClientRect().toJSON() }), category));
    await page.screenshot({ path: info.outputPath(`monitor-popup-${category}.png`), animations: 'disabled', scale: 'css' });
    await close.click();
    await expect(body).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
  await info.attach('live-popup-contract', { body: JSON.stringify({ commit: process.env.GITHUB_SHA, records, errors, writes, businessAPIIntercepted: false, physicalAndroid: false }), contentType: 'application/json' });
});
