import { test, expect } from '@playwright/test';
import { login, prefix } from './helpers';
import { multiRoleJourney, pendingMultiRoleJourney } from '../multirole-journey';
import { externalTrackingJourney } from '../external-tracking-journey';
test('external participant tracking is scoped, paginated and read-only', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page, info, 'operador');
  await externalTrackingJourney(page, prefix(info));
  await page.screenshot({ path: info.outputPath('external-tracking.png'), fullPage: true });
  expect(errors).toEqual([]);
});
test('approved activity switch, additional draft and unblocked incomplete operation', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page, info, 'multirol-' + info.project.name);
  await multiRoleJourney(page, prefix(info));
  await page.screenshot({ path: info.outputPath('incomplete-operation.png') });
  await page.goto(prefix(info) + '/mi-perfil');
  await expect(page.getByRole('button', { name: 'Operador · En uso', exact: true })).toBeDisabled();
  await page.getByRole('heading', { name: 'Mis actividades', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('approved-activities.png') });
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('verified applicant keeps separate activity drafts without operational access', async ({ page }, info) => {
  await login(page, info, 'multirol-pending-' + info.project.name, { showWelcome: true });
  await expect(page.getByRole('button', { name: 'Saltar introducción', exact: true })).toHaveCount(0);
  await pendingMultiRoleJourney(page, prefix(info));
  await page.screenshot({ path: info.outputPath('pending-activities.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
