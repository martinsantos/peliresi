import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('a lost response after saving an incident duplicates it on retry', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'incident-fixture.json'), 'utf8'));
  expect(fixture.synthetic).toBe(true);
  const manifest = fixture.cases[info.project.name];
  expect(manifest.numero).toMatch(/^QA-INCIDENT-RETRY-/);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition() { return 1; }, getCurrentPosition() {}, clearWatch() {},
    } });
  });
  await isolatedMapTiles(page, info);
  let lost = false;
  await page.route(`**/api/manifiestos/${manifest.id}/incidente`, async route => {
    if (!lost) {
      lost = true;
      const saved = await route.fetch();
      expect(saved.status()).toBe(200);
      await route.abort('failed');
    } else await route.continue();
  });
  const { PrismaClient } = backendRequire('@prisma/client');
  const db = new PrismaClient();
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await page.getByRole('button', { name: 'Incidente', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Reportar Incidente', exact: true });
    await dialog.getByRole('button', { name: 'Avería mecánica', exact: true }).click();
    await dialog.getByLabel('Descripción (opcional)', { exact: true }).fill('QA respuesta perdida después del guardado');
    await dialog.getByRole('button', { name: 'Registrar Incidente', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('revisá si el incidente ya aparece en el historial');
    const first = await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id, tipo: 'INCIDENTE' } });
    expect(first).toBe(1);
    const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/api/manifiestos/${manifest.id}/incidente`));
    await dialog.getByRole('button', { name: 'Registrar Incidente', exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect(dialog).not.toBeVisible();
    const second = await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id, tipo: 'INCIDENTE' } });
    expect(second).toBe(2);
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('lost-response-proof.json'), JSON.stringify({ synthetic: true, surface: info.project.name,
      manifestId: manifest.id, first, second, lostAfterServerSuccess: lost }));
  } finally { await db.$disconnect(); await context.close(); }
});
