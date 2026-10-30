import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

const attempt = process.env.QA_DOC_ATTEMPT || 'before';
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, `fixture-${attempt}.json`), 'utf8'));
test.beforeAll(async () => { await assertCloudDatabase(); expect(fixture.synthetic).toBe(true); });
async function verifyApplicantDocument(page: Page, info: TestInfo) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(`${prefix(info)}/mi-solicitud`);
  await expect.poll(() => new URL(page.url()).searchParams.get('solicitud')).toBe(fixture.operator);
  await expect.poll(() => new URL(page.url()).searchParams.get('documento')).toBe(fixture.document);
  const target = page.getByRole('listitem', { name: 'Documento del aviso: ' + fixture.documentName });
  await expect(target).toBeVisible(); await expect(target).toHaveText(/Documento indicado en el aviso/); await expect(target).toContainText('Inscripción: Operador');
  await expect(target).toBeFocused();
  await expect(page.getByLabel('Solicitud por actividad')).toHaveValue(fixture.operator);
  await page.screenshot({ path: info.outputPath('documento.png'), animations: 'disabled' });
}
for (const source of ['campana', 'avisos'] as const) {
  test(`${source} abre el documento del aviso en la actividad correcta`, async ({ page }, info) => {
    const downloads: string[] = [];
    page.on('request', request => { if (request.url().includes('/download')) downloads.push(request.url()); });
    await login(page, info, fixture.owner.split('@')[0]);
    await page.goto(`${prefix(info)}/mi-solicitud?solicitud=${fixture.generator}`);
    await expect(page.getByLabel('Solicitud por actividad')).toHaveValue(fixture.generator);
    if (source === 'campana') {
      await page.getByRole('button', { name: /^Notificaciones/ }).click();
      await page.getByRole('region', { name: 'Notificaciones recientes' }).getByRole('button').filter({ hasText: 'Comprobante repetido' }).first().click();
    } else {
      await page.goto(`${prefix(info)}/notificaciones`);
      await page.getByRole('button', { name: 'Abrir aviso: Comprobante repetido', exact: true }).first().click();
    }
    await verifyApplicantDocument(page, info); expect(downloads).toEqual([]);
    if (source === 'campana') {
      await page.getByRole('button', { name: /Documentos presentados/ }).click();
      await expect(page.getByRole('button', { name: /Documentos presentados/ })).toHaveAttribute('aria-expanded', 'false');
      await page.getByRole('button', { name: /^Notificaciones/ }).click();
      await page.getByRole('region', { name: 'Notificaciones recientes' }).getByRole('button').filter({ hasText: 'Comprobante repetido' }).first().click();
      await verifyApplicantDocument(page, info); expect(downloads).toEqual([]);
    }
  });
}
for (const recipient of ['applicant', 'admin'] as const) {
  test(`correo ${recipient} abre el documento después de ingresar`, async ({ page }, info) => {
    await isolatedMapTiles(page, info);
    await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.11.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`, url: 'http://127.0.0.1:4177' }]);
    await page.addInitScript(() => { for (const role of ['GENERADOR', 'ADMIN', 'ADMIN_OPERADOR']) localStorage.setItem('sitrep_onboarding_' + role, 'true'); });
    await page.setContent(recipient === 'admin' ? fixture.adminMail : fixture.applicantMail);
    const link = page.locator(`[data-mail-action="${info.project.name === 'app' ? 'app' : 'web'}"]`);
    const target = new URL((await link.getAttribute('href'))!);
    expect(target.searchParams.get('documento')).toBe(fixture.document);
    await link.click(); await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Correo electrónico o CUIT').fill(recipient === 'admin' ? 'admin@night-qa.invalid' : fixture.owner);
    await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
    const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); expect((await response).status()).toBe(200);
    await expect(page).toHaveURL(target.href);
    if (recipient === 'applicant') await verifyApplicantDocument(page, info);
    else {
      const document = page.getByRole('group', { name: 'Documento: ' + fixture.documentName });
      await expect(document).toBeVisible(); await expect(document).toHaveText(/Documento indicado en el aviso/); await expect(document).toContainText('Inscripción: Operador'); await expect(document).toBeFocused();
      await page.screenshot({ path: info.outputPath('documento-admin.png'), animations: 'disabled' });
    }
  });
}
test('un documento de otra actividad no se sustituye', async ({ page }, info) => {
  await login(page, info, fixture.owner.split('@')[0]);
  await page.goto(`${prefix(info)}/mi-solicitud?solicitud=${fixture.generator}&documento=${fixture.document}`);
  await expect(page.getByText('El documento indicado en el aviso no está disponible en esta solicitud.')).toBeVisible();
  await expect(page.getByText('Documento indicado en el aviso', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('listitem', { name: 'Documento del aviso: ' + fixture.documentName })).toHaveCount(0);
});
test('cambiar de actividad deja atrás la selección del documento', async ({ page }, info) => {
  await login(page, info, fixture.owner.split('@')[0]);
  await page.goto(`${prefix(info)}/mi-solicitud?solicitud=${fixture.operator}&documento=${fixture.document}`);
  await verifyApplicantDocument(page, info);
  await page.getByLabel('Solicitud por actividad').selectOption(fixture.generator);
  await expect.poll(() => new URL(page.url()).searchParams.get('documento')).toBeNull();
  await expect(page.getByText('Inscripción de Generador', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Documentos presentados/ })).toHaveAttribute('aria-expanded', 'false');
});
test('el contexto y la acción del documento quedan visibles a 320 px', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await login(page, info, fixture.owner.split('@')[0]);
  await page.goto(`${prefix(info)}/mi-solicitud?solicitud=${fixture.operator}&documento=${fixture.document}`);
  const target = page.getByRole('listitem', { name: 'Documento del aviso: ' + fixture.documentName });
  await expect(target).toBeFocused();
  for (const part of [target.getByText('Documento indicado en el aviso'), target.getByText('Inscripción: Operador'), target.getByRole('button', { name: /Descargar original/ })]) {
    await expect(part).toBeInViewport();
    const visible = await part.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return rect.top >= 0 && rect.bottom <= innerHeight && !!top && (top === element || element.contains(top));
    });
    expect(visible).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('documento-320.png'), animations: 'disabled' });
});
