import { expect, test } from '@playwright/test';
import { assertCloudDatabase } from '../safety';
import { login, prefix, readableFixedAction, readableWholeWords } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

for (const [user, label] of [['generador', 'Generador'], ['transportista', 'Transportista'], ['operador', 'Operador']] as const) {
  test(`${label}: identidad, avisos y navegación con texto ampliado`, async ({ page }, info) => {
    page.setDefaultTimeout(15000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 500) errors.push(`API ${response.status()}`); });
    await login(page, info, user);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`${prefix(info)}/notificaciones`);
    const header = page.getByRole('banner');
    await expect(header.getByRole('heading', { name: 'Avisos' })).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await readableWholeWords(header.getByRole('heading', { name: 'Avisos' }));
    const role = header.getByLabel('Función actual');
    await expect(role).toHaveText(label);
    await readableWholeWords(role);
    const bell = header.getByRole('button', { name: /^Notificaciones/ });
    for (const control of [header.getByRole('button', { name: 'Abrir menu' }), header.getByRole('button', { name: 'Ayuda y soporte técnico' }), bell]) {
      await readableFixedAction(control, header);
      expect((await control.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    }
    const nav = page.getByRole('navigation', { name: 'Navegación principal' });
    await expect(nav.getByRole('link', { name: /^Inspecciones$/ })).toHaveCount(0);
    const notices = nav.getByRole('link', { name: /Avisos/ });
    const links = nav.getByRole('link');
    await links.first().focus();
    for (let index = 1; index < await links.count(); index++) await page.keyboard.press('Tab');
    await expect(notices).toBeFocused();
    await expect(notices).toHaveAttribute('aria-current', 'page');
    const geometry = await nav.evaluate(element => {
      const bounds = element.getBoundingClientRect(), main = document.querySelector('main')!.getBoundingClientRect();
      const selected = element.querySelector('[aria-current="page"]')!.getBoundingClientRect();
      return { mainHeight: main.height, noOverlap: main.bottom <= bounds.top + 1,
        visible: selected.left >= bounds.left - 1 && selected.right <= bounds.right + 1 };
    });
    expect(geometry.mainHeight).toBeGreaterThan(80);
    expect(geometry).toMatchObject({ noOverlap: true, visible: true });
    await bell.focus(); await page.keyboard.press('Enter');
    const panel = page.getByRole('region', { name: 'Notificaciones recientes' });
    await expect(panel).toBeVisible();
    await readableWholeWords(panel.getByRole('heading', { name: 'Notificaciones' }));
    for (const name of ['Cerrar notificaciones', 'Ver todas las notificaciones']) {
      const action = panel.getByRole('button', { name, exact: true });
      await readableFixedAction(action, panel);
      await expect.poll(() => action.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
        return hit === element || Boolean(hit && element.contains(hit));
      })).toBe(true);
    }
    await page.screenshot({ path: info.outputPath(`${user}-campana-ampliada.png`), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Notificaciones recientes' })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`${user}-texto-ampliado.png`), animations: 'disabled' });
    expect(errors).toEqual([]);
  });
}
