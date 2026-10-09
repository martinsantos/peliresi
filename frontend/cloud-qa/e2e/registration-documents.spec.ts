import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from './helpers';
const require = createRequire(new URL('../../package.json', import.meta.url));
const backendRequire = createRequire(new URL('../../../backend/package.json', import.meta.url));
const { jsPDF } = require('jspdf');
const sharp = backendRequire('sharp');

// Synthetic bytes only, not a certificate or a real payment. All sessions below
// come from real UI account creation/login; no business API interception.
function receipt() {
  const id = randomUUID();
  const pdf = new jsPDF();
  pdf.text(['RECIBO QA SIN VALIDEZ FISCAL', `Referencia ${id}`, 'IMPORTE 12500', 'Pago pendiente de revision humana'], 15, 25);
  return Buffer.from(pdf.output('arraybuffer'));
}
type Draft = { id: string; authorization: string; documentStep: number; actor: string };
async function draft(page: Page, info: TestInfo, actor: string): Promise<Draft> {
  await page.goto(`${prefix(info)}/inscripcion/${actor}`);
  const id = randomUUID();
  await page.getByLabel('Nombre completo *', { exact: true }).fill(`QA ${actor} ${id}`);
  await page.getByLabel('Email *', { exact: true }).fill(`${id}@night-qa.invalid`);
  await page.getByLabel('CUIT *', { exact: true }).fill(`30-${String(Date.now()).slice(-8)}-1`);
  await page.getByLabel('Password *', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  await page.getByLabel('Confirmar password *', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const posted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/solicitudes/iniciar' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear cuenta y continuar', exact: true }).click();
  const created = await posted; expect(created.status()).toBe(201);
  const body = (await created.json()).data;
  await expect(page.getByTestId('registration-wizard')).toBeVisible();
  await page.getByPlaceholder(actor === 'generador' ? 'Empresa S.A.' : actor === 'operador' ? 'Operador S.A.' : 'Transporte S.A.').fill(`QA establecimiento ${id}`);
  await page.getByPlaceholder('Calle 123, Ciudad', { exact: true }).fill('Domicilio QA Mendoza 123');
  const documentStep = actor === 'generador' ? 6 : actor === 'operador' ? 7 : 4;
  await page.getByRole('navigation', { name: 'Etapas de la inscripción' }).getByRole('button', { name: new RegExp(`^Paso ${documentStep} de .*: Documentos$`) }).click();
  await expect(page.getByTestId('registration-document-COMPROBANTE_PAGO')).toBeVisible();
  return { id: body.solicitudId, authorization: `Bearer ${body.tokens.accessToken}`, documentStep, actor };
}
async function attach(page: Page, id: string, type: string, bytes: Buffer, mimeType = 'application/pdf', name = 'QA.pdf') {
  const row = page.getByTestId(`registration-document-${type}`);
  const upload = page.waitForResponse(response => new URL(response.url()).pathname === `/api/solicitudes/${id}/documentos` && response.request().method() === 'POST');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), row.getByRole('button', { name: 'Adjuntar', exact: true }).click()]);
  await chooser.setFiles({ name, mimeType, buffer: bytes });
  const response = await upload; expect(response.status()).toBe(201);
  const doc = (await response.json()).data.documento;
  expect(doc.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  expect(doc.size).toBe(bytes.length); expect(doc.estado).toBe('PENDIENTE');
  await expect(row).toContainText('Guardado');
  return doc;
}

