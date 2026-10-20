import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isolatedMapTiles, login, prefix, readableWholeWords, readableFixedAction } from './helpers';
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'intake-fixture.json'), 'utf8'));
if (existsSync(path.join(process.env.QA_ARTIFACTS!, 'intake-browser-fixture.json'))) fixture.cases = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'intake-browser-fixture.json'), 'utf8')).cases;
async function api(page: Page, endpoint: string, method = 'GET', body?: unknown) {
  const token = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
  const response = await page.request.fetch('/api' + endpoint, { method, headers: { Authorization: 'Bearer ' + token }, ...(body ? { data: body } : {}) });
  return { status: response.status(), body: await response.json() };
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); }

test('operator finding remains in its adenda and reaches an assigned PSIP inspection', async ({ page, browser }, info) => {
  page.setDefaultTimeout(20000); const base = prefix(info), manifest = fixture.cases[info.project.name].finding, errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'operator'); await page.goto(`${base}/manifiestos/${manifest.id}/adendas`);
  await page.getByRole('button', { name: 'Informar hallazgo', exact: true }).click();
  await expect(page.getByLabel('Cantidad observada 1')).toHaveValue('10');
  await page.getByLabel('Cantidad observada 1').fill('12');
  await page.getByRole('button', { name: 'Agregar corriente', exact: true }).click();
  await expect(page.getByLabel('Corriente observada 2')).toHaveAttribute('inputmode', 'text');
  await page.getByLabel('Corriente observada 2').fill('Y21'); await page.getByLabel('Cantidad observada 2').fill('3');
  await page.getByLabel('Motivo de la adenda').fill('QA hallazgo: cantidad mayor y una Y omitida, sin datos reales.');
  const posting = page.waitForResponse(r => r.url().endsWith(`/api/manifiestos/${manifest.id}/adendas`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Guardar y solicitar revisión', exact: true }).click();
  const saved = await posting; expect(saved.status()).toBe(201); const addendum = (await saved.json()).data.adenda;
  const report = page.getByRole('region', { name: 'Informe de hallazgo', exact: true });
  await expect(report).toContainText('Y1 · Cantidad diferente'); await expect(report).toContainText('Y21 · Y omitida en el manifiesto');
  await expect(report).toContainText('No constan en esa ficha: Y21');
  await report.scrollIntoViewIfNeeded(); await noOverflow(page);
  await page.screenshot({ path: info.outputPath('operator-finding.png'), animations: 'disabled' });
  expect((await api(page, '/inspecciones/antecedentes')).status).toBe(403);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: page.viewportSize(), serviceWorkers: 'block', timezoneId: 'America/Argentina/Mendoza' });
  try {
    const authority = await context.newPage(); authority.on('pageerror', error => errors.push(error.message));
    await login(authority, info); await authority.goto(`${base}/inspecciones?vista=antecedentes`);
    const queue = authority.getByRole('region', { name: 'Cola de revisión PSIP', exact: true });
    await queue.getByLabel('Actor del antecedente').selectOption('GENERADOR'); await queue.getByLabel('Buscar antecedente').fill(manifest.numero);
    const source = queue.getByRole('button', { name: new RegExp(manifest.numero) }); await source.click();
    await expect(queue.getByRole('region', { name: 'Informe de hallazgo' })).toContainText('Y21');
    await readableWholeWords(queue.getByRole('heading', { name: /Por evaluar en PSIP/ }));
    const opening = queue.getByRole('button', { name: 'Abrir inspección', exact: true }); await opening.scrollIntoViewIfNeeded();
    await readableFixedAction(opening, queue); await noOverflow(authority);
    await authority.screenshot({ path: info.outputPath('psip-intake.png'), animations: 'disabled' });
    await opening.click(); const dialog = authority.getByRole('dialog', { name: 'Nueva inspección', exact: true });
    await expect(dialog).toContainText(manifest.numero); await dialog.getByLabel('Inspector asignado').selectOption(fixture.initialUsers.inspector);
    const openingResponse = authority.waitForResponse(r => r.url().endsWith('/api/inspecciones') && r.request().method() === 'POST');
    const confirm = dialog.getByRole('button', { name: 'Crear expediente', exact: true }); await confirm.scrollIntoViewIfNeeded(); await readableFixedAction(confirm, dialog); await confirm.click();
    const opened = await openingResponse; expect(opened.status()).toBe(201); const inspection = (await opened.json()).data;
    expect(inspection.eventos.some((event: any) => event.tipo === 'ANTECEDENTE_VINCULADO' && !event.visibleActor)).toBe(true);
    await authority.goto(`${base}/inspecciones?vista=antecedentes`); await queue.getByLabel('Estado del antecedente').selectOption('VINCULADA');
    await queue.getByLabel('Buscar antecedente').fill(manifest.numero); await queue.getByRole('button', { name: new RegExp(manifest.numero) }).click();
    await expect(queue.getByRole('link', { name: `Seguir expediente ${inspection.numero}` })).toBeVisible();
    await queue.getByRole('link', { name: `Seguir expediente ${inspection.numero}` }).click(); await expect(authority).toHaveURL(new RegExp(inspection.id));
    writeFileSync(info.outputPath('flow.json'), JSON.stringify({ adendaId: addendum.id, inspeccionId: inspection.id, manifestId: manifest.id, project: info.project.name, synthetic: true, production: false }));
  } finally { await context.close(); }
  const counterpartContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: page.viewportSize(), serviceWorkers: 'block' });
  try {
    const counterpart = await counterpartContext.newPage(); await login(counterpart, info, 'generator');
    await counterpart.goto(`${base}/manifiestos/${manifest.id}/adendas`);
    await expect(counterpart.getByRole('region', { name: 'Informe de hallazgo' })).toContainText('Y1 · Cantidad diferente');
    await counterpart.getByLabel('Motivo de resolución').fill('QA contraparte observa y conserva el hallazgo.');
    const revision = counterpart.waitForResponse(r => r.url().endsWith(`/${addendum.id}/revisiones`) && r.request().method() === 'POST');
    await counterpart.getByRole('button', { name: 'Observar', exact: true }).click(); expect((await revision).status()).toBe(200);
    await expect(counterpart.getByRole('status', { name: 'Estado de revisión' })).toHaveText('Observada');
  } finally { await counterpartContext.close(); }
  expect(errors).toEqual([]);
});

