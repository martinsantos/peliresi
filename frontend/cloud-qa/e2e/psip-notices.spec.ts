import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { login, prefix, readableWholeWords } from './helpers';

const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'psip-fixture.json'), 'utf8'));

async function api(page: Page, endpoint: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ endpoint, method, body }) => {
    const response = await fetch('/api' + endpoint, { method, headers: {
      Authorization: 'Bearer ' + localStorage.getItem('sitrep_access_token'), ...(body ? { 'Content-Type': 'application/json' } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }, { endpoint, method, body });
}
async function notices(page: Page, exchangeId: string) {
  const result = await api(page, '/notificaciones?limit=500');
  expect(result.status).toBe(200);
  return result.body.data.notificaciones.filter((notice: { datos: string }) => {
    try { return JSON.parse(notice.datos || '{}').intercambioId === exchangeId; } catch { return false; }
  });
}

for (const type of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) {
  test(`PSIP bell ${type}: every requirement, reply and decision, scoped and without duplicates`, async ({ page, browser }, info) => {
    page.setDefaultTimeout(15_000);
    const errors: string[] = [], observed: Array<{ exchangeId: string; tipo: string; recipient: string; read: boolean }> = [];
    const contexts = [];
    const watch = (target: Page) => target.on('pageerror', error => errors.push(error.message)); watch(page);
    const asUser = async (user: string) => {
      const context = await browser.newContext({ viewport: page.viewportSize(), isMobile: info.project.name !== 'web-desktop', hasTouch: info.project.name !== 'web-desktop',
        baseURL: 'http://127.0.0.1:4177', serviceWorkers: 'block' }); contexts.push(context);
      const target = await context.newPage(); target.setDefaultTimeout(15_000); watch(target); await login(target, info, user); return target;
    };
    try {
      await login(page, info, 'admin');
      const actor = await asUser(fixture.actors[type].login), inspector = await asUser('inspector');
      const id = fixture.cases[info.project.name][type], base = prefix(info);
      const endpoint = `/inspecciones/${id}/intercambios`;
      await page.goto(`${base}/inspecciones/${id}#intercambios`);
      const number = (await api(page, endpoint)).body.data.inspeccion.numero;
      const initialUnread = (await api(actor, '/notificaciones?limit=5')).body.data.noLeidas;
      const senderExcluded = async (sender: Page, exchange: any) => expect(await notices(sender, exchange.id)).toHaveLength(0);
      const openBell = async (recipient: Page, exchange: any, destination: 'participacion' | 'inspeccion') => {
        const own = await notices(recipient, exchange.id); expect(own).toHaveLength(1); expect(own[0].leida).toBe(false);
        expect(JSON.parse(own[0].datos)).toMatchObject({ inspeccionId: id, secuencia: exchange.secuencia, evento: exchange.tipo, destino: destination, soloCampana: true });
        await recipient.getByRole('button', { name: /^Notificaciones(?: \(|$)/ }).click();
        const panel = recipient.getByRole('region', { name: 'Notificaciones recientes', exact: true });
        await expect(panel).toBeVisible();
        expect(await panel.evaluate(element => { const box = element.getBoundingClientRect(); return { left: box.left >= 0, right: box.right <= innerWidth, top: box.top >= 0, bottom: box.bottom <= innerHeight }; })).toEqual({ left: true, right: true, top: true, bottom: true });
        await readableWholeWords(panel.getByRole('heading', { name: 'Notificaciones', exact: true }));
        const notice = recipient.getByRole('button').filter({ has: recipient.getByText(own[0].titulo, { exact: true }) }).filter({ hasText: `${number} · Actuación #${exchange.secuencia}.` });
        await expect(notice).toBeVisible(); await readableWholeWords(notice.getByText(own[0].titulo, { exact: true }));
        expect(await recipient.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        if (exchange.secuencia === 1 || exchange.tipo === 'CIERRE_CONFORME' || exchange.tipo === 'DERIVACION_LEGALES') await recipient.screenshot({ path: info.outputPath(`bell-${destination}-${exchange.secuencia}.png`), animations: 'disabled' });
        await notice.click();
        await expect(recipient).toHaveURL(`http://127.0.0.1:4177${base}/${destination === 'participacion' ? 'mis-inspecciones' : 'inspecciones'}/${id}${destination === 'inspeccion' ? '#intercambios' : ''}`);
        await expect(recipient.getByTestId('inspection-exchange-row').filter({ has: recipient.getByRole('heading', { name: exchange.asunto, exact: true }) })).toBeVisible();
        await expect.poll(async () => (await notices(recipient, exchange.id))[0]?.leida).toBe(true);
        observed.push({ exchangeId: exchange.id, tipo: exchange.tipo, recipient: destination, read: true });
      };
      const submit = async (sender: Page, tipo: string, parent?: any) => {
        const isActor = sender === actor;
        if (parent) await sender.getByTestId('inspection-exchange-row').filter({ has: sender.getByRole('heading', { name: parent.asunto, exact: true }) }).getByRole('button', { name: 'Responder esta actuación', exact: true }).click();
        else await sender.getByRole('button', { name: 'Nuevo requerimiento', exact: true }).click();
        await sender.getByRole('combobox', { name: 'Tipo de actuación', exact: true }).selectOption(tipo);
        const subject = `QA aviso ${type} ${tipo} ${Date.now()}`;
        await sender.getByLabel('Asunto', { exact: true }).fill(subject);
        await sender.getByLabel('Contenido', { exact: true }).fill('QA artificial: esta actuación permite verificar el aviso interno, su destinatario y el recorrido sin comunicaciones externas.');
        if (tipo === 'REQUERIMIENTO') await sender.getByLabel('Plazo de respuesta', { exact: true }).fill('2030-01-03T12:00');
        const saved = sender.waitForResponse(r => r.url().endsWith(endpoint) && r.request().method() === 'POST');
        await sender.getByRole('button', { name: 'Presentar en expediente', exact: true }).click();
        const result = await saved; expect(result.status()).toBe(201); const exchange = (await result.json()).data;
        await expect(sender.getByTestId('inspection-exchange-row').filter({ hasText: subject })).toBeVisible();
        await senderExcluded(sender, exchange);
        if (isActor) { await openBell(page, exchange, 'inspeccion'); await openBell(inspector, exchange, 'inspeccion'); }
        else {
          // One real polling interval on each main surface proves delivery while idle,
          // before opening the bell (opening also refreshes immediately by design).
          if (exchange.secuencia === 1 && type === 'GENERADOR' && info.project.name !== 'web-responsive') {
            await expect.poll(async () => Number((await actor.getByRole('button', { name: /^Notificaciones(?: \(|$)/ }).getAttribute('aria-label'))?.match(/\((\d+) sin leer\)/)?.[1] || 0), { timeout: 40_000 }).toBeGreaterThanOrEqual(initialUnread + 1);
          }
          await openBell(actor, exchange, 'participacion');
        }
        return exchange;
      };
      const request = await submit(page, 'REQUERIMIENTO');
      await expect(actor.getByTestId('inspection-next-step')).toContainText('Tenés requerimientos por responder');
      // Reading a bell is not an answer, and the existing idempotency key creates no second notice.
      const replay = await api(page, endpoint, 'POST', { version: 1, clienteId: request.clienteId, tipo: 'REQUERIMIENTO', asunto: request.asunto, cuerpo: request.cuerpo, plazoRespuestaAt: request.plazoRespuestaAt });
      expect(replay.status).toBe(200); expect(replay.body.data.id).toBe(request.id); expect(await notices(actor, request.id)).toHaveLength(1);
      const otherType = type === 'GENERADOR' ? 'OPERADOR' : 'GENERADOR';
      expect((await api(actor, `/inspecciones/${fixture.cases[info.project.name][otherType]}/intercambios`)).status).toBe(403);
      const reply = await submit(actor, 'RESPUESTA', request);
      await submit(page, 'RESPUESTA', reply);
      await page.goto(`${base}/inspecciones/${id}#intercambios`);
      await submit(page, 'PRONUNCIAMIENTO', reply);
      await page.goto(`${base}/inspecciones/${id}#intercambios`);
      const correction = await submit(page, 'REQUERIMIENTO');
      await submit(actor, 'DESCARGO', correction);
      const lastRequest = await submit(page, 'REQUERIMIENTO');
      await submit(actor, 'SUBSANACION', lastRequest);
      const version = (await api(page, endpoint)).body.data.inspeccion.version;
      const rejected = await api(page, endpoint, 'POST', { version: version - 1, clienteId: `rejected_${Date.now()}`, tipo: 'REQUERIMIENTO', asunto: 'QA version rechazada', cuerpo: 'QA no debe generar ninguna actuación ni aviso.' });
      expect(rejected.status).toBe(409);
      const beforeDecision = (await api(page, endpoint)).body.data; expect(beforeDecision.intercambios).toHaveLength(8); expect(beforeDecision.inspeccion.version).toBe(version);
      const legal = type === 'OPERADOR';
      await page.getByRole('button', { name: legal ? 'Derivar a Legales' : 'Cerrar conforme', exact: true }).click();
      await page.getByLabel('Fundamento de la decisión', { exact: true }).fill('QA decisión artificial: se revisaron las presentaciones y se deja constancia fundada del resultado del ensayo.');
      const decided = page.waitForResponse(r => r.url().endsWith(endpoint + '/decision') && r.request().method() === 'POST');
      await page.getByRole('button', { name: legal ? 'Confirmar derivación' : 'Confirmar cierre conforme', exact: true }).click();
      const result = await decided; expect(result.status()).toBe(200); const decision = (await result.json()).data;
      await senderExcluded(page, decision); await openBell(actor, decision, 'participacion');
      await expect(actor.getByRole('button', { name: /^Responder/ })).toHaveCount(0);
      await actor.goto(`${base}/notificaciones`);
      const inbox = actor.getByRole('list', { name: 'Avisos', exact: true });
      const latest = inbox.getByRole('button', { name: `Abrir aviso: PSIP · ${legal ? 'Derivación a Legales' : 'Cierre conforme'}`, exact: true }).filter({ hasText: number });
      await expect(latest).toContainText('Abrir expediente y ver el intercambio');
      await expect(latest).not.toContainText('Abrir manifiesto');
      await latest.click(); await expect(actor).toHaveURL(new RegExp(`/mis-inspecciones/${id}$`));
      expect(errors).toEqual([]);
      writeFileSync(info.outputPath('notices-proof.json'), JSON.stringify({ project: info.project.name, type, caseId: id, number, observed, idempotent: true, conflict: 409, unrelatedActor: 403, production: false }, null, 2));
    } finally { for (const context of contexts) await context.close().catch(() => undefined); }
  });
}
