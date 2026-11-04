import { expect, test, type Page, type TestInfo, type Worker } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
const { PrismaClient } = backendRequire('@prisma/client');

async function activeWorker(page: Page, info: TestInfo): Promise<Worker> {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 45_000 });
  const suffix = info.project.name === 'app' ? '/app/sw-app.js' : '/sw.js';
  await expect.poll(() => page.context().serviceWorkers().filter(item => item.url().endsWith(suffix)).length,
    { timeout: 45_000 }).toBeGreaterThan(0);
  return page.context().serviceWorkers().find(item => item.url().endsWith(suffix))!;
}

/** Exercise the actual registered worker handler without a push or OS notification. */
async function simulateDeviceClick(worker: Worker, rawUrl: string, app: boolean) {
  return worker.evaluate(async ({ raw, appScope }) => {
    const scope = self as any, clientsObject = scope.clients;
    const previousMatch = Object.getOwnPropertyDescriptor(clientsObject, 'matchAll');
    const previousOpen = Object.getOwnPropertyDescriptor(clientsObject, 'openWindow');
    const actions: string[] = [];
    let finish: ((value: any) => void) | undefined;
    let destination = '', work: Promise<unknown> | undefined, settled = false;
    const fakeClient = { url: scope.location.origin + (appScope ? '/app/dashboard' : '/dashboard'),
      navigate: (url: string) => { destination = url; actions.push('navigate'); return new Promise(resolve => { finish = resolve; }); },
      focus: async () => { actions.push('focus'); } };
    Object.defineProperty(clientsObject, 'matchAll', { configurable: true, value: async () => [fakeClient] });
    Object.defineProperty(clientsObject, 'openWindow', { configurable: true, value: async () => { actions.push('openWindow'); } });
    try {
      const event = new Event('notificationclick');
      Object.defineProperty(event, 'notification', { value: { data: { url: raw }, close: () => actions.push('close') } });
      Object.defineProperty(event, 'waitUntil', { value: (promise: Promise<unknown>) => { work = promise; void promise.then(() => { settled = true; }); } });
      scope.dispatchEvent(event);
      for (let i = 0; i < 100 && !finish; i++) await new Promise(resolve => setTimeout(resolve, 10));
      if (!finish || !work) throw Error('El worker no recibió la navegación simulada');
      await new Promise(resolve => setTimeout(resolve, 20));
      const waited = !settled && !actions.includes('focus');
      finish(fakeClient);
      await work;
      return { destination, waited, actions };
    } finally {
      if (previousMatch) Object.defineProperty(clientsObject, 'matchAll', previousMatch); else delete clientsObject.matchAll;
      if (previousOpen) Object.defineProperty(clientsObject, 'openWindow', previousOpen); else delete clientsObject.openWindow;
    }
  }, { raw: rawUrl, appScope: app });
}

for (const signedIn of [true, false]) test(`aviso simulado conserva destino ${signedIn ? 'con sesión' : 'tras ingresar'}`, async ({ page }, info) => {
  const db = new PrismaClient();
  const pageErrors: string[] = [], consoleErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text().replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT omitido]')); });
  try {
    const account = await db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, select: { id: true, email: true } });
    expect(account.email).toBe('generador@night-qa.invalid');
    const title = `QA aviso de dispositivo ${info.project.name} ${signedIn ? 'sesión' : 'ingreso'}`;
    const notice = await db.notificacion.create({ data: { usuarioId: account.id, tipo: 'INFO_GENERAL',
      prioridad: 'NORMAL', titulo: title, mensaje: 'QA aviso artificial; no se envió una notificación al dispositivo.' } });
    if (signedIn) await login(page, info, 'generador');
    else {
      await isolatedMapTiles(page, info);
      await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.11.87.${info.project.name === 'app' ? 3 : info.project.name === 'web-responsive' ? 2 : 1}`, url: 'http://127.0.0.1:4177' }]);
      await page.addInitScript(() => localStorage.setItem('sitrep_onboarding_GENERADOR', 'true'));
      await page.goto(prefix(info) + '/login');
    }
    const serviceWorker = await activeWorker(page, info);
    const raw = `http://127.0.0.1:4177/notificaciones/${notice.id}?origen=aviso#detalle`;
    const result = await simulateDeviceClick(serviceWorker, raw, info.project.name === 'app');
    const target = `http://127.0.0.1:4177${prefix(info)}/notificaciones/${notice.id}?origen=aviso#detalle`;
    expect(result).toEqual({ destination: target, waited: true, actions: ['close', 'navigate', 'focus'] });
    await page.goto(target);
    if (!signedIn) {
      await expect(page).toHaveURL(/\/login$/);
      await page.reload();
      await page.getByLabel('Correo electrónico o CUIT').fill('generador@night-qa.invalid');
      await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
      const response = page.waitForResponse(item => item.url().endsWith('/api/auth/login') && item.request().method() === 'POST');
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
      expect((await response).status()).toBe(200);
    }
    await expect(page).toHaveURL(target);
    await expect(page).toHaveTitle(/SITREP/i);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(pageErrors).toEqual([]);
    await page.screenshot({ path: info.outputPath('aviso-sintetico.png'), animations: 'disabled', scale: 'css' });
    writeFileSync(info.outputPath('proof.json'), JSON.stringify({ synthetic: true, pushSent: false, systemClick: false,
      workerHandlerSimulated: true, navigationAwaited: result.waited, signedIn, destinationOpenedAfterSimulation: true, consoleErrors }), { flag: 'wx', mode: 0o600 });
  } finally { await db.$disconnect(); }
});

test('el manual distingue la campana de los avisos opcionales del dispositivo', async ({ page }, info) => {
  await login(page, info, 'generador');
  await page.goto('/manual/directorio.html');
  const section = page.getByRole('button', { name: 'CU-S09: Enviar Notificaciones Push', exact: true });
  await section.scrollIntoViewIfNeeded();
  if (await section.getAttribute('aria-expanded') === 'true') {
    await section.click(); await expect(section).toHaveAttribute('aria-expanded', 'false');
  }
  await section.click();
  await expect(section).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/La campana y la bandeja de Avisos muestran/)).toBeVisible();
  await expect(page.getByText(/Durante los ensayos de preview están apagadas/)).toBeVisible();
  await expect(page.getByText(/Si no se abre o falta conexión/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('manual-notificaciones.png'), animations: 'disabled', scale: 'css' });
  const parties = page.getByRole('button', { name: 'CU-S02: Enviar Notificaciones Automaticas', exact: true });
  await parties.scrollIntoViewIfNeeded();
  if (await parties.getAttribute('aria-expanded') === 'false') await parties.click();
  await expect(parties).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/propuestas y decisiones de aprobación generan avisos para las partes vinculadas/)).toBeVisible();
  await expect(page.getByText(/una lectura no reemplaza la aprobación/)).toBeVisible();
});
