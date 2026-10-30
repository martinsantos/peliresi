import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix, readableFixedAction, readableWholeWords } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('la fotografía conserva el contexto y el foco al ampliarla', async ({ page }, info) => {
  page.setDefaultTimeout(15000);
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  expect(fixture.synthetic).toBe(true);
  const errors: string[] = [];
  const consoleMessages: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 500) errors.push(`API ${response.status()}`); });
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) consoleMessages.push(`${message.type()}: ${message.text()}`); });
  await login(page, info);
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`${prefix(info)}/inspecciones/${fixture.inspection.id}#evidencias`);
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.getByRole('heading', { name: fixture.inspection.numero, exact: true })).toBeVisible();
  await expect(page.locator('vite-error-overlay, nextjs-portal')).toHaveCount(0);
  const trigger = page.getByRole('button', { name: 'Ampliar evidencia: Imagen artificial de revisión' });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /^Vista ampliada/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByAltText('Imagen artificial de revisión')).toBeVisible();
  await page.screenshot({ path: info.outputPath('evidencia-abierta.png'), animations: 'disabled' });
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  const close = dialog.getByRole('button', { name: /Cerrar/ });
  const measurements = [];
  for (const width of [320, 393, 768, 1365, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
    // visualViewport changes and the shared modal applies them on the next frame.
    await expect.poll(() => close.evaluate(element => {
      const rect = element.getBoundingClientRect(), v = window.visualViewport;
      return rect.left >= (v?.offsetLeft || 0) - 1 && rect.right <= (v ? v.offsetLeft + v.width : innerWidth) + 1
        && rect.top >= (v?.offsetTop || 0) - 1 && rect.bottom <= (v ? v.offsetTop + v.height : innerHeight) + 1;
    })).toBe(true);
    await readableFixedAction(close, dialog);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    measurements.push({ width, close: await close.boundingBox() });
  }
  if (info.project.name === 'app') {
    await page.setViewportSize({ width: 320, height: 800 });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(320);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await expect.poll(() => close.evaluate(element => {
      const rect = element.getBoundingClientRect(), v = window.visualViewport;
      return rect.left >= (v?.offsetLeft || 0) - 1 && rect.right <= (v ? v.offsetLeft + v.width : innerWidth) + 1
        && rect.top >= (v?.offsetTop || 0) - 1 && rect.bottom <= (v ? v.offsetTop + v.height : innerHeight) + 1;
    })).toBe(true);
    await readableFixedAction(close, dialog);
    await readableWholeWords(dialog.getByRole('heading', { name: 'Vista ampliada' }));
    await page.screenshot({ path: info.outputPath('evidencia-texto-ampliado.png'), animations: 'disabled' });
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  }
  await close.focus();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('heading', { name: fixture.inspection.numero, exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(consoleMessages).toEqual([]);
  writeFileSync(info.outputPath('focus-evidence.json'), JSON.stringify({ surface: info.project.name, synthetic: true, measurements, errors, consoleMessages }, null, 2));
});

test('el formulario de inspección sigue accesible con texto ampliado', async ({ page }, info) => {
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let writes = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/inspecciones') writes++;
  });
  await login(page, info);
  await page.setViewportSize(info.project.name === 'app' ? { width: 320, height: 568 } : { width: 1365, height: 900 });
  await page.goto(`${prefix(info)}/inspecciones`);
  await expect(page.getByRole('button', { name: 'Nueva inspección', exact: true })).toBeVisible();
  if (info.project.name === 'app') {
    const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
    expect(await navigation.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  if (info.project.name === 'app') {
    const header = page.getByRole('banner');
    await readableWholeWords(header.getByRole('heading', { name: 'Inspecciones' }));
    for (const name of ['Abrir menu', 'Ayuda y soporte técnico', /^Notificaciones/]) {
      const control = header.getByRole('button', { name });
      await readableFixedAction(control, header);
      expect((await control.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    }
    const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
    const notices = navigation.getByRole('link', { name: /Avisos/ });
    await notices.focus();
    await expect(notices).toBeFocused();
    const geometry = await navigation.evaluate((element) => {
      const nav = element.getBoundingClientRect();
      const main = document.querySelector('main')!.getBoundingClientRect();
      const last = element.querySelector('a:last-child')!.getBoundingClientRect();
      return { mainHeight: main.height, noOverlap: main.bottom <= nav.top + 1,
        lastVisible: last.left >= nav.left - 1 && last.right <= nav.right + 1,
        containedScroll: element.scrollWidth >= element.clientWidth };
    });
    expect(geometry.mainHeight).toBeGreaterThan(80);
    expect(geometry).toMatchObject({ noOverlap: true, lastVisible: true, containedScroll: true });
  }
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección' });
  await expect(dialog).toBeVisible();
  await readableWholeWords(dialog.getByRole('heading', { name: 'Nueva inspección' }));
  const close = dialog.getByRole('button', { name: 'Cerrar', exact: true });
  await readableFixedAction(close, dialog);
  await readableFixedAction(dialog.getByRole('button', { name: 'Cancelar', exact: true }), dialog);
  await readableFixedAction(dialog.getByRole('button', { name: 'Crear expediente', exact: true }), dialog);
  const location = dialog.getByLabel('Ubicación prevista');
  const label = dialog.getByText('Ubicación prevista', { exact: true });
  await label.scrollIntoViewIfNeeded();
  await location.fill('Lugar artificial para revisión de teclado');
  await expect(location).toHaveValue('Lugar artificial para revisión de teclado');
  const fieldAndLabelVisible = () => label.evaluate(element => {
    const field = element.parentElement!.querySelector('input')!;
    const body = element.closest('.overflow-y-auto')!.getBoundingClientRect();
    const labelRect = element.getBoundingClientRect(), fieldRect = field.getBoundingClientRect();
    return labelRect.top >= body.top - 1 && labelRect.bottom <= body.bottom + 1
      && fieldRect.top >= body.top - 1 && fieldRect.bottom <= body.bottom + 1;
  });
  await expect.poll(fieldAndLabelVisible).toBe(true);
  if (info.project.name === 'app') {
    await page.setViewportSize({ width: 320, height: 650 });
    await expect.poll(() => page.evaluate(() => window.visualViewport?.height)).toBe(650);
    await page.setViewportSize({ width: 320, height: 568 });
    await expect.poll(() => page.evaluate(() => window.visualViewport?.height)).toBe(568);
    await expect.poll(fieldAndLabelVisible).toBe(true);
    await expect(location).toBeFocused();
  }
  await page.screenshot({ path: info.outputPath('inspeccion-texto-ampliado.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(writes).toBe(0);
  expect(errors).toEqual([]);
});

test('el panel de avisos deja sus controles accesibles con texto ampliado', async ({ page }, info) => {
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'generador');
  await page.setViewportSize(info.project.name === 'app' ? { width: 320, height: 568 } : { width: 1365, height: 900 });
  await page.goto(`${prefix(info)}/notificaciones`);
  const header = page.getByRole('banner');
  await expect(header.getByRole('heading', { name: 'Avisos' })).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const bell = header.getByRole('button', { name: /^Notificaciones/ });
  await bell.focus(); await page.keyboard.press('Enter');
  const panel = page.getByRole('region', { name: 'Notificaciones recientes' });
  await expect(panel).toBeVisible();
  await readableWholeWords(panel.getByRole('heading', { name: 'Notificaciones' }));
  for (const name of ['Cerrar notificaciones', 'Ver todas las notificaciones']) {
    const action = panel.getByRole('button', { name, exact: true });
    await readableFixedAction(action, panel);
    await expect.poll(() => action.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
      return hit === element || Boolean(hit && element.contains(hit));
    })).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('campana-texto-ampliado.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});
