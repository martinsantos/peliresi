import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { login, prefix, readablePageHeading } from './helpers';
import { assertCloudDatabase, backendRequire } from '../safety';
const { PrismaClient } = backendRequire('@prisma/client');
const { jsPDF } = createRequire(new URL('../../package.json', import.meta.url))('jspdf');
const pdf = (lines: string[]) => { const doc = new jsPDF(); doc.text(['ARTIFICIAL QA SIN VALIDEZ', ...lines], 15, 25); return Buffer.from(doc.output('arraybuffer')); };

test('administrative transport preserves fleet and partial uploads, then reviews ATM from its own dossier', async ({ page, browser }, info) => {
  test.setTimeout(120_000); await assertCloudDatabase();
  const uid = randomUUID(), payment = String(Date.now()), cuit = '99-' + payment.slice(-8) + '-0', plate = 'QA' + payment.slice(-5);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let creates = 0;
  page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/actores/transportistas') creates++; });
  await login(page, info, 'admin-transporte');
  await page.goto(prefix(info) + '/admin/actores/transportistas/nuevo');
  for (const [label, value] of [['Razon Social *', 'QA transporte directo ' + uid], ['CUIT *', cuit], ['Email *', uid + '@night-qa.invalid'], ['Contraseña inicial *', 'OnlyLocal-NightQA-2026!']]) await page.getByLabel(label, { exact: true }).fill(value);
  const step = async (number: number, name: string) => {
    if (info.project.name === 'web-desktop') await page.getByRole('button', { name: `${number}. ${name}`, exact: true }).click();
    else await page.getByRole('combobox', { name: 'Paso del registro' }).selectOption(String(number));
  };
  await step(3, 'Vehiculos'); await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  for (const [label, value] of [['Patente *', plate], ['Ano *', '2026'], ['Capacidad (kg) *', '1250.5'], ['Vencimiento *', '2028-12-31']]) await page.getByLabel(label, { exact: true }).fill(value);
  await step(4, 'Choferes'); await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  for (const [label, value] of [['Nombre *', 'QA conductor'], ['Apellido', 'Artificial'], ['DNI *', '900' + payment.slice(-5)], ['Licencia', 'QA-LIC'], ['Vencimiento *', '2028-12-31']]) await page.getByRole('group', { name: 'Chofer 1', exact: true }).getByLabel(label, { exact: true }).fill(value);
  await step(5, 'Confirmar');
  const documents = page.getByRole('region', { name: 'Documentación del transportista', exact: true });
  const receipt = pdf(['ATM ADMINISTRACION TRIBUTARIA MENDOZA', 'ID Comprobante: ' + payment, 'Transaccion: 88' + payment, 'Control: 77' + payment, 'CUIT: ' + cuit, 'Codigo de Tasa: 162', 'Fecha Pago: 20/10/2026', 'IMPORTE TOTAL: $12.500,00']);
  await documents.getByLabel('Tipo documento', { exact: true }).selectOption('COMPROBANTE_PAGO');
  await documents.locator('input[type=file]').setInputFiles({ name: 'ATM-transporte-QA.pdf', mimeType: 'application/pdf', buffer: receipt });
  await documents.getByLabel('Tipo documento', { exact: true }).selectOption('OTRO');
  await documents.locator('input[type=file]').setInputFiles({ name: 'Adjunto-reintento-QA.pdf', mimeType: 'application/pdf', buffer: Buffer.from('QA invalid PDF signature') });
  const created = page.waitForResponse(r => new URL(r.url()).pathname === '/api/actores/transportistas' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear Transportista', exact: true }).click();
  const result = await created; expect(result.status()).toBe(201); const actorId = (await result.json()).data.transportista.id;
  await expect(page.getByRole('alert', { name: 'Adjuntos pendientes' })).toContainText('Transportista guardado');
  await expect(page.getByRole('button', { name: 'Reintentar adjuntos', exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('transport-partial-upload.png'), animations: 'disabled' });
  const other = pdf(['QA documento recuperado', uid]);
  await documents.locator('input[type=file]').setInputFiles({ name: 'Adjunto-reintento-QA.pdf', mimeType: 'application/pdf', buffer: other });
  await page.getByRole('button', { name: 'Reintentar adjuntos', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/admin/actores/transportistas$')); expect(creates).toBe(1);
  await page.goto(prefix(info) + '/admin/actores/transportistas/' + actorId);
  await expect(page.getByRole('tab', { name: 'Documentos', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Documentos', exact: true }).click();
  await expect(page.getByText('ATM-transporte-QA.pdf', { exact: true })).toBeVisible();
  await expect(page.getByText('Adjunto-reintento-QA.pdf', { exact: true })).toBeVisible();
  const form = page.getByTestId('payment-identity-review'); await form.locator('summary').click();
  const identity = { 'ID Comprobante ATM': payment, 'CUIT del obligado': cuit.replace(/\D/g, ''), 'Código de tasa': '162', 'Fecha de pago': '2026-10-20', 'Importe pagado (ARS)': '12500', 'Período / concepto': 'Inscripción 2026', 'Referencia de liquidación o trámite': 'QA-TRANSPORTE-' + uid, 'Transacción (si figura)': '88' + payment, 'Control (si figura)': '77' + payment };
  for (const [label, value] of Object.entries(identity)) await form.getByLabel(label, { exact: true }).fill(value);
  await form.getByRole('checkbox').check();
  const reservation = page.waitForResponse(r => r.url().includes('/actores/documentos/') && r.url().endsWith('/identidad-pago'));
  await form.getByRole('button', { name: 'Confirmar y reservar pago', exact: true }).click(); expect((await reservation).status()).toBe(200);
  const reviewed = page.waitForResponse(r => r.url().includes('/actores/documentos/') && r.url().endsWith('/revisar'));
  await page.getByRole('button', { name: 'Aprobar ATM-transporte-QA.pdf', exact: true }).click(); expect((await reviewed).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Aprobar ATM-transporte-QA.pdf', exact: true })).toHaveCount(0);
  await readablePageHeading(page); await page.screenshot({ path: info.outputPath('transport-documents-reviewed.png'), animations: 'disabled' });
  const db = new PrismaClient(); try {
    const carrier = await db.transportista.findUniqueOrThrow({ where: { id: actorId }, include: { vehiculos: true, choferes: true } });
    expect(carrier.vehiculos).toHaveLength(1); expect(carrier.vehiculos[0]).toMatchObject({ patente: plate, capacidad: 1250.5 });
    expect(carrier.choferes).toHaveLength(1); expect(carrier.choferes[0]).toMatchObject({ nombre: 'QA conductor', dni: '900' + payment.slice(-5) });
    const saved = await db.documento.findMany({ where: { transportistaId: actorId } }); expect(saved).toHaveLength(2);
    const paid = saved.find(d => d.tipo === 'COMPROBANTE_PAGO')!;
    expect(paid).toMatchObject({ sha256: createHash('sha256').update(receipt).digest('hex'), estado: 'APROBADO' });
    expect(saved.find(d => d.tipo === 'OTRO')!.sha256).toBe(createHash('sha256').update(other).digest('hex'));
    const allocated = await db.registroPagoComprobante.findFirstOrThrow({ where: { documentoId: paid.id } });
    expect(allocated).toMatchObject({ estado: 'CONFIRMADO', origen: 'ACTOR', sha256: paid.sha256 });
  } finally { await db.$disconnect(); }
  // The owner is a different session. An authenticated /app/login correctly
  // resumes the existing administrator instead of presenting another login.
  const ownerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
  try {
    const ownerPage = await ownerContext.newPage();
    ownerPage.on('pageerror', error => errors.push(error.message));
    await login(ownerPage, info, uid);
    await ownerPage.goto(prefix(info) + '/admin/actores/transportistas/' + actorId);
    await expect(ownerPage.getByRole('tab', { name: 'Documentos', exact: true })).toBeVisible();
    await ownerPage.getByRole('tab', { name: 'Documentos', exact: true }).click();
    await expect(ownerPage.getByText('ATM-transporte-QA.pdf', { exact: true })).toBeVisible();
    await expect(ownerPage.getByRole('button', { name: 'Adjuntar documento', exact: true })).toHaveCount(0);
    await expect(ownerPage.getByRole('button', { name: /^Aprobar / })).toHaveCount(0);
    await expect(ownerPage.getByTestId('payment-identity-review')).toHaveCount(0);
  } finally { await ownerContext.close(); }
  expect(errors).toEqual([]);
});
