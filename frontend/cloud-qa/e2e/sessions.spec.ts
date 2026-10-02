import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from './helpers';

const profileResponse = (page: Page) => page.waitForResponse(response =>
  response.url().endsWith('/api/auth/profile') && response.request().method() === 'GET');

async function expectIdentity(response: Awaited<ReturnType<typeof profileResponse>>, role: string, email: string) {
  expect(response.status()).toBe(200);
  const { data } = await response.json();
  expect(data.user.rol).toBe(role);
  expect(data.user.email).toBe(email);
}

async function logout(page: Page, info: TestInfo) {
  if (info.project.name === 'app') {
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar Sesión', exact: true }).click();
  } else {
    if (info.project.name === 'web-responsive') {
      await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
    }
    await page.getByRole('button', { name: /^Mi Cuenta/ }).click();
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  }
  await expect(page).toHaveURL(new RegExp(`${prefix(info)}/login$`));
}

test('real impersonation survives reload and restores the original administrator', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info);
  await page.goto(`${prefix(info)}/switch-user`);
  await expect(page.getByRole('heading', { name: 'Ver como otro usuario', exact: true })).toBeVisible();
  await page.getByLabel('Buscar usuario').fill('operador@night-qa.invalid');
  const target = page.getByRole('region', { name: 'Operador', exact: true })
    .getByRole('button').filter({ hasText: 'QA Operador 1' });
  await expect(target).toHaveCount(1);
  const switched = page.waitForResponse(response => response.url().includes('/api/admin/impersonate/') && response.request().method() === 'POST');
  const operatorProfile = profileResponse(page);
  await target.click();
  expect((await switched).status()).toBe(200);
  await expectIdentity(await operatorProfile, 'OPERADOR', 'operador@night-qa.invalid');
  await expect(page.getByText(/Vista temporal ·/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Volver a mi cuenta', exact: true })).toBeVisible();
  const restoredOperator = profileResponse(page);
  await page.reload();
  await expectIdentity(await restoredOperator, 'OPERADOR', 'operador@night-qa.invalid');
  await expect(page.getByText(/Vista temporal ·/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('operator-temporary-session.png'), animations: 'disabled' });
  const administratorProfile = profileResponse(page);
  await page.getByRole('button', { name: 'Volver a mi cuenta', exact: true }).click();
  await expectIdentity(await administratorProfile, 'ADMIN', 'admin@night-qa.invalid');
  await expect(page).toHaveURL(new RegExp(`${prefix(info)}/switch-user$`));
  await expect(page.getByRole('heading', { name: 'Ver como otro usuario', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Volver a mi cuenta', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('administrator-restored.png'), animations: 'disabled' });
  expect(errors).toEqual([]);
});

test('logout in one real tab removes access in every tab and browser history', async ({ page, context }, info) => {
  await login(page, info);
  const other = await context.newPage();
  try {
    const actualProfile = profileResponse(other);
    await other.goto(`${prefix(info)}/manifiestos`);
    await expectIdentity(await actualProfile, 'ADMIN', 'admin@night-qa.invalid');
    await expect(other.getByRole('banner')).toBeVisible();
    await logout(page, info);
    await expect(other).toHaveURL(new RegExp(`${prefix(info)}/login$`));
    await other.goBack();
    await other.goto(`${prefix(info)}/manifiestos`);
    await expect(other).toHaveURL(new RegExp(`${prefix(info)}/login$`));
    await expect(other.getByLabel('Correo electrónico o CUIT')).toBeVisible();
    await expect(other.getByRole('banner')).toHaveCount(0);
    await other.screenshot({ path: info.outputPath('cross-tab-logout.png'), animations: 'disabled' });
  } finally {
    await other.close();
  }
});
