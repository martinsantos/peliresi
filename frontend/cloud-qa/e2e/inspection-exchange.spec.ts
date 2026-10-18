import { devices, expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from './helpers';

// All preconditions, logins and mutations are driven through the real UI/API.
// Synthetic fixtures live only in sitrep_night_qa_20260926; no API interception.
async function recordScreenshot(page: Page, info: TestInfo, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled' });
}

for (const outcome of ['CERRADA_CONFORME', 'DERIVADA_LEGALES'] as const) {
  test(`real inspector, sector head and actor complete ${outcome} through the UI`, async ({ page, browser }, info) => {
    test.setTimeout(180_000);
    page.setDefaultTimeout(15_000);
    const contexts: BrowserContext[] = [];
    const errors: string[] = [];
    const observe = (target: Page) => {
      target.on('pageerror', error => errors.push(error.message));
      target.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    };
    observe(page);
    const asUser = async (user: string) => {
      const context = await browser.newContext({
        ...(info.project.name === 'web-desktop' ? devices['Desktop Chrome'] : devices['Pixel 7']),
        baseURL: 'http://127.0.0.1:4177',
      });
      contexts.push(context);
      const target = await context.newPage();
      target.setDefaultTimeout(15_000);
      observe(target);
      await login(target, info, user);
      return target;
    };
    try {
      await login(page, info, 'inspector');
      await page.goto(`${prefix(info)}/inspecciones`);
      await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
      await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('GENERADOR');
      await page.getByRole('combobox', { name: 'Actor inspeccionado', exact: true }).selectOption({ label: 'QA Generador 2' });
      const creation = page.waitForResponse(r => r.url().endsWith('/api/inspecciones') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
      const created = await creation;
      expect(created.status()).toBe(201);
      const record = (await created.json()).data as {
        id: string; numero: string; items: Array<{ id: string }>;
        comparaciones: Array<{ id: string; categoria: string }>;
      };
      const nav = page.getByRole('navigation', { name: 'Secciones del expediente' });
      await nav.getByRole('link', { name: 'Visita', exact: true }).click();
      await page.getByLabel('Número de acta', { exact: true }).fill(`QA-${record.numero}`);
      const start = page.waitForResponse(r => r.url().endsWith(`/inspecciones/${record.id}/estado`) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Iniciar visita', exact: true }).click();
      expect((await start).status()).toBe(200);
      await nav.getByRole('link', { name: 'Controles', exact: true }).click();
      for (const item of record.items) {
        const control = page.locator(`#control-${item.id}`);
        const trigger = control.locator('button[aria-expanded]').first();
        if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
        await control.getByRole('button', { name: 'Cumple', exact: true }).click();
      }
      await page.getByRole('link', { name: 'Datos declarados', exact: true }).click();
      for (const group of new Set(record.comparaciones.map(row => row.categoria))) {
        const groupToggle = page.getByRole('button', { name: new RegExp(`^${group} 0/`) });
        if (await groupToggle.getAttribute('aria-expanded') !== 'true') await groupToggle.click();
        const rows = record.comparaciones.filter(row => row.categoria === group);
        for (const [index, row] of rows.entries()) {
          if (index > 0 && index % 6 === 0) await page.getByRole('button', { name: 'Siguiente bloque', exact: true }).click();
          await page.locator(`#comparison-${row.id}`).getByRole('button', { name: 'Coincide', exact: true }).click();
        }
      }
      await nav.getByRole('link', { name: 'Registro', exact: true }).click();
      await page.locator('#inspection-observations').fill('QA constatación sintética completa para probar el intercambio formal.');
      await page.getByText('Detalle de generación y almacenamiento', { exact: true }).click();
      await page.getByLabel('Motivo de la visita', { exact: true }).fill('QA control sintético');
      await page.getByText('Personas y lugar', { exact: true }).click();
      await page.getByLabel('Área interviniente', { exact: true }).fill('QA sin organismo real');
      await page.getByLabel('Lugar afectado', { exact: true }).fill('QA depósito ficticio');
      await page.getByText('Constancias de la visita', { exact: true }).click();
      for (const [label, value] of [
        ['Daños a personas o bienes', 'NO_OBSERVADOS'], ['Terceros y testigos', 'NO_IDENTIFICADOS'],
        ['Firma de la persona interviniente', 'FIRMADA'], ['Entrega de copia', 'ENTREGADA'],
      ]) await page.getByRole('combobox', { name: label, exact: true }).selectOption(value);
      await page.getByLabel('Constancia de entrega', { exact: true }).fill('QA entrega simulada, sin destinatario real');
      await page.getByText('Documentación y comunicación', { exact: true }).click();
      await page.getByRole('combobox', { name: 'Libro de Registro de Operaciones', exact: true }).selectOption('EXHIBIDO');
      await page.getByLabel('Constancia del libro', { exact: true }).fill('QA libro sintético verificado');
      await page.getByLabel('Domicilio legal constituido', { exact: true }).fill('QA domicilio ficticio');
      await page.getByRole('combobox', { name: 'Comunicación de lo actuado', exact: true }).selectOption('COMUNICADA_EN_ACTA');
      await page.getByLabel('Constancia de comunicación y derechos', { exact: true }).fill('QA constancia sintética, ninguna comunicación externa');
      await nav.getByRole('link', { name: 'Expediente', exact: true }).click();
      await page.getByRole('link', { name: 'Evaluación técnica', exact: true }).click();
      for (const label of ['Expediente electrónico', 'Objetivo', 'Antecedentes', 'Evaluación', 'Conclusión', 'Recomendación']) {
        await page.getByRole('textbox', { name: label, exact: true }).fill(`QA ${label} sintético ${record.numero}`);
      }
      await page.getByRole('link', { name: 'Resumen y cierre', exact: true }).click();
      const review = page.waitForResponse(r => r.url().endsWith(`/inspecciones/${record.id}/estado`) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click();
      const reviewed = await review;
      expect(reviewed.status()).toBe(200);
      expect((await reviewed.json()).data.estado).toBe('EN_REVISION');
      await expect(page.getByRole('button', { name: 'Aprobar expediente', exact: true })).toHaveCount(0);
      await page.close();

      const head = await asUser('jefe-generadores');
      await head.goto(`${prefix(info)}/inspecciones/${record.id}`);
      const headNav = head.getByRole('navigation', { name: 'Secciones del expediente' });
      await headNav.getByRole('link', { name: 'Expediente', exact: true }).click();
      await expect(head.getByRole('button', { name: 'Aprobar expediente', exact: true })).toBeDisabled();
      await head.getByLabel('Plazo de respuesta', { exact: true }).fill('2030-01-01T12:00');
      await expect(head.getByTestId('inspection-dossier-readiness')).toContainText('21/21 completos');
      await recordScreenshot(head, info, 'head-ready-to-approve');
      const approval = head.waitForResponse(r => r.url().endsWith(`/inspecciones/${record.id}/estado`) && r.request().method() === 'POST');
      await head.getByRole('button', { name: 'Aprobar expediente', exact: true }).click();
      const approved = await approval;
      expect(approved.status()).toBe(200);
      expect((await approved.json()).data.estado).toBe('NOTIFICADA');
      // Approval changes the dossier to its read-only presentation, initially Visita.
      await headNav.getByRole('link', { name: 'Expediente', exact: true }).click();
      await head.getByRole('link', { name: 'Comunicaciones', exact: true }).click();
      await head.getByRole('button', { name: 'Nuevo requerimiento', exact: true }).click();
      await head.getByRole('textbox', { name: 'Asunto', exact: true }).fill(`QA documentación ${record.numero}`);
      await head.getByRole('textbox', { name: 'Contenido', exact: true }).fill('QA presentar constancia sintética; no corresponde a un expediente real.');
      const requirementResponse = head.waitForResponse(r => r.url().endsWith(`/inspecciones/${record.id}/intercambios`) && r.request().method() === 'POST');
      await head.getByRole('button', { name: 'Presentar en expediente', exact: true }).click();
      const requirement = await requirementResponse;
      expect(requirement.status()).toBe(201);
      const requirementId = (await requirement.json()).data.id;
      await expect(head.getByTestId('inspection-exchange-row')).toHaveCount(1);
      await head.context().close();

      const actor = await asUser('generador2');
      await actor.goto(`${prefix(info)}/mis-inspecciones`);
      await actor.getByRole('button', { name: new RegExp(`^${record.numero} `) }).click();
      await expect(actor.getByRole('heading', { name: 'Presentaciones y respuestas', exact: true })).toBeVisible();
      await actor.getByRole('button', { name: 'Responder esta actuación', exact: true }).click();
      await expect(actor.getByRole('combobox', { name: 'Tipo de actuación', exact: true })).toHaveValue('DESCARGO');
      const answer = `QA descargo de ${record.numero}: documentación sintética presentada por el actor correcto.`;
      await actor.getByRole('textbox', { name: 'Contenido', exact: true }).fill(answer);
      await actor.context().setOffline(true);
      await expect(actor.getByRole('button', { name: 'Presentar en expediente', exact: true })).toBeDisabled();
      await actor.getByRole('textbox', { name: 'Contenido', exact: true }).fill(answer + ' Recuperado después de la desconexión.');
      await expect.poll(() => actor.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('sitrep_exchange_draft_') && localStorage.getItem(key)?.includes('Recuperado después')))).toBe(true);
      await actor.context().setOffline(false);
      await actor.reload();
      await expect(actor.getByRole('textbox', { name: 'Contenido', exact: true })).toHaveValue(answer + ' Recuperado después de la desconexión.');
      await expect(actor.getByTestId('inspection-exchange-row')).toHaveCount(1);
      await actor.getByRole('button', { name: 'Presentar en expediente', exact: true }).scrollIntoViewIfNeeded();
      await recordScreenshot(actor, info, 'actor-recovered-unsent-draft');
      const answerResponse = actor.waitForResponse(r => r.url().endsWith(`/inspecciones/${record.id}/intercambios`) && r.request().method() === 'POST');
      await actor.getByRole('button', { name: 'Presentar en expediente', exact: true }).click();
      const submitted = await answerResponse;
      expect(submitted.status()).toBe(201);
      expect((await submitted.json()).data).toMatchObject({ respondeAId: requirementId, tipo: 'DESCARGO' });
      await expect(actor.getByTestId('inspection-exchange-row')).toHaveCount(2);
      await expect(actor.getByText('En descargo', { exact: true })).toBeVisible();
      await expect(actor.getByRole('button', { name: 'Cerrar conforme', exact: true })).toHaveCount(0);
      await actor.context().close();

      const reviewer = await asUser('jefe-generadores');
      await reviewer.goto(`${prefix(info)}/inspecciones/${record.id}#intercambios`);
      await expect(reviewer.getByTestId('inspection-exchange-row')).toHaveCount(2);
      await reviewer.getByRole('button', { name: outcome === 'CERRADA_CONFORME' ? 'Cerrar conforme' : 'Derivar a Legales', exact: true }).click();
      const confirmation = reviewer.getByRole('button', { name: outcome === 'CERRADA_CONFORME' ? 'Confirmar cierre conforme' : 'Confirmar derivación', exact: true });
      await expect(confirmation).toBeDisabled();
      await reviewer.getByRole('textbox', { name: 'Fundamento de la decisión', exact: true }).fill(`QA decisión sintética ${outcome}: se revisó la constancia aportada y se registra esta prueba local.`);
      const decisionResponse = reviewer.waitForResponse(r => r.url().endsWith(`/inspecciones/${record.id}/intercambios/decision`) && r.request().method() === 'POST');
      await confirmation.click();
      expect((await decisionResponse).status()).toBe(200);
      await reviewer.reload();
      await expect(reviewer.getByTestId('inspection-exchange-row')).toHaveCount(3);
      await expect(reviewer.getByText(outcome === 'CERRADA_CONFORME' ? 'Cerrada conforme' : 'Derivada a legales', { exact: true }).first()).toBeVisible();
      await expect(reviewer.getByRole('button', { name: 'Nuevo requerimiento', exact: true })).toHaveCount(0);
      await reviewer.getByTestId('inspection-exchange-row').last().scrollIntoViewIfNeeded();
      await recordScreenshot(reviewer, info, `head-${outcome}`);
      await reviewer.context().close();

      const recipient = await asUser('generador2');
      await recipient.goto(`${prefix(info)}/mis-inspecciones/${record.id}`);
      await expect(recipient.getByTestId('inspection-exchange-row')).toHaveCount(3);
      await expect(recipient.getByRole('button', { name: 'Responder esta actuación', exact: true })).toHaveCount(0);
      await recipient.getByTestId('inspection-exchange-row').last().scrollIntoViewIfNeeded();
      await recordScreenshot(recipient, info, `actor-${outcome}`);
      expect(errors).toEqual([]);
    } finally {
      for (const context of contexts) await context.close();
    }
  });
}
