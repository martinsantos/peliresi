import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const origin = 'https://sitrep.ultimamilla.com.ar';
const commit = '3117f91d7c21516993f22a8888ebb4d007bea975';
const output = '/tmp/sitrep-production-registration-proof';
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Cloud only, never launch a local browser');
assert.equal(process.env.GITHUB_REF, 'refs/heads/codex/sitrep-production-forms-20261011');
await mkdir(output, { recursive: true });
const fixture = await readFile(new URL('./registration-license-QA.png', import.meta.url));
const hashes = { web: '2e6dbd1594120f772dee91a198d48e4b95414dfefbc5465667cafb79abaab2a4', app: '9e7d941c6d339458552c0fb89aae2abaaa572ac1a35ba08bc9db54fe2ed626e2' };
const results: unknown[] = [], blocked: string[] = [], pageErrors: string[] = [], failedResponses: string[] = [];
const browser = await chromium.launch({ headless: true });
let failure: unknown;
try {
  for (const surface of [
    { name: 'web-desktop', prefix: '', viewport: { width: 1440, height: 960 }, mobile: false },
    { name: 'web-mobile', prefix: '', viewport: { width: 390, height: 844 }, mobile: true },
    { name: 'app-mobile', prefix: '/app', viewport: { width: 390, height: 844 }, mobile: true },
  ]) {
    // Isolated throwaway storage: cannot read or change the human's open form.
    const context = await browser.newContext({ viewport: surface.viewport, isMobile: surface.mobile, hasTouch: surface.mobile, serviceWorkers: 'block' });
    // Safety firewall only: no mocked API success/error or substituted business data.
    await context.route('**/*', async (route: any) => {
      const request = route.request(), url = new URL(request.url());
      const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(request.method());
      const statelessOCR = request.method() === 'POST' && url.origin === origin && url.pathname === '/api/solicitudes/analizar-documento';
      if (!readOnly && !statelessOCR) { blocked.push(request.method() + ' ' + url.pathname); await route.abort('blockedbyclient'); }
      else await route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error: Error) => pageErrors.push(surface.name + ': ' + error.message));
    page.on('response', (response: any) => { if (response.status() >= 400 && new URL(response.url()).origin === origin) failedResponses.push(surface.name + ': ' + response.status() + ' ' + new URL(response.url()).pathname); });
    try {
      for (const actor of [{ type: 'generador', total: 7, second: 'Regulatorio' }, { type: 'operador', total: 8, second: 'Regulatorio' }, { type: 'transportista', total: 5, second: 'Habilitacion' }]) {
        const url = origin + surface.prefix + '/inscripcion/' + actor.type + '?modo=revision';
        const response = await page.goto(url, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        assert.equal(createHash('sha256').update(await response.body()).digest('hex'), surface.prefix ? hashes.app : hashes.web);
        await expect(page.getByTestId('registration-wizard')).toBeVisible();
        const value = 'QA SIN VALIDEZ - ' + surface.name + ' ' + actor.type;
        await page.getByLabel('Razon Social *', { exact: true }).fill(value);
        await page.getByRole('button', { name: 'Paso 2 de ' + actor.total + ': ' + actor.second, exact: true }).click();
        await page.getByRole('button', { name: 'Guardar borrador de prueba', exact: true }).click();
        await page.reload({ waitUntil: 'networkidle' });
        await expect(page.getByRole('navigation', { name: 'Etapas de la inscripción' }).locator('[aria-current=step]')).toHaveAttribute('aria-label', 'Paso 2 de ' + actor.total + ': ' + actor.second);
        await page.getByRole('button', { name: new RegExp('^Paso 1 de ' + actor.total + ':') }).click();
        await expect(page.getByLabel('Razon Social *', { exact: true })).toHaveValue(value);
        for (let step = 1; step <= actor.total; step++) {
          await page.getByRole('button', { name: new RegExp('^Paso ' + step + ' de ' + actor.total + ':') }).click();
          await expect(page.getByRole('navigation', { name: 'Etapas de la inscripción' }).locator('[aria-current=step]')).toHaveAttribute('aria-label', new RegExp('^Paso ' + step + ' de '));
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1), surface.name + ' overflow at ' + actor.type + ' step ' + step);
          await expect(page.locator('vite-error-overlay')).toHaveCount(0);
          await page.screenshot({ path: output + '/' + surface.name + '-' + actor.type + '-step-' + step + '.png', animations: 'disabled' });
        }
        results.push({ surface: surface.name, actor: actor.type, route: url, shellHashVerified: true, draftValueRecovered: true, stepRecovered: true, stepsVisited: actor.total, noHorizontalOverflow: true });
      }
      await page.getByRole('button', { name: /^Paso 3 de 5:/ }).click();
      await page.getByRole('button', { name: 'Agregar chofer', exact: true }).click();
      const driver = page.getByRole('group', { name: 'Chofer 2', exact: true });
      const reading = page.waitForResponse((response: any) => new URL(response.url()).pathname === '/api/solicitudes/analizar-documento' && response.request().method() === 'POST', { timeout: 25000 });
      await driver.getByLabel('Archivo de licencia del chofer 2').setInputFiles({ name: 'LICENCIA-QA-SIN-VALIDEZ.png', mimeType: 'image/png', buffer: fixture });
      const response = await reading;
      assert.equal(response.status(), 200);
      const data = (await response.json()).data;
      assert.equal(data.persistido, false);
      assert.equal(data.analisis.motor, 'TESSERACT');
      assert.equal(data.analisis.lectura, 'LEIDO');
      assert.deepEqual(data.campos, { nombre: 'JUAN', apellido: 'QA', dni: '90000000', licencia: 'QA-12345', vencimiento: '2027-12-31' });
      await expect(driver.getByLabel('Nombre *', { exact: true })).toHaveValue('');
      await driver.getByRole('button', { name: 'Usar datos seleccionados', exact: true }).click();
      await expect(driver.getByLabel('DNI *', { exact: true })).toHaveValue('90000000');
      await page.getByRole('button', { name: 'Guardar borrador de prueba', exact: true }).click();
      await page.reload({ waitUntil: 'networkidle' });
      const recovered = page.getByRole('group', { name: 'Chofer 2', exact: true });
      await expect(recovered.getByLabel('Nombre *', { exact: true })).toHaveValue('JUAN');
      await expect(recovered.getByLabel('DNI *', { exact: true })).toHaveValue('90000000');
      await expect(page.getByText('Datos recuperados. Volvé a seleccionar los archivos de prueba para leerlos.', { exact: true })).toBeVisible();
      await recovered.scrollIntoViewIfNeeded();
      await page.screenshot({ path: output + '/' + surface.name + '-ocr-recovered.png', animations: 'disabled' });
      results.push({ surface: surface.name, statelessOCR: true, fields: 5, explicitAcceptance: true, driverDraftRecovered: true, imagesRetainedByServer: false });
    } catch (error) {
      await page.screenshot({ path: output + '/' + surface.name + '-failure.png', animations: 'disabled' });
      throw error;
    } finally { await context.close(); }
  }
  assert.deepEqual(blocked, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedResponses, []);
  assert.equal(results.length, 12);
} catch (error) { failure = error; }
finally {
  await browser.close();
  const result = { at: new Date().toISOString(), commit, origin, passed: results.length, failed: failure ? 1 : 0, failure: failure instanceof Error ? failure.message : failure, results, blockedBusinessWrites: blocked, pageErrors, failedResponses, credentialsUsed: false, isolatedStorage: true, syntheticImagesOnly: true, browserClosed: true, businessDataWritten: false, scope: 'Public trial on final URL; not a repeat of administrative or physical APK tests' };
  await writeFile(output + '/result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
if (failure) throw failure;
