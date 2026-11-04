import { expect, test } from '@playwright/test';
import { assertCloudDatabase } from '../safety';
import { login, prefix, readablePageHeading } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('the real preview serves liveness, the manual and the operator manifest list', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'operador');
  await page.goto(`${prefix(info)}/manifiestos`);
  await expect(page.getByRole('banner').getByRole('heading', { name: 'Manifiestos' })).toBeVisible();
  await readablePageHeading(page);
  const live = await page.request.get('/api/health/live');
  expect(live.status()).toBe(200); expect((await live.json()).status).toBe('alive');
  const manual = await page.request.get('/manual/directorio.html');
  expect(manual.status()).toBe(200);
  const text = await manual.text();
  expect(text).toContain('La sonda de vida no comprueba la base de datos');
  expect(text).toContain('no escribe analítica ni contadores persistentes');
  await page.screenshot({ path: info.outputPath('manifiestos-operador.png'), animations: 'disabled' });
  expect(errors).toEqual([]);
});
