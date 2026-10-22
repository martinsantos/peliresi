import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { login, prefix, readablePageHeading, readableWholeWords, readableFixedAction } from './helpers';

const fixture = JSON.parse(readFileSync(process.env.QA_ARTIFACTS! + '/psip-deadlines-fixture.json', 'utf8'));
for (const [type, label] of [['GENERADOR', 'Generador'], ['TRANSPORTISTA', 'Transportista'], ['OPERADOR', 'Operador']]) {
  test(`own inspection context ${type}: named workspace and header help preserve the actor role`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await login(page, info, fixture.actors[type].login);
    const record = fixture.cases[info.project.name][type].mixed;
    for (const route of ['/mis-inspecciones', '/mis-inspecciones/' + record.id]) {
      await page.goto(prefix(info) + route);
      const header = page.getByRole('banner');
      await expect(header.getByRole('heading', { name: 'Mis inspecciones', exact: true })).toBeVisible();
      await expect(header.getByLabel('Función actual')).toHaveText(new RegExp('^' + label + '$', 'i'));
      for (const width of [360, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await readablePageHeading(page);
        await readableWholeWords(header.locator('h1'));
        const help = page.getByRole('button', { name: 'Ayuda y soporte técnico', exact: true });
        expect(await help.evaluate(element => Boolean(element.closest('header')))).toBe(true);
        await readableFixedAction(help, header);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      }
      await expect(page.getByRole('button', { name: 'Aprobar expediente', exact: true })).toHaveCount(0);
    }
    await page.getByTestId('inspection-next-step').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('inspection-context.png'), animations: 'disabled' });
    expect(errors).toEqual([]);
  });
}
