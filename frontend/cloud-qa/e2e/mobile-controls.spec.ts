import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { isolatedMapTiles, login, prefix, readableFixedAction, readablePageHeading, readableWholeWords } from './helpers';

async function touchable(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  await control.click({ trial: true, timeout: 15000 });
  const geometry = await control.evaluate(element => {
    const b = element.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return { name: element.getAttribute('aria-label') || element.textContent?.trim(), width: b.width, height: b.height,
      reachable: hit === element || (hit !== null && element.contains(hit)),
      inViewport: b.left >= -1 && b.right <= innerWidth + 1 && b.top >= -1 && b.bottom <= innerHeight + 1 };
  });
  expect(geometry.height, JSON.stringify(geometry)).toBeGreaterThanOrEqual(44);
  expect(geometry.width, JSON.stringify(geometry)).toBeGreaterThanOrEqual(44);
  expect(geometry).toMatchObject({ reachable: true, inViewport: true });
}
async function proof(page: Page, info: TestInfo, name: string) {
  await expect(page).toHaveTitle(/SITREP/);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath(name + '.png'), animations: 'disabled' });
}

test('compact login: finger sized controls, password visibility and explicit rejection retain the identifier', async ({ page }, info) => {
  await isolatedMapTiles(page, info);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(prefix(info) + '/login');
  const email = page.getByLabel('Correo electrónico o CUIT', { exact: true });
  const password = page.getByLabel('Contraseña', { exact: true });
  await email.fill('synthetic-wrong-login@night-qa.invalid'); await password.fill('NeverAnActualPassword26!');
  for (const control of [email, password, page.getByRole('button', { name: 'Mostrar contraseña', exact: true }), page.getByRole('button', { name: 'Ingresar', exact: true })]) await touchable(control);
  await expect(email).toHaveAttribute('autocapitalize', 'none');
  await expect(email).toHaveAttribute('spellcheck', 'false');
  await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar contraseña', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  expect((await response).status()).toBe(401);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(email).toHaveValue('synthetic-wrong-login@night-qa.invalid');
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeEnabled();
  await proof(page, info, 'compact-login-rejection');
});

for (const role of ['admin','generador','transportista','operador']) test(`mobile shell ${role}: menu, inbox and support remain reachable after rotation and a short viewport`, async ({ page }, info) => {
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await login(page, info, role); const home=page.url();
  for (const size of [{width:320,height:640},{width:640,height:360},{width:360,height:800}]) {
    await page.setViewportSize(size);
    await readablePageHeading(page);
    await readableWholeWords(page.locator('header h1:visible').first());
    const menu=page.getByRole('button',{name:info.project.name==='app'?'Abrir menu':'Abrir menú',exact:true});
    await touchable(menu); await menu.click();
    const close=page.getByRole('button',{name:info.project.name==='app'?'Cerrar menu':'Cerrar menú',exact:true});
    await touchable(close); await close.click();
    const bell=page.getByRole('button',{name:/^Notificaciones(?: \(|$)/});
    await touchable(bell); await bell.click();
    const notices=page.getByRole('region',{name:'Notificaciones recientes',exact:true});
    await expect(notices).toBeVisible();
    const dismiss=notices.getByRole('button',{name:'Cerrar notificaciones',exact:true});
    await touchable(dismiss); await dismiss.click(); await expect(notices).toHaveCount(0);
    await proof(page,info,role+'-shell-'+size.width);
  }
  await page.goto(prefix(info)+'/manifiestos');
  const help=page.getByRole('button',{name:'Ayuda y soporte técnico',exact:true});
  await touchable(help); await help.click();
  const dialog=page.getByRole('dialog',{name:'Reportar un problema',exact:true});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Asunto',{exact:true}).fill('QA teclado y continuidad '+role);
  await page.setViewportSize({width:360,height:440});
  const later=dialog.getByRole('button',{name:'Continuar luego',exact:true});
  await readableFixedAction(later,dialog); await later.click(); await expect(dialog).toHaveCount(0);
  await page.setViewportSize({width:360,height:800});
  await page.goto(home); await expect(page.getByRole('banner')).toBeVisible();
  await proof(page,info,role+'-restored'); expect(errors).toEqual([]);
});
