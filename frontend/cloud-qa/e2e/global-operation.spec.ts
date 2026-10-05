import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { login, prefix } from './helpers';

// Expectations implement the human's confirmed policy, not the existing filter.
// No controller mocks, business interception or injected sessions.
for (const user of ['generador2', 'operador2', 'transportista2']) {
  test(`${user}: global Monitor and Control data remain visible inside the authenticated system`, async ({ page }, info) => {
    test.setTimeout(90000);
    const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
    expect(fixture.database).toBe('sitrep_night_qa_20260926');
    expect(fixture.externalDelivery).toBe(false);
    const errors: string[] = [];
    const writes: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/api/centro-control/') && response.status() >= 400) errors.push(String(response.status()) + ' ' + new URL(response.url()).pathname);
    });
    await login(page, info, user);
    page.on('request', request => {
      if (/\/api\/(actores|manifiestos|inspecciones|centro-control)\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
    });
    const liveResponse = page.waitForResponse(response => response.url().endsWith('/api/centro-control/monitor-live') && response.status() === 200);
    await page.goto(`${prefix(info)}/monitor`);
    await expect(page).toHaveURL(new RegExp(`${prefix(info)}/monitor$`));
    const live = (await (await liveResponse).json()).data;
    expect(live.enTransito.some((trip: { manifiestoId: string }) => trip.manifiestoId === fixture.deviceManifest.id)).toBe(true);
    await expect(page.locator('.wr-layout-header').getByRole('button', { name: 'En vivo', exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.wr-layout')).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    await expect(page).toHaveTitle(/SITREP/i);
    await page.screenshot({ path: info.outputPath('global-monitor-' + user + '.png'), animations: 'disabled' });

    const activityResponse = page.waitForResponse(response => response.url().includes('/api/centro-control/actividad') && response.status() === 200);
    await page.goto(`${prefix(info)}/centro-control`);
    const activity = (await (await activityResponse).json()).data;
    expect(activity.enTransito.some((trip: { manifiestoId: string }) => trip.manifiestoId === fixture.deviceManifest.id)).toBe(true);
    const panel = page.getByRole('region', { name: 'Agenda y viajes', exact: true });
    const active = panel.getByRole('button', { name: /^Viajes Activos/ });
    await expect(active).toBeVisible();
    if (await active.getAttribute('aria-expanded') !== 'true') await active.click();
    await active.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('global-control-' + user + '.png'), animations: 'disabled' });
    // This record belongs entirely to actor1, not the logged-in actor2.
    await expect(panel.getByText(fixture.deviceManifest.numero, { exact: true })).toBeVisible();
    await expect(panel.getByText(fixture.deviceManifest.numero, { exact: true })).toHaveCount(1);
    const selection = panel.getByRole('button', { name: 'Seleccionar viaje ' + fixture.deviceManifest.numero, exact: true });
    await selection.click();
    await expect(selection).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.getByRole('button', { name: 'Ver detalle del viaje', exact: true })).toHaveCount(0);
    await expect(panel.getByText('Vista operativa · expediente restringido', { exact: true })).toBeVisible();
    await selection.click();
    await expect(selection).toHaveAttribute('aria-expanded', 'false');
    const forecastResponse = page.waitForResponse(response => response.url().includes('/api/centro-control/forecast') && response.status() === 200);
    await page.goto(`${prefix(info)}/monitor`);
    await page.locator('.wr-layout-header').getByRole('button', { name: 'Pendientes', exact: true }).click();
    const forecast = (await (await forecastResponse).json()).data;
    expect(forecast.pendienteTratamiento.length).toBeGreaterThan(0);
    const foreignPending = page.getByRole('group', { name: 'Vista operativa ' + fixture.followup.numero, exact: true });
    await expect(foreignPending).toBeVisible();
    await expect(foreignPending.getByRole('link')).toHaveCount(0);
    await expect(foreignPending.getByText('Vista operativa · expediente restringido', { exact: true })).toBeVisible();
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
    await info.attach('global-operation-policy', { body: JSON.stringify({
      user, foreignRecord: fixture.deviceManifest.numero, url: page.url(),
      viewport: page.viewportSize(), errors, writes, businessAPIIntercepted: false,
    }), contentType: 'application/json' });
  });
}

test('global operational pages do not load business data without a system session', async ({ page }, info) => {
  const calls: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/centro-control/')) calls.push(new URL(request.url()).pathname);
  });
  for (const route of ['/monitor', '/centro-control']) {
    await page.goto(prefix(info) + route);
    await expect(page).toHaveURL(new RegExp(`${prefix(info)}/login$`));
    await expect(page.getByLabel('Correo electrónico o CUIT')).toBeVisible();
    await expect(page.locator('.leaflet-container')).toHaveCount(0);
  }
  expect(calls).toEqual([]);
  await page.screenshot({ path: info.outputPath('global-operation-requires-login.png'), animations: 'disabled' });
});
