import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from './helpers';

async function navigation(page: Page, info: TestInfo) {
  if (info.project.name !== 'web-desktop') {
    await page.getByRole('button', { name: info.project.name === 'app' ? 'Abrir menu' : 'Abrir menú', exact: true }).click();
  }
  return page.getByRole('navigation', { name: info.project.name === 'app' ? 'Menú de la aplicación' : 'Navegación principal', exact: true });
}

for (const category of [
  { path: 'generadores', label: 'Generadores', webLabel: 'Admin Generadores', actor: 'QA Generador 1', icon: 'factory' },
  { path: 'operadores', label: 'Operadores', webLabel: 'Admin Operadores', actor: 'QA Operador 1', icon: 'flask-conical' },
]) {
  test(`${category.label}: menu -> real list row -> detail, one active destination and stable focus`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 400) errors.push(response.status() + ' ' + new URL(response.url()).pathname); });
    await login(page, info);
    const menu = await navigation(page, info);
    const label = info.project.name === 'app' ? category.label : category.webLabel;
    const link = menu.getByRole('link', { name: label, exact: true });
    await expect(link.locator(`svg.lucide-${category.icon}`)).toHaveCount(1);
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (info.project.name === 'web-desktop') {
      const before = await link.boundingBox();
      await link.hover();
      await expect(link).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.1)');
      expect(await link.boundingBox()).toEqual(before);
    }
    await link.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(link).toBeFocused();
    expect(await link.evaluate(element => getComputedStyle(element).outlineWidth)).toBe('2px');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${prefix(info)}/admin/actores/${category.path}$`));
    const search = page.locator('main input[placeholder^="Buscar"]').first();
    await search.fill(category.actor);
    const name = page.locator('main').getByText(category.actor, { exact: true }).filter({ visible: true }).first();
    await expect(name).toBeVisible();
    await name.click();
    await expect(page).toHaveURL(new RegExp(`${prefix(info)}/admin/actores/${category.path}/[^/]+$`));
    await expect(page.getByRole('banner')).toContainText(label);
    await expect(page.locator('main')).toContainText(category.actor);
    const detailMenu = await navigation(page, info);
    await expect(detailMenu.locator('a[aria-current="page"]')).toHaveCount(1);
    await expect(detailMenu.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
    await detailMenu.getByRole('link', { name: label, exact: true }).scrollIntoViewIfNeeded();
    if (info.project.name === 'app') {
    const contrast = await detailMenu.getByRole('link', { name: label, exact: true }).evaluate(element => {
      const css = getComputedStyle(element);
      const luminance = (color: string) => {
        const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
          const s = value / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const text = luminance(css.color), background = luminance(css.backgroundColor);
      return { text: css.color, background: css.backgroundColor, ratio: (Math.max(text, background) + .05) / (Math.min(text, background) + .05) };
    });
    // The app uses an opaque background. Do not report a false ratio for web alpha/gradient layers.
    expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
    await info.attach('current-item-contrast', { body: JSON.stringify(contrast), contentType: 'application/json' });
    } else {
      await expect(detailMenu.getByRole('link', { name: label, exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)');
    }
    await expect(page).toHaveTitle(/SITREP/i);
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(category.path + '-detail-menu.png'), animations: 'disabled' });
    if (info.project.name === 'app') await page.getByRole('button', { name: 'Cerrar menu', exact: true }).click();
    else if (info.project.name === 'web-responsive') await page.locator('div.fixed.inset-0.bg-black\\/40').click({ position: { x: 348, y: 400 } });
    if (category.path === 'generadores') {
      const categoryCard = page.getByLabel('Categoría del generador', { exact: true });
      const categoryValue = categoryCard.getByText('GRAN GENERADOR', { exact: true });
      await expect(categoryValue).toBeVisible();
      await expect(categoryCard).not.toContainText('GRAN_GENERADOR');
      await expect(page.getByRole('heading', { name: category.actor, exact: true }).locator('..').getByText('GRAN GENERADOR', { exact: true })).toBeVisible();
      const cardBounds = (await categoryCard.boundingBox())!;
      const valueBounds = (await categoryValue.boundingBox())!;
      expect(cardBounds.x).toBeGreaterThanOrEqual(0);
      expect(cardBounds.x + cardBounds.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
      expect(valueBounds.x).toBeGreaterThanOrEqual(cardBounds.x);
      expect(valueBounds.x + valueBounds.width).toBeLessThanOrEqual(cardBounds.x + cardBounds.width + 1);
      expect(valueBounds.y + valueBounds.height).toBeLessThanOrEqual(cardBounds.y + cardBounds.height + 1);
      expect(await categoryValue.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expect(await categoryCard.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: info.outputPath(category.path + '-detail.png'), animations: 'disabled' });
    await info.attach('console-health', { body: JSON.stringify(errors), contentType: 'application/json' });
    expect(errors).toEqual([]);
  });
}