for (const actor of ['generador', 'operador', 'transportista']) test(`${actor}: actual registration documents, bounded PDF reading and authenticated reload`, async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const candidate = await draft(page, info, actor), bytes = receipt();
  const legal = ['CONSTANCIA_AFIP', 'CERTIFICADO_HABILITACION', actor === 'generador' ? 'MEMORIA_TECNICA' : actor === 'operador' ? 'RESOLUCION_DPA' : 'SEGURO_AMBIENTAL'];
  for (const type of legal) await attach(page, candidate.id, type, bytes, 'application/pdf', `${type}-QA.pdf`);
  const read = await attach(page, candidate.id, 'COMPROBANTE_PAGO', bytes, 'application/pdf', 'Recibo-QA.pdf');
  expect(read.analisis).toMatchObject({ lectura: 'LEIDO', motor: 'PDF_TEXT', duplicado: false });
  expect(read.analisis.texto).toContain('RECIBO QA SIN VALIDEZ FISCAL');
  const receiptRow = page.getByTestId('registration-document-COMPROBANTE_PAGO');
  await expect(receiptRow.getByText(/KB · Guardado/, { exact: false })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    receiptRow.getByRole('button', { name: 'Descargar Recibo-QA.pdf', exact: true }).click(),
  ]);
  expect(await download.failure()).toBeNull(); expect(download.suggestedFilename()).toBe('Recibo-QA.pdf');
  const downloaded = await download.path(); expect(downloaded).not.toBeNull();
  expect(await readFile(downloaded!)).toEqual(bytes);
  await receiptRow.scrollIntoViewIfNeeded();
  await page.getByText('Ver texto leído del recibo', { exact: true }).click();
  await expect(page.getByText(/Lectura automática para revisar; no valida el pago/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath(`${actor}-receipt-readable.png`), animations: 'disabled' });
  await page.reload();
  const row = page.getByTestId('registration-document-COMPROBANTE_PAGO');
  await expect(row).toContainText('Recibo-QA.pdf'); await expect(row).toContainText('Guardado');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  const send = page.waitForResponse(response => new URL(response.url()).pathname === `/api/solicitudes/${candidate.id}/enviar`);
  await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
  expect((await send).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Solicitud enviada', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('same receipt in two real applicant accounts raises a persistent warning without disclosing the other actor', async ({ page, browser }, info) => {
  test.setTimeout(120000);
  const first = await draft(page, info, 'generador'), bytes = receipt();
  const doc = await attach(page, first.id, 'COMPROBANTE_PAGO', bytes, 'application/pdf', 'original-QA.pdf');
  const secondContext = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    const otherPage = await secondContext.newPage(), other = await draft(otherPage, info, 'operador');
    const repeated = await attach(otherPage, other.id, 'COMPROBANTE_PAGO', bytes, 'application/pdf', 'nombre-distinto-QA.pdf');
    expect(repeated.analisis.duplicado).toBe(true); expect(repeated.sha256).toBe(doc.sha256);
    expect(JSON.stringify(repeated.analisis)).not.toContain(first.id);
    await expect(otherPage.getByRole('alert')).toContainText('Comprobante repetido');
    await otherPage.reload();
    await expect(otherPage.getByRole('alert')).toContainText('Comprobante repetido');
    await otherPage.screenshot({ path: info.outputPath('receipt-duplicate-persistent.png'), animations: 'disabled' });
    const forbidden = await otherPage.request.get(`/api/solicitudes/${first.id}/documentos/${doc.id}/download`, { headers: { Authorization: other.authorization } });
    expect(forbidden.status()).toBe(403);
    const own = await page.request.get(`/api/solicitudes/${first.id}/documentos/${doc.id}/download`, { headers: { Authorization: first.authorization } });
    expect(own.status()).toBe(200); expect(await own.body()).toEqual(bytes);
  } finally { await secondContext.close(); }
});

