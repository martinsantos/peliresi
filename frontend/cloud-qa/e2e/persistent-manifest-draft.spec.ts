import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { isolatedMapTiles, login, prefix } from './helpers';

async function choose(page: Page, label: string, pattern: RegExp) {
  const control = page.getByRole('button', { name: label, exact: true });
  if (await control.isEnabled()) {
    await control.click();
    await page.getByRole('option', { name: pattern }).click();
  }
}
for (const role of ['admin', 'generador', 'transportista', 'operador']) {
  test(role + ': recover after browser shutdown and erase after discard', async ({ playwright }, info) => {
    test.setTimeout(120000);
    const profile = info.outputPath('synthetic-browser-profile');
    mkdirSync(profile, { recursive: true });
    const use = info.project.use;
    let context: BrowserContext | undefined;
    const writes: string[] = [];
    async function open() {
      context = await playwright.chromium.launchPersistentContext(profile, {
        headless: true, baseURL: 'http://127.0.0.1:4177',
        viewport: use.viewport, userAgent: use.userAgent,
        deviceScaleFactor: use.deviceScaleFactor, isMobile: use.isMobile, hasTouch: use.hasTouch,
      });
      const page = context.pages()[0] || await context.newPage();
      await isolatedMapTiles(page, info);
      page.on('request', request => {
        if (request.method() !== 'GET' && /\/api\/manifiestos(?:\/|$)/.test(new URL(request.url()).pathname)) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
      });
      return page;
    }
    try {
      let page = await open();
      await login(page, info, role);
      await page.goto(prefix(info) + '/manifiestos/nuevo');
      await choose(page, 'Generador *', /^QA Generador 1 /);
      await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
      await choose(page, 'Tipo de Residuo *', /^Y1 - /);
      await page.getByLabel('Cantidad *', { exact: true }).fill('18.75');
      await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
      await choose(page, 'Transportista *', /^QA Transporte 1 /);
      await choose(page, 'Operador / Destino *', /^QA Operador 1 /);
      const note = 'Cierre completo: ñ, destino y 18.75 kg · ' + role;
      await page.getByLabel('Observaciones', { exact: true }).fill(note);
      await expect(page.getByText('Borrador guardado en este dispositivo', { exact: true })).toBeVisible();
      await context!.close(); context = undefined;

      // New Chromium process/profile session, not a reload or copied storageState.
      page = await open();
      await page.goto(prefix(info) + '/manifiestos/nuevo');
      await expect(page.getByLabel('Observaciones', { exact: true })).toHaveValue(note);
      await expect(page.getByText('Borrador recuperado · guardado en este dispositivo')).toBeVisible();
      expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('sitrep:manifest-form:')))).toEqual([]);
      await expect(page.getByRole('button', { name: 'Transportista *', exact: true })).toContainText('QA Transporte 1');
      await expect(page.getByRole('button', { name: 'Operador / Destino *', exact: true })).toContainText('QA Operador 1');
      await page.getByRole('button', { name: 'Anterior', exact: true }).click();
      await expect(page.getByLabel('Cantidad *', { exact: true })).toHaveValue('18.75');
      await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath(role + '-browser-reopened.png'), animations: 'disabled' });
      await page.getByRole('button', { name: 'Descartar borrador', exact: true }).click();
      await page.getByRole('button', { name: 'Sí, descartar', exact: true }).click();
      await context!.close(); context = undefined;
      page = await open();
      await page.goto(prefix(info) + '/manifiestos/nuevo');
      await expect(page.getByRole('button', { name: 'Generador *', exact: true })).toBeVisible();
      await expect(page.getByLabel('Observaciones', { exact: true })).toHaveCount(0);
      await expect(page.getByLabel('Borrador del manifiesto')).toHaveCount(0);
      expect(writes).toEqual([]);
      await info.attach('shutdown-proof', { body: JSON.stringify({ role, surface: info.project.name, browserSessions: 3, reusedDiskProfile: true, storageStateInjected: false, businessWrites: writes.length }), contentType: 'application/json' });
    } finally { await context?.close(); }
  });
}
