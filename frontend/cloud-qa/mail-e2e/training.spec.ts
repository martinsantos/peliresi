import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from '../e2e/helpers';

async function enter(page: Page, info: TestInfo, category: string, index = 1) {
  await page.goto(prefix(info) + '/switch-user');
  await page.getByRole('button', { name: 'Capacitación', exact: true }).click();
  const group = page.getByRole('region', { name: category, exact: true });
  await expect(group.getByRole('button', { name: /^Ver como CAP/ })).toHaveCount(5);
  const entry = page.waitForResponse(response => response.url().includes('/api/admin/training/impersonate/') && response.request().method() === 'POST');
  await group.getByRole('button', { name: /^Ver como CAP/ }).nth(index - 1).click();
  const response = await entry;
  expect(response.status()).toBe(200);
  await expect(page.getByText('Capacitación · sin validez oficial', { exact: false }).first()).toBeVisible();
  // Read only the real credentials issued by that UI action, after its full
  // navigation. CDP can no longer retrieve the previous page's response body.
  // No injected session, intercepted business API or production account.
  const tokens = await page.evaluate(() => ({
    accessToken: localStorage.getItem('sitrep_access_token') || '',
    refreshToken: localStorage.getItem('sitrep_refresh_token') || '',
  }));
  expect(Boolean(tokens.accessToken && tokens.refreshToken)).toBe(true);
  return tokens;
}
async function leave(page: Page) {
  await page.getByRole('button', { name: 'Volver a mi cuenta', exact: true }).click();
  await expect(page).toHaveURL(/\/switch-user$/);
}

