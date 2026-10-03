import { devices, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { login, prefix } from './helpers';

test('separate real users hand a manifest from generator to transport to operator', async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const contexts: BrowserContext[] = [];
  const asRole = async (role: string) => {
    const context = await browser.newContext({ ...(info.project.name === 'web-desktop' ? devices['Desktop Chrome'] : devices['Pixel 7']), baseURL: 'http://127.0.0.1:4177', geolocation: { latitude: -32.89, longitude: -68.84 }, permissions: ['geolocation'] });
    contexts.push(context);
    const next = await context.newPage();
    await login(next, info, role);
    return next;
  };
  const mutate = async (actor: Page, id: string, button: string, endpoint: string) => {
    const response = actor.waitForResponse(res => res.url().endsWith(`/api/manifiestos/${id}/${endpoint}`) && res.request().method() === 'POST');
    await actor.getByRole('button', { name: button, exact: true }).click();
    expect((await response).status()).toBe(200);
  };
  try {
    await login(page, info);
    await page.goto(`${prefix(info)}/manifiestos/nuevo`);
    const choose = async (label: string, value: RegExp) => {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.getByRole('option', { name: value }).click();
    };
    await choose('Generador *', /^QA Generador 1 /);
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await choose('Tipo de Residuo *', /^Y1 - /);
    await page.getByLabel('Cantidad *', { exact: true }).fill('35');
    await page.getByRole('button', { name: 'Agregar Residuo', exact: true }).click();
    await page.getByRole('button', { name: 'Tipo de Residuo *', exact: true }).last().click();
    await page.getByRole('option', { name: /^Y2 - / }).click();
    await page.getByLabel('Cantidad *', { exact: true }).last().fill('12.5');
    await page.getByRole('button', { name: 'Unidad', exact: true }).last().click();
    await page.getByRole('option', { name: 'lt', exact: true }).click();
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await choose('Transportista *', /^QA Transporte 1 /);
    await choose('Operador / Destino *', /^QA Operador 1 /);
    const created = page.waitForResponse(res => res.url().endsWith('/api/manifiestos') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const { id } = (await response.json()).data.manifiesto;
    await page.close();

    const generator = await asRole('generador');
    await generator.goto(`${prefix(info)}/manifiestos/${id}`);
    await generator.getByRole('button', { name: 'Firmar Manifiesto', exact: true }).click();
    const canvas = generator.getByRole('dialog', { name: 'Firma del manifiesto' }).locator('canvas');
    await canvas.scrollIntoViewIfNeeded();
    const bounds = (await canvas.boundingBox())!;
    await generator.mouse.move(bounds.x + bounds.width * .1, bounds.y + bounds.height * .7);
    await generator.mouse.down();
    await generator.mouse.move(bounds.x + bounds.width * .4, bounds.y + bounds.height * .2, { steps: 12 });
    await generator.mouse.move(bounds.x + bounds.width * .8, bounds.y + bounds.height * .6, { steps: 12 });
    await generator.mouse.up();
    await generator.getByRole('button', { name: 'Usar firma', exact: true }).click();
    await mutate(generator, id, 'Confirmar y Firmar', 'firmar');
    await generator.context().close();

    const carrier = await asRole('transportista');
    await carrier.goto(`${prefix(info)}/manifiestos/${id}`);
    await expect(carrier).toHaveURL(new RegExp(`/transporte/viaje/${id}$`));
    await expect(carrier.locator('body')).toContainText('35 kg · 12,5 lt');
    await mutate(carrier, id, 'Confirmar retiro', 'confirmar-retiro');
    await carrier.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
    await mutate(carrier, id, 'Sí, Confirmar Entrega', 'confirmar-entrega');
    await carrier.screenshot({ path: info.outputPath('carrier-delivered.png'), animations: 'disabled' });
    await carrier.context().close();

    const operator = await asRole('operador');
    await operator.goto(`${prefix(info)}/manifiestos/${id}`);
    await mutate(operator, id, 'Confirmar Recepcion', 'confirmar-recepcion');
    await operator.getByRole('button', { name: 'Registrar Pesaje', exact: true }).click();
    await operator.getByPlaceholder('Peso real').first().fill('34.5');
    await operator.getByPlaceholder('Peso real').last().fill('12');
    await mutate(operator, id, 'Confirmar Pesaje', 'pesaje');
    await operator.getByRole('button', { name: 'Registrar Tratamiento', exact: true }).click();
    await mutate(operator, id, 'Confirmar Tratamiento', 'tratamiento');
    await mutate(operator, id, 'Cerrar Manifiesto', 'cerrar');
    await operator.reload();
    await expect(operator.getByRole('button', { name: 'Descargar Certificado', exact: true })).toBeVisible();
    await expect(operator.getByRole('button', { name: 'Firmar Manifiesto', exact: true })).toHaveCount(0);
    await operator.screenshot({ path: info.outputPath('operator-completed.png'), animations: 'disabled' });
  } finally {
    for (const context of contexts) await context.close();
  }
});
