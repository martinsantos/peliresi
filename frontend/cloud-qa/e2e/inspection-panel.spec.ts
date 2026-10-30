import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { login, prefix } from './helpers';

const fixturePath = path.join(process.env.QA_ARTIFACTS!, 'inspection-panel-fixture.json');

test('staff sees the complete actor history, accurate totals and returns to the same page', async ({ page }, info) => {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  expect(fixture).toMatchObject({ synthetic: true, externalDelivery: false, capClosed: true, database: 'sitrep_night_qa_20260926' });
  await login(page, info, 'admin');
  const actorPath = `${prefix(info)}/admin/actores/generadores/${fixture.actors.generador2}`;
  await page.goto(actorPath + '?tab=inspecciones');
  await expect(page.getByText('Historial asociado')).toBeVisible();
  await expect(page.getByText('Total', { exact: true }).locator('..')).toContainText(String(fixture.total));
  await expect(page.getByText('Abiertas', { exact: true }).locator('..')).toContainText(String(fixture.open));
  await expect(page.getByText('Cerradas', { exact: true }).locator('..')).toContainText(String(fixture.closed));
  const pages = Math.ceil(fixture.total / 20);
  const seen = new Set<string>();
  for (let index = 1; index <= pages; index++) {
    await expect(page.getByText(`Página ${index} de ${pages}`, { exact: true })).toBeVisible();
    for (const link of await page.getByRole('link', { name: /^Abrir expediente / }).all()) seen.add((await link.getAttribute('href'))!);
    if (index < pages) await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  }
  expect(seen.size).toBe(fixture.total);
  await page.reload();
  await expect(page.getByText(`Página ${pages} de ${pages}`, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  if (info.project.name === 'web-desktop') {
    for (const width of [320, 393, 768, 1365, 1920]) {
      await page.setViewportSize({ width, height: 850 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `overflow at ${width}px`).toBeLessThanOrEqual(1);
      const previous = page.getByRole('button', { name: 'Anterior', exact: true });
      await previous.scrollIntoViewIfNeeded();
      expect((await previous.boundingBox())!.height, `touch target at ${width}px`).toBeGreaterThanOrEqual(44);
      const pagination = page.getByRole('navigation', { name: 'Páginas del historial de inspecciones' });
      const previousBox = (await previous.boundingBox())!;
      const nextBox = (await pagination.getByRole('button', { name: 'Siguiente' }).boundingBox())!;
      const pageBox = (await pagination.getByText(`Página ${pages} de ${pages}`).boundingBox())!;
      expect(Math.abs(previousBox.y + previousBox.height / 2 - nextBox.y - nextBox.height / 2), `aligned controls at ${width}px`).toBeLessThanOrEqual(1);
      expect(Math.abs(previousBox.y + previousBox.height / 2 - pageBox.y - pageBox.height / 2), `aligned page number at ${width}px`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath(`staff-history-${width}px.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 1365, height: 850 });
  }
  await page.screenshot({ path: info.outputPath('staff-history-last-page.png'), animations: 'disabled', fullPage: true });
  await page.getByRole('link', { name: /^Abrir expediente / }).first().click();
  await page.getByRole('button', { name: 'Volver a Ficha del actor', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`tab=inspecciones&inspeccionesPagina=${pages}$`));
  await expect(page.getByText(`Página ${pages} de ${pages}`, { exact: true })).toBeVisible();
});

for (const [user, plural] of [['generador', 'generadores'], ['transportista', 'transportistas'], ['operador', 'operadores']]) {
  test(`${user}: actor has no staff inspection tab or list API`, async ({ page }, info) => {
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
    await login(page, info, user);
    const calls: string[] = [];
    page.on('request', req => { if (new URL(req.url()).pathname === '/api/inspecciones') calls.push(req.method()); });
    await page.goto(`${prefix(info)}/admin/actores/${plural}/${fixture.actors[user]}?tab=inspecciones`);
    await expect(page.getByRole('tab', { name: 'Inspecciones', exact: true })).toHaveCount(0);
    await expect(page.getByText('Historial asociado', { exact: true })).toHaveCount(0);
    expect(calls).toEqual([]);
    const status = await page.evaluate(async () => {
      const token = localStorage.getItem('sitrep_access_token');
      if (!token) throw new Error('Synthetic login did not establish a session');
      return (await fetch('/api/inspecciones', { headers: { Authorization: `Bearer ${token}` } })).status;
    });
    expect(status).toBe(403);
  });
}
