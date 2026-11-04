import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

type Scenario = { role: 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR'; id: string; noticeId: string; legal: boolean };
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'inspection-company-decisions.json'), 'utf8')) as {
  email: string; cases: Record<string, Scenario[]>;
};
const labels = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transporte', OPERADOR: 'Operador' } as const;
test('representatives open the result of a requirement from its notice', async ({ page }, info) => {
 await assertCloudDatabase(); expect(fixture.email).toMatch(/@night-qa\.invalid$/);
 const cases = fixture.cases[info.project.name];
 expect(cases.map(item => item.role)).toEqual(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']);
 const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
 await login(page, info, fixture.email.split('@')[0]);
 for (const item of cases) {
  await page.goto(prefix(info) + '/notificaciones/' + item.noticeId);
  const notice = page.getByRole('region', { name: 'Aviso recibido' });
  await expect(notice.getByRole('heading', { name: 'PSIP · ' + (item.legal ? 'Derivación a Legales' : 'Cierre conforme'), exact: true })).toBeVisible();
  await notice.getByRole('button', { name: `Usar ${labels[item.role]} y abrir requerimiento`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/requerimientos/' + item.id + '(?:[?#].*)?$'));
  await expect(page.getByTestId('inspection-next-step')).toContainText(item.legal ? 'Derivación a Legales registrada' : 'Seguimiento cerrado conforme');
  await expect(page.getByRole('button', { name: /^Responder requerimiento #/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Mis inspecciones', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
 }
 expect(errors).toEqual([]);
});
