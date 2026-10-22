import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { login, prefix, readableWholeWords } from './helpers';

const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'psip-deadlines-fixture.json'), 'utf8'));
async function findReminder(page: Page, base: string, title: string, message: string) {
  await page.goto(`${base}/notificaciones`);
  const inbox = page.getByRole('list', { name: 'Avisos', exact: true });
  await expect(inbox).toBeVisible();
  const reminder = inbox.getByRole('button', { name: `Abrir aviso: ${title}`, exact: true }).filter({ hasText: message });
  // Other independent journeys can add newer notices. Use the real pagination;
  // never delete those notices or assume this reminder is on the first page.
  const next = page.getByRole('button', { name: 'Siguiente página', exact: true });
  let current = 1;
  while (await reminder.count() === 0 && await next.isEnabled()) {
    current++;
    const loaded = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === '/api/notificaciones' && url.searchParams.get('offset') === String((current - 1) * 20);
    });
    await next.click(); expect((await loaded).status()).toBe(200);
    await expect(page.getByRole('navigation', { name: 'Paginación de avisos' })).toContainText(`Página ${current} de`);
  }
  await expect(reminder).toBeVisible();
  return reminder;
}
async function api(page: Page, endpoint: string) {
  return page.evaluate(async endpoint => {
    const response = await fetch('/api' + endpoint, { headers: { Authorization: 'Bearer ' + localStorage.getItem('sitrep_access_token') } });
    return { status: response.status, body: await response.json() };
  }, endpoint);
}

