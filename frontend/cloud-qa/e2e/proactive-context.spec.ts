import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix, readableMapLayers } from './helpers';

function health(page: Page) {
  const errors: string[] = [];
  const messages: Array<{ level: string; message: string }> = [];
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) messages.push({ level: message.type(), message: message.text() });
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  return { errors, messages };
}

async function proof(page: Page, info: TestInfo, filename: string) {
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath(filename), animations: 'disabled' });
}

test('proactive context offers explicit locations and one actionable reference per map', async ({ page }, info) => {
  const { errors, messages } = health(page);
  await login(page, info);
  await page.goto(`${prefix(info)}/inspecciones`);
  const catalog = page.waitForResponse(response => response.url().endsWith('/api/catalogos/generadores') && response.status() === 200);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  const declared = (await (await catalog).json()).data.generadores.find((actor: { razonSocial: string }) => actor.razonSocial === 'QA Generador 1');
  expect(declared.domicilioRealCalle).toBe('QA Planta 200');
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección', exact: true });
  await dialog.getByRole('combobox', { name: 'Actor inspeccionado', exact: true }).selectOption({ label: 'QA Generador 1' });
  await expect(dialog.getByLabel('Ubicación prevista', { exact: true })).toHaveValue('');
  await expect(dialog.getByRole('button', { name: `Usar domicilio declarado: ${declared.domicilio}`, exact: true })).toBeVisible();
  await dialog.getByLabel('Ubicación prevista', { exact: true }).fill('QA portón constatado');
  await dialog.getByRole('combobox', { name: 'Actor inspeccionado', exact: true }).selectOption({ label: 'QA Generador 2' });
  await expect(dialog.getByLabel('Ubicación prevista', { exact: true })).toHaveValue('QA portón constatado');
  await expect(dialog.getByRole('button', { name: /QA Planta 200/ })).toHaveCount(0);
  const tooLong = dialog.getByRole('button', { name: `Usar domicilio legal: ${'A'.repeat(301)}`, exact: true });
  await expect(tooLong).toBeDisabled();
  await expect(tooLong).toHaveAccessibleDescription(/300 caracteres/);
  await dialog.getByLabel('Ubicación prevista', { exact: true }).fill('A'.repeat(301));
  await expect(dialog.getByLabel('Ubicación prevista', { exact: true })).toHaveValue('A'.repeat(300));
  await dialog.getByLabel('Responsable todavía sin identificar', { exact: true }).check();
  await expect(dialog.getByRole('group', { name: 'Direcciones declaradas' })).toHaveCount(0);
  await dialog.getByLabel('Responsable todavía sin identificar', { exact: true }).uncheck();
  await dialog.getByRole('combobox', { name: 'Actor inspeccionado', exact: true }).selectOption({ label: 'QA Generador 1' });
  await dialog.getByRole('button', { name: 'Usar domicilio real: QA Planta 200, Las Heras', exact: true }).click();
  await expect(dialog.getByLabel('Ubicación prevista', { exact: true })).toHaveValue('QA Planta 200, Las Heras');
  await dialog.getByLabel('Ubicación prevista', { exact: true }).scrollIntoViewIfNeeded();
  await dialog.getByRole('group', { name: 'Direcciones declaradas' }).scrollIntoViewIfNeeded();
  await proof(page, info, '01-inspection-location.png');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.goto(`${prefix(info)}/centro-control`);
  await expect(page.getByRole('heading', { name: 'Mapa de Actividad', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Generadores', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('group', { name: 'Capas del mapa' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Generadores', exact: true })).toHaveCount(1);
  await readableMapLayers(page.getByRole('group', { name: 'Capas del mapa' }));
  await proof(page, info, '02-control-layers.png');
  await page.getByRole('heading', { name: 'Mapa de Actividad', exact: true }).scrollIntoViewIfNeeded();
  await proof(page, info, '03-control-map.png');

  await page.goto(`${prefix(info)}/reportes`);
  await page.getByRole('navigation', { name: 'Tipos de reporte' }).getByRole('button', { name: 'Mapa de Actores', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  const layers = page.getByRole('group', { name: 'Capas del mapa', exact: true });
  await expect(layers).toHaveCount(1);
  await layers.scrollIntoViewIfNeeded();
  await readableMapLayers(layers);
  await expect(page.getByText('Generadores', { exact: true })).toHaveCount(1);
  for (const [label, glyph, symbol] of [['Generadores', 'factory', 'generador'], ['Transportistas', 'truck', 'transportista'], ['Op. Fijos', 'flask-conical', 'operador'], ['Op. In Situ', 'flask-conical', 'operador'], ['Inspecciones', 'clipboard-check', 'inspeccion']]) {
    const button = layers.getByRole('button', { name: label, exact: true });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button.locator(`svg.lucide-${glyph}`)).toHaveCount(1);
    await expect(button.locator(`[data-map-symbol="${symbol}"]`)).toHaveCount(1);
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const generators = layers.getByRole('button', { name: 'Generadores', exact: true });
  const markers = page.locator('.leaflet-marker-icon').filter({ has: page.locator('svg path[d^="M2 20"]') });
  const count = await markers.count();
  expect(count).toBeGreaterThan(0);
  await generators.focus();
  await generators.press('Space');
  await expect(generators).toHaveAttribute('aria-pressed', 'false');
  await expect(markers).toHaveCount(0);
  await generators.press('Space');
  await expect(markers).toHaveCount(count);
  const includeInactive = page.getByRole('switch', { name: 'Incluir actores sin actividad en el período' });
  expect((await includeInactive.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await proof(page, info, '04-report-map-layers.png');
  expect(errors).toEqual([]);
  await info.attach('audit-context', { body: JSON.stringify({ url: page.url(), viewport: page.viewportSize(), errors, messages, phase: 'after', businessAPIIntercepted: false }), contentType: 'application/json' });
});

test('inspector preserves an explicitly chosen location through creation, save and reload for every actor category', async ({ page }, info) => {
  test.setTimeout(90000);
  const { errors, messages } = health(page);
  await login(page, info, 'inspector');
  for (const [type, actor, button, value] of [
    ['GENERADOR', 'QA Generador 1', 'Usar domicilio real: QA Planta 200, Las Heras', 'QA Planta 200, Las Heras'],
    ['TRANSPORTISTA', 'QA Transporte 1', 'Usar domicilio declarado: QA SIN DOMICILIO REAL', 'QA SIN DOMICILIO REAL'],
    ['OPERADOR', 'QA Operador 1', 'Usar domicilio real: QA Tratamiento 500, Godoy Cruz', 'QA Tratamiento 500, Godoy Cruz'],
  ]) {
    await page.goto(`${prefix(info)}/inspecciones`);
    await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nueva inspección', exact: true });
    await dialog.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption(type);
    await dialog.getByRole('combobox', { name: 'Actor inspeccionado', exact: true }).selectOption({ label: actor });
    await expect(dialog.getByLabel('Ubicación prevista', { exact: true })).toHaveValue('');
    await dialog.getByRole('button', { name: button, exact: true }).click();
    await dialog.getByLabel('Número de acta', { exact: true }).fill('DEMO-PROACTIVE-LOCATION');
    const created = page.waitForResponse(response => response.url().endsWith('/api/inspecciones') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Crear expediente', exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const inspection = (await response.json()).data;
    expect(inspection.ubicacion).toBe(value);
    await page.getByRole('navigation', { name: 'Secciones del expediente' }).getByRole('link', { name: 'Visita', exact: true }).click();
    const location = page.getByLabel('Ubicación', { exact: true });
    await expect(location).toHaveValue(value);
    if (type === 'OPERADOR') {
      await page.getByRole('button', { name: 'Usar sede declarada: QA Sede norte · FIJO · QA Acceso 600', exact: true }).click();
      await expect(location).toHaveValue('QA Sede norte · FIJO · QA Acceso 600');
    }
    await location.fill(`QA acceso confirmado ${type}`);
    const saved = page.waitForResponse(response => response.url().endsWith(`/api/inspecciones/${inspection.id}/borrador`) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    const acknowledged = await saved;
    expect(acknowledged.status()).toBe(200);
    expect((await acknowledged.json()).data.ubicacion).toBe(`QA acceso confirmado ${type}`);
    await page.reload();
    await expect(location).toHaveValue(`QA acceso confirmado ${type}`);
    await location.scrollIntoViewIfNeeded();
    await proof(page, info, `05-${type.toLowerCase()}-saved-location.png`);
  }
  expect(errors).toEqual([]);
  await info.attach('inspector-location-health', { body: JSON.stringify({ errors, messages, viewport: page.viewportSize(), businessAPIIntercepted: false }), contentType: 'application/json' });
});

test('finding location assistance preserves actual GPS and the registered narrative', async ({ page }, info) => {
  const { errors, messages } = health(page);
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Denuncia / hallazgo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Denuncia o hallazgo', exact: true });
  await dialog.getByLabel('Descripción del hallazgo', { exact: true }).fill('QA hallazgo de prueba con GPS y domicilio elegido');
  await dialog.getByLabel('Ubicación o referencia', { exact: true }).fill('QA desagüe observado');
  await dialog.getByRole('button', { name: 'Agregar GPS (opcional)', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Actualizar GPS', exact: true })).toBeVisible();
  await dialog.getByText('Identificar al actor · puede hacerse después', { exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Tipo de actor', exact: true }).selectOption('GENERADOR');
  await dialog.getByRole('combobox', { name: 'Actor', exact: true }).selectOption({ label: 'QA Generador 1' });
  await expect(dialog.getByLabel('Ubicación o referencia', { exact: true })).toHaveValue('QA desagüe observado');
  await dialog.getByRole('button', { name: 'Usar domicilio declarado: QA Registro 100', exact: true }).click();
  await dialog.getByRole('group', { name: 'Direcciones declaradas' }).scrollIntoViewIfNeeded();
  await proof(page, info, '06-finding-location.png');
  const registered = page.waitForResponse(response => response.url().endsWith('/api/inspecciones') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Registrar denuncia', exact: true }).click();
  const response = await registered;
  expect(response.status()).toBe(201);
  const inspection = (await response.json()).data;
  expect(inspection.ubicacion).toBe('QA Registro 100');
  expect(inspection.latitud).toBe(-32.89);
  expect(inspection.longitud).toBe(-68.84);
  expect(inspection.observaciones).toBe('Hallazgo espontáneo: QA hallazgo de prueba con GPS y domicilio elegido');
  expect(errors).toEqual([]);
  await info.attach('finding-location-health', { body: JSON.stringify({ errors, messages, businessAPIIntercepted: false }), contentType: 'application/json' });
});