for (const [category, role] of [['Transportistas', 'TRANSPORTISTA'], ['Generadores', 'GENERADOR'], ['Operadores', 'OPERADOR']]) {
  test(`school ${role}: own inspections, private drafts, response and authority closure`, async ({ page }, info) => {
    test.setTimeout(90000);
    await login(page, info);
    const index = ['web-desktop', 'web-responsive', 'app'].indexOf(info.project.name) + 1;
    const tokens = await enter(page, info, category, index);
    const headers = { Authorization: 'Bearer ' + tokens.accessToken };
    const id = `cap-20261012-participacion-${index}-${role}-abierta`;
    const listing = page.waitForResponse(r => new URL(r.url()).pathname === '/api/inspecciones/participacion');
    await page.goto(prefix(info) + '/mis-inspecciones');
    const rows = (await (await listing).json()).data;
    expect(rows.map((row: { id: string }) => row.id).sort()).toEqual([id, id.replace('abierta', 'cerrada')].sort());
    await expect(page.locator('main').getByRole('heading', { name: 'Mis inspecciones', exact: true })).toBeVisible();
    for (const forbidden of [`cap-20261012-inspeccion-${index}-${role}`, `cap-20261012-participacion-5-${role}-abierta`]) {
      const denied = await page.request.get('/api/inspecciones/' + forbidden + '/intercambios', { headers });
      expect(denied.status()).toBe(403);
    }
    expect((await page.request.get('/api/inspecciones', { headers })).status()).toBe(403);
    await page.getByRole('button', { name: new RegExp(`CAP-P-${index}-${role}-A`) }).click();
    await expect(page.getByText('Vista: Inspeccionado', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar conforme', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Responder esta actuación', exact: true }).last().click();
    await page.getByLabel('Contenido', { exact: true }).fill('CAP respuesta del participante: control ficticio completado, sin actuación real.');
    const posted = page.waitForResponse(r => r.url().endsWith('/' + id + '/intercambios') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Presentar en expediente', exact: true }).click();
    expect((await posted).status()).toBe(201);
    await page.reload();
    await expect(page.getByText('CAP respuesta del participante: control ficticio completado, sin actuación real.', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`training-${role}-response.png`), fullPage: true });
    await leave(page);
    await enter(page, info, 'Administradores', index);
    await page.goto(prefix(info) + '/inspecciones/' + id);
    await page.getByRole('navigation', { name: 'Secciones del expediente' }).getByRole('link', { name: 'Expediente', exact: true }).click();
    await page.getByRole('navigation', { name: 'Apartados de Expediente' }).getByRole('link', { name: 'Comunicaciones', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar conforme', exact: true }).click();
    await page.getByLabel('Fundamento de la decisión').fill('CAP Ejercicio revisado: se acepta la respuesta ficticia, sin validez oficial.');
    const closed = page.waitForResponse(r => r.url().endsWith('/intercambios/decision') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirmar cierre conforme', exact: true }).click();
    expect((await closed).status()).toBe(200);
    await leave(page);
    await enter(page, info, category, index);
    await page.goto(prefix(info) + '/mis-inspecciones/' + id);
    await expect(page.getByText('CAP Ejercicio revisado: se acepta la respuesta ficticia, sin validez oficial.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Responder esta actuación', exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`training-${role}-closed.png`), fullPage: true });
  });
}

test('training selector: five per category, collapse, each role can reopen and return to administrator', async ({ page }, info) => {
  test.setTimeout(120_000);
  await login(page, info);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const category of ['Generadores', 'Transportistas', 'Operadores', 'Inspectores', 'Administradores',
    'Administradores de generadores', 'Administradores de transporte', 'Administradores de operadores']) {
    await enter(page, info, category);
    await page.reload();
    await expect(page.getByText('Capacitación · sin validez oficial', { exact: false }).first()).toBeVisible();
    const band = await page.getByTestId('impersonation-banner').boundingBox();
    const header = await page.getByRole('banner').boundingBox();
    expect(band && header && band.y + band.height <= header.y + 1, 'Training banner must not cover navigation').toBe(true);
    await leave(page);
  }
  await page.getByRole('button', { name: 'Capacitación', exact: true }).click();
  const group = page.getByRole('region', { name: 'Generadores', exact: true });
  const header = group.getByRole('button', { name: /^Generadores/ });
  await header.click(); await expect(header).toHaveAttribute('aria-expanded', 'false');
  await expect(group.getByRole('button', { name: /^Ver como/ })).toHaveCount(0);
  await header.click(); await expect(group.getByRole('button', { name: /^Ver como/ })).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('training-selector.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('training bearer cannot read an operational record, emit a certificate or lose its realm on refresh', async ({ page }, info) => {
  await login(page, info);
  const tokens = await enter(page, info, 'Administradores');
  const headers = { Authorization: 'Bearer ' + tokens.accessToken };
  const denied = await page.request.get('/api/manifiestos/cloud-qa-report-0', { headers });
  expect(denied.status()).toBe(404);
  const certificate = await page.request.get('/api/pdf/certificado/cap-20261012-manifiesto-1-TRATADO', { headers });
  expect(certificate.status()).toBe(403);
  const jobs = await page.request.post('/api/admin/jobs/vencimientos', { headers });
  expect(jobs.status()).toBe(403);
  const refresh = await page.request.post('/api/auth/refresh-token', { data: { refreshToken: tokens.refreshToken } });
  expect(refresh.status()).toBe(200);
  const renewed = (await refresh.json()).data.accessToken;
  const profile = await page.request.get('/api/auth/profile', { headers: { Authorization: 'Bearer ' + renewed } });
  expect((await profile.json()).data.user.training).toBe(true);
  await leave(page);
  await expect(page.getByRole('heading', { name: 'Ver como otro usuario' })).toBeVisible();
});

test('school transport and operator complete a persisted manifest through real buttons', async ({ page }, info) => {
  await login(page, info);
  const index = ['web-desktop', 'web-responsive', 'app'].indexOf(info.project.name) + 1;
  const id = `cap-20261012-manifiesto-${index}-APROBADO`;
  await enter(page, info, 'Transportistas', index);
  await page.goto(prefix(info) + '/manifiestos/' + id);
  // Transportistas use the trip screen, not the administrator's action strip.
  // Delivery has its own explicit confirmation; exercise both real clicks.
  const retired = page.waitForResponse(r => r.url().endsWith('/confirmar-retiro') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar retiro', exact: true }).click();
  expect((await retired).status()).toBe(200);
  await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar Entrega?', exact: true })).toBeVisible();
  const delivered = page.waitForResponse(r => r.url().endsWith('/confirmar-entrega') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
  expect((await delivered).status()).toBe(200);
  await leave(page);
  await enter(page, info, 'Operadores', index);
  await page.goto(prefix(info) + '/manifiestos/' + id);
  const received = page.waitForResponse(r => r.url().endsWith('/confirmar-recepcion') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar Recepcion', exact: true }).click();
  expect((await received).status()).toBe(200);
  await page.getByRole('button', { name: 'Registrar Tratamiento', exact: true }).click();
  const treatment = page.getByRole('dialog', { name: 'Registrar Tratamiento', exact: true });
  await treatment.getByPlaceholder('Observaciones del tratamiento...').fill('CAPACITACIÓN · Ejercicio sin validez oficial');
  const treated = page.waitForResponse(r => r.url().endsWith('/tratamiento') && r.request().method() === 'POST');
  await treatment.getByRole('button', { name: 'Confirmar Tratamiento', exact: true }).click();
  expect((await treated).status()).toBe(200);
  const closed = page.waitForResponse(r => r.url().endsWith('/cerrar') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Cerrar Manifiesto', exact: true }).click();
  expect((await closed).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Descargar Certificado', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar Certificado', exact: true })).toBeDisabled();
  await expect(page.getByText('Capacitación: no se emiten documentos oficiales.')).toBeVisible();
  await page.screenshot({ path: info.outputPath('training-manifest-finished.png'), fullPage: true });
  await leave(page);
});

test('school inspector starts and resumes field work without exposing it to the operational administrator', async ({ page }, info) => {
  await login(page, info);
  const index = ['web-desktop', 'web-responsive', 'app'].indexOf(info.project.name) + 1;
  const id = `cap-20261012-inspeccion-${index}-GENERADOR`;
  await enter(page, info, 'Inspectores', index);
  await page.goto(prefix(info) + '/inspecciones/' + id);
  await expect(page.getByRole('button', { name: 'Descargar expediente', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Otras descargas', exact: true })).toBeDisabled();
  const nav = page.getByRole('navigation', { name: 'Secciones del expediente' });
  await nav.getByRole('link', { name: 'Visita', exact: true }).click();
  const started = page.waitForResponse(r => r.url().endsWith('/inspecciones/' + id + '/estado') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Iniciar visita', exact: true }).click();
  expect((await started).status()).toBe(200);
  await nav.getByRole('link', { name: 'Controles', exact: true }).click();
  const control = page.locator('[id^="control-"]').first();
  const trigger = control.locator('button[aria-expanded]').first();
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await control.getByRole('button', { name: 'Cumple', exact: true }).click();
  const saved = page.waitForResponse(r => r.url().includes('/inspecciones/' + id) && r.request().method() === 'PATCH');
  await page.getByTestId('inspection-field-save-bar').getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await page.reload();
  await nav.getByRole('link', { name: 'Controles', exact: true }).click();
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await expect(control.getByRole('button', { name: 'Cumple', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: info.outputPath('training-inspection-resumed.png'), fullPage: true });
  await leave(page);
  const denied = page.waitForResponse(r => new URL(r.url()).pathname === '/api/inspecciones/' + id);
  await page.goto(prefix(info) + '/inspecciones/' + id);
  expect((await denied).status()).toBe(404);
});

test('school support upload and handoff stay invisible to the operational administrator', async ({ page }, info) => {
  await login(page, info);
  await enter(page, info, 'Generadores', 4);
  await page.goto(prefix(info) + '/soporte');
  await page.getByRole('region', { name: 'Soporte de SITREP', exact: true }).getByRole('button', { name: 'Reportar problema', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reportar un problema', exact: true });
  await dialog.getByLabel('¿Qué intentabas hacer y qué ocurrió?', { exact: true }).fill('CAP consulta de práctica ' + info.project.name);
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'cap-practica.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  const posted = page.waitForResponse(r => r.url().endsWith('/api/soporte') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Enviar ticket', exact: true }).click();
  const result = await posted;
  expect(result.status()).toBe(201);
  const ticket = (await result.json()).data;
  await expect(page.getByRole('heading', { name: 'CAP consulta de práctica ' + info.project.name, exact: true })).toBeVisible();
  await leave(page);
  const denied = page.waitForResponse(r => new URL(r.url()).pathname === '/api/soporte/' + ticket.id);
  await page.goto(prefix(info) + '/soporte/' + ticket.id);
  expect((await denied).status()).toBe(404);
  await enter(page, info, 'Administradores', 4);
  await page.goto(prefix(info) + '/soporte/' + ticket.id);
  await expect(page.getByRole('heading', { name: 'CAP consulta de práctica ' + info.project.name, exact: true })).toBeVisible();
  const claimed = page.waitForResponse(r => r.url().endsWith('/acciones') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Asignarme', exact: true }).click();
  expect((await claimed).status()).toBe(200);
  await expect(page.getByText('Responsable', { exact: true }).locator('..')).toContainText('CAP · ADMIN 4');
  await page.screenshot({ path: info.outputPath('training-support.png'), fullPage: true });
  await leave(page);
});
