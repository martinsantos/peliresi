import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, devices, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from './helpers';
const backendRequire = createRequire(new URL('../../../backend/package.json', import.meta.url));
const { PrismaClient } = backendRequire('@prisma/client');
const { buildInspectionExchangeDigests } = backendRequire('./dist/services/inspectionExchange.service.js');

async function request(page: Page, route: string, method = 'GET', data?: object) {
  const token = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
  return page.request.fetch('http://127.0.0.1:4177/api' + route, { method, data, headers: { Authorization: 'Bearer ' + token } });
}
async function createRule(page: Page, info: TestInfo, kind: string, name: string) {
  await page.goto(prefix(info) + '/alertas'); await page.getByRole('tab', { name: /Reglas/ }).click();
  await page.getByRole('button', { name: 'Nueva Regla', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva Regla', exact: true });
  await dialog.getByRole('button', { name: 'Tipo de regla', exact: true }).click();
  await page.getByRole('option', { name: kind, exact: true }).click();
  await dialog.getByLabel('Nombre', { exact: true }).fill(name);
  await expect(dialog.getByLabel('Regla activa', { exact: true })).not.toBeChecked();
  expect(await dialog.getByRole('checkbox').evaluateAll(inputs => [...new Set(inputs.map(input => getComputedStyle(input).accentColor))])).toEqual(['rgb(11, 120, 68)']);
  const simulate = page.waitForResponse(r => r.url().endsWith('/api/alertas/catalogo/simular'));
  await dialog.getByRole('button', { name: 'Simular sin enviar', exact: true }).click();
  const preview = await simulate; expect(preview.status()).toBe(200);
  const previewData = (await preview.json()).data;
  expect(previewData).toMatchObject({ escribeDatos: false, canal: 'interno' });
  await expect(dialog.getByText(/objetos coinciden con la condición/)).toBeVisible();
  for (const item of previewData.ejemplos) {
    expect(await dialog.textContent()).toContain(new Date(item.vencimiento).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza', hour12: false }) + ' (Mendoza)');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('catalogue-preview.png'), animations: 'disabled' });
  await dialog.getByLabel('Regla activa', { exact: true }).check();
  const created = page.waitForResponse(r => r.url().endsWith('/api/alertas/reglas') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Crear regla', exact: true }).click();
  const response = await created; expect(response.status()).toBe(201); return (await response.json()).data;
}
function observe(page: Page, errors: string[]) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
}

test('inspection deadline -> configured case -> exact actor/inspector notice -> linked response reconciles only its request', async ({ page, browser }, info) => {
  test.setTimeout(150000); const errors: string[] = []; observe(page, errors);
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
  let ruleId: string | undefined;
  try {
    expect(await db.$queryRawUnsafe('SELECT current_database() AS name, inet_server_port() AS port, host(inet_server_addr()) AS address')).toEqual([{ name: 'sitrep_night_qa_20260926', port: 55440, address: '127.0.0.1' }]);
    const inspection = await db.inspeccion.create({ data: { numero: 'GRP-QA-CATALOGUE-' + info.project.name, inspectorId: fixture.users.inspector, tipoActor: 'GENERADOR', generadorId: fixture.actors.generador, estado: 'NOTIFICADA', version: 3,
      plazoRespuestaAt: new Date(Date.now() - 86400000) } });
    // Historical synthetic requirements, created once with the actual digest function.
    // No edits of existing signed exchanges or production sequences.
    const rows = []; let previousHash: string | null = null;
    for (let sequence = 1; sequence <= 2; sequence++) {
      const input = { inspeccionId: inspection.id, secuencia: sequence, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', destinatario: 'INSPECCIONADO',
        asunto: 'QA pedido ' + sequence, cuerpo: 'QA presentar constancia sintética vinculada a este pedido.', plazoRespuestaAt: new Date(Date.now() - sequence * 86400000),
        canal: 'PORTAL_SITREP', versionExpediente: sequence + 1, autorId: fixture.users.admin, createdAt: new Date(Date.now() - 5 * 86400000), adjuntos: [] };
      const digests = buildInspectionExchangeDigests(input, previousHash);
      const { adjuntos, ...fields } = input;
      const row = await db.intercambioInspeccion.create({ data: { ...fields, ...digests, hashAnterior: previousHash, puestaDisposicionAt: input.createdAt } });
      rows.push(row); previousHash = row.hashCadena;
    }
    await login(page, info);
    const before = { cases: await db.alertaGenerada.count(), notices: await db.notificacion.count() };
    const name = 'QA requerimientos ' + info.project.name;
    const rule = await createRule(page, info, 'Inspección · requerimiento sin respuesta', name); ruleId = rule.id;
    expect(await db.alertaGenerada.count()).toBe(before.cases); expect(await db.notificacion.count()).toBe(before.notices);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = page.waitForResponse(r => r.url().endsWith('/api/alertas/catalogo/evaluar'));
      await page.getByRole('button', { name: 'Evaluar inspecciones y vencimientos', exact: true }).click(); expect((await response).status()).toBe(200);
    }
    // Evaluations intentionally consider ALL pending sources. Earlier surface
    // journeys retain their history; assert the two sources of this inspection.
    const sourceToken = JSON.stringify({ inspeccionId: inspection.id }).slice(1, -1);
    const caseWhere = { reglaId: rule.id, datos: { contains: sourceToken } };
    const noticeWhere = { AND: [{ datos: { contains: JSON.stringify({ reglaId: rule.id }).slice(1, -1) } }, { datos: { contains: sourceToken } }] };
    const cases = await db.alertaGenerada.findMany({ where: caseWhere }); expect(cases).toHaveLength(2);
    const notices = await db.notificacion.findMany({ where: noticeWhere });
    expect(notices).toHaveLength(4); expect(new Set(notices.map((n: any) => n.usuarioId))).toEqual(new Set([fixture.users.generador, fixture.users.inspector]));
    const options = { ...(info.project.name === 'web-desktop' ? devices['Desktop Chrome'] : devices['Pixel 7']), viewport: info.project.name === 'web-desktop' ? { width: 1440, height: 900 } : { width: 360, height: 800 }, baseURL: 'http://127.0.0.1:4177' };
    const actorContext = await browser.newContext(options);
    try {
      const actor = await actorContext.newPage(); observe(actor, errors); await login(actor, info, 'generador');
      await actor.goto(prefix(info) + '/notificaciones');
      await actor.getByRole('button', { name: 'Abrir aviso: ' + name, exact: true }).first().click();
      await expect(actor).toHaveURL(new RegExp('/mis-inspecciones/' + inspection.id));
      await expect(actor.getByRole('heading', { name: 'Presentaciones y respuestas', exact: true })).toBeVisible();
      await actor.getByRole('button', { name: 'Responder esta actuación', exact: true }).first().click();
      await actor.getByRole('textbox', { name: 'Contenido', exact: true }).fill('QA respuesta tardía real: constancia sintética para el requerimiento seleccionado.');
      const submitted = actor.waitForResponse(r => r.url().endsWith(`/inspecciones/${inspection.id}/intercambios`) && r.request().method() === 'POST');
      await actor.getByRole('button', { name: 'Presentar en expediente', exact: true }).click(); expect((await submitted).status()).toBe(201);
      await actor.screenshot({ path: info.outputPath('catalogue-linked-response.png'), animations: 'disabled' });
    } finally { await actorContext.close(); }
    const evaluation = await request(page, '/alertas/catalogo/evaluar', 'POST'); expect(evaluation.status()).toBe(200);
    const after = await db.alertaGenerada.findMany({ where: caseWhere });
    expect(after.filter((item: any) => item.estado === 'RESUELTA')).toHaveLength(1);
    expect(after.filter((item: any) => item.estado === 'PENDIENTE')).toHaveLength(1);
    expect((await db.inspeccion.findUniqueOrThrow({ where: { id: inspection.id } })).estado).toBe('EN_DESCARGO');
    expect(await db.notificacion.count({ where: noticeWhere })).toBe(4);
    const inspectorContext = await browser.newContext(options);
    try {
      const inspector = await inspectorContext.newPage(); observe(inspector, errors); await login(inspector, info, 'inspector');
      await inspector.goto(prefix(info) + '/notificaciones'); await inspector.getByRole('button', { name: 'Abrir aviso: ' + name, exact: true }).first().click();
      await expect(inspector).toHaveURL(new RegExp('/inspecciones/' + inspection.id));
      await expect(inspector.getByRole('heading', { name: inspection.numero, exact: true })).toBeVisible();
      await inspector.screenshot({ path: info.outputPath('catalogue-inspector-origin.png'), animations: 'disabled' });
    } finally { await inspectorContext.close(); }
    expect(errors).toEqual([]);
  } finally {
    if (ruleId) await db.reglaAlerta.update({ where: { id: ruleId }, data: { activa: false } });
    await db.$disconnect();
  }
});

test('expiry includes operator and two vehicle owners, concurrent retries deduplicate and renewal preserves history', async ({ page, browser }, info) => {
  test.setTimeout(120000); const errors: string[] = []; observe(page, errors);
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
  let ruleId: string | undefined; const restore: Array<() => Promise<unknown>> = [];
  try {
    expect(await db.$queryRawUnsafe('SELECT current_database() AS name, inet_server_port() AS port, host(inet_server_addr()) AS address')).toEqual([{ name: 'sitrep_night_qa_20260926', port: 55440, address: '127.0.0.1' }]);
    const operator = await db.operador.findUniqueOrThrow({ where: { id: fixture.actors.operador } });
    restore.push(() => db.operador.update({ where: { id: operator.id }, data: { vencimientoHabilitacion: operator.vencimientoHabilitacion } }));
    await db.operador.update({ where: { id: operator.id }, data: { vencimientoHabilitacion: new Date(Date.now() - 86400000) } });
    const vehicles = [];
    for (const actor of [fixture.actors.transportista, fixture.actors.transportista2]) {
      const vehicle = await db.vehiculo.findFirstOrThrow({ where: { transportistaId: actor, activo: true } }); vehicles.push(vehicle);
      restore.push(() => db.vehiculo.update({ where: { id: vehicle.id }, data: { vencimiento: vehicle.vencimiento } }));
      await db.vehiculo.update({ where: { id: vehicle.id }, data: { vencimiento: new Date(Date.now() - 2 * 86400000) } });
    }
    await login(page, info); const name = 'QA vigencia ' + info.project.name;
    const rule = await createRule(page, info, 'Habilitaciones y licencias · vigencia', name); ruleId = rule.id;
    const responses = await Promise.all([request(page, '/alertas/catalogo/evaluar', 'POST'), request(page, '/alertas/catalogo/evaluar', 'POST')]);
    expect(responses.map(r => r.status())).toEqual([200, 200]);
    const cases = await db.alertaGenerada.findMany({ where: { reglaId: rule.id } });
    const operatorCase = cases.find((item: any) => JSON.parse(item.datos).entidad === 'OPERADOR' && JSON.parse(item.datos).entidadId === operator.id); expect(operatorCase).toBeTruthy();
    for (let i = 0; i < vehicles.length; i++) {
      const item = cases.filter((item: any) => JSON.parse(item.datos).entidadId === vehicles[i].id && JSON.parse(item.datos).entidad === 'VEHICULO'); expect(item).toHaveLength(1);
      const notices = await db.notificacion.findMany({ where: { datos: { contains: JSON.stringify({ casoId: item[0].id }).slice(1, -1) } } });
      expect(notices).toHaveLength(1); expect(notices[0].usuarioId).toBe(fixture.users[i === 0 ? 'transportista' : 'transportista2']);
      const owner = await db.transportista.findUniqueOrThrow({ where: { id: vehicles[i].transportistaId } });
      const ownerContext = await browser.newContext({ ...(info.project.name === 'web-desktop' ? devices['Desktop Chrome'] : devices['Pixel 7']), viewport: info.project.name === 'web-desktop' ? { width: 1440, height: 900 } : { width: 360, height: 800 }, baseURL: 'http://127.0.0.1:4177' });
      try {
        const ownVehicle = await ownerContext.newPage(); observe(ownVehicle, errors);
        await login(ownVehicle, info, i === 0 ? 'transportista' : 'transportista2');
        await ownVehicle.goto(prefix(info) + '/notificaciones');
        await ownVehicle.getByRole('button', { name: 'Abrir aviso: ' + name, exact: true }).first().click();
        await expect(ownVehicle).toHaveURL(new RegExp('/admin/actores/transportistas/' + owner.id));
        await expect(ownVehicle.getByRole('heading', { name: owner.razonSocial, exact: true })).toBeVisible();
        await ownVehicle.getByRole('tab', { name: 'Flota y Conductores', exact: true }).click();
        await expect(ownVehicle.getByText(vehicles[i].patente, { exact: true })).toBeVisible();
        await ownVehicle.screenshot({ path: info.outputPath(`catalogue-vehicle-owner-${i}.png`), animations: 'disabled' });
      } finally { await ownerContext.close(); }
    }
    const context = await browser.newContext({ ...(info.project.name === 'web-desktop' ? devices['Desktop Chrome'] : devices['Pixel 7']), viewport: info.project.name === 'web-desktop' ? { width: 1440, height: 900 } : { width: 360, height: 800 }, baseURL: 'http://127.0.0.1:4177' });
    try {
      const own = await context.newPage(); observe(own, errors); await login(own, info, 'operador'); await own.goto(prefix(info) + '/notificaciones');
      await own.getByRole('button', { name: 'Abrir aviso: ' + name, exact: true }).first().click(); await expect(own).toHaveURL(/\/mi-perfil$/);
      await expect(own.getByRole('heading', { name: 'Mi Perfil', level: 2, exact: true })).toBeVisible();
      await expect(own.getByText(operator.razonSocial, { exact: true })).toBeVisible();
      await expect(own.getByText(operator.cuit, { exact: true })).toBeVisible();
      await expect(own.getByText('Fecha de habilitación registrada', { exact: true })).toBeVisible();
      expect(await own.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await own.screenshot({ path: info.outputPath('catalogue-owner-profile.png'), animations: 'disabled' });
    } finally { await context.close(); }
    await db.operador.update({ where: { id: operator.id }, data: { vencimientoHabilitacion: new Date(Date.now() + 400 * 86400000) } });
    expect((await request(page, '/alertas/catalogo/evaluar', 'POST')).status()).toBe(200);
    const resolved = await db.alertaGenerada.findUniqueOrThrow({ where: { id: operatorCase.id } }); expect(resolved.estado).toBe('RESUELTA'); expect(resolved.datos).toBe(operatorCase.datos);
    expect(errors).toEqual([]);
  } finally {
    if (ruleId) await db.reglaAlerta.update({ where: { id: ruleId }, data: { activa: false } });
    for (const action of restore) await action(); await db.$disconnect();
  }
});
