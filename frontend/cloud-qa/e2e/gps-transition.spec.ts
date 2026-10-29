import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

async function setup(page: Page, info: TestInfo, kind: string) {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-transition-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name][kind];
  const queueKey = `sitrep_gps_v2_${encodeURIComponent(JSON.stringify([String(fixture.owner), manifest.id]))}`;
  const point = { lat: -33.123, lng: -68.123, speed: null, heading: null, puntoId: randomUUID() };
  let blocked = true, attempts = 0, transitions = 0;
  const events: string[] = [];
  const endpoint = 'confirmar-entrega';
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith(`/manifiestos/${manifest.id}/${endpoint}`)) {
      transitions++; events.push('transition-request');
    }
  });
  page.on('response', response => {
    if (response.request().method() === 'POST' && response.url().endsWith(`/manifiestos/${manifest.id}/ubicacion-idempotente`) && response.status() === 200) events.push('gps-accepted');
  });
  await page.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`, async route => {
    attempts++; if (blocked) await route.abort('failed'); else await route.continue();
  });
  await login(page, info, kind === 'admin-delivery' ? 'admin' : 'transportista');
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify([data])), { key: queueKey, data: point });
  return { manifest, other: fixture.cases[info.project.name]['fleet-other'], queueKey, point, attempts: () => attempts, transitions: () => transitions, events,
    unblock: () => { blocked = false; } };
}

test('an administrator cannot deliver while another account has GPS pending on this device', async ({ page }, info) => {
  const data = await setup(page, info, 'admin-delivery');
  await page.goto(`${prefix(info)}/manifiestos/${data.manifest.id}`);
  const button = page.getByRole('button', { name: 'Confirmar Entrega', exact: true });
  await button.click();
  await expect(page.getByRole('alert').filter({ hasText: /otra cuenta/i })).toBeVisible();
  expect(data.attempts()).toBe(0);
  expect(data.transitions()).toBe(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), data.queueKey)).toEqual([data.point]);
  writeFileSync(info.outputPath('admin-delivery-proof.json'), JSON.stringify({ surface: info.project.name, transitions: data.transitions(), synthetic: true }));
});

test('the multiple-load screen waits for stored GPS before delivering one load', async ({ page }, info) => {
  const data = await setup(page, info, 'fleet-delivery');
  await page.goto(`${prefix(info)}/transporte/cargas`);
  await page.getByRole('searchbox', { name: 'Número de manifiesto', exact: true }).fill(data.manifest.numero);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('checkbox', { name: `Llevo ${data.manifest.numero} en este móvil`, exact: true }).check();
  await page.getByRole('searchbox', { name: 'Número de manifiesto', exact: true }).fill(data.other.numero);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('checkbox', { name: `Llevo ${data.other.numero} en este móvil`, exact: true }).check();
  await page.getByRole('button', { name: `Entregar ${data.manifest.numero}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirmar entrega', exact: true });
  await expect(dialog.getByText(/Las otras cargas permanecen seleccionadas/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirmar entrega de esta carga', exact: true }).click();
  await expect.poll(data.attempts, { timeout: 8000 }).toBe(1);
  await expect(dialog.getByRole('alert')).toContainText(/ubicaciones pendientes/i);
  await expect(dialog.getByRole('alert')).toBeFocused();
  expect(data.transitions()).toBe(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), data.queueKey)).toEqual([data.point]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await dialog.screenshot({ path: info.outputPath('gps-pendiente.png'), animations: 'disabled' });
  data.unblock();
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/manifiestos/${data.manifest.id}/confirmar-entrega-idempotente`));
  await dialog.getByRole('button', { name: 'Confirmar entrega de esta carga', exact: true }).click(); expect((await response).status()).toBe(200);
  expect(data.events).toEqual(['gps-accepted', 'transition-request']);
  expect(await page.evaluate(key => localStorage.getItem(key), data.queueKey)).toBeNull();
  await expect(page.getByRole('region', { name: 'Cargas marcadas' })).toContainText(data.other.numero);
  writeFileSync(info.outputPath('fleet-delivery-proof.json'), JSON.stringify({ surface: info.project.name, events: data.events, synthetic: true }));
});
