import { expect, test, type Page } from '@playwright/test';
import { readFile, rename, symlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

const out = '/work/sitrep/.qa-notification-click-20261031';
const previous = '/work/sitrep/.qa-pwa-shortcuts-20261031';
const liveWeb = path.join(out, 'web-current'), liveApp = path.join(out, 'app-current');
if (process.env.QA_ARTIFACTS !== out || process.env.QA_WEB_BUILD !== liveWeb || process.env.QA_APP_BUILD !== liveApp)
  throw Error('Versiones QA inválidas');
async function select(app: boolean, newer: boolean) {
  const live = app ? liveApp : liveWeb;
  const target = path.join(newer ? out : previous, app ? 'app' : 'web');
  if (![path.join(out, app ? 'app' : 'web'), path.join(previous, app ? 'app' : 'web')].includes(target)) throw Error('Versión no permitida');
  const next = path.join(out, `${app ? 'app' : 'web'}-next-${randomUUID()}`);
  await symlink(target, next, 'dir'); await rename(next, live);
}
async function controlled(page: Page, app: boolean) {
  await page.waitForFunction(expected => navigator.serviceWorker.controller?.scriptURL.endsWith(expected), app ? '/app/sw-app.js' : '/sw.js', { timeout: 45_000 });
}
test.beforeAll(async () => { await assertCloudDatabase(); });
test('una actualización no borra el formulario abierto en otra pestaña', async ({ page }, info) => {
  const app = info.project.name === 'app';
  await select(false, true); await select(true, true); await select(app, false);
  try {
    await login(page, info, 'inspector');
    await controlled(page, app);
    await page.goto(`${prefix(info)}/inspecciones`);
    await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
    await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
    const value = `QA borrador de inspección ${info.project.name}`;
    await page.getByLabel('Descripción inicial').fill(value);
    const second = await page.context().newPage();
    try {
      await isolatedMapTiles(second, info);
      await second.goto(`${prefix(info)}/dashboard`); await controlled(second, app);
      const priorWorker = await readFile(path.join(previous, app ? 'app/sw-app.js' : 'web/sw.js'), 'utf8');
      const version = app ? priorWorker.match(/const SW_VERSION = '([^']+)'/)?.[1]
        : priorWorker.match(/const CACHE_NAME = '([^']+)'/)?.[1];
      expect(version).toBeTruthy();
      const cacheName = app ? `sitrep-app-${version}` : version!;
      const shell = app ? '/app/index.html' : '/index.html';
      const oldShell = await second.evaluate(async ({ cacheName, shell }) => (await (await caches.open(cacheName)).match(shell))?.text(), { cacheName, shell });
      expect(oldShell).toContain('<!');
      await select(app, true);
      await second.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
      await expect.poll(() => second.evaluate(async scope => (await navigator.serviceWorker.getRegistration(scope))?.waiting?.state, app ? '/app/' : '/'),
        { timeout: 45_000 }).toBe('installed');
      const savedShell = await second.evaluate(async ({ cacheName, shell }) => (await (await caches.open(cacheName)).match(shell))?.text(), { cacheName, shell });
      expect(savedShell).toBe(oldShell);
      await page.evaluate(() => { (window as any).__qaControllerChanges = 0;
        navigator.serviceWorker.addEventListener('controllerchange', () => { (window as any).__qaControllerChanges++; }); });
      await second.getByRole('button', { name: /Nueva versión disponible — Actualizar cuando termines/ }).click();
      await expect.poll(() => page.evaluate(() => (window as any).__qaControllerChanges), { timeout: 45_000 }).toBeGreaterThan(0);
      await expect(page.getByLabel('Descripción inicial')).toHaveValue(value);
      await page.getByLabel('Descripción inicial').fill(value + ' · continúa');
      await page.getByRole('dialog').getByRole('button', { name: 'Volver', exact: true }).click();
      await page.reload();
      await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
      await expect(page.getByLabel('Descripción inicial')).toHaveValue(value + ' · continúa');
      await page.screenshot({ path: info.outputPath('formulario-conservado.png'), animations: 'disabled', scale: 'css' });
      await writeFile(info.outputPath('proof.json'), JSON.stringify({ synthetic: true, oldShellRetainedWhileWaiting: true,
        draftEditableAfterUpdate: true, draftRecoveredAfterReload: true }), { flag: 'wx', mode: 0o600 });
    } finally { await second.close(); }
  } finally { await select(false, true); await select(true, true); }
});
