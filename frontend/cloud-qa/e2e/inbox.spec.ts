import { createRequire } from 'node:module';
import { test, expect, devices } from '@playwright/test';
import { login, prefix } from './helpers';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const databaseUrl = process.env.DATABASE_URL!;

test('real assignment -> bell -> paginated inbox -> keyboard -> exact dossier -> persisted read', async ({ page, browser }, info) => {
  const errors: string[] = [];
  await login(page, info);
  await page.goto(prefix(info) + '/inspecciones');
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  const select = page.getByRole('combobox', { name: 'Inspector asignado', exact: true });
  await expect(select.getByRole('option', { name: 'QA inspector', exact: true })).toHaveCount(1);
  await select.selectOption((await select.getByRole('option', { name: 'QA inspector', exact: true }).getAttribute('value'))!);
  await page.getByLabel('Descripción inicial').fill('QA bandeja: aviso interno sintético, sin envíos externos');
  await page.getByLabel('Ubicación prevista').fill('QA sitio ficticio');
  await page.getByLabel('Fecha programada', { exact: true }).fill('2026-10-05T10:00');
  const save = page.waitForResponse(r => r.url().endsWith('/api/inspecciones') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  const saved = await save; expect(saved.status()).toBe(201);
  const inspection = (await saved.json()).data;
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const target = await db.$queryRawUnsafe('SELECT current_database() AS name, inet_server_port() AS port, host(inet_server_addr()) AS address');
    expect(target).toEqual([{ name: 'sitrep_night_qa_20260926', port: 55440, address: '127.0.0.1' }]);
    const recipient = await db.usuario.findUniqueOrThrow({ where: { email: 'inspector@night-qa.invalid' } });
    expect(inspection.inspectorId).toBe(recipient.id);
    const actualNotice = await db.notificacion.findFirstOrThrow({ where: { usuarioId: recipient.id, titulo: 'Inspección asignada · ' + inspection.numero } });
    expect(JSON.parse(actualNotice.datos).inspeccionId).toBe(inspection.id);
    // Older notifications are explicit synthetic pagination fixtures, not a
    // replacement for the actual domain-created assignment above.
    await db.notificacion.createMany({ data: Array.from({ length: 45 }, (_, i) => ({
      usuarioId: recipient.id, tipo: 'INFO_GENERAL', titulo: '[QA bandeja] Aviso anterior ' + info.project.name + ' ' + (i + 1),
      mensaje: 'Prueba sintética de paginación; no contactar actores.', datos: JSON.stringify({ inspeccionId: inspection.id }),
      createdAt: new Date(new Date(actualNotice.createdAt).getTime() - (i + 1) * 1000),
    })) });
    await info.attach('real-assignment', { body: JSON.stringify({ inspectionId: inspection.id, number: inspection.numero, noticeId: actualNotice.id, recipientId: recipient.id }), contentType: 'application/json' });
  } finally { await db.$disconnect(); }
  await page.close();

  const context = await browser.newContext({ ...(info.project.name === 'web-desktop' ? devices['Desktop Chrome'] : devices['Pixel 7']), viewport: info.project.name === 'web-desktop' ? { width: 1440, height: 900 } : { width: 360, height: 800 }, baseURL: 'http://127.0.0.1:4177' });
  try {
    const inspector = await context.newPage();
    inspector.on('pageerror', error => errors.push(error.message));
    inspector.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    inspector.on('response', response => { if (response.url().includes('/api/') && response.status() >= 400) errors.push(response.status() + ' ' + new URL(response.url()).pathname); });
    const authenticated = inspector.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
    await login(inspector, info, 'inspector');
    const token = (await (await authenticated).json()).data.tokens.accessToken;
    const notices = async (query: string) => {
      const response = await inspector.request.get('/api/notificaciones?' + query, { headers: { Authorization: 'Bearer ' + token } });
      expect(response.status()).toBe(200);
      return (await response.json()).data;
    };
    await inspector.getByRole('banner').getByRole('button', { name: /^Notificaciones/ }).click();
    await expect(inspector.getByText('Inspección asignada · ' + inspection.numero, { exact: true })).toBeVisible();
    const all = inspector.getByRole('button', { name: 'Ver todas las notificaciones', exact: true });
    expect((await all.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await all.click();
    await expect(inspector).toHaveURL(new RegExp(prefix(info) + '/notificaciones$'));
    const inbox = inspector.getByTestId('notification-inbox');
    await expect(inbox.getByRole('heading', { name: 'Notificaciones', exact: true })).toBeVisible();
    if (info.project.name === 'app') {
      const activeNotice = inspector.getByRole('link', { name: /Avisos/ });
      await expect(activeNotice).toHaveAttribute('aria-current', 'page');
      await expect(activeNotice).toHaveCSS('color', 'rgb(7, 84, 46)');
      await expect(activeNotice).toHaveCSS('background-color', 'rgb(230, 247, 239)');
    }
    const counts = await notices('limit=20');
    await expect(inbox.getByRole('button', { name: 'No leídas (' + counts.noLeidas + ')', exact: true })).toBeVisible();
    await expect(inbox.getByRole('list', { name: 'Avisos', exact: true }).locator(':scope > li')).toHaveCount(20);
    const primary = inbox.getByRole('button', { name: 'Abrir aviso: Inspección asignada · ' + inspection.numero, exact: true });
    await expect(primary.locator('svg.lucide-clipboard-check')).toHaveCount(1);
    if (info.project.name === 'web-desktop') {
      const before = await primary.boundingBox();
      await primary.hover();
      await expect(primary).toHaveCSS('background-color', 'rgb(230, 247, 239)');
      expect(await primary.boundingBox()).toEqual(before);
    }
    expect(await inspector.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await inspector.screenshot({ path: info.outputPath('inbox-after.png'), animations: 'disabled' });
    await inbox.getByRole('button', { name: 'Siguiente página', exact: true }).click();
    await expect(inspector).toHaveURL(/pagina=2/);
    const older = await notices('limit=20&offset=20');
    await expect(inbox.getByRole('button', { name: 'Abrir aviso: ' + older.notificaciones[0].titulo, exact: true })).toBeVisible();
    await inspector.goBack();
    await expect(inspector).not.toHaveURL(/pagina=2/);
    await expect(primary).toBeVisible();
    await primary.focus();
    // Chromium only enables :focus-visible after keyboard interaction. Move
    // through the real next control and back, rather than checking mouse focus.
    await inspector.keyboard.press('Tab');
    await inspector.keyboard.press('Shift+Tab');
    await expect(primary).toBeFocused();
    expect(await primary.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
    await inspector.keyboard.press('Enter');
    await expect(inspector).toHaveURL(new RegExp(prefix(info) + '/inspecciones/' + inspection.id + '$'));
    await expect(inspector.locator('main')).toContainText(inspection.numero);
    await expect.poll(async () => (await notices('limit=20')).notificaciones.find((n: { titulo: string }) => n.titulo === 'Inspección asignada · ' + inspection.numero)?.leida).toBe(true);
    await inspector.goto(prefix(info) + '/notificaciones');
    await expect(inbox.getByRole('button', { name: 'Abrir aviso: Inspección asignada · ' + inspection.numero, exact: true })).toBeVisible();
    const changed = await notices('limit=1');
    await expect(inspector.getByRole('banner').getByRole('button', { name: 'Notificaciones (' + changed.noLeidas + ' sin leer)', exact: true })).toBeVisible();
    await expect(inspector).toHaveTitle(/SITREP/);
    await expect(inspector.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    await info.attach('console-health', { body: JSON.stringify(errors), contentType: 'application/json' });
  } finally { await context.close(); }
});

test('cold offline inbox stays pending instead of empty and recovers on reconnect', async ({ page, context }, info) => {
  await login(page, info, 'inspector');
  // Visit once to cache the actual lazy page asset, then use a never-fetched
  // page key while offline. No business API responses are intercepted.
  await page.goto(prefix(info) + '/notificaciones');
  await expect(page.getByTestId('notification-inbox').getByRole('list', { name: 'Avisos', exact: true })).toBeVisible();
  await context.setOffline(true);
  try {
    await page.getByRole('button', { name: /^No leídas \(/ }).click();
    await expect(page.getByTestId('notification-inbox').getByRole('status')).toContainText('Cargando avisos');
    await expect(page.getByText('No hay notificaciones', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('inbox-offline.png'), animations: 'disabled' });
  } finally { await context.setOffline(false); }
  await expect(page.getByTestId('notification-inbox').getByRole('list', { name: 'Avisos', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^No leídas \(/ })).toHaveAttribute('aria-pressed', 'true');
});
