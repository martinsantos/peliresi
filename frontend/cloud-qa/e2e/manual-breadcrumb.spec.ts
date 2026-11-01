import { expect, test, type Page } from '@playwright/test';
import { assertCloudDatabase } from '../safety';
import { login } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
async function positionHeading(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.evaluate(selector => {
    const target = document.querySelector(selector)!;
    const style = getComputedStyle(document.documentElement);
    const offset = parseInt(style.getPropertyValue('--header-height')) + parseInt(style.getPropertyValue('--breadcrumb-height')) + 8;
    window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - offset, behavior: 'instant' });
  }, selector);
}
test('ruta del directorio clara y accesible al filtrar por rol', async ({ page }, info) => {
  await login(page, info, 'generador');
  await page.goto('/manual/directorio.html');
  await positionHeading(page, '#cu-sistema h3');
  const breadcrumb = page.locator('.section-breadcrumb');
  await expect(breadcrumb).toHaveClass(/visible/);
  await expect.poll(() => breadcrumb.locator('.sb-sub').textContent(), { timeout: 15_000 }).toBe('7.5 Sistema');
  const system = breadcrumb.getByRole('button', { name: 'Ir a 7.5 Sistema', exact: true });
  await expect(system).toBeVisible();
  expect((await system.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await system.focus(); await expect(system).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.locator('#cu-sistema h3').evaluate(element => {
    const bar = document.querySelector('.section-breadcrumb')!.getBoundingClientRect();
    return element.getBoundingClientRect().top >= bar.bottom - 1;
  }), { timeout: 10_000 }).toBe(true);
  await page.locator('.role-tab[data-role="generador"]').click();
  await expect(page.locator('#cu-operador')).toBeHidden();
  await positionHeading(page, '#cu-generador h3');
  await expect.poll(() => breadcrumb.locator('.sb-sub').textContent(), { timeout: 15_000 }).toBe('7.2 Generador');
  await expect.poll(() => breadcrumb.locator('.sb-section').textContent(), { timeout: 15_000 }).toBe('7. Anexo: Casos de Uso');
  await expect(breadcrumb.getByRole('button', { name: 'Ir a 7.2 Generador', exact: true })).toBeVisible();
  await expect.poll(() => breadcrumb.locator('.sb-sub').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const chapter = breadcrumb.getByRole('button', { name: 'Ir a 7. Anexo: Casos de Uso', exact: true });
  await chapter.focus(); await expect(chapter).toBeFocused(); await page.keyboard.press('Space');
  await expect.poll(() => page.locator('#cu-generador h3').evaluate(element => {
    const bar = document.querySelector('.section-breadcrumb')!.getBoundingClientRect();
    const top = element.getBoundingClientRect().top;
    return top >= bar.bottom - 1 && top <= bar.bottom + 80;
  }), { timeout: 10_000 }).toBe(true);
  const geometry = await breadcrumb.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return { inside: bounds.left >= 0 && bounds.right <= innerWidth + 1,
      controls: Array.from(element.querySelectorAll('button')).filter(button => getComputedStyle(button).display !== 'none')
        .map(button => { const b = button.getBoundingClientRect(); return { height: b.height, contained: b.left >= bounds.left - 1 && b.right <= bounds.right + 1 }; }) };
  });
  expect(geometry.inside).toBe(true);
  for (const control of geometry.controls) { expect(control.height).toBeGreaterThanOrEqual(44); expect(control.contained).toBe(true); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('ruta-generador.png'), animations: 'disabled', scale: 'css' });
});
