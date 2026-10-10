import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from './helpers';
import { assertCloudDatabase } from '../safety';
const require = createRequire(new URL('../../package.json', import.meta.url));
const back = createRequire(new URL('../../../backend/package.json', import.meta.url));
const { jsPDF } = require('jspdf');
const sharp = back('sharp');
const { PrismaClient } = back('@prisma/client');
async function trialCounts() {
  await assertCloudDatabase();
  const db = new PrismaClient();
  try { return await db.$transaction([db.usuario.count(), db.solicitudInscripcion.count(), db.documentoSolicitud.count()]); }
  finally { await db.$disconnect(); }
}
const fields = { nombre: 'JUAN', apellido: 'QA', dni: '90000000', licencia: 'QA-12345', vencimiento: '2027-12-31' };
async function license() {
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750"><rect width="1200" height="750" fill="white"/><g font-family="DejaVu Sans" font-size="36" fill="black">${['LICENCIA DE PRUEBA - SIN VALIDEZ', 'APELLIDO: QA', 'NOMBRE: JUAN', 'DNI: 90000000', 'NRO LICENCIA: QA-12345', 'VENCIMIENTO: 31/12/2027'].map((text, i) => `<text x="50" y="${80 + i * 95}">${text}</text>`).join('')}</g></svg>`)).png().toBuffer();
}
function syntheticDocument() { const pdf = new jsPDF(); pdf.text(['DOCUMENTO SINTETICO QA - SIN VALIDEZ', randomUUID()], 15, 25); return Buffer.from(pdf.output('arraybuffer')); }
async function create(page: Page, info: TestInfo) {
  await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.12.${1 + Math.floor(Math.random() * 240)}.${1 + Math.floor(Math.random() * 240)}`, url: 'http://127.0.0.1:4177' }]);
  await page.goto(`${prefix(info)}/inscripcion/transportista`);
  const uid = randomUUID();
  await page.getByLabel('Nombre completo *', { exact: true }).fill('QA alta integral');
  await page.getByLabel('Email *', { exact: true }).fill(`${uid}@night-qa.invalid`);
  await page.getByLabel('CUIT *', { exact: true }).fill(`30-${String(Date.now()).slice(-8)}-1`);
  await page.getByLabel('Contraseña *', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  await page.getByLabel('Confirmar contraseña *', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const posted = page.waitForResponse(response => response.url().endsWith('/api/solicitudes/iniciar') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear cuenta y continuar', exact: true }).click();
  const response = await posted; expect(response.status()).toBe(201);
  await expect(page.getByTestId('registration-wizard')).toBeVisible();
  return (await response.json()).data as { solicitudId: string };
}
async function cleanLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
}
async function administrativeStep(page: Page, step: number, label: string) {
  const mobile = page.getByRole('combobox', { name: 'Paso del registro', exact: true });
  if (await mobile.isVisible()) await mobile.selectOption(String(step));
  else await page.getByRole('button', { name: `${step}. ${label}`, exact: true }).click();
}

test('trial: real license OCR, all actor drafts recover, and no application or account is created', async ({ page }, info) => {
  test.setTimeout(120000); const businessWrites: string[] = [], errors: string[] = [];
  const before = await trialCounts();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && path !== '/api/solicitudes/analizar-documento') businessWrites.push(path); });
  for (const [type, total, second] of [['generador', 7, 'Regulatorio'], ['operador', 8, 'Regulatorio'], ['transportista', 5, 'Habilitacion']] as const) {
    await page.goto(`${prefix(info)}/inscripcion/${type}?modo=revision`);
    await page.getByLabel('Razon Social *', { exact: true }).fill(`QA borrador de prueba ${type}`);
    await page.getByRole('button', { name: `Paso 2 de ${total}: ${second}`, exact: true }).click();
    await page.getByRole('button', { name: 'Guardar borrador de prueba', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Etapas de la inscripción' }).locator('[aria-current=step]')).toHaveAttribute('aria-label', `Paso 2 de ${total}: ${second}`);
    await page.getByRole('button', { name: new RegExp(`^Paso 1 de ${total}:`) }).click();
    await expect(page.getByLabel('Razon Social *', { exact: true })).toHaveValue(`QA borrador de prueba ${type}`);
  }
  await page.getByRole('button', { name: /^Paso 3 de 5:/ }).click();
  await page.getByRole('button', { name: 'Agregar chofer', exact: true }).click();
  const driver = page.getByRole('group', { name: 'Chofer 2', exact: true }), bytes = await license();
  const read = page.waitForResponse(response => response.url().endsWith('/api/solicitudes/analizar-documento') && response.request().method() === 'POST');
  await driver.getByLabel('Archivo de licencia del chofer 2').setInputFiles({ name: 'LICENCIA-QA.png', mimeType: 'image/png', buffer: bytes });
  const response = await read; expect(response.status()).toBe(200);
  const result = (await response.json()).data; expect(result).toMatchObject({ persistido: false, campos: fields, analisis: { lectura: 'LEIDO', motor: 'TESSERACT' } });
  await expect(driver.getByText('Revisá los datos leídos', { exact: true })).toBeVisible();
  await expect(driver.getByLabel('Nombre *', { exact: true })).toHaveValue('');
  await driver.getByRole('button', { name: 'Usar datos seleccionados', exact: true }).click();
  await expect(driver.getByLabel('DNI *', { exact: true })).toHaveValue(fields.dni);
  await page.getByRole('button', { name: 'Guardar borrador de prueba', exact: true }).click(); await page.reload();
  await expect(page.getByRole('group', { name: 'Chofer 2', exact: true }).getByLabel('Nombre *', { exact: true })).toHaveValue('JUAN');
  await expect(page.getByText('Datos recuperados. Volvé a seleccionar los archivos de prueba para leerlos.', { exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Chofer 2', exact: true }).scrollIntoViewIfNeeded();
  await cleanLayout(page); await page.screenshot({ path: info.outputPath('trial-license-recovered.png'), animations: 'disabled' });
  expect(businessWrites).toEqual([]); expect(errors).toEqual([]); expect(await trialCounts()).toEqual(before);
});

test('public transport: original license, structured fleet, administrative correction and actual approval retain the same facts', async ({ page }, info) => {
  test.setTimeout(180000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const candidate = await create(page, info);
  await page.getByLabel('Razon Social *', { exact: true }).fill('QA Transporte Integral'); await page.getByLabel('Domicilio', { exact: true }).fill('QA domicilio declarado 100');
  await page.getByRole('button', { name: /^Paso 3 de 5:/ }).click();
  await page.getByRole('button', { name: 'Agregar vehículo', exact: true }).click();
  const vehicle = page.getByRole('group', { name: /^Vehículo 1/ });
  await vehicle.getByLabel('Patente *', { exact: true }).fill('QA123ZZ'); await vehicle.getByLabel('Ano *', { exact: true }).fill('2026');
  await vehicle.getByLabel('Capacidad (kg) *', { exact: true }).fill('12500'); await vehicle.getByLabel('Vencimiento *', { exact: true }).fill('2028-12-31');
  await page.getByRole('button', { name: 'Agregar chofer', exact: true }).click();
  const driver = page.getByRole('group', { name: 'Chofer 1', exact: true }), bytes = await license();
  const stored = page.waitForResponse(response => response.url().endsWith(`/api/solicitudes/${candidate.solicitudId}/documentos`) && response.request().method() === 'POST');
  await driver.getByLabel('Archivo de licencia del chofer 1').setInputFiles({ name: 'LICENCIA-QA.png', mimeType: 'image/png', buffer: bytes });
  const upload = await stored; expect(upload.status()).toBe(201); const original = (await upload.json()).data.documento;
  expect(original).toMatchObject({ sha256: createHash('sha256').update(bytes).digest('hex'), analisis: { campos: fields, documentKind: 'LICENCIA' } });
  await driver.getByRole('button', { name: 'Usar datos seleccionados', exact: true }).click();
  await page.getByRole('button', { name: /^Paso 4 de 5:/ }).click();
  for (const type of ['CONSTANCIA_AFIP', 'CERTIFICADO_HABILITACION', 'SEGURO_AMBIENTAL']) {
    const row = page.getByTestId(`registration-document-${type}`);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), row.getByRole('button', { name: 'Adjuntar', exact: true }).click()]);
    await chooser.setFiles({ name: `${type}-QA.pdf`, mimeType: 'application/pdf', buffer: syntheticDocument() }); await expect(row).toContainText('Guardado');
  }
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Flota declarada' })).toContainText('90000000');
  await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Solicitud enviada', exact: true })).toBeVisible();
  await login(page, info); await page.goto(`${prefix(info)}/admin/solicitudes/${candidate.solicitudId}`);
  await page.getByRole('button', { name: 'Corregir datos', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Corregir datos de la solicitud', exact: true });
  await editor.getByLabel('Domicilio', { exact: true }).fill('QA domicilio corregido 200');
  await editor.getByRole('button', { name: 'Guardar corrección', exact: true }).click(); await expect(editor).not.toBeVisible();
  await expect(page.getByText('QA domicilio corregido 200', { exact: true })).toBeVisible();
  await assertCloudDatabase();
  const db = new PrismaClient();
  try {
    const history = await db.auditoria.findMany({ where: { modulo: 'SOLICITUD', accion: 'UPDATE' } });
    const correction = history.find((item: { datosDespues: string }) => JSON.parse(item.datosDespues).solicitudId === candidate.solicitudId);
    expect(correction).toBeDefined();
    expect(JSON.parse(correction.datosAntes).datosActor.domicilio).toBe('QA domicilio declarado 100');
    expect(JSON.parse(correction.datosDespues).datosActor.domicilio).toBe('QA domicilio corregido 200');
    expect(correction.usuarioId).toBe((await db.usuario.findUnique({ where: { email: 'admin@night-qa.invalid' } })).id);
  } finally { await db.$disconnect(); }
  await expect(page.getByRole('region', { name: 'Flota declarada' })).toContainText('QA-12345');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar LICENCIA-QA.png', exact: true }).click()]); expect(await download.failure()).toBeNull();
  await cleanLayout(page); await page.screenshot({ path: info.outputPath('administrative-fleet-correction.png'), animations: 'disabled' });
  const approval = page.waitForResponse(response => response.url().endsWith(`/api/solicitudes/${candidate.solicitudId}/aprobar`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Aprobar', exact: true }).click(); await page.getByRole('dialog', { name: 'Confirmar Aprobacion', exact: true }).getByRole('button', { name: 'Confirmar Aprobacion', exact: true }).click();
  const approved = await approval; expect(approved.status()).toBe(200); const application = (await approved.json()).data.solicitud;
  const token = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
  const actorResponse = await page.request.get(`/api/actores/transportistas/${application.transportistaId}`, { headers: { Authorization: `Bearer ${token}` } }); expect(actorResponse.status()).toBe(200);
  const actor = (await actorResponse.json()).data.transportista;
  expect(actor.domicilio).toBe('QA domicilio corregido 200'); expect(actor.vehiculos).toHaveLength(1); expect(actor.vehiculos[0]).toMatchObject({ patente: 'QA123ZZ', capacidad: 12500 });
  expect(actor.choferes).toHaveLength(1); expect(actor.choferes[0]).toMatchObject({ nombre: 'JUAN', apellido: 'QA', dni: '90000000', licencia: 'QA-12345' }); expect(actor.choferes[0].vencimiento).toMatch(/^2027-12-31/);
  expect(errors).toEqual([]);
});

test('administrative transport uses the same driver and license controls without creating an actor during draft recovery', async ({ page }, info) => {
  test.setTimeout(90000); await login(page, info);
  const creates: string[] = []; page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/actores/transportistas')) creates.push(request.url()); });
  await page.goto(`${prefix(info)}/admin/actores/transportistas/nuevo`);
  await page.getByLabel('Razon Social *', { exact: true }).fill('QA borrador compartido'); await page.getByLabel('CUIT *', { exact: true }).fill('30-70000001-1'); await page.getByLabel('Email *', { exact: true }).fill('qa-shared-driver@night-qa.invalid'); await page.getByLabel('Contraseña inicial *', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  await administrativeStep(page, 4, 'Choferes'); await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  const driver = page.getByRole('group', { name: 'Chofer 1', exact: true }); await driver.getByLabel('Archivo de licencia del chofer 1').setInputFiles({ name: 'LICENCIA-QA.png', mimeType: 'image/png', buffer: await license() });
  await driver.getByRole('button', { name: 'Usar datos seleccionados', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click(); await page.reload(); await page.getByRole('button', { name: 'Recuperar borrador', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Chofer 1', exact: true }).getByLabel('DNI *', { exact: true })).toHaveValue('90000000');
  const recoveredDriver = page.getByRole('group', { name: 'Chofer 1', exact: true });
  const reader = await recoveredDriver.getByRole('button', { name: 'Adjuntar licencia y leer', exact: true }).boundingBox();
  const remove = await recoveredDriver.getByRole('button', { name: 'Quitar chofer 1', exact: true }).boundingBox();
  expect(reader).not.toBeNull(); expect(remove).not.toBeNull();
  expect(reader!.height).toBeGreaterThanOrEqual(44); expect(remove!.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(reader!.y + reader!.height / 2 - remove!.y - remove!.height / 2)).toBeLessThanOrEqual(1);
  await cleanLayout(page); await page.screenshot({ path: info.outputPath('administrative-driver-recovered.png'), animations: 'disabled' }); expect(creates).toEqual([]);
});
