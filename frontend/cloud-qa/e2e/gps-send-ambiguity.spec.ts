import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from '../safety';
import { activeGpsQueueKey, isolatedMapTiles, login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('a saved GPS point with a lost response is not reported as unsent', async ({ browser }, info) => {
  const stage = process.env.QA_GPS_AMBIGUITY_STAGE;
  expect(['before', 'after']).toContain(stage);
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  expect(fixture.synthetic).toBe(true);
  const manifest = fixture.cases[`${stage}-${info.project.name}`];
  expect(manifest.numero).toMatch(/^QA-GPS-RESPONSE-/);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [], requests: unknown[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    watchPosition() { return 1; }, getCurrentPosition() {}, clearWatch() {},
  } }));
  let first = true;
  await context.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`, async route => {
    requests.push(route.request().postDataJSON());
    if (first) {
      first = false;
      const saved = await route.fetch(); expect(saved.status()).toBe(200);
      await route.abort('failed');
    } else await route.continue();
  });
  const point = { lat: -33.1234, lng: -68.1234, speed: null, heading: null, puntoId: randomUUID() };
  const { PrismaClient } = backendRequire('@prisma/client'); const db = new PrismaClient();
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await isolatedMapTiles(page, info);
    const queueKey = await activeGpsQueueKey(page, fixture.owner, manifest.id);
    await page.evaluate(({ key, point }) => localStorage.setItem(key, JSON.stringify([point])), { key: queueKey, point });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByText('1 pendiente', { exact: true })).toBeVisible();
    if (stage === 'before') {
      await expect(page.getByText('Sin enviar', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reintentar envío GPS', exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByText('Sin confirmar', { exact: true })).toBeVisible();
      await expect(page.getByText('Sin enviar', { exact: true })).toHaveCount(0);
      const retry = page.getByRole('button', { name: 'Reintentar envío GPS', exact: true });
      await expect(retry).toBeEnabled();
      if (info.project.name === 'app') {
        expect((await retry.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      }
      await page.screenshot({ path: info.outputPath('gps-no-confirmado.png'), animations: 'disabled' });
      const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/api/manifiestos/${manifest.id}/ubicacion-idempotente`));
      await retry.click();
      const answer = await response; expect(answer.status()).toBe(200);
      expect((await answer.json()).data.idempotencia.repetido).toBe(true);
      await expect.poll(() => page.evaluate(key => localStorage.getItem(key), queueKey)).toBeNull();
      expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]);
    }
    const parent = await db.manifiesto.findUniqueOrThrow({ where: { id: manifest.id }, select: { numero: true, isDemoData: true, estado: true } });
    expect(parent).toMatchObject({ numero: manifest.numero, isDemoData: true, estado: 'EN_TRANSITO' });
    const records = await db.trackingGPS.findMany({ where: { manifiestoId: manifest.id } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ latitud: point.lat, longitud: point.lng });
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('gps-proof.json'), JSON.stringify({ synthetic: true, stage, surface: info.project.name,
      persistedPoints: records.length, requests: requests.length, responseLostAfterSave: true }));
  } finally { await context.close(); await db.$disconnect(); }
});
