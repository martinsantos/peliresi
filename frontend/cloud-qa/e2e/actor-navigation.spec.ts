import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { login, prefix } from './helpers';

// Real synthetic login and APIs; no intercepted business data or actor mutations.
for (const user of ['admin', 'inspector', 'lector-generadores', 'generador', 'operador']) {
  test(`${user}: manifest actor links open permitted fichas and return to the exact record`, async ({ page }, info) => {
    const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
    expect(fixture.database).toBe('sitrep_night_qa_20260926');
    expect(fixture.externalDelivery).toBe(false);
    const actors = [
      { key: 'generador', path: 'generadores', label: 'Generador', name: 'QA Generador 1', icon: 'factory' },
      { key: 'transportista', path: 'transportistas', label: 'Transportista', name: 'QA Transporte 1', icon: 'truck' },
      { key: 'operador', path: 'operadores', label: 'Operador', name: 'QA Operador 1', icon: 'flask-conical' },
    ];
    const staff = ['admin', 'inspector', 'lector-generadores'].includes(user);
    const permitted = staff ? actors : actors.filter(actor => actor.key === user);
    const errors: string[] = [];
    const writes: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/api/') && response.status() >= 400) errors.push(response.status() + ' ' + new URL(response.url()).pathname);
    });
    await login(page, info, user);
    page.on('request', request => {
      if (request.url().includes('/api/actores/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
    });
    const origin = `${prefix(info)}/manifiestos/cloud-qa-report-0?qa=actor-navigation#registro`;
    await page.goto(origin);
    const links = page.getByRole('link', { name: /^Abrir ficha de / });
    await expect(links).toHaveCount(permitted.length);
    for (const actor of permitted) {
      const link = page.getByRole('link', { name: `Abrir ficha de ${actor.label.toLowerCase()}: ${actor.name}`, exact: true });
      await expect(link.locator(`svg.lucide-${actor.icon}`)).toHaveCount(1);
      await expect(link).toHaveAttribute('href', `${prefix(info)}/admin/actores/${actor.path}/${fixture.actors[actor.key]}`);
      await link.scrollIntoViewIfNeeded();
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      if (info.project.name === 'web-desktop') {
        const before = await link.boundingBox();
        await link.hover();
        await expect.poll(() => link.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
        expect(await link.boundingBox()).toEqual(before);
      }
      await link.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`${prefix(info)}/admin/actores/${actor.path}/${fixture.actors[actor.key]}$`));
      await expect(page.getByRole('heading', { name: actor.name, exact: true })).toBeVisible();
      if (actor.key !== 'generador') {
        const symbol = page.locator(`[data-map-symbol="${actor.key}"]`).first();
        await expect(symbol.locator(`svg.lucide-${actor.icon}`)).toHaveCount(1);
        await expect(symbol.locator('[data-map-symbol-background]')).toHaveCSS('background-color', actor.key === 'transportista' ? 'rgb(234, 88, 12)' : 'rgb(37, 99, 235)');
        const geometry = await symbol.evaluate(element => {
          const frame = element.querySelector('[data-map-symbol-background]')!.getBoundingClientRect();
          const icon = element.querySelector('svg')!.getBoundingClientRect();
          return { dx: Math.abs(frame.x + frame.width / 2 - icon.x - icon.width / 2), dy: Math.abs(frame.y + frame.height / 2 - icon.y - icon.height / 2) };
        });
        expect(geometry.dx).toBeLessThanOrEqual(.5); expect(geometry.dy).toBeLessThanOrEqual(.5);
      }
      if (user !== 'admin' && !(user === 'lector-generadores' && actor.key === 'generador')) {
        await expect(page.getByRole('button', { name: /^Editar|^Renovar/ })).toHaveCount(0);
        if (actor.key === 'generador') {
          await page.getByRole('tab', { name: 'DDJJ y Documentos', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Registrar DDJJ', exact: true })).toHaveCount(0);
        }
        if (!staff) {
          await page.getByRole('tab', { name: 'Inspecciones', exact: true }).click();
          await expect(page.getByRole('link', { name: 'Ver mis inspecciones', exact: true })).toBeVisible();
          await expect(page.getByRole('link', { name: /^Abrir expediente/ })).toHaveCount(0);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath(`${user}-${actor.key}-readonly.png`), animations: 'disabled' });
      await page.getByRole('button', { name: 'Volver', exact: true }).first().click();
      await expect(page).toHaveURL('http://127.0.0.1:4177' + origin);
      await expect(links).toHaveCount(permitted.length);
    }
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('ordinary actor cannot mount a foreign ficha or call its API', async ({ page }, info) => {
  await login(page, info, 'generador');
  const calls: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/actores/generadores/qa-foreign-forbidden') calls.push(request.method());
  });
  await page.goto(`${prefix(info)}/admin/actores/generadores/qa-foreign-forbidden`);
  if (info.project.name === 'app') await expect(page).toHaveURL(/\/app\/dashboard$/);
  else await expect(page.getByRole('heading', { name: 'Acceso denegado', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'QA Generador 1', exact: true })).toHaveCount(0);
  expect(calls).toEqual([]);
  await page.screenshot({ path: info.outputPath('foreign-actor-not-mounted.png'), animations: 'disabled' });
});
