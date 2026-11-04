import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isolatedMapTiles, login, prefix, readableWholeWords } from './helpers';
import { assertCloudDatabase } from '../safety';

const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'psip-lifecycle-fixture.json'), 'utf8'));
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

test.beforeAll(async () => { await assertCloudDatabase(); });

for (const type of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) {
  test(`PSIP ${type}: notice, reply, correction and decision`, async ({ page, browser }, info) => {
    page.setDefaultTimeout(20_000);
    const id = fixture.cases[info.project.name][type], base = prefix(info), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await login(page, info, 'admin');
    await page.goto(`${base}/inspecciones/${id}#intercambios`);
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
      await page.getByRole('button', { name: 'Continuar en el expediente', exact: true }).click();
    }
    async function openNotice(target: Page, title: string, sequence: number) {
      await target.goto(`${base}/notificaciones`);
      const item = target.getByRole('list', { name: 'Avisos', exact: true }).getByRole('listitem')
        .filter({ hasText: caseNumber }).filter({ hasText: `Actuación #${sequence}.` });
      const action = item.getByRole('button', { name: `Abrir aviso: PSIP · ${title}`, exact: true });
      await expect(action).toBeVisible();
      await action.click();
    }
    await request('QA observaciones iniciales PSIP');
    const deadlineBeforeClosure = await page.getByTestId('inspection-deadline-value').innerText();
    const context = await browser.newContext({ viewport: page.viewportSize(), isMobile: info.project.name !== 'web-desktop',
      hasTouch: info.project.name !== 'web-desktop', deviceScaleFactor: 1, baseURL: 'http://127.0.0.1:4177', serviceWorkers: 'block' });
    try {
      const actor = await context.newPage(); actor.setDefaultTimeout(20_000); actor.on('pageerror', error => errors.push(error.message));
      await login(actor, info, fixture.actors[type].login);
      const otherType = type === 'GENERADOR' ? 'OPERADOR' : 'GENERADOR';
      const otherId = fixture.cases[info.project.name][otherType];
      const denied = await actor.evaluate(async (other: string) => (await fetch(`/api/inspecciones/${other}/intercambios`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('sitrep_access_token')}` } })).status, otherId);
      expect(denied).toBe(403);
      await openNotice(actor, 'Nuevo requerimiento', 1);
      await expect(actor).toHaveURL(new RegExp(`/requerimientos/${id}(?:[?#].*)?$`));
      await expect(actor.getByRole('link', { name: 'Mis inspecciones', exact: true })).toHaveCount(0);
      await expect(actor.getByTestId('inspection-next-step')).toContainText('Tenés requerimientos por responder');
      expect(await actor.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await readableWholeWords(actor.getByRole('button', { name: /^Responder requerimiento #/ }));
      await actor.screenshot({ path: info.outputPath('requerimiento-desde-aviso.png'), animations: 'disabled' });
      for (const [index, tipo] of ['DESCARGO', 'SUBSANACION'].entries()) {
        if (index) {
          await openNotice(actor, 'Nuevo requerimiento', 3);
          await expect(actor).toHaveURL(new RegExp(`/requerimientos/${id}(?:[?#].*)?$`));
        }
        await actor.getByRole('button', { name: /^Responder requerimiento #/ }).click();
        await actor.getByRole('combobox', { name: 'Tipo de actuación', exact: true }).selectOption(tipo);
        await actor.getByLabel('Contenido', { exact: true }).fill('QA presentación artificial: constancia de la corrección para revisión de la autoridad.');
        if (index) await actor.getByLabel(/Adjuntos probatorios/).setInputFiles({ name: 'constancia-qa-psip.pdf', mimeType: 'application/pdf', buffer: pdf });
        const saved = actor.waitForResponse(r => r.url().endsWith(`/inspecciones/${id}/intercambios`) && r.request().method() === 'POST');
        await actor.getByRole('button', { name: 'Presentar en expediente', exact: true }).click();
        expect((await saved).status()).toBe(201);
        await expect(actor.getByTestId('inspection-next-step')).toContainText('Tu presentación está registrada');
        await actor.getByRole('button', { name: 'Continuar en el expediente', exact: true }).click();
        const inbox = await page.context().newPage(); inbox.on('pageerror', error => errors.push(error.message));
        try {
          await isolatedMapTiles(inbox, info);
          await openNotice(inbox, index ? 'Subsanación presentada' : 'Descargo presentado', index ? 4 : 2);
          await expect(inbox).toHaveURL(new RegExp(`/inspecciones/${id}(?:[?#].*)?$`));
          await expect(inbox.getByTestId('inspection-next-step')).toContainText('Revisar las presentaciones recibidas');
        } finally { await inbox.close(); }
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
      await page.screenshot({ path: info.outputPath('cierre-autoridad.png'), animations: 'disabled' });
      await openNotice(actor, 'Cierre conforme', 5);
      await expect(actor).toHaveURL(new RegExp(`/requerimientos/${id}(?:[?#].*)?$`));
      await expect(actor.getByTestId('inspection-next-step')).toContainText('Seguimiento cerrado conforme');
      await expect(actor.getByTestId('inspection-deadline-value')).toHaveText(deadlineBeforeClosure);
      await expect(actor.getByTestId('inspection-exchange-row')).toHaveCount(5);
      await expect(actor.getByRole('button', { name: /^Responder/ })).toHaveCount(0);
      expect(errors).toEqual([]);
      writeFileSync(info.outputPath('psip-lifecycle-proof.json'), JSON.stringify({ surface: info.project.name, type, id, caseNumber,
        otherActorDenied: 403, sequences: 5, openedFromNotices: true, attachment: 'constancia-qa-psip.pdf', production: false }, null, 2));
    } finally { await context.close().catch(() => undefined); }
  });
}
