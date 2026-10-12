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
  const result = (await response.json()).data;
  await expect(page.getByText('Capacitación · sin validez oficial', { exact: false }).first()).toBeVisible();
  return result.tokens.accessToken as string;
}
async function leave(page: Page) {
  await page.getByRole('button', { name: 'Volver a mi cuenta', exact: true }).click();
  await expect(page).toHaveURL(/\/switch-user$/);
}

test('training selector: five per category, collapse, each role can reopen and return to administrator', async ({ page }, info) => {
  await login(page, info);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const category of ['Generadores', 'Transportistas', 'Operadores', 'Inspectores', 'Administradores']) {
    await enter(page, info, category);
    await page.reload();
    await expect(page.getByText('Capacitación · sin validez oficial', { exact: false }).first()).toBeVisible();
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
  const token = await enter(page, info, 'Administradores');
  const headers = { Authorization: 'Bearer ' + token };
  const denied = await page.request.get('/api/manifiestos/cloud-qa-report-0', { headers });
  expect(denied.status()).toBe(404);
  const certificate = await page.request.get('/api/pdf/certificado/cap-20261012-manifiesto-1-TRATADO', { headers });
  expect(certificate.status()).toBe(403);
  const jobs = await page.request.post('/api/admin/jobs/vencimientos', { headers });
  expect(jobs.status()).toBe(403);
  const refresh = await page.request.post('/api/auth/refresh-token', { data: { refreshToken: token } });
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
  for (const [name, endpoint] of [['Confirmar Retiro', 'confirmar-retiro'], ['Confirmar Entrega', 'confirmar-entrega']]) {
    const response = page.waitForResponse(r => r.url().endsWith('/' + endpoint) && r.request().method() === 'POST');
    await page.getByRole('button', { name, exact: true }).click();
    expect((await response).status()).toBe(200);
  }
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