for (const type of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) {
  test(`PSIP deadlines ${type}: exact request, late response and next responsible party`, async ({ page, browser }, info) => {
    page.setDefaultTimeout(15_000);
    const base = prefix(info), cases = fixture.cases[info.project.name][type];
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: page.viewportSize(),
      isMobile: info.project.name !== 'web-desktop', hasTouch: info.project.name !== 'web-desktop', timezoneId: 'UTC', serviceWorkers: 'allow' });
    const actor = await context.newPage(); actor.setDefaultTimeout(15_000);
    const errors: string[] = [], consoles: Array<{ surface: string; level: string; text: string }> = [], replies: unknown[] = [];
    for (const [surface, target] of [['authority', page], ['actor', actor]] as const) {
      target.on('pageerror', error => errors.push(error.message));
      target.on('console', message => { if (['error', 'warning'].includes(message.type())) consoles.push({ surface, level: message.type(), text: message.text() }); });
    }
    const participantRow = async (record: any) => {
      await actor.goto(`${base}/mis-inspecciones`);
      return actor.getByRole('button').filter({ has: actor.getByText(record.number, { exact: true }) });
    };
    const open = (target: Page, record: any, authority = false) => target.goto(`${base}/${authority ? 'inspecciones' : 'mis-inspecciones'}/${record.id}${authority ? '#intercambios' : ''}`);
    const reply = async (record: any, sequence: number, expectedLate: boolean) => {
      await open(actor, record);
      await actor.getByRole('button', { name: `Responder pedido #${sequence}`, exact: true }).click();
      const request = record.requirements.find((entry: any) => entry.secuencia === sequence);
      await expect(actor.getByTestId('inspection-reply-deadline')).toContainText(request.deadline ? (expectedLate ? 'Vencido' : 'En plazo') : 'Sin plazo registrado');
      await actor.getByLabel('Contenido', { exact: true }).fill('QA artificial: documentación presentada sobre este pedido concreto para evaluación de la autoridad.');
      const saved = actor.waitForResponse(r => r.url().endsWith(`/inspecciones/${record.id}/intercambios`) && r.request().method() === 'POST');
      await actor.getByRole('button', { name: 'Presentar en expediente', exact: true }).click();
      const response = await saved; expect(response.status()).toBe(201);
      const entry = (await response.json()).data;
      expect(entry.respondeAId).toBe(request.id); expect(entry.presentadoFueraDePlazo).toBe(expectedLate);
      replies.push({ id: entry.id, parent: request.id, late: entry.presentadoFueraDePlazo });
      await expect(actor.getByRole('button', { name: 'Presentar en expediente', exact: true })).toHaveCount(0);
    };
    try {
      await login(page, info, 'admin'); await login(actor, info, fixture.actors[type].login);
      await expect(actor).toHaveTitle(/SITREP|Trazabilidad|Residuos/i);
      const row = await participantRow(cases.mixed);
      await expect(row.getByTestId('inspection-follow-up')).toContainText('Inspeccionado: 3 por responder · 1 vencido');
      await readableWholeWords(row.getByTestId('inspection-follow-up').locator('p').first());
      await page.goto(`${base}/inspecciones?search=${encodeURIComponent(cases.mixed.number)}`);
      const staffRow = page.getByTestId(`inspection-row-${cases.mixed.id}`);
      await expect(staffRow.getByTestId('inspection-follow-up')).toContainText('Inspeccionado: 3 por responder · 1 vencido');
      await staffRow.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('authority-pending-list.png'), animations: 'disabled' });
      await open(actor, cases.mixed);
      await expect(actor.getByTestId('inspection-responsible')).toHaveText('Debe actuar: Inspeccionado');
      await expect(actor.getByTestId('inspection-pending-request')).toHaveCount(3);
      await expect(actor.getByTestId('inspection-pending-request').first()).toContainText('#1');
      for (const pending of await actor.getByTestId('inspection-pending-request').all()) {
        const title = pending.locator('p').first();
        await readableWholeWords(title);
        expect((await title.boundingBox())!.width).toBeGreaterThanOrEqual(Math.min(220, actor.viewportSize()!.width - 100));
      }
      await expect(actor.getByTestId('inspection-overdue')).toContainText('1 requerimiento vencido sin respuesta');
      await expect(actor.getByRole('button', { name: 'Responder requerimiento #1', exact: true })).toBeVisible();
      expect(await actor.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await actor.getByTestId('inspection-next-step').scrollIntoViewIfNeeded();
      await actor.screenshot({ path: info.outputPath('actor-pending-requests.png'), animations: 'disabled' });

      const received = await api(actor, '/notificaciones?limit=500');
      expect(received.status).toBe(200);
      const reminders = received.body.data.notificaciones.filter((notice: any) => {
        const data = JSON.parse(notice.datos || '{}');
        return data.reglaId === fixture.ruleId && data.entidadId === cases.mixed.requirements[0].id;
      });
      expect(reminders).toHaveLength(1);
      const reminder = await findReminder(actor, base, reminders[0].titulo, `${cases.mixed.number} · ${cases.mixed.requirements[0].asunto}.`);
      await reminder.click();
      await expect(actor).toHaveURL(new RegExp(`/mis-inspecciones/${cases.mixed.id}$`));
      await expect(actor.getByTestId('inspection-pending-request')).toHaveCount(3);
      await expect(actor.getByTestId('inspection-overdue')).toContainText('1 requerimiento vencido sin respuesta');

      await reply(cases.mixed, 1, true);
      const afterFirst = await participantRow(cases.mixed);
      await expect(afterFirst.getByTestId('inspection-follow-up')).toContainText('Inspeccionado: 2 por responder');
      await expect(afterFirst.getByTestId('inspection-follow-up')).not.toContainText('vencido');
      await reply(cases.mixed, 3, false);
      await reply(cases.mixed, 2, false);
      await expect(actor.getByTestId('inspection-responsible')).toHaveText('Debe actuar: Autoridad');
      await expect(actor.getByTestId('inspection-overdue')).toHaveCount(0);
      await expect(actor.getByTestId('inspection-pending-request')).toHaveCount(0);
      const reviewRow = await participantRow(cases.mixed);
      await expect(reviewRow.getByTestId('inspection-follow-up')).toContainText('Autoridad: revisar presentación');
      await (await findReminder(actor, base, reminders[0].titulo, `${cases.mixed.number} · ${cases.mixed.requirements[0].asunto}.`)).click();
      await expect(actor.getByTestId('inspection-responsible')).toHaveText('Debe actuar: Autoridad');
      await expect(actor.getByTestId('inspection-overdue')).toHaveCount(0);
      await open(page, cases.mixed, true);
      await expect(page.getByTestId('inspection-responsible')).toHaveText('Debe actuar: Autoridad');
      await page.getByTestId('inspection-next-step').scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('authority-review-response.png'), animations: 'disabled' });
      if (type === 'GENERADOR') {
        const staffContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: page.viewportSize(), timezoneId: 'UTC', serviceWorkers: 'allow' });
        try {
          const inspector = await staffContext.newPage(); await login(inspector, info, 'inspector');
          await open(inspector, cases.mixed, true);
          await expect(inspector.getByTestId('inspection-responsible')).toHaveText('Debe actuar: Autoridad');
          await expect(inspector.getByRole('button', { name: 'Cerrar conforme', exact: true })).toHaveCount(0);
        } finally { await staffContext.close(); }
      }
      const waitingReview = await api(actor, `/inspecciones/${cases.mixed.id}/intercambios`);
      expect(waitingReview.body.data.inspeccion.estado).toBe('EN_DESCARGO');
      expect(waitingReview.body.data.inspeccion.seguimiento.paso).toBe('REVISAR');

      await reply(cases.inverse, 1, false);
      await expect(actor.getByTestId('inspection-pending-request')).toHaveCount(1);
      await expect(actor.getByTestId('inspection-pending-request')).toContainText('#2');
      await expect(actor.getByTestId('inspection-overdue')).toContainText('1 requerimiento vencido sin respuesta');

      const emptyRow = await participantRow(cases.empty);
      await expect(emptyRow.getByTestId('inspection-follow-up')).toContainText('Autoridad: publicar requerimiento');
      await open(actor, cases.empty);
      await expect(actor.getByTestId('inspection-responsible')).toHaveText('Debe actuar: Autoridad');
      await expect(actor.getByTestId('inspection-overdue')).toHaveCount(0);
      await expect(actor.getByRole('button', { name: /^Responder/ })).toHaveCount(0);
      await open(page, cases.empty, true);
      await page.getByRole('button', { name: 'Nuevo requerimiento', exact: true }).click();
      await page.getByLabel('Plazo de respuesta', { exact: true }).fill('2031-01-02T16:30');
      await page.getByLabel('Asunto', { exact: true }).fill('QA plazo ingresado en hora de Mendoza');
      await page.getByLabel('Contenido', { exact: true }).fill('QA artificial: se solicita una constancia con una fecha y hora expresas, sin envío externo.');
      const created = page.waitForResponse(r => r.url().endsWith(`/inspecciones/${cases.empty.id}/intercambios`) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Presentar en expediente', exact: true }).click();
      const saved = await created; expect(saved.status()).toBe(201);
      expect((await saved.json()).data.plazoRespuestaAt).toBe('2031-01-02T19:30:00.000Z');
      await open(actor, cases.empty);
      await expect(actor.getByTestId('inspection-responsible')).toHaveText('Debe actuar: Inspeccionado');
      await expect(actor.getByTestId('inspection-deadline-value')).toContainText('16:30');
      await open(actor, cases.closed);
      await expect(actor.getByText('Último plazo · histórico', { exact: true })).toBeVisible();
      await expect(actor.getByTestId('inspection-overdue')).toHaveCount(0);
      await expect(actor.getByRole('button', { name: /^Responder/ })).toHaveCount(0);
      await expect(actor.locator('vite-error-overlay, nextjs-portal')).toHaveCount(0);
      // The explicitly blocked service worker returns no registration in this harness.
      // Retain both exact warning forms; all other warnings/errors still fail.
      const expectedHarnessWarnings = consoles.filter(message => message.level === 'warning' && (
        message.text === 'Service Worker registration blocked by Playwright'
        || message.text.startsWith("[SW] Registration failed: TypeError: Cannot read properties of undefined (reading 'scope')\n    at http://127.0.0.1:4177/")
        || message.text.startsWith("[SW-App] Registration failed: TypeError: Cannot read properties of undefined (reading 'scope')\n    at http://127.0.0.1:4177/app/")
      ));
      const unexpectedConsole = consoles.filter(message => !expectedHarnessWarnings.includes(message));
      expect(errors).toEqual([]); expect(unexpectedConsole).toEqual([]);
      writeFileSync(info.outputPath('deadline-journey-proof.json'), JSON.stringify({ project: info.project.name, type, cases, replies,
        clockZone: 'UTC', displayedZone: 'America/Argentina/Mendoza', capClosed: true, emails: false, push: false, errors, consoles, expectedHarnessWarnings, unexpectedConsole,
        browserPlugin: 'Browser plugin not available; regular Playwright in the isolated preview', production: false }, null, 2));
    } finally { await context.close(); }
  });
}

