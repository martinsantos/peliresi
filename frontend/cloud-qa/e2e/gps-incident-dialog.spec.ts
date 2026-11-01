import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('incident dialog keeps keyboard focus and restores it on Escape', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-unreadable-handoff-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name];
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), writes: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes(`/api/manifiestos/${manifest.id}/`)) writes.push(new URL(request.url()).pathname);
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition() { return 1; }, getCurrentPosition() {}, clearWatch() {},
    } });
  });
  await isolatedMapTiles(page, info);
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    const opener = page.getByRole('button', { name: 'Incidente', exact: true });
    await expect(opener).toBeEnabled(); await opener.focus(); await opener.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Reportar Incidente', exact: true });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    const cancel = dialog.getByRole('button', { name: 'Cancelar', exact: true });
    await cancel.focus(); await page.keyboard.press('Tab');
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused();
    expect(writes).toEqual([]);
    writeFileSync(info.outputPath('incident-keyboard-proof.json'), JSON.stringify({ surface: info.project.name, focusContained: true, restored: true }));
  } finally { await context.close(); }
});

test('incident form labels fields, explains a missing type and records one synthetic report', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-unreadable-handoff-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name];
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [];
  let incidents = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith(`/api/manifiestos/${manifest.id}/incidente`)) incidents++;
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition() { return 1; }, getCurrentPosition() {}, clearWatch() {},
    } });
  });
  await isolatedMapTiles(page, info);
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await page.getByRole('button', { name: 'Incidente', exact: true }).click();
    const description = page.getByLabel('Descripción (opcional)', { exact: true });
    await description.fill('Avería simulada durante la prueba');
    await page.getByRole('button', { name: 'Registrar Incidente', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Reportar Incidente', exact: true });
    const alert = dialog.getByRole('alert'); await expect(alert).toContainText('Seleccioná un tipo de incidente');
    await expect(alert).toBeFocused(); await expect(description).toHaveValue('Avería simulada durante la prueba');
    expect(incidents).toBe(0);
    const type = dialog.getByRole('button', { name: 'Avería mecánica', exact: true });
    await type.click(); await expect(type).toHaveAttribute('aria-pressed', 'true');
    const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/api/manifiestos/${manifest.id}/incidente`));
    await dialog.getByRole('button', { name: 'Registrar Incidente', exact: true }).click();
    expect((await response).status()).toBe(200); await expect(dialog).not.toBeVisible();
    expect(incidents).toBe(1); expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    writeFileSync(info.outputPath('incident-record-proof.json'), JSON.stringify({ surface: info.project.name, id: manifest.id, incidents, synthetic: true }));
  } finally { await context.close(); }
});
