import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from '../safety';
import { login, prefix } from './helpers';

const dir = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(readFileSync(path.join(dir, 'after-fixture.json'), 'utf8'));
test.beforeAll(async () => { await assertCloudDatabase(); expect(fixture.synthetic).toBe(true); });
async function choose(page: Page, info: TestInfo, activity: string, site: string, first: boolean) {
  if (first) await page.goto(`${prefix(info)}/empresas?empresa=${fixture.companyId}`);
  else await page.getByRole('link', { name: 'Cambiar empresa o sede', exact: true }).click();
  await page.getByText(first ? 'Actuar por esta empresa' : 'Cambiar actividad o sede', { exact: true }).click();
  await page.getByLabel('Actividad autorizada', { exact: true }).selectOption(activity);
  await page.getByLabel('Establecimiento para operar', { exact: true }).selectOption(site);
  await page.getByRole('button', { name: 'Usar empresa y establecimiento', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Cambiar empresa o sede', exact: true })).toBeVisible();
}
test('la revocación impide abrir o repetir un eventual desde otra actividad', async ({ page }, info) => {
  await login(page, info, fixture.member.split('@')[0]);
  await choose(page, info, fixture.generatorActivityId, fixture.north, true);
  await page.goto(`${prefix(info)}/manifiestos/baja-intensidad?registro=${fixture.recordId}`);
  await expect(page.getByText(/QA transporte de contexto/).first()).toBeVisible();
  await choose(page, info, fixture.operatorActivityId, fixture.south, false);
  const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
  const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: fixture.generatorGrantId } });
  expect(grant.usuarioId).toBe(fixture.memberId); expect(grant.activa).toBe(true); expect(grant.revision).toBe(fixture.generatorGrantRevision);
  try {
    await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: false, revision: { increment: 1 } } });
    const apiResult = await page.evaluate(async ({ companyId, operatorActivityId, south, body }) => {
      const token = localStorage.getItem('sitrep_access_token');
      const response = await fetch('/api/manifiestos/baja-intensidad', { method: 'POST', headers: { Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json', 'X-SITREP-Empresa': companyId, 'X-SITREP-Empresa-Actividad': operatorActivityId, 'X-SITREP-Establecimiento': south }, body: JSON.stringify(body) });
      return response.status;
    }, fixture);
    expect(apiResult).toBe(409);
    await page.goto(`${prefix(info)}/manifiestos/baja-intensidad?registro=${fixture.recordId}`);
    await expect(page.getByRole('alert')).toContainText('no está disponible para esta actividad');
    await expect(page.getByText(/QA transporte de contexto/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Volver a Eventuales', exact: true }).click();
    await page.getByLabel('Buscar eventual', { exact: true }).fill('BI-' + fixture.recordId);
    await expect(page.getByText('No hay eventuales para estos filtros.')).toBeVisible();
    await expect(page.getByText(/QA transporte de contexto/)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('context-denied.png'), animations: 'disabled' });
  } finally {
    await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: grant.activa, revision: grant.revision } });
    await db.$disconnect();
  }
});
