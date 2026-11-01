import { test, expect, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
const fixture = () => JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'incident-fixture.json'), 'utf8'));
async function open(browser: Browser, info: TestInfo, label: string) {
  const data = fixture(); expect(data.synthetic).toBe(true);
  const manifest = data.cases[`${label}-${info.project.name}`]; expect(manifest.numero).toMatch(/^QA-INCIDENT-FINAL-/);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition() { return 1; }, getCurrentPosition() {}, clearWatch() {},
    } });
  });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'transportista');
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  await isolatedMapTiles(page, info);
  return { context, page, errors, data, manifest };
}
async function proof(info: TestInfo, manifestId: string, expectedDescription: string) {
  const { PrismaClient } = backendRequire('@prisma/client'); const db = new PrismaClient();
  try {
    const row = await db.manifiesto.findUniqueOrThrow({ where: { id: manifestId }, select: { numero: true, isDemoData: true } });
    expect(row.isDemoData).toBe(true); expect(row.numero).toMatch(/^QA-INCIDENT-FINAL-/);
    const events = await db.eventoManifiesto.findMany({ where: { manifiestoId: manifestId, tipo: 'INCIDENTE' } });
    expect(events).toHaveLength(1); expect(events[0].descripcion).toContain(expectedDescription); expect(events[0].isDemoData).toBe(true);
    const notices = await db.notificacion.count({ where: { manifiestoId: manifestId, tipo: 'INCIDENTE_REPORTADO', usuarioId: fixture().users.operator } });
    expect(notices).toBe(1);
    writeFileSync(info.outputPath('proof.json'), JSON.stringify({ synthetic: true, surface: info.project.name, manifestId, events: events.length, operatorNotices: notices }));
  } finally { await db.$disconnect(); }
}
function loseFirstResponse(context: BrowserContext, manifestId: string) {
  const requests: unknown[] = [], receipts: any[] = [];
  let first = true;
  const setup = context.route(`**/api/manifiestos/${manifestId}/incidente-idempotente`, async route => {
    requests.push(route.request().postDataJSON());
    if (first) {
      first = false; const saved = await route.fetch(); expect(saved.status()).toBe(200);
      receipts.push(await saved.json()); await route.abort('failed');
    } else await route.continue();
  });
  return { setup, requests, receipts };
}
async function confirmSaved(page: Page, info: TestInfo, manifestId: string, requests: unknown[], receipts: any[]) {
  const notice = page.getByText('El incidente puede estar registrado.', { exact: true });
  await expect(notice).toBeVisible();
  const button = page.getByRole('button', { name: 'Comprobar envío', exact: true });
  await expect(button).toBeEnabled();
  if (info.project.name === 'app') {
    const box = await button.boundingBox(); expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: info.outputPath('pending.png'), animations: 'disabled' });
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/api/manifiestos/${manifestId}/incidente-idempotente`));
  await button.click(); const answer = await response; expect(answer.status()).toBe(200);
  const result = await answer.json(); expect(result.data.idempotencia.repetido).toBe(true);
  expect(result.data.evento.id).toBe(receipts[0].data.evento.id);
  expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]);
  await expect(notice).not.toBeVisible();
}

for (const entry of ['trip', 'detail'] as const) {
  test(`${entry}: a lost saved response survives reload and confirms without a duplicate`, async ({ browser }, info) => {
    const { context, page, errors, manifest } = await open(browser, info, entry);
    const intercept = loseFirstResponse(context, manifest.id); await intercept.setup;
    try {
      if (entry === 'trip') {
        await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
        await page.getByRole('button', { name: 'Incidente', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Reportar Incidente', exact: true });
        await dialog.getByRole('button', { name: 'Avería mecánica', exact: true }).click();
        await dialog.getByLabel('Descripción (opcional)', { exact: true }).fill('QA respuesta perdida');
        await dialog.getByRole('button', { name: 'Registrar Incidente', exact: true }).click();
        await expect(dialog.getByText('El incidente puede estar registrado.', { exact: true })).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Registrar Incidente', exact: true })).toBeDisabled();
        await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
      } else {
        await page.goto(`${prefix(info)}/manifiestos/${manifest.id}`);
        await page.getByRole('button', { name: 'Registrar Incidente', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Registrar Incidente', exact: true });
        await dialog.getByRole('button', { name: 'Tipo de incidente *', exact: true }).click();
        await page.getByRole('option', { name: 'Avería mecánica', exact: true }).click();
        await dialog.getByLabel('Descripción', { exact: true }).fill('QA respuesta perdida');
        await dialog.getByRole('button', { name: 'Registrar Incidente', exact: true }).click();
        await expect(dialog.getByText('El incidente puede estar registrado.', { exact: true })).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Registrar Incidente', exact: true })).toBeDisabled();
        await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      }
      await page.reload(); await confirmSaved(page, info, manifest.id, intercept.requests, intercept.receipts);
      expect(errors).toEqual([]); await proof(info, manifest.id, 'QA respuesta perdida');
    } finally { await context.close(); }
  });
}

test('a lost pause response is confirmed after reload and restores the pause state', async ({ browser }, info) => {
  const { context, page, errors, manifest } = await open(browser, info, 'pause');
  const intercept = loseFirstResponse(context, manifest.id); await intercept.setup;
  try {
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(page.getByText('La pausa puede estar registrada.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Incidente', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Confirmar entrega', exact: true })).toBeEnabled();
    await page.reload();
    const notice = page.getByText('La pausa puede estar registrada.', { exact: true }); await expect(notice).toBeVisible();
    const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/api/manifiestos/${manifest.id}/incidente-idempotente`));
    await page.getByRole('button', { name: 'Comprobar envío', exact: true }).click();
    const answer = await response; expect(answer.status()).toBe(200); expect((await answer.json()).data.idempotencia.repetido).toBe(true);
    expect(intercept.requests[1]).toEqual(intercept.requests[0]);
    await expect(notice).not.toBeVisible(); await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeEnabled();
    expect(errors).toEqual([]); await proof(info, manifest.id, 'PAUSA');
  } finally { await context.close(); }
});