test('PSIP deadline boundary: no early expiry, refresh after the exact timestamp', async ({ page }, info) => {
  const record = fixture.cases[info.project.name].boundary;
  await page.clock.install({ time: new Date(Date.parse(fixture.boundary) - 60_000) });
  await login(page, info, 'generador2');
  await page.goto(`${prefix(info)}/mis-inspecciones/${record.id}`);
  await expect(page.getByTestId('inspection-pending-request')).toContainText('Vence hoy');
  await page.clock.pauseAt(new Date(fixture.boundary));
  expect(await page.evaluate(() => Date.now())).toBe(Date.parse(fixture.boundary));
  await expect(page.getByTestId('inspection-overdue')).toHaveCount(0);
  await page.clock.runFor(61_000);
  await expect(page.getByTestId('inspection-overdue')).toContainText('1 requerimiento vencido sin respuesta');
  await expect(page.getByTestId('inspection-pending-request')).toContainText('Vencido');
  await expect(page.getByTestId('inspection-responsible')).toHaveText('Debe actuar: Inspeccionado');
  await page.getByTestId('inspection-next-step').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('exact-deadline-transition.png'), animations: 'disabled' });
  const timeline = await api(page, `/inspecciones/${record.id}/intercambios`);
  expect(timeline.body.data.inspeccion.estado).toBe('NOTIFICADA');
  expect(timeline.body.data.intercambios).toHaveLength(1);
});
