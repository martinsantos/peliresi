import { test, expect } from '@playwright/test';
import { login, prefix } from './helpers';
import { multiRoleJourney } from '../multirole-journey';
test('approved activity switch, additional draft and unblocked incomplete operation', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page, info, 'multirol-' + info.project.name);
  await multiRoleJourney(page, prefix(info));
  await page.screenshot({ path: info.outputPath('incomplete-operation.png') });
  await page.goto(prefix(info) + '/mi-perfil');
  await page.screenshot({ path: info.outputPath('approved-activities.png') });
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});