test('a second tab cannot submit while the first response is uncertain', async ({ browser }, info) => {
  const { context, page, errors, manifest } = await open(browser, info, 'tabs');
  let release!: () => void, saved!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; }), committed = new Promise<void>(resolve => { saved = resolve; });
  const requests: unknown[] = []; let first = true;
  await context.route(`**/api/manifiestos/${manifest.id}/incidente-idempotente`, async route => {
    requests.push(route.request().postDataJSON());
    if (first) { first = false; const result = await route.fetch(); expect(result.status()).toBe(200); saved(); await hold; await route.abort('failed'); }
    else await route.continue();
  });
  try {
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await page.getByRole('button', { name: 'Incidente', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Reportar Incidente', exact: true });
    await dialog.getByRole('button', { name: 'Avería mecánica', exact: true }).click();
    await dialog.getByLabel('Descripción (opcional)', { exact: true }).fill('QA dos ventanas');
    await dialog.getByRole('button', { name: 'Registrar Incidente', exact: true }).click(); await committed;
    const other = await context.newPage(); other.on('pageerror', error => errors.push(error.message));
    if (info.project.name === 'app') await other.setViewportSize({ width: 320, height: 800 });
    await other.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(other.getByText('El incidente puede estar registrado.', { exact: true })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Incidente', exact: true })).toBeDisabled();
    await other.getByRole('button', { name: 'Comprobar envío', exact: true }).click();
    await expect(other.getByRole('alert').filter({ hasText: 'Otra ventana' })).toBeVisible(); expect(requests).toHaveLength(1);
    release(); await expect(dialog.getByText('El incidente puede estar registrado.', { exact: true })).toBeVisible();
    const response = other.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/api/manifiestos/${manifest.id}/incidente-idempotente`));
    await other.getByRole('button', { name: 'Comprobar envío', exact: true }).click();
    expect((await (await response).json()).data.idempotencia.repetido).toBe(true);
    expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]);
    expect(errors).toEqual([]); await proof(info, manifest.id, 'QA dos ventanas');
  } finally { release(); await context.close(); }
});
