import { expect, test } from '@playwright/test';
import { prefix, readableFixedAction, readableWholeWords } from './helpers';

test('public actor wizards keep titles aligned, current steps visible and navigation at the heading without submitting records', async ({ page }, info) => {
  test.setTimeout(120000);
  const writes: string[] = [], errors: string[] = [], readings: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/solicitudes/analizar-documento') readings.push(request.url());
    else if (/\/api\/solicitudes(?:\/|\?|$)/.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
  });
  page.on('pageerror', error => errors.push(error.message));
  for (const [actor, total] of [['Generador', 7], ['Transportista', 5], ['Operador', 8]] as const) {
    await page.goto(`${prefix(info)}/login`);
    // A real link from the lower part of the login page, not goto() directly to
    // the wizard: reproduce entry with an existing scroll position.
    await page.getByRole('link', { name: `Probar formulario de ${actor} sin completar datos`, exact: true }).click();
    const title = page.getByRole('heading', { name: `Inscripción como ${actor}`, exact: true });
    const wizard = page.getByTestId('registration-wizard');
    const rail = page.getByRole('navigation', { name: 'Etapas de la inscripción', exact: true });
    await expect(title).toBeVisible();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    expect(Math.abs((await title.boundingBox())!.x - (await wizard.boundingBox())!.x)).toBeLessThanOrEqual(1);
    await readableWholeWords(title);
    await readableFixedAction(page.getByRole('button', { name: 'Volver a la pantalla anterior', exact: true }), page.getByTestId('registration-identity'));
    await expect(rail.getByRole('button')).toHaveCount(total);
    await expect(rail.getByRole('button', { name: /Calculo TEF/i })).toHaveCount(0);
    const draft = page.getByRole('region', { name: 'Borrador de prueba', exact: true });
    const help = draft.getByRole('button', { name: 'Información del modo prueba', exact: true });
    await expect(help).toHaveAttribute('aria-expanded', 'false');
    await expect(draft.getByRole('note')).toHaveCount(0);
    expect((await draft.boundingBox())!.height).toBeLessThanOrEqual(88);
    for (const button of await draft.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (info.project.name !== 'web-desktop') {
      const first = (await page.getByLabel('Razon Social *', { exact: true }).boundingBox())!;
      expect(first.y + first.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.58);
    }
    await help.click(); await expect(draft.getByRole('note')).toContainText('No crea cuentas, trámites ni avisos');
    await help.click(); await expect(draft.getByRole('note')).toHaveCount(0);
    for (let step = 1; step <= total; step++) {
      const active = rail.locator('[aria-current="step"]');
      await expect(active).toHaveAttribute('aria-label', new RegExp(`^Paso ${step} de ${total}: `));
      await readableFixedAction(active, rail);
      const label = active.locator('span');
      await expect(label).toBeVisible();
      await readableWholeWords(label);
      const railLabels = await rail.getByRole('button').locator('span').evaluateAll(elements => elements.map(element => {
        const box = element.getBoundingClientRect(); return { left: box.left, right: box.right };
      }));
      for (let index = 1; index < railLabels.length; index++) expect(railLabels[index].left - railLabels[index - 1].right).toBeGreaterThanOrEqual(8);
      await expect.poll(() => title.evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await expect(page.getByTestId('tef-calculator')).toHaveCount(0);
      await expect(page.getByText('Monto MxR', { exact: true })).toHaveCount(0);
      for (const section of await page.getByTestId('registration-section-title').all()) {
        const icon = (await section.locator('svg').boundingBox())!, heading = (await section.getByRole('heading').boundingBox())!;
        expect(icon.width).toBeGreaterThanOrEqual(20);
        expect(heading.x - icon.x - icon.width).toBeGreaterThanOrEqual(8);
      }
      if ((actor === 'Generador' && step === 5) || (actor === 'Operador' && step === 6)) {
        await expect(page.getByRole('heading', { name: 'Datos de la actividad', exact: true })).toBeVisible();
        await page.getByLabel('Personal en planta', { exact: true }).fill('32');
        await page.getByLabel('Potencia instalada (HP)', { exact: true }).fill('120');
        await page.getByLabel('Superficie cubierta (m²)', { exact: true }).fill('1250');
        for (const name of ['Personal en planta', 'Potencia instalada (HP)', 'Superficie cubierta (m²)']) {
          const input = page.getByLabel(name, { exact: true });
          await expect(input).toBeVisible();
          expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
      }
      if ((actor === 'Generador' && step === 6) || (actor === 'Operador' && step === 7) || (actor === 'Transportista' && step === 4)) {
        const receipt = page.getByTestId('registration-document-COMPROBANTE_PAGO');
        await expect(receipt).toBeVisible();
        await expect(receipt.getByLabel('obligatorio')).toHaveCount(0);
        const processed = page.waitForResponse(response => response.url().endsWith('/api/solicitudes/analizar-documento') && response.request().method() === 'POST');
        const [chooser] = await Promise.all([page.waitForEvent('filechooser'), receipt.getByRole('button', { name: 'Adjuntar', exact: true }).click()]);
        await chooser.setFiles({ name: 'preview-only-QA.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 QA preview, never uploaded') });
        await expect(receipt).toContainText('Seleccionado para revisión');
        await expect(receipt).not.toContainText('Guardado');
        const response = await processed; expect(response.status()).toBe(200); expect((await response.json()).data.persistido).toBe(false);
        await expect(receipt).not.toContainText('Leyendo…');
        await expect(page.getByText('En prueba los archivos no se conservan al salir.', { exact: true })).toBeVisible();
        const filesHelp = page.locator('summary').filter({ hasText: 'PDF, JPG o PNG' });
        expect((await filesHelp.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await filesHelp.click();
        await expect(page.getByText(/La prueba no consulta recibos de otros usuarios/)).toBeVisible();
        await filesHelp.click();
        await expect(page.getByText(/La prueba no consulta recibos de otros usuarios/)).not.toBeVisible();
      }
      if (step === total) {
        const fullValues = await page.locator('dl dd').evaluateAll(elements => elements.map(element => ({
          text: element.textContent, clipped: element.scrollWidth > element.clientWidth + 1,
          ellipsis: getComputedStyle(element).textOverflow === 'ellipsis',
        })));
        expect(fullValues.some(value => value.text?.includes('Av. de Acceso 1234'))).toBe(true);
        expect(fullValues.filter(value => value.clipped || value.ellipsis)).toEqual([]);
      }
      if (step === total && actor !== 'Transportista') {
        await expect(page.getByRole('heading', { name: 'Actividad', exact: true })).toBeVisible();
        await expect(page.getByText('32', { exact: true })).toBeVisible();
        await expect(page.getByText('120', { exact: true })).toBeVisible();
      }
      await page.screenshot({ path: info.outputPath(`public-${actor.toLowerCase()}-step-${step}.png`), animations: 'disabled' });
      if (step < total) {
        await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
        await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      }
    }
    await page.getByRole('button', { name: 'Finalizar revisión', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Revisión finalizada', exact: true })).toBeVisible();
    await expect(page.getByText(/Tu borrador de prueba quedó en este navegador. No se creó ninguna cuenta ni trámite/)).toBeVisible();
  }
  expect(writes).toEqual([]);
  expect(readings).toHaveLength(3);
  expect(errors).toEqual([]);
  await info.attach('public-wizard-safety', { body: JSON.stringify({ actors: 3, steps: 20, writes, errors, businessAPIIntercepted: false, productionDataWritten: false }), contentType: 'application/json' });
});
