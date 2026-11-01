import { expect, test } from '@playwright/test';
import { rename, symlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles } from './helpers';

const out = '/work/sitrep/.qa-pwa-shortcuts-20261031';
const oldApp = '/work/sitrep/.qa-operational-ui-current2026103114/app';
const newApp = path.join(out, 'app');
const live = path.join(out, 'app-current');
if (process.env.QA_ARTIFACTS !== out || process.env.QA_APP_BUILD !== live) throw Error('Versiones QA inválidas');
async function selectRelease(target: string) {
  if (![oldApp, newApp].includes(target)) throw Error('Versión QA no permitida');
  const next = path.join(out, `app-next-${randomUUID()}`);
  await symlink(target, next, 'dir');
  await rename(next, live);
}
test.beforeAll(async () => { await assertCloudDatabase(); });
test('el navegador actualiza los accesos aun con el service worker anterior', async ({ page }, info) => {
  await isolatedMapTiles(page, info);
  await selectRelease(oldApp);
  try {
    await page.goto('/app/login');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 45_000 });
    const shortcuts = () => page.evaluate(async () => {
      const response = await fetch('/app/manifest-app.json', { cache: 'no-store' });
      if (!response.ok) throw Error(`Manifest HTTP ${response.status}`);
      return (await response.json()).shortcuts.map((entry: { name: string }) => entry.name);
    });
    const old = await shortcuts();
    expect(old).toContain('Centro de control');
    await selectRelease(newApp);
    const expected = ['Inicio', 'Escanear QR', 'Avisos'];
    expect(await shortcuts()).toEqual(expected);
    await page.context().setOffline(true);
    // The previous worker prefers its initial precache while it remains active.
    expect(await shortcuts()).toEqual(old);
    await page.context().setOffline(false);
    await page.evaluate(async () => {
      (window as any).__qaControllerChanges = 0;
      navigator.serviceWorker.addEventListener('controllerchange', () => { (window as any).__qaControllerChanges++; });
      await (await navigator.serviceWorker.ready).update();
    });
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/app/'))?.waiting?.state),
      { timeout: 45_000 }).toBe('installed');
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/app/'))!.waiting!.postMessage({ type: 'SKIP_WAITING' }));
    await expect.poll(() => page.evaluate(() => (window as any).__qaControllerChanges), { timeout: 45_000 }).toBeGreaterThan(0);
    expect(await shortcuts()).toEqual(expected);
    await page.context().setOffline(true);
    expect(await shortcuts()).toEqual(expected);
    await writeFile(info.outputPath('update-proof.json'), JSON.stringify({ synthetic: true, previousWorkerControlled: true,
      oldWorkerOfflineShowsOldManifest: true, newWorkerOfflineShowsNewManifest: true, androidLauncherVerified: false }));
  } finally {
    await page.context().setOffline(false);
    await selectRelease(newApp);
  }
});