test('a photographed receipt recovers from a real busy OCR and is read in Spanish without a second upload', async ({ page }, info) => {
  test.setTimeout(120000);
  const candidate = await draft(page, info, 'transportista');
  // A distinct synthetic receipt per journey. Reusing identical PNG bytes
  // across viewports correctly triggers the duplicate detector, not an OCR bug.
  const svg = Buffer.from(`<svg width="1400" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><g font-family="DejaVu Sans" font-size="52" fill="black"><text x="70" y="100">RECIBO DE PAGO QA</text><text x="70" y="220">IMPORTE 12500</text><text x="70" y="340">SIN VALIDEZ FISCAL</text><text x="70" y="480" font-size="28">Referencia ${randomUUID()}</text></g></svg>`);
  const bytes = await sharp(svg).png().toBuffer();
  // Hold the actual shared engine lock, not an intercepted business response.
  // -F keeps Node on the tracked PID and finally always releases our own child.
  const blocker = spawn('flock', ['-F', '-n', path.join(os.tmpdir(), 'sitrep-receipt-ocr.lock'), process.execPath, '-e', 'process.stdout.write("QA_LOCKED"); setInterval(()=>{},1000);'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stop: Promise<unknown[]> | undefined;
  let stored: any;
  try {
    const ready = await Promise.race([
      once(blocker.stdout, 'data').then(([data]) => String(data)),
      once(blocker, 'exit').then(([code]) => { throw new Error(`QA lock failed: ${code}`); }),
      new Promise<never>((_, reject) => { const timeout = setTimeout(() => reject(new Error('QA lock readiness timeout')), 5000); timeout.unref(); }),
    ]);
    expect(ready).toContain('QA_LOCKED');
    stored = await attach(page, candidate.id, 'COMPROBANTE_PAGO', bytes, 'image/png', 'foto-recibo-QA.png');
    expect(stored.analisis).toMatchObject({ lectura: 'NO_DISPONIBLE', texto: '' });
    await expect(page.getByRole('button', { name: 'Reintentar lectura', exact: true })).toBeVisible();
  } finally {
    if (blocker.pid && blocker.exitCode === null && blocker.signalCode === null) { stop = once(blocker, 'exit'); blocker.kill('SIGTERM'); }
    if (stop) await stop;
  }
  const retried = page.waitForResponse(response => new URL(response.url()).pathname === `/api/solicitudes/${candidate.id}/documentos/${stored.id}/analizar`);
  await page.getByRole('button', { name: 'Reintentar lectura', exact: true }).click();
  const response = await retried; expect(response.status()).toBe(200);
  const doc = (await response.json()).data.documento;
  expect(doc.id).toBe(stored.id); expect(doc.sha256).toBe(stored.sha256); expect(doc.estado).toBe('PENDIENTE');
  expect(doc.analisis).toMatchObject({ lectura: 'LEIDO', motor: 'TESSERACT', duplicado: false });
  expect(doc.analisis.texto).toMatch(/RECIBO DE PAGO QA/i); expect(doc.analisis.texto).toContain('12500');
  await page.getByText('Ver texto leído del recibo', { exact: true }).click();
  await page.screenshot({ path: info.outputPath('receipt-spanish-ocr.png'), animations: 'disabled' });
});

test('administrative transport registration preserves its saved actor after a failed attachment', async ({ page }, info) => {
  test.setTimeout(120000); await login(page, info);
  await page.goto(`${prefix(info)}/admin/actores/transportistas/nuevo`);
  const id = randomUUID(), creations: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/actores/transportistas') creations.push(request.url()); });
  await page.getByLabel('Razon Social *', { exact: true }).fill(`QA Transportista ${id}`);
  await page.getByLabel('CUIT *', { exact: true }).fill(`30-${String(Date.now()).slice(-8)}-1`);
  await page.getByLabel('Email *', { exact: true }).fill(`${id}@night-qa.invalid`);
  await page.getByLabel('Contraseña inicial *', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  if (info.project.name === 'web-desktop') await page.getByRole('button', { name: '5. Confirmar', exact: true }).click();
  else await page.getByRole('combobox', { name: 'Paso del registro' }).selectOption('5');
  const panel = page.getByRole('region', { name: 'Documentación del transportista' });
  await panel.locator('input[type=file]').setInputFiles({ name: 'false-PDF-QA.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not PDF bytes') });
  await page.getByRole('button', { name: 'Crear Transportista', exact: true }).click();
  await expect(page.getByRole('alert', { name: 'Adjuntos pendientes' })).toContainText('Transportista guardado');
  await page.getByRole('button', { name: 'Quitar false-PDF-QA.pdf', exact: true }).click();
  await panel.locator('input[type=file]').setInputFiles({ name: 'real-QA.pdf', mimeType: 'application/pdf', buffer: receipt() });
  await page.getByRole('button', { name: 'Reintentar adjuntos', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/admin/actores/transportistas$'));
  expect(creations).toHaveLength(1);
});
