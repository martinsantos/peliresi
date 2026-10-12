/** Real published trial OCR; synthetic bytes only, no account or application. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.GITHUB_REPOSITORY, 'martinsantos/peliresi');
assert.equal(process.env.GITHUB_REF, 'refs/heads/codex/sitrep-mail-safety-20261011');
const output = path.join(process.env.RUNNER_TEMP!, 'sitrep-brand-review', 'ocr');
await mkdir(output, { recursive: true });
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const sharp = require('sharp'); sharp.concurrency(1); sharp.cache(false);
const lines = ['LICENCIA DE PRUEBA - SIN VALIDEZ', 'APELLIDO: QA', 'NOMBRE: JUAN', 'DNI: 90000000', 'NRO LICENCIA: QA-12345', 'VENCIMIENTO: 31/12/2027'];
const bytes = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750"><rect width="1200" height="750" fill="white"/><g font-family="DejaVu Sans" font-size="36" fill="black">' + lines.map((text, i) => '<text x="50" y="' + (80 + i * 95) + '">' + text + '</text>').join('') + '</g></svg>')).png().toBuffer();
const browser = await chromium.launch();
const results: object[] = [];
try {
  for (const [name, width, height, prefix] of [['desktop', 1440, 900, ''], ['mobile', 360, 800, '/app']] as const) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
    const forbidden: string[] = [], errors: string[] = [];
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method());
      if (write && !(url.origin === 'https://sitrep.ultimamilla.com.ar' && url.pathname === '/api/solicitudes/analizar-documento' && request.method() === 'POST')) {
        forbidden.push(request.method() + ' ' + url.pathname); await route.abort(); return;
      }
      await route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('https://sitrep.ultimamilla.com.ar' + prefix + '/inscripcion/transportista?modo=revision');
      await expect(page.getByTestId('registration-wizard')).toBeVisible();
      await page.getByRole('button', { name: /^Paso 3 de 5:/ }).click();
      await page.getByRole('button', { name: 'Agregar chofer', exact: true }).click();
      const driver = page.getByRole('group', { name: 'Chofer 2', exact: true });
      const read = page.waitForResponse(r => r.url().endsWith('/api/solicitudes/analizar-documento') && r.request().method() === 'POST');
      await driver.getByLabel('Archivo de licencia del chofer 2').setInputFiles({ name: 'LICENCIA-QA-SIN-VALIDEZ.png', mimeType: 'image/png', buffer: bytes });
      const response = await read; assert.equal(response.status(), 200);
      const data = (await response.json()).data;
      assert.equal(data.persistido, false); assert.equal(data.analisis.motor, 'TESSERACT'); assert.equal(data.analisis.lectura, 'LEIDO');
      assert.equal(data.campos.dni, '90000000'); assert.equal(data.campos.nombre, 'JUAN');
      await expect(driver.getByText('Revisá los datos leídos', { exact: true })).toBeVisible();
      await expect(driver.getByLabel('DNI *', { exact: true })).toHaveValue('');
      await driver.getByText('Revisá los datos leídos', { exact: true }).scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1));
      await expect(page.locator('vite-error-overlay')).toHaveCount(0);
      const file = name + '-ocr-proposals.png';
      await page.screenshot({ path: path.join(output, file), animations: 'disabled' });
      await driver.getByRole('button', { name: 'Usar datos seleccionados', exact: true }).click();
      await expect(driver.getByLabel('DNI *', { exact: true })).toHaveValue('90000000');
      await page.getByRole('button', { name: 'Guardar borrador de prueba', exact: true }).click();
      await page.reload();
      await expect(page.getByRole('group', { name: 'Chofer 2', exact: true }).getByLabel('DNI *', { exact: true })).toHaveValue('90000000');
      assert.deepEqual(forbidden, []); assert.deepEqual(errors, []);
      const screenshot = await readFile(path.join(output, file));
      results.push({ name, file, width, height, sha256: createHash('sha256').update(screenshot).digest('hex'), status: 'PASS', ocr: 'TESSERACT', persistido: false, draftRecovered: true, forbidden, errors });
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ run: process.env.GITHUB_RUN_ID, commit: process.env.GITHUB_SHA, at: new Date().toISOString(), synthetic: true, edited: false, authenticated: false, businessDataWritten: false, results }, null, 2));
}
assert.equal(results.length, 2);
