import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import type { Page } from 'playwright';
import { apkOrigin } from './apk-auth-policy.ts';
import { tapApkSubmit } from './apk-native-submit.ts';

/** Called only after the original signed APK has launched its production TWA. */
export async function trainingJourney(page: Page, credentials: { id: string; email: string; password: string },
  proof: (name: string) => Promise<void>, reopen: () => Promise<Page>) {
  // Navigate to a protected route as a person would, preserving its login return path.
  await page.goto(apkOrigin + '/app/switch-user');
  await page.getByLabel('Correo electrónico o CUIT').fill(credentials.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(credentials.password);
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/login' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).tap();
  const logged = await response;
  assert.equal(logged.status(), 200);
  const identity = (await logged.json()).data.user;
  assert.equal(identity.id, credentials.id); assert.equal(identity.rol, 'ADMIN');
  await expect(page).not.toHaveURL(/\/login$/);
  const welcome = page.getByRole('button', { name: 'Saltar introducción', exact: true });
  if (await welcome.isVisible()) await welcome.tap();
  await page.goto(apkOrigin + '/app/switch-user');
  for (const [category, role] of [['Transportistas', 'TRANSPORTISTA'], ['Generadores', 'GENERADOR'], ['Operadores', 'OPERADOR'], ['Inspectores', 'INSPECTOR']]) {
    await page.getByRole('button', { name: 'Capacitación', exact: true }).tap();
    const group = page.getByRole('region', { name: category, exact: true });
    await expect(group.getByRole('button', { name: /^Ver como CAP/ })).toHaveCount(5);
    const entry = page.waitForResponse(r => r.url().includes('/api/admin/training/impersonate/') && r.request().method() === 'POST');
    await group.getByRole('button', { name: /^Ver como CAP/ }).nth(4).tap();
    assert.equal((await entry).status(), 200);
    await expect(page.getByText('Capacitación · sin validez oficial', { exact: false }).first()).toBeVisible();
    const intro = page.getByRole('button', { name: 'Saltar introducción', exact: true });
    if (await intro.isVisible()) await intro.tap();
    if (role === 'INSPECTOR') {
      await page.getByRole('button', { name: 'Abrir menu', exact: true }).tap();
      await page.getByRole('navigation', { name: 'Menú de la aplicación', exact: true }).getByRole('link', { name: 'Inspecciones', exact: true }).tap();
      const filtered = page.waitForResponse(r => {
        const url = new URL(r.url());
        return url.pathname === '/api/inspecciones' && url.searchParams.get('search') === 'CAP-I-5-GENERADOR' && r.request().method() === 'GET';
      });
      await page.getByRole('textbox', { name: 'Buscar inspección', exact: true }).fill('CAP-I-5-GENERADOR');
      assert.equal((await filtered).status(), 200);
      await expect(page.getByText('Cargando inspecciones…', { exact: true })).toHaveCount(0);
      await expect(page.getByText('CAP-I-5-GENERADOR', { exact: true }).first()).toBeVisible();
      await page.getByRole('link', { name: /^Abrir expediente CAP-I-5-GENERADOR$/ }).scrollIntoViewIfNeeded();
      await proof('training-inspector-list');
    } else {
      const id = `cap-20261012-participacion-5-${role}-abierta`;
      const list = page.waitForResponse(r => new URL(r.url()).pathname === '/api/inspecciones/participacion');
      await page.getByRole('button', { name: 'Abrir menu', exact: true }).tap();
      const menu = page.getByRole('navigation', { name: 'Menú de la aplicación', exact: true });
      await expect(menu.getByRole('link', { name: 'Inspecciones', exact: true })).toHaveCount(0);
      await menu.getByRole('link', { name: 'Mis inspecciones', exact: true }).tap();
      const result = await list; assert.equal(result.status(), 200);
      const rows = (await result.json()).data;
      assert.deepEqual(rows.map((row: { id: string }) => row.id).sort(), [id, id.replace('abierta', 'cerrada')].sort());
      await expect(page.locator('main').getByRole('heading', { name: 'Mis inspecciones', exact: true })).toBeVisible();
      await proof('training-' + role + '-own-list');
      await page.getByRole('button', { name: new RegExp(`CAP-P-5-${role}-A`) }).tap();
      await expect(page.getByText('Vista: Inspeccionado', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cerrar conforme', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Responder esta actuación', exact: true }).last().tap();
      const text = `CAP Android ${process.env.GITHUB_RUN_ID}: respuesta sintética del ${role}. Sin actuación real ni correo.`;
      await page.getByLabel('Contenido', { exact: true }).fill(text);
      await proof('training-' + role + '-before-submit');
      // Observe both promises immediately: a response timeout must reach the
      // diagnostic wrapper instead of becoming an unhandled rejection while
      // Android's touch driver is still waiting.
      const [sent] = await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/' + id + '/intercambios') && r.request().method() === 'POST'),
        tapApkSubmit(page, role),
      ]);
      assert.equal(sent.status(), 201);
      await page.reload();
      await expect(page.getByText(text, { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await proof('training-' + role + '-persisted-response');
      if (role === 'TRANSPORTISTA') {
        page = await reopen();
        await expect(page.getByText('Capacitación · sin validez oficial', { exact: false }).first()).toBeVisible();
        await page.goto(apkOrigin + '/app/mis-inspecciones/' + id);
        await expect(page.getByText(text, { exact: true })).toBeVisible();
        await proof('training-transportista-apk-reopened');
      }
    }
    await page.getByRole('button', { name: 'Volver a mi cuenta', exact: true }).tap();
    await expect(page).toHaveURL(/\/app\/switch-user$/);
  }
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).tap();
  await page.getByRole('button', { name: 'Cerrar Sesión', exact: true }).tap();
  await expect(page).toHaveURL(/\/app\/login$/);
  assert.equal(await page.evaluate(() => localStorage.getItem('sitrep_access_token')), null);
  await page.goto(apkOrigin + '/app/mis-inspecciones');
  await expect(page).toHaveURL(/\/app\/login$/);
  await expect(page.getByLabel('Correo electrónico o CUIT')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
  await proof('training-apk-logout');
}
