import { syntheticCuit } from '../synthetic-cuit';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { isolatedMapTiles, login, prefix, readablePageHeading } from './helpers';
import { assertCloudDatabase, backendRequire } from '../safety';
const { PrismaClient } = backendRequire('@prisma/client');
const { jsPDF } = createRequire(new URL('../../package.json', import.meta.url))('jspdf');
test.beforeEach(async ({ page }, info) => { await isolatedMapTiles(page, info); });

for (const actor of ['generador', 'operador'] as const) test(`${actor}: administrative alta retains electrical evidence and reserves ATM before review`, async ({ page }, info) => {
  await assertCloudDatabase(); expect(['actor_onboarding_20261020', 'circuit_review_20261020', 'actor_representation_20261022', 'web_app_audit_20261022']).toContain(new URL(process.env.DATABASE_URL!).searchParams.get('schema'));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const id = randomUUID(), cuit = syntheticCuit(Date.now()), route = actor === 'generador' ? 'generadores' : 'operadores', payment = String(Date.now());
  await login(page, info, 'admin-' + actor); await page.goto(`${prefix(info)}/admin/actores/${route}/nuevo`);
  for (const [label, value] of [['Razon Social *', 'QA directa ' + actor + ' ' + id], ['CUIT *', cuit], ['Email *', id + '@night-qa.invalid']]) await page.getByLabel(label, { exact: true }).fill(value);
  const step = async (number: number, name: string) => {
    if (info.project.name === 'web-desktop') await page.getByRole('button', { name: `${number}. ${name}`, exact: true }).click();
    else await page.getByRole('combobox', { name: 'Paso del registro' }).selectOption(String(number));
  };
  await step(actor === 'generador' ? 5 : 6, 'Regulatorio');
  await page.getByLabel('Password Inicial *', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  await step(actor === 'generador' ? 6 : 7, 'Adjuntos');
  const doc = new jsPDF(); doc.text(['ARTIFICIAL QA SIN VALIDEZ FISCAL', 'ATM ADMINISTRACION TRIBUTARIA MENDOZA', 'ID Comprobante: ' + payment, 'Transaccion: 88' + payment, 'Control: 77' + payment, 'CUIT: ' + cuit, 'Codigo de Tasa: 162', 'Fecha Pago: 20/10/2026', 'IMPORTE TOTAL: $12.500,00'], 15, 25);
  const bytes = Buffer.from(doc.output('arraybuffer'));
  await page.getByLabel('Adjuntar Recibo o comprobante de pago', { exact: true }).setInputFiles({ name: 'Pago-ATM-directa-QA.pdf', mimeType: 'application/pdf', buffer: bytes });
  const bill = new jsPDF(); bill.text(['ARTIFICIAL QA SIN VALIDEZ', actor === 'generador' ? 'EDEMSA' : 'Cooperativa Empresa Electrica de Godoy Cruz', 'Tarifa: T2 R BT', 'Consumo facturado: 1250 kWh', 'Potencia contratada: 45 kW', 'NIC: 900000001', 'Periodo: 2026/10'], 15, 25);
  const electric = Buffer.from(bill.output('arraybuffer'));
  await page.getByLabel('Adjuntar ' + (actor === 'generador' ? 'Factura de Luz' : 'Factura eléctrica'), { exact: true }).setInputFiles({ name: 'Factura-directa-QA.pdf', mimeType: 'application/pdf', buffer: electric });
  const created = page.waitForResponse(r => new URL(r.url()).pathname === `/api/actores/${route}` && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar Registro', exact: true }).click();
  const response = await created; expect(response.status()).toBe(201); const actorId = (await response.json()).data[actor].id;
  await expect(page).toHaveURL(new RegExp(`/admin/actores/${route}$`));
  await page.goto(`${prefix(info)}/admin/actores/${route}/${actorId}`);
  await page.getByRole('tab', { name: actor === 'generador' ? 'DDJJ y Documentos' : 'Documentos', exact: true }).click();
  await expect(page.getByText('Factura-directa-QA.pdf', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Lectura de factura eléctrica', { exact: true })).toContainText('1250 kWh');
  const form = page.getByTestId('payment-identity-review'); await form.locator('summary').click();
  const identity = { 'ID Comprobante ATM': payment, 'CUIT del obligado': cuit.replace(/\D/g, ''), 'Código de tasa': '162', 'Fecha de pago': '2026-10-20', 'Importe pagado (ARS)': '12500', 'Período / concepto': 'Inscripción 2026', 'Referencia de liquidación o trámite': 'QA-DIRECTA-' + id, 'Transacción (si figura)': '88' + payment, 'Control (si figura)': '77' + payment };
  for (const [label, value] of Object.entries(identity)) await form.getByLabel(label, { exact: true }).fill(value);
  await form.getByRole('checkbox').check();
  const reservation = page.waitForResponse(r => r.url().includes('/actores/documentos/') && r.url().endsWith('/identidad-pago'));
  await form.getByRole('button', { name: 'Confirmar y reservar pago', exact: true }).click(); expect((await reservation).status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: 'Pago reservado para este trámite' })).toBeVisible();
  const review = page.waitForResponse(r => r.url().includes('/actores/documentos/') && r.url().endsWith('/revisar'));
  await page.getByRole('button', { name: 'Aprobar Pago-ATM-directa-QA.pdf', exact: true }).click(); expect((await review).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Aprobar Pago-ATM-directa-QA.pdf', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); await readablePageHeading(page);
  await page.getByLabel('Lectura de factura eléctrica', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath(actor + '-administrative-documents.png'), animations: 'disabled' });
  const db = new PrismaClient(); try {
    const records = await db.documento.findMany({ where: { [actor + 'Id']: actorId } }); expect(records).toHaveLength(2);
    const savedBill = records.find(row => row.nombre === 'Factura-directa-QA.pdf')!;
    expect(savedBill.tipo).toBe(actor === 'generador' ? 'FACTURA_LUZ' : 'FACTURA_ELECTRICA');
    expect(savedBill.sha256).toBe(createHash('sha256').update(electric).digest('hex'));
    expect(savedBill.analisis).toMatchObject({ documentKind: 'FACTURA_ELECTRICA', electricidad: { campos: { consumoKwh: '1250', potenciaContratadaKw: '45', categoriaTarifaria: 'T2RBT' } } });
    expect(await db.huellaRecibo.count({ where: { sha256: savedBill.sha256 } })).toBe(0);
    const savedReceipt = records.find(row => row.nombre === 'Pago-ATM-directa-QA.pdf')!; expect(savedReceipt.estado).toBe('APROBADO');
    // A document decision retains the reservation and records APROBADO.
    // APLICADO is the separate application-approval event, not a TEF payment.
    const allocation = await db.registroPagoComprobante.findFirstOrThrow({ where: { documentoId: savedReceipt.id } });
    expect(allocation).toMatchObject({ estado: 'CONFIRMADO', origen: 'ACTOR', sha256: savedReceipt.sha256 });
    expect(await db.eventoPagoComprobante.count({ where: { registroId: allocation.id, documentoId: savedReceipt.id, accion: 'APROBADO' } })).toBe(1);
    expect(await db[actor].findUniqueOrThrow({ where: { id: actorId } })).toMatchObject({ tefInputs: null });
    writeFileSync(info.outputPath('administrative-case.json'), JSON.stringify({ actor, actorId, bill: savedBill.id, receipt: savedReceipt.id, result: 'APROBADO', artificial: true }));
  } finally { await db.$disconnect(); }
  expect(errors).toEqual([]);
});
