import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
test('un aviso de prueba no pierde una apertura de inspección ya guardada', async ({ page }, info) => {
  const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
  try {
    const account = await db.usuario.findUniqueOrThrow({ where: { email: 'inspector@night-qa.invalid' }, select: { id: true, email: true } });
    expect(account.email).toBe('inspector@night-qa.invalid');
    const title = `QA aviso durante borrador ${info.project.name}`;
    const notice = await db.notificacion.create({ data: { usuarioId: account.id, tipo: 'INFO_GENERAL', prioridad: 'NORMAL',
      titulo: title, mensaje: 'QA aviso artificial sin envío externo.' } });
    await login(page, info, 'inspector');
    await page.goto(`${prefix(info)}/inspecciones`);
    await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
    await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
    const value = `QA apertura antes de aviso ${info.project.name}`;
    await page.getByLabel('Descripción inicial').fill(value);
    await expect(page.getByText('Lo que completes se guarda en este dispositivo.').first()).toBeVisible();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 45_000 });
    const suffix = info.project.name === 'app' ? '/app/sw-app.js' : '/sw.js';
    const worker = page.context().serviceWorkers().find(item => item.url().endsWith(suffix));
    expect(worker).toBeTruthy();
    const target = `http://127.0.0.1:4177${prefix(info)}/notificaciones/${notice.id}`;
    // Dispatch a synthetic event, but let the registered worker use real
    // WindowClient navigation; no notification or push provider is invoked.
    const workerResult = worker!.evaluate(async raw => {
      const scope = self as any; let work: Promise<unknown> | undefined;
      const event = new Event('notificationclick');
      Object.defineProperty(event, 'notification', { value: { data: { url: raw }, close: () => {} } });
      Object.defineProperty(event, 'waitUntil', { value: (promise: Promise<unknown>) => { work = promise; } });
      scope.dispatchEvent(event);
      if (!work) throw Error('El worker no recibió el evento de prueba');
      try { await work; return 'finished'; } catch (error) { return error instanceof Error ? error.name : 'rejected'; }
    }, `http://127.0.0.1:4177/notificaciones/${notice.id}`);
    await expect(page).toHaveURL(target, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const result = await workerResult;
    await page.goto(`${prefix(info)}/inspecciones`);
    await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
    await expect(page.getByLabel('Descripción inicial')).toHaveValue(value);
    await page.screenshot({ path: info.outputPath('apertura-recuperada.png'), animations: 'disabled', scale: 'css' });
    writeFileSync(info.outputPath('proof.json'), JSON.stringify({ synthetic: true, systemClick: false, pushSent: false,
      realWindowClientNavigation: true, inspectionDraftRecovered: true, workerResult: result }), { flag: 'wx', mode: 0o600 });
  } finally { await db.$disconnect(); }
});
