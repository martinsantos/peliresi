import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test('confirmed support actions refresh the ticket and survive a failed read without a duplicate', async ({ page }, info) => {
  test.setTimeout(150000);
  await assertCloudDatabase();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'admin');
  await page.goto(prefix(info) + '/soporte');
  await page.getByRole('region', { name: 'Soporte de SITREP', exact: true }).getByRole('button', { name: 'Reportar problema', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reportar un problema', exact: true });
  const subject = 'QA soporte actualización ' + info.project.name;
  await dialog.getByLabel('Asunto', { exact: true }).fill(subject);
  await dialog.getByLabel('¿Qué intentabas hacer y qué ocurrió?', { exact: true }).fill('QA sintético: verificar la actualización y el recibo.');
  const created = page.waitForResponse(response => response.url().endsWith('/api/soporte') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Enviar ticket', exact: true }).click();
  const creation = await created;
  expect(creation.status()).toBe(201);
  const ticket = (await creation.json()).data as { id: string; referencia: string };
  await expect(page.getByRole('heading', { name: subject, exact: true })).toBeVisible();
  let actions = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === `/api/soporte/${ticket.id}/acciones` && request.method() === 'POST') actions += 1; });
  await page.getByRole('button', { name: 'Asignarme', exact: true }).click();
  await expect(page.getByText('Acción confirmada. No hace falta enviarla otra vez.', { exact: true })).toBeVisible();
  await expect(page.locator('dd').filter({ hasText: 'QA admin' })).toBeVisible();
  let continueButton = page.getByRole('button', { name: 'Continuar', exact: true });
  await expect(continueButton).toBeEnabled(); await continueButton.click();
  await expect(continueButton).toHaveCount(0);

  let blocked = true, rejectedReads = 0;
  await page.route(`**/api/soporte/${ticket.id}`, async route => {
    if (blocked && route.request().method() === 'GET') {
      rejectedReads += 1;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'QA lectura interrumpida' }) });
    } else await route.continue();
  });
  await page.getByRole('region', { name: 'Atender ticket', exact: true }).getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Mensaje o resolución', exact: true }).fill('QA resolución confirmada sin repetir el envío.');
  await page.getByRole('button', { name: 'Cerrar con resolución', exact: true }).click();
  await expect(page.getByText('Acción confirmada. No hace falta enviarla otra vez.', { exact: true })).toBeVisible();
  await expect(page.getByText(/No pudimos actualizar el ticket/).first()).toBeVisible();
  const pendingFields = page.locator('header').getByText('Pendiente de actualización', { exact: true });
  await expect(pendingFields).toHaveCount(2);
  await expect(pendingFields.first()).toBeVisible(); await expect(pendingFields.last()).toBeVisible();
  const confirmation = page.getByRole('region', { name: 'Resultado de la acción', exact: true });
  await expect(confirmation).toBeFocused();
  await expect(confirmation.getByRole('alert')).toContainText('No pudimos actualizar el ticket');
  continueButton = confirmation.getByRole('button', { name: 'Reintentar actualización', exact: true });
  await expect(confirmation.getByRole('alert')).toBeInViewport();
  await expect(continueButton).toBeInViewport();
  await expect(continueButton).toBeEnabled(); await continueButton.click();
  await expect.poll(() => rejectedReads).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('Acción confirmada. No hace falta enviarla otra vez.', { exact: true })).toBeVisible();
  expect(actions).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('confirmed-refresh-unavailable.png'), animations: 'disabled' });

  blocked = false;
  await page.reload();
  await expect(page.getByRole('heading', { name: subject, exact: true })).toBeVisible();
  await expect(page.getByText('Acción confirmada. No hace falta enviarla otra vez.', { exact: true })).toBeVisible();
  await expect(page.getByText('Cerrado', { exact: true }).first()).toBeVisible();
  continueButton = page.getByRole('button', { name: 'Continuar', exact: true });
  await expect(continueButton).toBeEnabled(); await continueButton.click();
  await expect(continueButton).toHaveCount(0);
  expect(actions).toBe(2);
  expect(errors).toEqual([]);
  await writeFile(info.outputPath('proof.json'), JSON.stringify({ surface: info.project.name, ticketId: ticket.id,
    actions, rejectedReads, confirmedAfterReopen: true, noDuplicate: true }, null, 2));
});

test('a multi-role account keeps its support reply drafts separate across activity changes', async ({ page }, info) => {
  test.setTimeout(150000);
  await assertCloudDatabase();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'draft-multirole-20261024');
  await page.goto(prefix(info) + '/mi-perfil');
  const generatorInUse = page.getByRole('button', { name: 'Generador · En uso', exact: true });
  const operatorInUse = page.getByRole('button', { name: 'Operador · En uso', exact: true });
  await expect(generatorInUse.or(operatorInUse)).toBeVisible();
  const first = await generatorInUse.isVisible() ? 'Generador' : 'Operador';
  const second = first === 'Generador' ? 'Operador' : 'Generador';
  await page.goto(prefix(info) + '/soporte');
  await page.getByRole('region', { name: 'Soporte de SITREP', exact: true }).getByRole('button', { name: 'Reportar problema', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reportar un problema', exact: true });
  const subject = 'QA soporte multirol ' + info.project.name;
  await dialog.getByLabel('Asunto', { exact: true }).fill(subject);
  await dialog.getByLabel('¿Qué intentabas hacer y qué ocurrió?', { exact: true }).fill('QA sintético: conservar respuestas por actividad.');
  const created = page.waitForResponse(response => response.url().endsWith('/api/soporte') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Enviar ticket', exact: true }).click();
  const result = await created; expect(result.status()).toBe(201);
  const ticket = (await result.json()).data as { id: string };
  const reply = page.getByRole('textbox', { name: 'Mensaje o resolución', exact: true });
  await reply.fill('QA borrador de ' + first); await reply.blur();
  await expect(page.getByText('Borrador guardado en este dispositivo. Todavía no se envió.', { exact: true })).toBeVisible();

  await page.goto(prefix(info) + '/mi-perfil');
  await page.getByRole('button', { name: 'Usar ' + second, exact: true }).click();
  await expect(page.getByRole('button', { name: second + ' · En uso', exact: true })).toBeDisabled();
  await page.goto(prefix(info) + '/soporte/' + ticket.id);
  await expect(page.getByRole('heading', { name: subject, exact: true })).toBeVisible();
  await expect(reply).toHaveValue('');
  await reply.fill('QA borrador de ' + second); await reply.blur();
  await expect(page.getByText('Borrador guardado en este dispositivo. Todavía no se envió.', { exact: true })).toBeVisible();

  await page.goto(prefix(info) + '/mi-perfil');
  await page.getByRole('button', { name: 'Usar ' + first, exact: true }).click();
  await expect(page.getByRole('button', { name: first + ' · En uso', exact: true })).toBeDisabled();
  await page.goto(prefix(info) + '/soporte/' + ticket.id);
  await expect(reply).toHaveValue('QA borrador de ' + first);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('multirole-draft-recovered.png'), animations: 'disabled' });
  await writeFile(info.outputPath('multirole-proof.json'), JSON.stringify({ surface: info.project.name, ticketId: ticket.id,
    first, second, separated: true, replySent: false }, null, 2));
});
