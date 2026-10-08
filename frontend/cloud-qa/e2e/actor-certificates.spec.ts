import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { login, prefix } from './helpers';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { jsPDF } = require('jspdf');

for (const actor of [
  { type: 'GENERADOR', key: 'generador', path: 'generadores' },
  { type: 'OPERADOR', key: 'operador', path: 'operadores' },
  { type: 'TRANSPORTISTA', key: 'transportista', path: 'transportistas' },
]) test(`${actor.key}: DGFA uploads original annual PDFs and the actual owner downloads identical bytes`, async ({ page, browser }, info) => {
  test.setTimeout(90000);
  const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  expect(fixture.database).toBe('sitrep_night_qa_20260926'); expect(fixture.externalDelivery).toBe(false);
  const id = fixture.actors[actor.key];
  const files = new Map<number, { bytes: Buffer; id: string }>();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await login(page, info);
  await page.goto(`${prefix(info)}/admin/actores/${actor.path}/${id}`);
  const certificates = page.getByRole('region', { name: 'Certificados ambientales oficiales', exact: true });
  await expect(certificates).toBeVisible();
  await certificates.getByText('Cargar certificado oficial', { exact: true }).click();
  for (const year of [2025, 2026]) {
    const pdf = new jsPDF(); pdf.text('QA CERTIFICADO SINTETICO - SIN VALIDEZ LEGAL', 15, 20); pdf.text(`${actor.type} ${year}`, 15, 32);
    if (year === 2025) { pdf.addPage(); pdf.text('QA ANEXO - DEBE CONSERVARSE COMPLETO', 15, 20); }
    const bytes = Buffer.from(pdf.output('arraybuffer'));
    await certificates.getByLabel('Año del certificado', { exact: true }).fill(String(year));
    await certificates.getByLabel('PDF oficial firmado', { exact: true }).setInputFiles({ name: `QA-CAA-${actor.key}-${year}.pdf`, mimeType: 'application/pdf', buffer: bytes });
    const posted = page.waitForResponse(response => new URL(response.url()).pathname === `/api/actores/${actor.path}/${id}/documentos` && response.request().method() === 'POST');
    await certificates.getByRole('button', { name: 'Cargar certificado', exact: true }).click();
    const response = await posted; expect(response.status()).toBe(201);
    const doc = (await response.json()).data.documento;
    expect(doc).toMatchObject({ estado: 'APROBADO', anio: year, tipo: 'CERTIFICADO_AMBIENTAL', subidoPor: fixture.users.admin });
    expect(doc[actor.key + 'Id']).toBe(id);
    files.set(year, { bytes, id: doc.id });
    await expect(certificates.getByRole('button', { name: `Descargar CAA ${year}`, exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await certificates.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath(`${actor.key}-certificates-admin.png`), animations: 'disabled' });
  await page.getByRole('tab', { name: 'Trazabilidad', exact: true }).click();
  await page.getByText('Cambios de datos del padrón', { exact: true }).click();
  const history = page.locator('details').filter({ has: page.getByText('Cambios de datos del padrón', { exact: true }) });
  await history.getByRole('button').filter({ hasText: 'Modificado' }).first().click();
  await expect(history.getByText(`QA-CAA-${actor.key}-2026.pdf`, { exact: true })).toBeVisible();
  const context = await browser.newContext({ viewport: info.project.name === 'web-desktop' ? { width: 1440, height: 900 } : { width: 360, height: 800 } });
  try {
    const owner = await context.newPage(); await login(owner, info, actor.key);
    await owner.goto(`${prefix(info)}/mi-perfil`);
    const ownCertificates = owner.getByRole('region', { name: 'Certificados ambientales oficiales', exact: true });
    await expect(ownCertificates).toBeVisible();
    await expect(ownCertificates.getByText('Cargar certificado oficial', { exact: true })).toHaveCount(0);
    for (const [year, stored] of files) {
      await expect(ownCertificates.getByRole('button', { name: `Descargar CAA ${year}`, exact: true })).toBeVisible();
      const downloaded = owner.waitForEvent('download', { timeout: 15000 });
      await ownCertificates.getByRole('button', { name: `Descargar CAA ${year}`, exact: true }).click();
      const file = await downloaded; const saved = await file.path(); expect(saved).toBeTruthy();
      expect(createHash('sha256').update(await readFile(saved!)).digest('hex')).toBe(createHash('sha256').update(stored.bytes).digest('hex'));
    }
    expect(await owner.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await owner.screenshot({ path: info.outputPath(`${actor.key}-certificates-owner.png`), animations: 'disabled' });
  } finally { await context.close(); }
  expect(errors).toEqual([]);
});
