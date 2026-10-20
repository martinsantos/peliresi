import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isolatedMapTiles, login, prefix, readableWholeWords } from './helpers';

const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'psip-fixture.json'), 'utf8'));

test('PSIP groups the entire list before pagination and retains filter links and closed cases', async ({ page }, info) => {
  page.setDefaultTimeout(15_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'admin');
  await page.goto(`${prefix(info)}/inspecciones?search=${fixture.prefix}`);
  const nav = page.getByRole('navigation', { name: 'Etapas PSIP' });
  await nav.getByRole('button', { name: /^Seguimiento/ }).click();
  await expect(page).toHaveURL(/etapa=SEGUIMIENTO/);
  await expect(page.getByLabel('Filtrar por estado')).toHaveValue('');
  await expect(page.getByRole('option', { name: 'Cerrada conforme', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-testid^="inspection-row-"]')).toHaveCount(25);
  await page.getByRole('button', { name: /siguiente/i }).last().click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('[data-testid^="inspection-row-"]').first()).toBeVisible();
  expect(await page.locator('[data-testid^="inspection-row-"]').count()).toBeGreaterThan(0);
  await page.reload();
  await expect(nav.getByRole('button', { name: /^Seguimiento/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/page=2/);
  const closedResponse = page.waitForResponse(r => { const u = new URL(r.url()); return u.pathname.endsWith('/api/inspecciones') && u.searchParams.get('estados') === 'CERRADA_CONFORME,FINALIZADA,CANCELADA' && r.request().method() === 'GET'; });
  await nav.getByRole('button', { name: /^Cerradas/ }).click();
  const closedPayload = (await (await closedResponse).json()).data;
  expect(closedPayload.total).toBeGreaterThanOrEqual(1);
  expect(closedPayload.items.every((row: { estado: string }) => ['CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA'].includes(row.estado))).toBe(true);
  await expect(page.getByTestId(`inspection-row-${fixture.closed}`)).toBeVisible();
  await expect(page.locator('[data-testid^="inspection-row-"]')).toHaveCount(closedPayload.items.length);
  for (const id of fixture.paging) await expect(page.getByTestId(`inspection-row-${id}`)).toHaveCount(0);
  await nav.getByRole('button', { name: /^Seguimiento/ }).click();
  await expect(page.getByTestId(`inspection-row-${fixture.closed}`)).toHaveCount(0);
  await page.getByLabel('Filtrar por estado').selectOption('REQUIERE_SUBSANACION');
  await expect(page).toHaveURL(/estado=REQUIERE_SUBSANACION/);
  await expect(page.locator('[data-testid^="inspection-row-"]').first()).toContainText('Requiere subsanación');
  for (const label of ['Todas', 'Preparación y visita', 'Seguimiento', 'Derivaciones', 'Cerradas', 'Agenda']) await readableWholeWords(nav.getByRole('button', { name: new RegExp('^' + label) }));
  const exportAction = nav.getByRole('button', { name: 'Exportar', exact: true });
  await expect(exportAction).toBeVisible();
  await expect(exportAction).toHaveAttribute('title', 'Exportar listado');
  expect((await exportAction.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  const original = page.viewportSize()!;
  for (const size of [{ width: 320, height: 720 }, original]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('psip-etapas.png'), animations: 'disabled' });
  const notification = await page.evaluate(async (id: string) => {
    const result = await fetch(`/api/inspecciones/${id}/estado`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sitrep_access_token')}` }, body: JSON.stringify({ version: 1, estado: 'NOTIFICADA', plazoRespuestaAt: '2030-01-01T12:00:00Z' }) });
    return { status: result.status, body: await result.json() };
  }, fixture.spontaneous);
  expect(notification.status).toBe(400);
  expect(JSON.stringify(notification.body)).toContain('destinatario');
  expect(errors).toEqual([]);
});

for (const type of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) {
  test(`PSIP ${type}: requirement, linked reply, further correction and reasoned closure`, async ({ page, browser }, info) => {
    test.setTimeout(240_000);
    page.setDefaultTimeout(15_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const id = fixture.cases[info.project.name][type];
    await login(page, info, 'admin');
    await page.goto(`${prefix(info)}/inspecciones/${id}#intercambios`);
    await expect(page.getByTestId('inspection-next-step')).toContainText('Falta publicar el requerimiento');
    const caseNumber = await page.getByTestId('inspection-case-identity').getByRole('heading').innerText();
    async function request(subject: string, followUp = false) {
      if (followUp) {
        await page.getByTestId('inspection-exchange-row').filter({ hasText: 'QA presentación artificial' }).last().getByRole('button', { name: 'Responder esta actuación', exact: true }).click();
        await page.getByRole('combobox', { name: 'Tipo de actuación', exact: true }).selectOption('REQUERIMIENTO');
      } else await page.getByRole('button', { name: 'Nuevo requerimiento', exact: true }).click();
      await page.getByLabel('Asunto', { exact: true }).fill(subject);
      await page.getByLabel('Contenido', { exact: true }).fill('QA: se observó un faltante artificial. Adjuntá la constancia sintética solicitada.');
      await page.getByLabel('Plazo de respuesta', { exact: true }).fill('2030-01-02T12:00');
      const saved = page.waitForResponse(r => r.url().endsWith(`/inspecciones/${id}/intercambios`) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Presentar en expediente', exact: true }).click();
      expect((await saved).status()).toBe(201);
      await expect(page.getByTestId('inspection-next-step')).toContainText('A la espera del inspeccionado');
    }
    await request('QA observaciones iniciales PSIP');
    const deadlineBeforeClosure = await page.getByTestId('inspection-deadline-value').innerText();
    const context = await browser.newContext({ viewport: page.viewportSize(), isMobile: info.project.name !== 'web-desktop', hasTouch: info.project.name !== 'web-desktop', deviceScaleFactor: 1, baseURL: 'http://127.0.0.1:4177', serviceWorkers: 'block' });
    try {
      const actor = await context.newPage(); actor.setDefaultTimeout(15_000); actor.on('pageerror', error => errors.push(error.message));
      await login(actor, info, fixture.actors[type].login);
      const otherType = type === 'GENERADOR' ? 'OPERADOR' : 'GENERADOR';
      const otherId = fixture.cases[info.project.name][otherType];
      const denied = await actor.evaluate(async (other: string) => (await fetch(`/api/inspecciones/${other}/intercambios`, { headers: { Authorization: `Bearer ${localStorage.getItem('sitrep_access_token')}` } })).status, otherId);
      expect(denied).toBe(403);
      await actor.goto(`${prefix(info)}/mis-inspecciones/${id}`);
      await expect(actor.getByTestId('inspection-next-step')).toContainText('Tenés requerimientos por responder');
      expect(await actor.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await readableWholeWords(actor.getByRole('button', { name: /^Responder requerimiento #/ }));
      await actor.screenshot({ path: info.outputPath('psip-responder.png'), animations: 'disabled' });
      for (const [index, tipo] of ['DESCARGO', 'SUBSANACION'].entries()) {
        if (index) await actor.reload();
        await actor.getByRole('button', { name: /^Responder requerimiento #/ }).click();
        await actor.getByRole('combobox', { name: 'Tipo de actuación', exact: true }).selectOption(tipo);
        await actor.getByLabel('Contenido', { exact: true }).fill('QA presentación artificial: constancia de la corrección para revisión de la autoridad.');
        const saved = actor.waitForResponse(r => r.url().endsWith(`/inspecciones/${id}/intercambios`) && r.request().method() === 'POST');
        await actor.getByRole('button', { name: 'Presentar en expediente', exact: true }).click();
        expect((await saved).status()).toBe(201);
        await expect(actor.getByTestId('inspection-next-step')).toContainText('Tu presentación está registrada');
        await page.reload();
        await expect(page.getByTestId('inspection-next-step')).toContainText('Revisar las presentaciones recibidas');
        if (!index) {
          await request('QA falta acreditar la subsanación PSIP', true);
          await expect(page.getByText('Requiere subsanación', { exact: true }).first()).toBeVisible();
        }
      }
      await page.getByRole('button', { name: 'Cerrar conforme', exact: true }).click();
      await page.getByLabel('Fundamento de la decisión', { exact: true }).fill('QA se revisó la respuesta y su subsanación artificial, se documenta el cierre del ensayo.');
      const closed = page.waitForResponse(r => r.url().endsWith(`/inspecciones/${id}/intercambios/decision`) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Confirmar cierre conforme', exact: true }).click();
      expect((await closed).status()).toBe(200);
      await expect(page.getByTestId('inspection-next-step')).toContainText('Seguimiento cerrado conforme');
      await expect(page.getByText('Último plazo · histórico', { exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath('psip-cierre.png'), animations: 'disabled' });
      const closedTimeline = actor.waitForResponse(r => r.url().endsWith(`/inspecciones/${id}/intercambios`) && r.request().method() === 'GET');
      await actor.reload();
      expect((await (await closedTimeline).json()).data.inspeccion.plazoRespuestaAt).toBeNull();
      await expect(actor.getByTestId('inspection-deadline-value')).toHaveText(deadlineBeforeClosure);
      await expect(actor.getByTestId('inspection-exchange-row')).toHaveCount(5);
      await expect(actor.getByRole('button', { name: /^Responder/ })).toHaveCount(0);
      await actor.goto(`${prefix(info)}/mis-inspecciones`);
      const ownCase = actor.getByRole('button').filter({ has: actor.getByText(caseNumber, { exact: true }) });
      await expect(ownCase).toContainText('Cerrada conforme');
      await expect(ownCase.getByText(/^(Hasta |Venció )/)).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally { await context.close().catch(() => undefined); }
  });
}

test('PSIP manual: discover the guide, read both sides and open original captures without API requests', async ({ page }, info) => {
  await isolatedMapTiles(page, info);
  const errors: string[] = [], api: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => { if (new URL(req.url()).pathname.startsWith('/api/')) api.push(req.method()); });
  await page.goto('/manual/');
  await page.getByRole('link', { name: 'PSIP: flujo de inspecciones', exact: true }).click();
  await expect(page.locator('#tutorialTitle')).toHaveText('PSIP: del control al seguimiento de la inspección');
  await expect(page.locator('.guide-step')).toHaveCount(7);
  await expect(page.locator('#safetyNote')).toContainText('no envía correo ni push');
  for (const image of await page.locator('img.guide-image').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(image.locator('xpath=ancestor::figure/figcaption')).toContainText('Datos sintéticos');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('psip-manual.png'), animations: 'disabled' });
  await page.reload();
  await expect(page.locator('#tutorialTitle')).toHaveText('PSIP: del control al seguimiento de la inspección');
  expect(api).toEqual([]); expect(errors).toEqual([]);
});
