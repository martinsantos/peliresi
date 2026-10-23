import { expect, test } from '@playwright/test';
import { login, prefix, readableWholeWords } from './helpers';

for (const role of ['admin', 'generador', 'transportista', 'operador']) {
  test(`${role}: compact agenda preserves context, decisions and app navigation`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await login(page, info, role);
    await expect(page.getByRole('banner').getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible();
    const agenda = page.getByRole('region', { name: 'Agenda de manifiestos' });
    await expect(agenda).toBeVisible();
    await expect(agenda.getByRole('region', { name: 'Aprobaciones pendientes' })).toHaveCount(0);
    await agenda.getByRole('button', { name: 'Por aprobar', exact: true }).click();
    await expect(agenda.getByRole('button', { name: 'Por aprobar', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const row = agenda.locator('[data-agenda-row]').first();
    await expect(row).toBeVisible();
    const link = row.getByRole('link');
    await expect(link).toHaveAttribute('title', /Falta aprobar:/);
    await expect(row.getByRole('list', { name: 'Aprobaciones' }).getByRole('listitem')).toHaveCount(3);
    await expect(row).not.toContainText('Falta aprobar:');
    const target = await link.getAttribute('href');
    expect(target).toMatch(new RegExp('^' + prefix(info) + '/manifiestos/'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(role + '-agenda.png'), animations: 'disabled' });
    await link.click();
    const approvals = page.getByRole('region', { name: 'Aprobaciones de las partes' });
    await expect(approvals).toBeVisible();
    await expect(approvals.getByRole('button', { name: 'Actualizar aprobaciones' })).toHaveCount(1);
    await expect(approvals.getByRole('listitem')).toHaveCount(3);
    if (role === 'admin') {
      await expect(approvals.getByRole('button', { name: /Aprobar como|Firmar Manifiesto/ })).toHaveCount(0);
    } else {
      await expect(approvals.getByRole('button', { name: /Aprobar como|Firmar Manifiesto/ })).toBeVisible();
    }
    await page.screenshot({ path: info.outputPath(role + '-approvals.png'), animations: 'disabled' });
    await page.goto(prefix(info) + '/manifiestos/nuevo');
    await expect(page.getByRole('list', { name: 'Etapas del formulario' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nuevo Manifiesto', exact: true })).toHaveCount(1);
    await expect(page.getByText('Sin guardar', { exact: true })).toHaveCount(0);
    await page.getByText('Cómo se aprueba', { exact: true }).click();
    await expect(page.getByText(/Generador, transporte y operador deben aprobar desde sus cuentas antes del retiro/)).toBeVisible();
    if (role === 'admin') {
      await expect(page.getByText(/Tu empresa queda vinculada a tu rol/)).toHaveCount(0);
    } else {
      await expect(page.getByText(/Tu empresa queda vinculada a tu rol/)).toBeVisible();
    }
    await page.getByText('Cómo se aprueba', { exact: true }).click();
    await readableWholeWords(page.getByRole('list', { name: 'Etapas del formulario' }));
    const back = page.getByRole('button', { name: 'Volver a Manifiestos', exact: true });
    if (await back.getByText('Manifiestos', { exact: true }).isVisible()) {
      const icon = await back.locator('svg').boundingBox();
      const label = await back.getByText('Manifiestos', { exact: true }).boundingBox();
      expect(icon).not.toBeNull();
      expect(label).not.toBeNull();
      expect(Math.abs(icon!.y + icon!.height / 2 - label!.y - label!.height / 2)).toBeLessThanOrEqual(2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(role + '-form.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Volver a Manifiestos', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(prefix(info) + '/manifiestos$'));
    expect(errors).toEqual([]);
  });
}

test('inspection agenda expands without disguising the selected phase', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info);
  await page.goto(prefix(info) + '/inspecciones');
  const phases = page.getByRole('navigation', { name: 'Etapas PSIP' });
  await phases.getByRole('button', { name: /^Seguimiento/ }).click();
  await page.getByRole('button', { name: 'Ver agenda', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ocultar agenda' })).toHaveAttribute('aria-expanded', 'true');
  await expect(phases.getByRole('button', { name: /^Seguimiento/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#inspection-agenda')).toBeVisible();
  await page.getByRole('button', { name: 'Ocultar agenda' }).click();
  await expect(page.locator('#inspection-agenda')).toHaveCount(0);
  await expect(phases.getByRole('button', { name: /^Seguimiento/ })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: info.outputPath('inspections.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
