import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
test('the relay observation identifies its leg in the inbox and reaches the manifest', async ({ page, browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'corridor-relay-private.json'), 'utf8'));
  const item = fixture.cases[info.project.name], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 500) errors.push(`API ${response.status()}`); });
  await login(page, info);
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(prefix(info) + '/notificaciones');
  const list = page.getByRole('list', { name: 'Avisos', exact: true });
  const current = list.locator('li').filter({ hasText: item.numero }).filter({ hasText: 'tramo de relevo 1' });
  await expect(current).toHaveCount(1);
  for (const text of ['GPS: corredor para revisar', 'Hora de captura no disponible', 'No se compara una ruta vial autorizada']) {
    await expect(current).toContainText(text);
  }
  await current.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('relevo-avisos.png'), animations: 'disabled', scale: 'css' });
  await page.getByRole('button', { name: /^Notificaciones/ }).click();
  const bell = page.getByRole('region', { name: 'Notificaciones recientes', exact: true });
  const message = bell.getByText(/Tres posiciones recibidas del tramo de relevo 1/).filter({ hasText: item.numero });
  await expect(message).toHaveCount(1);
  const geometry = await message.evaluate(element => ({ height: element.clientHeight, content: element.scrollHeight }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.height + 1);
  await page.getByRole('button', { name: 'Cerrar notificaciones' }).click();
  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: page.viewportSize(), serviceWorkers: 'block' });
  try {
    const generator = await other.newPage();
    await login(generator, info, 'generador');
    await generator.goto(prefix(info) + '/notificaciones');
    const configured = generator.getByRole('list', { name: 'Avisos', exact: true }).locator('li').filter({ hasText: item.ruleName });
    await expect(configured).toContainText('tramo de relevo 1');
    await configured.getByRole('button', { name: `Abrir aviso: ${item.ruleName}`, exact: true }).click();
    await expect(generator).toHaveURL(new RegExp(`/manifiestos/${item.id}(?:[?#].*)?$`));
  } finally { await other.close(); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
  writeFileSync(info.outputPath('relay-browser-proof.json'), JSON.stringify({ surface: info.project.name,
    synthetic: true, noticeIdentifiesLeg: true, bellUnclipped: true, configuredNoticeOpensManifest: true, errors }, null, 2));
});
