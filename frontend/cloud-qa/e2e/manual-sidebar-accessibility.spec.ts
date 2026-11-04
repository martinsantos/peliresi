import { test, expect, devices } from '@playwright/test';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('manual index follows keyboard, search and mobile navigation', async ({ browser }, info) => {
  const mobile = info.project.name === 'app';
  const options = mobile ? { ...devices['Pixel 7'], viewport: { width: 320, height: 800 } }
    : { ...devices['Desktop Chrome'], viewport: { width: 1365, height: 900 } };
  const context = await browser.newContext({ ...options, baseURL: 'http://127.0.0.1:4177', serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await login(page, info, 'transportista');
    await page.goto(prefix(info) + '/ayuda');
    await expect(page.getByRole('link', { name: 'Manual completo', exact: true })).toHaveAttribute('href', '/manual/');
    await page.goto('/manual/directorio.html');
    await expect(page).toHaveTitle(/SITREP/i);
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    await expect(page.locator('.auth-wall')).toHaveCount(0);
    await expect(page.locator('#mainContent')).toContainText('SITREP');
    await expect(page.locator('#fg-6')).toHaveText('Aprobación de las tres partes');
    await expect(page.locator('#cu-generador')).toContainText('Una sola firma no habilita la coordinación');
    const sidebar = page.locator('#sidebar');
    const hamburger = page.locator('#hamburgerBtn');
    if (mobile) {
      await expect(sidebar).toHaveAttribute('inert', '');
      await expect(sidebar.getByRole('link', { name: 'Volver al inicio del directorio' })).toHaveCount(0);
      await expect(hamburger).toHaveAccessibleName('Abrir índice del manual');
      await hamburger.focus(); await page.keyboard.press('Enter');
      await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
      await expect(hamburger).toHaveAccessibleName('Cerrar índice del manual');
      await expect(sidebar).not.toHaveAttribute('inert', '');
    }
    const headings = sidebar.locator('button.nav-section-title');
    expect(await headings.count()).toBe(18);
    expect(await headings.evaluateAll(items => items.filter(item => {
      const id = item.getAttribute('aria-controls');
      return !id || !document.getElementById(id);
    }).length)).toBe(0);
    const chapter = sidebar.getByRole('button', { name: '3. Módulos del sistema', exact: true });
    const panelId = await chapter.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = page.locator('#' + panelId);
    await expect(chapter).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab'); await chapter.focus();
    expect(await chapter.evaluate(e => e.matches(':focus-visible') && parseFloat(getComputedStyle(e).outlineWidth) >= 2)).toBe(true);
    expect((await chapter.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await chapter.evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12);
    await page.keyboard.press('Enter');
    await expect(chapter).toHaveAttribute('aria-expanded', 'false'); await expect(panel).toBeHidden();
    await page.screenshot({ path: info.outputPath('manual-index-keyboard-' + info.project.name + '.png'), animations: 'disabled' });
    await page.keyboard.press('Tab');
    await expect(sidebar.getByRole('button', { name: '4. Aplicación móvil', exact: true })).toBeFocused();
    await expect(sidebar.getByRole('link', { name: '4.2 Navegación', exact: true })).toBeVisible();
    await page.keyboard.press('Shift+Tab'); await expect(chapter).toBeFocused();
    await page.keyboard.press('Space');
    await expect(chapter).toHaveAttribute('aria-expanded', 'true'); await expect(panel).toBeVisible();
    await page.keyboard.press('Enter');
    const search = sidebar.getByRole('searchbox', { name: 'Buscar en el directorio' });
    await search.fill('Manifiestos');
    await expect(chapter).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.getByRole('link', { name: '3.2 Manifiestos', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '1. Visión general', exact: true })).toBeHidden();
    await search.fill('sin coincidencias xyz');
    await expect(chapter).toBeHidden();
    await expect(sidebar.getByRole('status')).toHaveText('No encontramos temas. Probá con otra palabra.');
    await expect(sidebar.getByRole('link', { name: 'Volver al inicio del directorio' })).toBeVisible();
    await search.fill('aprobacion de las tres partes');
    await expect(sidebar.getByRole('link', { name: 'Aprobación de las tres partes', exact: true })).toBeVisible();
    await search.fill('Manifiestos');
    if (mobile) await hamburger.click();
    await page.locator('.role-tab[data-role="transportista"]').click();
    if (mobile) await hamburger.click();
    await expect(search).toHaveValue('Manifiestos');
    await expect(chapter).toBeVisible();
    await expect(panel.getByRole('link', { name: '3.2 Manifiestos', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '1. Visión general', exact: true })).toBeHidden();
    await search.clear();
    await expect(sidebar.getByRole('button', { name: '1. Visión general', exact: true })).toBeVisible();
    const manifestLink = panel.getByRole('link', { name: '3.2 Manifiestos', exact: true });
    await manifestLink.click();
    await expect(page).toHaveURL(/#mod-manifiestos$/);
    if (mobile) await hamburger.click();
    await expect(manifestLink).toHaveAttribute('aria-current', 'location');
    const longGroup = sidebar.getByRole('button', { name: '14. Flujos por perfil', exact: true });
    await expect(longGroup).toHaveAttribute('aria-expanded', 'true');
    const longId = await longGroup.getAttribute('aria-controls');
    expect(await page.locator('#' + longId).evaluate(element => {
      const last = element.querySelector('a:last-child')!.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return last.bottom <= bounds.bottom + 1;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await longGroup.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('manual-index-' + info.project.name + '.png'), animations: 'disabled' });
    if (mobile) {
      await page.keyboard.press('Escape');
      await expect(hamburger).toHaveAttribute('aria-expanded', 'false'); await expect(hamburger).toBeFocused();
      await expect(hamburger).toHaveAccessibleName('Abrir índice del manual');
      await expect(sidebar).toHaveAttribute('inert', '');
      await page.setViewportSize({ width: 1365, height: 900 }); await expect(sidebar).not.toHaveAttribute('inert', '');
      await page.setViewportSize({ width: 320, height: 800 }); await expect(sidebar).toHaveAttribute('inert', '');
      await hamburger.click();
      await sidebar.getByRole('link', { name: 'Volver al inicio del directorio' }).click();
      await expect(page).toHaveURL(/#mainContent$/); await expect(sidebar).toHaveAttribute('inert', '');
    }
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally { await context.close(); }
});