test('external handoff and incomplete eventual keep separate declared identities in the queue', async ({ page, browser }, info) => {
  page.setDefaultTimeout(20000);
  const base = prefix(info), manifest = fixture.cases[info.project.name].handoff;
  await login(page, info, 'carrier'); await page.goto(`${base}/manifiestos/${manifest.id}`);
  await page.getByRole('button', { name: 'Registrar traspaso', exact: true }).click();
  const form = page.getByRole('form', { name: 'Registrar traspaso de carga', exact: true });
  await form.getByRole('combobox', { name: 'Reemplazo', exact: true }).selectOption('EXTERNO');
  await form.getByLabel('Empresa', { exact: true }).fill('QA relevo sin alta ' + info.project.name);
  await form.getByLabel('Motivo del traspaso', { exact: true }).fill('Rotura artificial; sólo se declara la empresa que se conoce.');
  const posting = page.waitForResponse(r => r.url().endsWith(`/api/manifiestos/${manifest.id}/tramos`) && r.request().method() === 'POST');
  await form.getByRole('button', { name: 'Confirmar traspaso', exact: true }).click(); expect((await posting).status()).toBe(201);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: page.viewportSize(), serviceWorkers: 'block' });
  try {
    const authority = await context.newPage(); await login(authority, info);
    const eventualId = randomUUID();
    const created = await api(authority, '/manifiestos/baja-intensidad', 'POST', { id: eventualId, motivo: 'QA eventual sin identidades completas', residuos: [{ corriente: 'Y1', cantidad: 1, unidad: 'kg' }] });
    expect(created.status).toBe(201);
    await authority.goto(`${base}/inspecciones?vista=antecedentes`);
    const queue = authority.getByRole('region', { name: 'Cola de revisión PSIP', exact: true });
    await queue.getByLabel('Buscar antecedente').fill(manifest.numero); await queue.getByRole('button', { name: new RegExp(manifest.numero) }).click();
    await expect(queue.getByText('Relevo sin alta', { exact: true })).toBeVisible(); await expect(queue.getByText('Identidad incompleta', { exact: true })).toBeVisible();
    await expect(queue.getByText('Sin alta vinculada · identidad pendiente de verificar', { exact: true })).toBeVisible();
    await queue.getByLabel('Motivo de evaluación').fill('QA: verificar identidad y la declaración del relevo.');
    const evaluating = authority.waitForResponse(r => r.url().includes('/decisiones') && r.request().method() === 'POST');
    await queue.getByRole('button', { name: 'Tomar en evaluación', exact: true }).click(); expect((await evaluating).status()).toBe(200);
    await queue.getByLabel('Estado del antecedente').selectOption('EN_EVALUACION'); await queue.getByRole('button', { name: new RegExp(manifest.numero) }).click();
    await queue.getByText('Historial de evaluación', { exact: true }).click();
    await expect(queue.getByText('QA: verificar identidad y la declaración del relevo.')).toBeVisible();
    await queue.getByLabel('Estado del antecedente').selectOption('PENDIENTE'); await queue.getByLabel('Buscar antecedente').fill('BI-' + eventualId);
    await expect(queue.getByRole('button', { name: new RegExp(eventualId) })).toHaveCount(3);
    await queue.getByRole('button', { name: new RegExp(eventualId) }).first().click(); await noOverflow(authority);
    await authority.screenshot({ path: info.outputPath('eventual-intake.png'), animations: 'disabled' });
  } finally { await context.close(); }
});

test('finding manual opens in the same web/app context without business requests', async ({ page }, info) => {
  await isolatedMapTiles(page, info); const business: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) business.push(request.url()); });
  await page.goto('/manual/tutorial.html?guide=hallazgos-manifiestos-psip&surface=' + (info.project.name === 'app' ? 'app' : 'web'));
  await expect(page.getByRole('heading', { name: 'Informe de hallazgo: de la adenda a PSIP', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operador: informar lo encontrado en destino', exact: true })).toBeVisible();
  await expect(page.locator('a[href="/inspecciones?vista=antecedentes"]')).toHaveCount(1);
  await expect(page.locator('a[href="/app/inspecciones?vista=antecedentes"]')).toHaveCount(1);
  for (const [alt, width] of [['App del operador con cantidades y corriente Y omitida en el informe dentro de la adenda', 945], ['Cola PSIP de administración con origen y evidencia del informe de hallazgo', 1440]] as const) {
    const picture = page.getByRole('img', { name: alt, exact: true }); await picture.scrollIntoViewIfNeeded();
    await expect(picture).toHaveJSProperty('naturalWidth', width); await noOverflow(page);
  }
  await page.screenshot({ path: info.outputPath('finding-manual.png'), animations: 'disabled' });
  await noOverflow(page); expect(business).toEqual([]);
});
