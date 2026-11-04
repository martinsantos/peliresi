import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { activeGpsQueueKey, isolatedMapTiles, login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('explains an unreadable GPS copy before a handoff and keeps the form', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-unreadable-handoff-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name];
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
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
    const key = await activeGpsQueueKey(page, fixture.owner, manifest.id);
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(k => localStorage.setItem(k, ''), key);
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron leer las ubicaciones guardadas' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Registrar traspaso', exact: true }).click();
    const form = page.getByRole('form', { name: 'Registrar traspaso de carga' });
    await form.getByLabel('Reemplazo').selectOption('EXTERNO');
    await form.getByLabel('Empresa', { exact: true }).fill('QA Reemplazo eventual');
    await form.getByLabel('Motivo del traspaso').fill('Rotura simulada de prueba');
    await form.getByRole('button', { name: 'Confirmar traspaso', exact: true }).click();
    const alert = form.getByRole('alert'); await expect(alert).toBeVisible(); await expect(alert).toBeFocused();
    expect(writes).toEqual([]); expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('');
    await expect(form.getByLabel('Empresa', { exact: true })).toHaveValue('QA Reemplazo eventual');
    await expect(form.getByLabel('Motivo del traspaso')).toHaveValue('Rotura simulada de prueba');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await alert.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('relevo-gps-ilegible.png'), animations: 'disabled' });
    await expect(alert).toContainText('No se pudieron leer las ubicaciones guardadas');
    await expect(alert).toContainText('contactá a soporte');
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('proof.json'), JSON.stringify({ surface: info.project.name, preserved: true, handoffRequests: writes.length }));
  } finally { await context.close(); }
});

test('keeps keyboard focus inside the blocked delivery dialog and restores it on Escape', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-unreadable-handoff-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name];
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition() { return 1; }, getCurrentPosition() {}, clearWatch() {},
    } });
  });
  await isolatedMapTiles(page, info);
  try {
    await login(page, info, 'transportista');
    const key = await activeGpsQueueKey(page, fixture.owner, manifest.id);
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(k => localStorage.setItem(k, ''), key);
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron leer las ubicaciones guardadas' }).first()).toBeVisible();
    const opener = page.getByRole('button', { name: 'Confirmar entrega', exact: true });
    await expect(opener).toBeEnabled();
    await opener.focus(); await opener.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Confirmar Entrega?', exact: true });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    const cancel = dialog.getByRole('button', { name: 'Cancelar', exact: true });
    await cancel.focus(); await page.keyboard.press('Tab');
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused();
    expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('');
    writeFileSync(info.outputPath('keyboard-proof.json'), JSON.stringify({ surface: info.project.name, focusContained: true, restored: true }));
  } finally { await context.close(); }
});

test('keeps keyboard focus inside the available delivery dialog and restores it on Escape', async ({ browser }, info) => {
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
    const opener = page.getByRole('button', { name: 'Confirmar entrega', exact: true });
    await expect(opener).toBeEnabled(); await opener.focus(); await opener.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Confirmar Entrega?', exact: true });
    const confirm = dialog.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true });
    const cancel = dialog.getByRole('button', { name: 'Cancelar', exact: true });
    await expect(confirm).toBeEnabled();
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await cancel.focus(); await page.keyboard.press('Tab'); await expect(confirm).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(cancel).toBeFocused();
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused();
    expect(writes).toEqual([]);
    writeFileSync(info.outputPath('available-keyboard-proof.json'), JSON.stringify({ surface: info.project.name, focusContained: true, restored: true }));
  } finally { await context.close(); }
});
