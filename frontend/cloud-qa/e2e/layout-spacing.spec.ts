import { expect, test, type Page } from '@playwright/test';
import { createSpontaneousInspection, login, prefix } from './helpers';

async function pageFrame(page: Page) {
  const frame = page.locator('[data-operational-page]');
  await expect(frame).toBeVisible();
  const measurement = await frame.evaluate(element => {
    const main = element.closest('main')!.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return { inset: rect.top - main.top, left: rect.left, right: rect.right,
      overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(measurement.inset, 'Exactly one top gutter, including the mobile shell').toBe(16);
  expect(measurement.overflow).toBeLessThanOrEqual(1);
  return measurement;
}

test('lists, detail and creation share navigation alignment at narrow and wide widths', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info);
  const widths = info.project.name === 'web-desktop' ? [1440, 1920] : [390, 320];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const edges: Array<{ left: number; right: number }> = [];
    for (const route of ['manifiestos', 'inspecciones']) {
      await page.goto(prefix(info) + '/' + route);
      const toolbar = page.locator('[data-page-toolbar]');
      await expect(toolbar).toBeVisible();
      edges.push(await pageFrame(page));
      for (const action of await toolbar.locator('button:visible, a:visible').all()) {
        const box = await action.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      const heading = page.getByRole('banner').getByRole('heading');
      await expect(heading).toHaveText(route === 'manifiestos' ? 'Manifiestos' : 'Inspecciones');
      await page.screenshot({ path: info.outputPath(route + '-' + width + '.png'), animations: 'disabled' });
    }
    expect(edges[0]).toMatchObject({ left: edges[1].left, right: edges[1].right });
  }
  await page.goto(prefix(info) + '/manifiestos');
  await page.getByRole('button', { name: /^Ver manifiesto / }).filter({ visible: true }).first().click();
  const back = page.getByRole('button', { name: 'Volver a Manifiestos', exact: true });
  await expect(back).toBeVisible();
  await pageFrame(page);
  expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('a button')).toHaveCount(0);
  await back.click();
  await expect(page).toHaveURL(new RegExp(prefix(info) + '/manifiestos$'));
  await page.getByRole('button', { name: 'Nuevo Manifiesto', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Etapas del formulario' })).toBeVisible();
  await pageFrame(page);
  await page.getByRole('button', { name: 'Volver a Manifiestos', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(prefix(info) + '/manifiestos$'));
  expect(errors).toEqual([]);
});

test('inspection keeps return and downloads above its identity and preserves field navigation', async ({ page }, info) => {
  test.setTimeout(120000);
  await login(page, info);
  const record = await createSpontaneousInspection(page, info);
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(size);
    const back = page.getByRole('button', { name: 'Volver a Inspecciones', exact: true });
    await expect(back).toBeVisible();
    await pageFrame(page);
    const identity = await page.getByTestId('inspection-case-identity').boundingBox();
    const actions = await page.getByTestId('inspection-case-actions').boundingBox();
    expect(actions!.y + actions!.height).toBeLessThanOrEqual(identity!.y);
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('navigation', { name: 'Secciones del expediente', exact: true })).toBeVisible();
    const save = page.getByRole('button', { name: 'Guardar cambios', exact: true });
    await expect(save).toBeVisible();
    await save.scrollIntoViewIfNeeded();
    expect(await save.evaluate(element => {
      const b = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
    }), 'Save is not covered by a header, support bubble or bottom navigation').toBe(true);
    await page.screenshot({ path: info.outputPath('expediente-' + size.width + '.png'), animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Volver a Inspecciones', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(prefix(info) + '/inspecciones$'));
  await expect(page.getByRole('link', { name: new RegExp('(Abrir|Retomar) expediente ' + record.numero) })).toBeVisible();
});
