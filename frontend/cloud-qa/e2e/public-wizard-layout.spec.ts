import { expect, test } from '@playwright/test';
import { prefix, readableFixedAction, readableWholeWords } from './helpers';

test('public actor wizards keep titles aligned, current steps visible and navigation at the heading without submitting records', async ({ page }, info) => {
  test.setTimeout(120000);
  const writes: string[] = [], errors: string[] = [];
  page.on('request', request => {
    if (/\/api\/solicitudes(?:\/|\?|$)/.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
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
    for (let step = 1; step <= total; step++) {
      const active = rail.locator('[aria-current="step"]');
      await expect(active).toHaveAttribute('aria-label', new RegExp(`^Paso ${step} de ${total}: `));
      await readableFixedAction(active, rail);
      const label = active.locator('span');
      await expect(label).toBeVisible();
      await readableWholeWords(label);
      await expect.poll(() => title.evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath(`public-${actor.toLowerCase()}-step-${step}.png`), animations: 'disabled' });
      if (step < total) {
        await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
        await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      }
    }
    await page.getByRole('button', { name: 'Finalizar revisión', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Revisión finalizada', exact: true })).toBeVisible();
    await expect(page.getByText('Recorriste el formulario de prueba. No se creó ninguna cuenta, no se subieron archivos y no se envió ningún correo.', { exact: true })).toBeVisible();
  }
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  await info.attach('public-wizard-safety', { body: JSON.stringify({ actors: 3, steps: 20, writes, errors, businessAPIIntercepted: false, productionDataWritten: false }), contentType: 'application/json' });
});
