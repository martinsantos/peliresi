import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { login, prefix } from './helpers';

for (const switchActivity of [false, true]) test(`delayed real message preserves the next draft and its activity (${switchActivity})`, async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'multirol-pending-' + info.project.name);
  await page.goto(prefix(info) + '/mi-solicitud');
  const activity = page.getByLabel('Solicitud por actividad', { exact: true });
  await expect(activity.locator('option')).toHaveCount(2);
  const ids = await activity.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  expect(ids).toHaveLength(2);
  await activity.selectOption(ids[0]);
  const field = page.getByRole('textbox', { name: 'Mensaje a administración', exact: true });
  const send = page.getByRole('button', { name: 'Enviar mensaje', exact: true });
  const sent = 'QA consulta enviada ' + randomUUID(), next = 'QA consulta todavía sin enviar ' + randomUUID();
  let release!: () => void, received!: (status: number) => void, posts = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const stored = new Promise<number>(resolve => { received = resolve; });
  const endpoint = '/api/solicitudes/' + ids[0] + '/mensajes';
  // Forward to the real controller; hold only its response to reproduce a slow connection.
  // No response body, business record, permission or notification is fabricated.
  await page.route('**' + endpoint, async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    posts++;
    const response = await route.fetch(); received(response.status());
    await gate; await route.fulfill({ response });
  });
  try {
    await field.fill(sent); await send.click();
    expect(await stored).toBe(201);
    await field.press('Enter'); expect(posts).toBe(1);
    if (switchActivity) await activity.selectOption(ids[1]);
    await field.fill(next);
    const completed = page.waitForResponse(response => new URL(response.url()).pathname === endpoint && response.request().method() === 'POST');
    release(); expect((await completed).status()).toBe(201);
    await expect(send).toBeEnabled();
    await expect(field).toHaveValue(next);
    if (switchActivity) {
      await activity.selectOption(ids[0]); await expect(field).toHaveValue('');
      await activity.selectOption(ids[1]); await expect(field).toHaveValue(next);
    }
    const token = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
    for (const id of ids) {
      const response = await page.request.get('/api/solicitudes/' + id + '/mensajes', { headers: { Authorization: 'Bearer ' + token } });
      expect(response.status()).toBe(200);
      const messages = (await response.json()).data.mensajes as Array<{ contenido: string }>;
      expect(messages.filter(message => message.contenido === sent)).toHaveLength(id === ids[0] ? 1 : 0);
      expect(messages.some(message => message.contenido === next)).toBe(false);
    }
    await field.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('message-draft-preserved.png'), animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(posts).toBe(1); expect(errors).toEqual([]);
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
});
