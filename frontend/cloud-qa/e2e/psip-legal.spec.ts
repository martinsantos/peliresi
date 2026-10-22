import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { login, prefix, readableWholeWords } from './helpers';
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'psip-legal-fixture.json'), 'utf8'));
async function api(page: Page, endpoint: string, method = 'GET', body?: unknown) {
  const token = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
  const response = await page.request.fetch('/api' + endpoint, { method, headers: { Authorization: 'Bearer ' + token }, ...(body ? { data: body } : {}) });
  return { status: response.status(), body: await response.json() };
}
for (const type of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) test(`PSIP legal ${type}: recorded derivation, administrative progress and public final result`, async ({ page, browser }, info) => {
  page.setDefaultTimeout(15_000);
  const base = prefix(info), group = fixture.cases[info.project.name], record = group[type];
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: page.viewportSize(), serviceWorkers: 'allow' });
  const actor = await context.newPage(), errors: string[] = [], consoles: Array<{ level: string; text: string }> = [];
  for (const target of [page, actor]) {
    target.on('pageerror', error => errors.push(error.message));
    target.on('console', message => { if (['warning', 'error'].includes(message.type())) consoles.push({ level: message.type(), text: message.text() }); });
  }
  try {
    await login(page, info); await login(actor, info, fixture.actors[type].login);
    await page.goto(`${base}/inspecciones/${record.id}#intercambios`);
    await page.getByRole('button', { name: 'Derivar a Legales', exact: true }).click();
    await page.getByLabel('Fundamento de la decisión', { exact: true }).fill('Derivación artificial QA para evaluar los antecedentes, sin afirmar sanción ni recepción externa.');
    await page.getByLabel(/Referencia de expediente legal/).fill('EX-QA-' + record.number);
    const deriving = page.waitForResponse(r => r.url().endsWith(`/inspecciones/${record.id}/intercambios/decision`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirmar derivación', exact: true }).click();
    expect((await deriving).status()).toBe(200);
    await expect(page.getByTestId('inspection-legal-progress')).toBeVisible();
    await expect(page.getByTestId('inspection-responsible')).toHaveText('Debe actuar: Administración competente');
    await expect(page.getByTestId('inspection-overdue')).toHaveCount(0);
    await page.goto(`${base}/inspecciones?search=${encodeURIComponent(record.number)}`);
    await expect(page.getByTestId('inspection-follow-up').filter({ hasText: 'registrar avance de Legales' })).toBeVisible();
    await page.goto(`${base}/inspecciones/${record.id}#intercambios`);
    await actor.goto(`${base}/mis-inspecciones/${record.id}`);
    await expect(actor.getByTestId('inspection-responsible')).toHaveText('Debe actuar: Administración competente');
    await expect(actor.getByRole('button', { name: 'Registrar trámite legal', exact: true })).toHaveCount(0);
    await expect(actor.getByText(/no confirma recepción externa/)).toBeVisible();
    const before = await api(actor, `/inspecciones/${record.id}/intercambios`);
    expect(before.status).toBe(200); expect(before.body.data.resultadoAdministrativo).toBeNull();
    const denied = await api(actor, `/inspecciones/${record.id}/estado`, 'POST', { estado: 'EN_TRAMITE_LEGAL', version: before.body.data.inspeccion.version, detalle: 'Intento artificial no autorizado.' });
    expect(denied.status).toBe(403);
    if (type === 'GENERADOR') {
      const inspectorContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: page.viewportSize(), serviceWorkers: 'allow' });
      try {
        const inspector = await inspectorContext.newPage(); await login(inspector, info, 'inspector');
        await inspector.goto(`${base}/inspecciones/${record.id}#intercambios`);
        await expect(inspector.getByTestId('inspection-legal-progress')).toBeVisible();
        await expect(inspector.getByRole('button', { name: 'Registrar trámite legal', exact: true })).toHaveCount(0);
        const refused = await api(inspector, `/inspecciones/${record.id}/estado`, 'POST', { estado: 'EN_TRAMITE_LEGAL', version: before.body.data.inspeccion.version, detalle: 'Intento artificial de inspector.' });
        expect(refused.status).toBe(409);
      } finally { await inspectorContext.close(); }
    }
    await page.getByRole('button', { name: 'Registrar trámite legal', exact: true }).click();
    const internal = 'INTERNAL-QA-LEGAL-' + record.number;
    await page.getByTestId('inspection-legal-progress').getByRole('textbox').fill(internal + ' · referencia y constancia administrativa para seguimiento.');
    const advancing = page.waitForResponse(r => r.url().endsWith(`/inspecciones/${record.id}/estado`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirmar registro', exact: true }).click();
    expect((await advancing).status()).toBe(200);
    await expect(page.getByRole('button', { name: 'Registrar finalización', exact: true })).toBeVisible();
    await readableWholeWords(page.getByRole('heading', { name: 'Seguimiento administrativo', exact: true }));
    await page.getByTestId('inspection-legal-progress').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('authority-legal-progress.png'), animations: 'disabled' });
    if (type === 'GENERADOR') {
      await actor.bringToFront();
      await expect(actor.getByTestId('inspection-next-step')).toContainText('Expediente en trámite legal', { timeout: 45_000 });
    } else await actor.goto(`${base}/mis-inspecciones/${record.id}`);
    await expect(actor.getByTestId('inspection-next-step')).toContainText('Expediente en trámite legal');
    const progressing = await api(actor, `/inspecciones/${record.id}/intercambios`);
    expect(progressing.body.data.inspeccion.estado).toBe('EN_TRAMITE_LEGAL');
    expect(JSON.stringify(progressing.body)).not.toContain(internal);
    expect(progressing.body.data.resultadoAdministrativo).toBeNull();
    await page.bringToFront();
    await page.getByRole('button', { name: 'Registrar finalización', exact: true }).click();
    const publicResult = 'QA: finalización administrativa documentada. Resultado para consulta del inspeccionado, sin afirmar sanción ni firmeza. ' + record.number;
    await page.getByTestId('inspection-legal-progress').getByRole('textbox').fill(publicResult);
    const finishing = page.waitForResponse(r => r.url().endsWith(`/inspecciones/${record.id}/estado`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirmar registro', exact: true }).click();
    expect((await finishing).status()).toBe(200);
    await expect(page.getByTestId('inspection-public-result')).toContainText(publicResult);
    if (type === 'GENERADOR') {
      await actor.bringToFront(); await expect(actor.getByTestId('inspection-public-result')).toContainText(publicResult, { timeout: 45_000 });
    } else await actor.goto(`${base}/mis-inspecciones/${record.id}`);
    await expect(actor.getByTestId('inspection-public-result')).toContainText(publicResult);
    await expect(actor.getByTestId('inspection-overdue')).toHaveCount(0);
    await actor.getByTestId('inspection-public-result').scrollIntoViewIfNeeded();
    await actor.screenshot({ path: info.outputPath('actor-public-final-result.png'), animations: 'disabled' });
    const final = await api(actor, `/inspecciones/${record.id}/intercambios`);
    expect(final.body.data.intercambios.find((entry: any) => entry.id === record.requestId).hashCadena).toBe(record.requestHash);
    expect(final.body.data.resultadoAdministrativo.detalle).toBe(publicResult);
    expect(JSON.stringify(final.body)).not.toContain(internal);
    if (type === 'GENERADOR') {
      await page.goto(`${base}/inspecciones/${group.legacyAtm.id}#intercambios`);
      await expect(page.getByTestId('inspection-legal-progress')).toContainText('Su alcance debe confirmarse');
      await expect(page.getByRole('button', { name: /Derivar a ATM|Registrar trámite legal|Registrar finalización/ })).toHaveCount(0);
      await page.getByTestId('inspection-legal-progress').scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('atm-legacy-scope.png'), animations: 'disabled' });
      await actor.goto(`${base}/mis-inspecciones/${group.privateFinal.id}`);
      await expect(actor.getByTestId('inspection-next-step')).toBeVisible();
      await expect(actor.getByTestId('inspection-public-result')).toHaveCount(0);
      expect(await actor.locator('body').innerText()).not.toContain('PRIVATE-QA-LEGAL-NOTE');
    }
    for (const target of [page, actor]) {
      expect(await target.title()).toMatch(/SITREP/);
      expect(await target.locator('body').innerText()).not.toMatch(/Vite Error|Internal Server Error|Unhandled Runtime Error/);
      expect(await target.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
    const expectedSw = (text: string) => text === 'Service Worker registration blocked by Playwright'
      || /^\[SW(?:-App)?\] Registration failed: TypeError: Cannot read properties of undefined \(reading 'scope'\)\n {4}at http:\/\/127\.0\.0\.1:4177\//.test(text);
    expect(errors).toEqual([]); expect(consoles.filter(entry => !expectedSw(entry.text))).toEqual([]);
    writeFileSync(info.outputPath('legal-journey-proof.json'), JSON.stringify({ number: record.number, project: info.project.name, actor: type,
      state: final.body.data.inspeccion.estado, publicResult: final.body.data.resultadoAdministrativo, originalRequestPreserved: true,
      internalNoteExcluded: true, unauthorizedActor: denied.status, consoles, errors }, null, 2));
  } finally { await context.close(); }
});
