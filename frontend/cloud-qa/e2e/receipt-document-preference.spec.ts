import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

const origin = 'http://127.0.0.1:4177';
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fixture-after.json'), 'utf8'));
test.beforeAll(async () => { await assertCloudDatabase(); expect(fixture.synthetic).toBe(true); });
for (const preference of ['web', 'app'] as const) {
  test(`el enlace principal conserva el documento con preferencia ${preference}`, async ({ page, browser }, info) => {
    await login(page, info, fixture.owner.split('@')[0]);
    await page.goto(prefix(info) + '/configuracion?tab=apariencia');
    const settings = page.getByRole('region', { name: 'Dónde abrir los enlaces' });
    const choice = settings.getByRole('radio', { name: preference === 'web' ? /Siempre web/ : /Siempre app/ });
    const automatic = settings.getByRole('radio', { name: /Según el dispositivo/ });
    await expect(choice).toBeEnabled();
    let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    try {
      if (await choice.isChecked()) { await automatic.check(); await expect(settings.getByRole('status')).toContainText('Preferencia guardada'); }
      await choice.check(); await expect(settings.getByRole('status')).toContainText('Preferencia guardada');
      await page.reload(); await expect(choice).toBeChecked();
      context = await browser.newContext({ ...info.project.use, baseURL: origin } as any);
      const other = await context.newPage(); await isolatedMapTiles(other, info);
      await context.addCookies([{ name: 'sitrep_qa_client', value: `127.23.${preference === 'web' ? 41 : 42}.${info.project.name === 'app' ? 2 : 1}`, url: origin }]);
      await other.addInitScript(() => { for (const role of ['GENERADOR','OPERADOR']) localStorage.setItem('sitrep_onboarding_' + role, 'true'); });
      await other.setContent(fixture.applicantMail);
      await other.locator('[data-mail-action="preferred"]').click(); await expect(other).toHaveURL(/\/login$/);
      await other.getByLabel('Correo electrónico o CUIT').fill(fixture.owner);
      await other.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
      const response = other.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
      await other.getByRole('button', { name: 'Ingresar', exact: true }).click(); expect((await response).status()).toBe(200);
      const expected = origin + (preference === 'app' ? '/app' : '') + '/mi-solicitud?solicitud=' + fixture.operator + '&documento=' + fixture.document;
      await expect(other).toHaveURL(expected);
      await expect(other.getByLabel('Solicitud por actividad')).toHaveValue(fixture.operator);
      const document = other.getByRole('listitem', { name: 'Documento del aviso: ' + fixture.documentName });
      await expect(document).toBeVisible(); await expect(document).toContainText('Inscripción: Operador'); await expect(document).toBeFocused();
      await other.screenshot({ path: info.outputPath('preferencia-documento.png'), animations: 'disabled' });
    } finally {
      await context?.close();
      if (!await automatic.isChecked()) { await automatic.check(); await expect(settings.getByRole('status')).toContainText('Preferencia guardada'); }
    }
  });
}
