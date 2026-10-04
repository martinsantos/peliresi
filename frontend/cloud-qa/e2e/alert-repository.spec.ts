import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, devices } from '@playwright/test';
import { login, prefix, readableFixedAction } from './helpers';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');

test('configured rule -> read-only simulation -> persistent case -> operator notice -> explicit resolution', async ({ page, browser }, info) => {
  test.setTimeout(120000); // Four real sessions plus configuration, pagination and persistence checks.
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
  const name = 'QA seguimiento ' + info.project.name;
  try {
    const target = await db.$queryRawUnsafe('SELECT current_database() AS name, inet_server_port() AS port, host(inet_server_addr()) AS address');
    expect(target).toEqual([{ name: 'sitrep_night_qa_20260926', port: 55440, address: '127.0.0.1' }]);
    const manifest = await db.manifiesto.create({ data: {
      numero: 'QA-ALERT-' + info.project.name, generadorId: fixture.actors.generador,
      transportistaId: fixture.actors.transportista, operadorId: fixture.actors.operador,
      creadoPorId: fixture.users.admin, estado: 'RECIBIDO', isDemoData: true, modalidad: 'FIJO',
      fechaRecepcion: new Date(Date.now() - 30 * 86400000),
      residuos: { create: [{ tipoResiduoId: fixture.wastes[0], cantidad: 10, cantidadRecibida: 10, unidad: 'kg', estado: 'SOLIDO' }] },
    } });
    await login(page, info);
    await page.goto(prefix(info) + '/alertas');
    await page.getByRole('tab', { name: /Reglas/ }).click();
    await page.getByRole('button', { name: 'Nueva Regla', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Nueva Regla', exact: true });
    await dialog.getByRole('button', { name: 'Tipo de regla', exact: true }).click();
    await page.getByRole('option', { name: 'Manifiesto pendiente de tratamiento o cierre', exact: true }).click();
    await dialog.getByLabel('Nombre', { exact: true }).fill(name);
    await dialog.getByLabel('Días desde la recepción', { exact: true }).fill('15');
    await expect(dialog.getByLabel('Regla activa', { exact: true })).not.toBeChecked();
    const before = { cases: await db.alertaGenerada.count(), notices: await db.notificacion.count() };
    const simulation = page.waitForResponse(r => r.url().endsWith('/api/alertas/seguimiento/simular') && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Simular sin enviar', exact: true }).click();
    const simulated = await simulation; expect(simulated.status()).toBe(200);
    expect((await simulated.json()).data).toMatchObject({ escribeDatos: false, canal: 'interno' });
    await expect(dialog.getByRole('status')).toContainText('Sin crear casos ni avisos');
    expect({ cases: await db.alertaGenerada.count(), notices: await db.notificacion.count() }).toEqual(before);
    await page.screenshot({ path: info.outputPath('alert-rule-simulation.png'), animations: 'disabled' });
    await readableFixedAction(dialog.getByRole('button', { name: 'Crear regla', exact: true }), dialog);
    const create = page.waitForResponse(r => r.url().endsWith('/api/alertas/reglas') && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Crear regla', exact: true }).click();
    const created = await create; expect(created.status()).toBe(201); const rule = (await created.json()).data;
    expect(rule.activa).toBe(false); expect(await db.alertaGenerada.count({ where: { reglaId: rule.id } })).toBe(0);
    await page.getByRole('button', { name: 'Editar regla: ' + name, exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Editar Regla', exact: true });
    await dialog.getByLabel('Regla activa', { exact: true }).check();
    const activate = page.waitForResponse(r => r.url().endsWith('/api/alertas/reglas/' + rule.id) && r.request().method() === 'PUT');
    await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    expect((await activate).status()).toBe(200);
    const evaluate = async (current: typeof page) => {
      const response = current.waitForResponse(r => r.url().endsWith('/api/alertas/seguimiento/evaluar') && r.request().method() === 'POST');
      await current.getByRole('button', { name: 'Evaluar seguimiento ahora', exact: true }).click();
      expect((await response).status()).toBe(200);
    };
    await evaluate(page); await evaluate(page);
    const cases = await db.alertaGenerada.findMany({ where: { reglaId: rule.id, manifiestoId: manifest.id } });
    expect(cases).toHaveLength(1); const caseId = cases[0].id;
    const notices = (await db.notificacion.findMany({ where: { manifiestoId: manifest.id } })).filter((notice: { datos: string }) => JSON.parse(notice.datos).reglaId === rule.id);
    expect(notices).toHaveLength(1); expect(notices[0].usuarioId).toBe(fixture.users.operador);
    expect(JSON.parse(notices[0].datos).casoId).toBe(caseId);
    await page.close();

    // One page at a time. Log in through the real form; no injected tokens.
    const options = { ...(info.project.name === 'web-desktop' ? devices['Desktop Chrome'] : devices['Pixel 7']), viewport: info.project.name === 'web-desktop' ? { width: 1440, height: 900 } : { width: 360, height: 800 }, baseURL: 'http://127.0.0.1:4177' };
    const operatorContext = await browser.newContext(options);
    try {
      const operator = await operatorContext.newPage(); await login(operator, info, 'operador');
      await operator.goto(prefix(info) + '/notificaciones');
      const action = operator.getByRole('button', { name: 'Abrir aviso: ' + name, exact: true }).filter({ hasText: manifest.numero });
      await expect(action).toHaveCount(1); await action.scrollIntoViewIfNeeded();
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await operator.screenshot({ path: info.outputPath('alert-operator-notice.png'), animations: 'disabled' });
      const read = operator.waitForResponse(r => r.url().endsWith('/api/notificaciones/' + notices[0].id + '/leida') && r.request().method() === 'PUT');
      await action.click(); expect((await read).status()).toBe(200);
      await expect(operator).toHaveURL(new RegExp(prefix(info) + '/manifiestos/' + manifest.id + '$'));
      expect((await db.alertaGenerada.findUniqueOrThrow({ where: { id: caseId } })).estado).toBe('PENDIENTE');
    } finally { await operatorContext.close(); }

    const adminContext = await browser.newContext(options);
    try {
      const admin = await adminContext.newPage(); await login(admin, info);
      const initialCases = admin.waitForResponse(r => r.url().includes('/api/alertas?') && r.request().method() === 'GET');
      await admin.goto(prefix(info) + '/alertas'); expect((await initialCases).status()).toBe(200);
      await expect(admin.getByRole('article').first()).toBeVisible();
      const row = admin.getByRole('article', { name: 'Caso: ' + name + ' · ' + manifest.numero, exact: true });
      for (let i = 0; i < 25 && await row.count() === 0; i++) {
        const loaded = admin.waitForResponse(r => r.url().includes('/api/alertas?') && r.request().method() === 'GET');
        await admin.getByRole('button', { name: 'Siguiente página de alertas', exact: true }).click(); expect((await loaded).status()).toBe(200);
      }
      await expect(row).toHaveCount(1); await expect(row).toContainText('Pendiente');
      await row.getByRole('button', { name: 'Gestionar caso', exact: true }).click();
      const manage = admin.getByRole('dialog', { name: 'Gestionar caso', exact: true });
      await manage.getByRole('button', { name: 'Guardar estado', exact: true }).click();
      await expect(manage.getByRole('alert')).toContainText('Registrá el motivo');
      await manage.getByRole('button', { name: 'Estado del caso', exact: true }).click();
      await admin.getByRole('option', { name: 'Resuelta', exact: true }).click();
      await manage.getByLabel('Motivo del cambio').fill('QA: evidencia revisada, caso sintético resuelto');
      await readableFixedAction(manage.getByRole('button', { name: 'Guardar estado', exact: true }), manage);
      await admin.screenshot({ path: info.outputPath('alert-case-resolution.png'), animations: 'disabled' });
      const resolution = admin.waitForResponse(r => r.url().endsWith('/api/alertas/' + caseId + '/resolver') && r.request().method() === 'PUT');
      await manage.getByRole('button', { name: 'Guardar estado', exact: true }).click(); expect((await resolution).status()).toBe(200);
      await expect(row).toContainText('Resuelta');
      await expect(row).toContainText('QA: evidencia revisada, caso sintético resuelto');
      await admin.screenshot({ path: info.outputPath('alert-resolved-case.png'), animations: 'disabled' });
      const snapshot = await db.alertaGenerada.findUniqueOrThrow({ where: { id: caseId } });
      expect(snapshot).toMatchObject({ estado: 'RESUELTA', resueltaPor: fixture.users.admin, notas: 'QA: evidencia revisada, caso sintético resuelto' });
      await evaluate(admin);
      expect((await db.alertaGenerada.findUniqueOrThrow({ where: { id: caseId } })).estado).toBe('RESUELTA');
      expect(await db.notificacion.count({ where: { id: notices[0].id } })).toBe(1);
      // Deactivate via the UI so later journeys are not affected by this synthetic rule.
      await admin.getByRole('tab', { name: /Reglas/ }).click();
      await admin.getByRole('button', { name: 'Editar regla: ' + name, exact: true }).click();
      const edit = admin.getByRole('dialog', { name: 'Editar Regla', exact: true }); await edit.getByLabel('Regla activa', { exact: true }).uncheck();
      const deactivate = admin.waitForResponse(r => r.url().endsWith('/api/alertas/reglas/' + rule.id) && r.request().method() === 'PUT');
      await edit.getByRole('button', { name: 'Guardar cambios', exact: true }).click(); expect((await deactivate).status()).toBe(200);
      expect(await admin.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    } finally { await adminContext.close(); }
  } finally { await db.$disconnect(); }
});
