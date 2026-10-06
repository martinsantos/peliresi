import { devices, expect, test, type Page, type TestInfo, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { login, prefix, readableFixedAction, readablePageHeading } from './helpers';

const path = (info: TestInfo, suffix = '') => prefix(info) + '/soporte' + suffix;
async function screenshot(page: Page, info: TestInfo, label: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page).toHaveTitle(/SITREP/);
  await page.screenshot({ path: info.outputPath('support-' + label + '.png'), animations: 'disabled' });
}
async function nativeState(page: Page, info: TestInfo) {
  const state = await page.evaluate(() => ({ path: location.pathname,
    formCount: document.querySelectorAll('#sitrep-support-report').length,
    fields: Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('#sitrep-support-report input:not([type=password]), #sitrep-support-report textarea')).map(element => ({
      id: element.id, length: element.value.length, disabled: element.disabled, required: element.required, valid: element.validity.valid,
    })), submit: Array.from(document.querySelectorAll<HTMLButtonElement>('button[form="sitrep-support-report"]')).map(element => ({
      disabled: element.disabled, busy: element.getAttribute('aria-busy'), formId: element.form?.id, height: element.getBoundingClientRect().height,
    })) }));
  await info.attach('support-native-ui-state', { body: JSON.stringify(state), contentType: 'application/json' });
}
async function report(page: Page, subject: string) {
  await page.getByRole('button', { name: 'Reportar problema', exact: true }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Reportar un problema', exact: true });
  const posts: string[] = [];
  const observe = (request: import('@playwright/test').Request) => { if (request.url().endsWith('/api/soporte') && request.method() === 'POST') posts.push(request.url()); };
  page.on('request', observe);
  try {
    // Actual reported state: both fields filled, but too short. The sticky
    // primary action must explain/focus the field, not become a silent dead end.
    await dialog.getByLabel('Asunto', { exact: true }).fill('yy');
    await dialog.getByLabel('¿Qué intentabas hacer y qué ocurrió?', { exact: true }).fill('hh');
    const submit = dialog.getByRole('button', { name: 'Enviar ticket', exact: true });
    await expect(submit).toBeEnabled();
    await expect(dialog.getByText('Para enviar: asunto (2/5 caracteres) y descripción (2/10 caracteres).', { exact: true })).toBeVisible();
    await submit.click();
    await expect(dialog.getByLabel('Asunto', { exact: true })).toBeFocused();
    expect(posts).toEqual([]);
    await dialog.getByLabel('Asunto', { exact: true }).fill(subject);
    await submit.click();
    await expect(dialog.getByLabel('¿Qué intentabas hacer y qué ocurrió?', { exact: true })).toBeFocused();
    expect(posts).toEqual([]);
    await screenshot(page, test.info(), 'incomplete-report-feedback');
  } finally { page.off('request', observe); }
  await dialog.getByLabel('Asunto', { exact: true }).fill(subject);
  await dialog.getByLabel('¿Qué intentabas hacer y qué ocurrió?', { exact: true }).fill('QA reporte sintético: la pantalla no muestra la información esperada.');
  await expect(dialog.getByRole('button', { name: 'Enviar ticket', exact: true })).toBeEnabled();
  return dialog;
}
async function action(page: Page, label: string, text: string) {
  await page.getByRole('button', { name: 'Acción de soporte', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await page.getByRole('textbox', { name: /Mensaje o resolución|Nota interna \/ motivo/ }).fill(text);
}
test('native support: report, take, private note, handoff, reply, close and reopen with actual notices', async ({ page, browser }, info) => {
  test.setTimeout(180000);
  const contexts: BrowserContext[] = [];
  const errors: string[] = [];
  let activePage = page;
  const observe = (target: Page) => {
    activePage = target;
    target.on('pageerror', error => errors.push(error.message));
    target.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  };
  observe(page);
  const asUser = async (who: string) => {
    const context = await browser.newContext({ ...(info.project.name === 'web-desktop' ? devices['Desktop Chrome'] : devices['Pixel 7']), viewport: info.project.use.viewport, baseURL: 'http://127.0.0.1:4177' });
    contexts.push(context); const target = await context.newPage(); observe(target); await login(target, info, who); return target;
  };
  const technician = info.project.name === 'web-desktop' ? 'operador2' : info.project.name === 'web-responsive' ? 'transportista2' : 'generador2';
  try {
    await login(page, info, 'operador'); await page.goto(path(info));
    const dialog = await report(page, 'QA circuito completo ' + info.project.name);
    await screenshot(page, info, 'report-form');
    await readableFixedAction(dialog.getByRole('button', { name: 'Enviar ticket', exact: true }), dialog);
    const creating = page.waitForResponse(response => response.url().endsWith('/api/soporte') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Enviar ticket', exact: true }).click();
    const created = await creating; expect(created.status()).toBe(201);
    const ticket = (await created.json()).data as { id: string; referencia: string };
    await expect(page).toHaveURL('http://127.0.0.1:4177' + path(info, '/' + ticket.id));
    await screenshot(page, info, 'report-created'); await page.close();

    const admin = await asUser('admin'); await admin.goto(path(info));
    await admin.getByRole('button', { name: 'Equipo de soporte', exact: true }).click();
    const settings = admin.getByRole('region', { name: 'Configurar equipo de soporte', exact: true });
    await settings.getByLabel('Buscar usuario para soporte', { exact: true }).fill(technician + '@night-qa.invalid');
    await settings.getByRole('button', { name: 'Buscar usuario', exact: true }).click();
    await expect(settings.getByText('QA ' + technician, { exact: false })).toBeVisible();
    const grant = settings.getByRole('button', { name: 'Habilitar soporte', exact: true });
    if (await grant.count()) await grant.click();
    await expect(settings.getByRole('button', { name: 'Deshabilitar soporte', exact: true })).toBeVisible();
    await admin.goto(path(info, '/' + ticket.id));
    await admin.getByRole('button', { name: 'Tomar ticket', exact: true }).click();
    await expect(admin.getByText('QA admin', { exact: true }).first()).toBeVisible();
    await action(admin, 'Nota interna de soporte', 'QA diagnóstico reservado: no mostrar al reportante.');
    await admin.getByRole('button', { name: 'Confirmar acción', exact: true }).click();
    await expect(admin.getByText('QA diagnóstico reservado: no mostrar al reportante.', { exact: true })).toBeVisible();
    await action(admin, 'Derivar a otro responsable', 'QA motivo privado para el nuevo responsable.');
    await admin.getByRole('button', { name: 'Nuevo responsable', exact: true }).click();
    await admin.getByRole('option', { name: 'QA ' + technician + ' · ' + technician + '@night-qa.invalid', exact: true }).click();
    await admin.getByRole('button', { name: 'Confirmar acción', exact: true }).click();
    await expect(admin.locator('dd').filter({ hasText: 'QA ' + technician })).toBeVisible();
    await screenshot(admin, info, 'desk-handoff'); await admin.close();

    const operator = await asUser(technician); await operator.goto(prefix(info) + '/notificaciones');
    await operator.getByRole('button', { name: 'Abrir aviso: Ticket derivado a tu atención', exact: true }).first().click();
    await expect(operator).toHaveURL('http://127.0.0.1:4177' + path(info, '/' + ticket.id));
    await action(operator, 'Solicitar respuesta al usuario', 'QA verificá si la pantalla ya muestra los datos.');
    await operator.getByRole('button', { name: 'Confirmar acción', exact: true }).click();
    await expect(operator.getByText('Esperando al usuario', { exact: true })).toBeVisible();
    await action(operator, 'Cerrar con una resolución', 'QA resolución sintética: se corrigió el acceso.');
    await operator.getByRole('button', { name: 'Confirmar acción', exact: true }).click();
    await expect(operator.getByText('Cerrado', { exact: true }).first()).toBeVisible(); await operator.close();

    const reporter = await asUser('operador'); await reporter.goto(prefix(info) + '/notificaciones');
    await reporter.getByRole('button', { name: 'Abrir aviso: Actualización de soporte', exact: true }).first().click();
    await expect(reporter).toHaveURL('http://127.0.0.1:4177' + path(info, '/' + ticket.id));
    await expect(reporter.getByText('QA diagnóstico reservado: no mostrar al reportante.', { exact: true })).toHaveCount(0);
    await expect(reporter.getByText('QA motivo privado para el nuevo responsable.', { exact: true })).toHaveCount(0);
    await action(reporter, 'Responder y reabrir', 'QA el problema persiste, solicito otra revisión.');
    await reporter.getByRole('button', { name: 'Confirmar acción', exact: true }).click();
    await expect(reporter.getByText('Abierto', { exact: true }).first()).toBeVisible();
    await expect(reporter.getByText(ticket.referencia, { exact: true })).toBeVisible();
    await reporter.getByText('Historial del ticket', { exact: true }).click();
    await expect(reporter.getByText(/CERRAR · Cerrado/)).toBeVisible();
    await reporter.getByText('Historial del ticket', { exact: true }).click();
    await expect(reporter.getByText(/CERRAR · Cerrado/)).not.toBeVisible();
    await screenshot(reporter, info, 'reporter-reopened'); expect(errors).toEqual([]);
  } catch (error) {
    if (!activePage.isClosed()) { await nativeState(activePage, info).catch(() => {}); await screenshot(activePage, info, 'failed-step').catch(() => {}); }
    throw error;
  } finally { for (const context of contexts) await context.close(); }
});

test('support offline draft is recoverable across close and reload without a false server acknowledgement', async ({ page, context }, info) => {
  await login(page, info, 'generador'); await page.goto(path(info));
  const dialog = await report(page, 'QA borrador offline ' + info.project.name);
  const requests: string[] = [];
  page.on('request', request => { if (request.url().endsWith('/api/soporte') && request.method() === 'POST') requests.push(request.url()); });
  await context.setOffline(true);
  try {
    await dialog.getByRole('button', { name: 'Enviar ticket', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('No se confirmó');
    expect(requests).toEqual([]);
    await dialog.getByRole('button', { name: 'Continuar luego', exact: true }).click();
    await page.getByRole('button', { name: 'Reportar problema', exact: true }).last().click();
    await expect(page.getByRole('dialog').getByLabel('Asunto', { exact: true })).toHaveValue('QA borrador offline ' + info.project.name);
    await screenshot(page, info, 'offline-draft');
  } finally { await context.setOffline(false); }
  await page.reload(); await page.getByRole('button', { name: 'Reportar problema', exact: true }).last().click();
  const restored = page.getByRole('dialog');
    await expect(restored.getByLabel('Asunto', { exact: true })).toHaveValue('QA borrador offline ' + info.project.name);
    await expect(restored.getByRole('button', { name: 'Enviar ticket', exact: true })).toBeEnabled();
  await restored.getByRole('button', { name: 'Enviar ticket', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/soporte/[^/]+$')); expect(requests.length).toBe(1);
});

test('support reload can recover lost optional attachments with a real receipt and one ticket per sending key', async ({ page }, info) => {
  test.setTimeout(120000);
  await login(page, info, 'generador');
  for (const delivered of [false, true]) {
    await page.goto(path(info));
    const subject = 'QA adjuntos perdidos ' + delivered + ' ' + info.project.name;
    const dialog = await report(page, subject);
    const description = await dialog.getByLabel('¿Qué intentabas hacer y qué ocurrió?', { exact: true }).inputValue();
    let key: string = crypto.randomUUID();
    let existingId: string | undefined;
    if (delivered) {
      await dialog.getByLabel('Capturas o documentos · opcional', { exact: true }).setInputFiles({ name: 'captura-perdida.png', mimeType: 'image/png', buffer: await page.screenshot({ animations: 'disabled' }) });
      const createdResponse = page.waitForResponse(response => response.url().endsWith('/api/soporte') && response.request().method() === 'POST');
      await dialog.getByRole('button', { name: 'Enviar ticket', exact: true }).click();
      const response = await createdResponse;
      expect(response.status()).toBe(201);
      key = response.request().headers()['idempotency-key'];
      existingId = (await response.json()).data.id;
    } else {
      await dialog.getByRole('button', { name: 'Continuar luego', exact: true }).click();
    }
    // Explicit synthetic persisted draft, NOT a session or business API mock.
    // The live authenticated API determines whether the original send exists.
    await page.evaluate(({ subject, description, key }) => {
      const token = localStorage.getItem('sitrep_access_token')!;
      const owner = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).id;
      const input = { asunto: subject, descripcion: description, categoria: 'GENERAL', contexto: { ruta: location.pathname } };
      localStorage.setItem('sitrep-soporte:v1:' + encodeURIComponent(owner), JSON.stringify({ ...input,
        pendiente: { key, input, files: [{ nombre: 'captura-perdida.png', sha256: '0'.repeat(64) }] } }));
    }, { subject, description, key });
    await page.goto(path(info)); await page.reload();
    await page.getByRole('region', { name: 'Soporte de SITREP', exact: true }).getByRole('button', { name: 'Reportar problema', exact: true }).click();
    const restored = page.getByRole('dialog', { name: 'Reportar un problema', exact: true });
    await expect(restored.getByLabel('Asunto', { exact: true })).toHaveValue(subject);
    await expect(restored.getByLabel('Asunto', { exact: true })).toBeDisabled();
    await expect(restored.getByText(/Si perdiste los adjuntos/)).toBeVisible();
    await restored.getByRole('button', { name: 'Enviar solo texto', exact: true }).scrollIntoViewIfNeeded();
    await screenshot(page, info, 'lost-attachments-' + delivered);
    const posts: import('@playwright/test').Request[] = [];
    const observe = (request: import('@playwright/test').Request) => { if (request.url().endsWith('/api/soporte') && request.method() === 'POST') posts.push(request); };
    page.on('request', observe);
    try {
      const receiptResponse = page.waitForResponse(response => response.url().endsWith('/api/soporte/envios/' + key));
      await restored.getByRole('button', { name: 'Enviar solo texto', exact: true }).click();
      expect((await receiptResponse).status()).toBe(delivered ? 200 : 404);
      await expect(page).toHaveURL(new RegExp('/soporte/[^/]+$'));
      if (delivered) { expect(posts).toEqual([]); expect(page.url()).toBe('http://127.0.0.1:4177' + path(info, '/' + existingId)); }
      else { expect(posts).toHaveLength(1); expect(posts[0].headers()['idempotency-key']).toBe(key); expect(posts[0].postData()).not.toContain('filename='); }
      await expect(page.getByText(subject, { exact: true })).toBeVisible();
      await screenshot(page, info, 'text-only-recovered-' + delivered);
    } finally { page.off('request', observe); }
    await page.getByRole('link', { name: 'Volver a tickets', exact: true }).click();
    await expect(page.getByRole('link').filter({ hasText: subject })).toHaveCount(1);
  }
});

test('support list rows are keyboard navigable and a common actor cannot open another reporter ticket', async ({ page, browser }, info) => {
  await login(page, info, 'operador'); await page.goto(path(info));
  const subject = 'QA acceso restringido ' + info.project.name;
  if (info.project.name !== 'web-desktop') {
    await page.getByRole('button', { name: info.project.name === 'app' ? 'Abrir menu' : 'Abrir menú', exact: true }).click();
  }
  // Report from the menu, not only the page's entry. It must close on ACK and
  // return to a fresh owned list, without an overlay intercepting row actions.
  const menu = info.project.name === 'app' ? page.getByRole('navigation', { name: 'Menú de la aplicación', exact: true }) : page.locator('aside');
  await menu.getByRole('button', { name: 'Reportar problema', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar luego', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const menuEntry = menu.getByRole('button', { name: 'Reportar problema', exact: true });
  await expect(menuEntry).toBeVisible(); await menuEntry.click();
  await page.getByRole('dialog').getByLabel('Asunto', { exact: true }).fill(subject);
  await page.getByRole('dialog').getByLabel('¿Qué intentabas hacer y qué ocurrió?', { exact: true }).fill('QA reporte sintético desde el menú, debe cerrar sólo tras confirmación.');
  const dialog = page.getByRole('dialog');
  const filename = 'captura-' + 'a'.repeat(110) + '.png';
  const fileBytes = await page.screenshot({ animations: 'disabled' });
  await dialog.getByLabel('Capturas o documentos · opcional', { exact: true }).setInputFiles({ name: filename, mimeType: 'image/png', buffer: fileBytes });
  await dialog.getByRole('button', { name: 'Enviar ticket', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/soporte/[^/]+$'));
  if (info.project.name === 'app') await expect(page.getByRole('navigation', { name: 'Menú de la aplicación', exact: true })).toHaveCount(0);
  if (info.project.name === 'web-responsive') await expect(page.getByRole('button', { name: 'Abrir menú', exact: true })).toHaveAttribute('aria-expanded', 'false');
  const attachment = page.getByRole('button').filter({ hasText: filename });
  await attachment.scrollIntoViewIfNeeded();
  await readableFixedAction(attachment, page.getByRole('region', { name: 'Conversación', exact: true }));
  const receiving = page.waitForEvent('download'); await attachment.click();
  const download = await receiving; expect(download.suggestedFilename()).toBe(filename);
  expect(await download.failure()).toBeNull();
  expect(await readFile((await download.path())!)).toEqual(fileBytes);
  await screenshot(page, info, 'menu-report-confirmed');
  const ticketUrl = page.url(); await page.getByRole('link', { name: 'Volver a tickets', exact: true }).click();
  const row = page.getByRole('link').filter({ hasText: subject }); await row.focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(ticketUrl); await readablePageHeading(page);
  const context = await browser.newContext({ ...(info.project.name === 'web-desktop' ? devices['Desktop Chrome'] : devices['Pixel 7']), viewport: info.project.use.viewport, baseURL: 'http://127.0.0.1:4177' });
  try {
    const outsider = await context.newPage(); await login(outsider, info, 'generador');
    const denied = outsider.waitForResponse(response => response.url().includes('/api/soporte/') && response.url().endsWith(ticketUrl.split('/').pop()!));
    await outsider.goto(ticketUrl); expect((await denied).status()).toBe(404);
    await expect(outsider.getByText(subject, { exact: true })).toHaveCount(0);
    await expect(outsider.getByRole('link', { name: 'Volver a tickets', exact: true })).toBeVisible();
    await screenshot(outsider, info, 'foreign-denied-with-exit');
  } finally { await context.close(); }
  // The primary help entry lives on the current screen, not only in the desk.
  const taskUrl = page.url();
  const unsentReply = page.getByRole('textbox', { name: /Mensaje o resolución|Nota interna \/ motivo/ });
  await unsentReply.fill('QA comentario del trámite que aún no envié.');
  await unsentReply.blur();
  const bubble = page.getByRole('button', { name: 'Ayuda y soporte técnico', exact: true });
  await expect(bubble).toBeVisible();
  await readableFixedAction(bubble, page.locator('body'));
  let supportPosts = 0;
  page.on('request', request => { if (request.url().endsWith('/api/soporte') && request.method() === 'POST') supportPosts++; });
  await screenshot(page, info, 'bubble-on-current-task');
  await bubble.click();
  const reviewed = page.getByRole('dialog', { name: 'Reportar un problema', exact: true });
  const preview = reviewed.getByRole('img', { name: 'Captura de la pantalla que estabas usando', exact: true });
  await expect(preview).toBeVisible();
  expect(await preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0
    && Math.max(image.naturalWidth, image.naturalHeight) <= 1600)).toBe(true);
  await reviewed.getByLabel('Asunto', { exact: true }).fill('QA quitar captura sin enviar ' + info.project.name);
  await reviewed.getByLabel('¿Qué intentabas hacer y qué ocurrió?', { exact: true }).fill('QA formulario válido: quitar la captura no debe enviar nada.');
  expect(supportPosts).toBe(0);
  await reviewed.getByRole('button', { name: 'Quitar captura', exact: true }).click();
  await expect(preview).toHaveCount(0);
  expect(supportPosts).toBe(0);
  await reviewed.getByRole('button', { name: 'Continuar luego', exact: true }).click();
  await expect(page).toHaveURL(taskUrl); await expect(unsentReply).toHaveValue('QA comentario del trámite que aún no envié.');
  await bubble.click();
  await expect(preview).toBeVisible();
  await reviewed.getByLabel('Asunto', { exact: true }).fill('QA burbuja contextual ' + info.project.name);
  await reviewed.getByLabel('¿Qué intentabas hacer y qué ocurrió?', { exact: true }).fill('QA envío desde la pantalla actual con captura revisada.');
  await screenshot(page, info, 'bubble-capture-preview');
  const confirming = page.waitForResponse(response => response.url().endsWith('/api/soporte') && response.request().method() === 'POST');
  await reviewed.getByRole('button', { name: 'Enviar ticket', exact: true }).click();
  const confirmed = await confirming; expect(confirmed.status()).toBe(201);
  const capturedTicket = (await confirmed.json()).data as { id: string };
  await expect(reviewed).toHaveCount(0); await expect(page).toHaveURL(taskUrl);
  await expect(unsentReply).toHaveValue('QA comentario del trámite que aún no envié.');
  await expect(page.getByRole('status').filter({ hasText: 'Reporte enviado a soporte. Podés continuar.' })).toBeVisible();
  expect(supportPosts).toBe(1);
  await page.goto(path(info, '/' + capturedTicket.id));
  const screenAttachment = page.getByRole('button').filter({ hasText: /sitrep-pantalla-\d+\.jpg/ });
  await expect(screenAttachment).toBeVisible();
  const receivingCapture = page.waitForEvent('download'); await screenAttachment.click();
  const captureDownload = await receivingCapture; expect(await captureDownload.failure()).toBeNull();
  const captureBytes = await readFile((await captureDownload.path())!);
  expect(captureBytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  expect(captureBytes.length).toBeGreaterThan(1000);
  await screenshot(page, info, 'bubble-ticket-with-private-capture');
});
