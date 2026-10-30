import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from '../safety';
import { login, prefix } from './helpers';

const dir = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(readFileSync(path.join(dir, 'fixture.json'), 'utf8'));
const result = JSON.parse(readFileSync(path.join(dir, 'after-api.json'), 'utf8'));
test.beforeAll(async () => { await assertCloudDatabase(); expect(fixture.synthetic).toBe(true); expect(result.synthetic).toBe(true); });
async function selectCompany(page: Page, info: TestInfo, email: string, site: string) {
  await login(page, info, email.split('@')[0]);
  await page.goto(`${prefix(info)}/empresas?empresa=${fixture.companyId}`);
  await page.getByText('Actuar por esta empresa', { exact: true }).click();
  await page.getByLabel('Actividad autorizada', { exact: true }).selectOption(fixture.activityId);
  await page.getByLabel('Establecimiento para operar', { exact: true }).selectOption(site);
  await page.getByRole('button', { name: 'Usar empresa y establecimiento', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Cambiar empresa o sede', exact: true })).toBeVisible();
}
test('una persona limitada a Norte recibe una explicación antes de ver un eventual', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await selectCompany(page, info, fixture.member, fixture.north);
  const status = await page.evaluate(async ({ companyId, activityId, north, id }) => {
    const token = localStorage.getItem('sitrep_access_token');
    const response = await fetch('/api/manifiestos/baja-intensidad/' + id, { headers: { Authorization: 'Bearer ' + token,
      'X-SITREP-Empresa': companyId, 'X-SITREP-Empresa-Actividad': activityId, 'X-SITREP-Establecimiento': north } });
    return response.status;
  }, { ...fixture, id: result.ownerId });
  expect(status).toBe(403);
  await page.goto(`${prefix(info)}/manifiestos/baja-intensidad?registro=${result.ownerId}`);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('autorización para todos los establecimientos');
  await expect(page.getByText('QA transporte externo')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Aprobar|Registrar operación/ })).toHaveCount(0);
  const back = page.getByRole('link', { name: 'Volver a Manifiestos' }); await expect(back).toBeVisible();
  expect(await back.evaluate(el => { const r=el.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight && !!hit && (hit === el || el.contains(hit)); })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('site-limited.png'), animations: 'disabled' });
  await back.click(); await expect(page).toHaveURL(new RegExp(`${prefix(info)}/manifiestos$`));
});
test('el acceso completo conserva el eventual y oculta datos si se limita el permiso', async ({ page }, info) => {
  await selectCompany(page, info, fixture.owner, fixture.south);
  await page.goto(`${prefix(info)}/manifiestos/baja-intensidad?registro=${result.ownerId}`);
  await expect(page.getByText(/QA transporte externo/).first()).toBeVisible();
  const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
  const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: fixture.activityId, usuarioId: fixture.ownerId } } });
  expect(grant.todosEstablecimientos).toBe(true); expect(grant.activa).toBe(true);
  try {
    await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { todosEstablecimientos: false, establecimientoIds: [fixture.north], revision: { increment: 1 } } });
    await expect(page.getByRole('alert')).toContainText('Revisá tus permisos', { timeout: 20000 });
    await expect(page.getByText(/QA transporte externo/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Aprobar|Registrar retirado/ })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('revoked.png'), animations: 'disabled' });
  } finally {
    await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { todosEstablecimientos: grant.todosEstablecimientos,
      establecimientoIds: grant.establecimientoIds, revision: grant.revision } });
    await db.$disconnect();
  }
});
