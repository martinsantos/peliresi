import { expect, test, type Page } from '@playwright/test';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

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
  const breadcrumb = page.locator('.section-breadcrumb');
  await expect(breadcrumb).toHaveAttribute('aria-hidden', 'true');
  await expect(breadcrumb.locator('button')).toHaveCount(3);
  for (const button of await breadcrumb.locator('button').all()) await expect(button).toHaveAttribute('tabindex', '-1');
  await positionHeading(page, '#cu-sistema h3');
  await expect(breadcrumb).toHaveClass(/visible/);
  await expect(breadcrumb).toHaveAttribute('aria-label', 'Ruta del directorio');
  await expect(breadcrumb).toHaveAttribute('aria-hidden', 'false');
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
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await page.evaluate(() => ({ scroll: getComputedStyle(document.documentElement).scrollBehavior,
    breadcrumb: getComputedStyle(document.querySelector('.section-breadcrumb')!).transitionDuration }));
  expect(motion).toEqual({ scroll: 'auto', breadcrumb: '0s' });
});

test('la ruta conserva el foco hasta que la persona sale de ella', async ({ page }, info) => {
  await login(page, info, 'generador');
  await page.goto('/manual/directorio.html');
  await positionHeading(page, '#cu-sistema h3');
  const breadcrumb = page.locator('.section-breadcrumb');
  const link = breadcrumb.getByRole('button', { name: 'Ir a 7.5 Sistema', exact: true });
  await expect(link).toBeVisible(); await link.focus(); await expect(link).toBeFocused();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(link).toBeFocused();
  await expect(breadcrumb).toHaveClass(/visible/);
  await expect(breadcrumb).toHaveAttribute('aria-hidden', 'false');
  await link.evaluate(element => (element as HTMLElement).blur());
  await expect(breadcrumb).not.toHaveClass(/visible/);
  await expect(breadcrumb).toHaveAttribute('aria-hidden', 'true');
});


test('el ancla se alinea y respeta el desplazamiento de la persona', async ({ page }, info) => {
  await login(page, info, 'generador');
  await page.goto(prefix(info) + '/manual/directorio.html');
  await expect(page.locator('#guia-operador')).toBeAttached();
  await page.waitForLoadState('load');
  await page.waitForTimeout(900);

  async function openAnchor() {
    await page.evaluate(() => {
      history.replaceState(null, '', '#guia-generador');
      location.hash = '#guia-operador';
    });
    await expect.poll(() => page.locator('#guia-operador').evaluate(element => {
      const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--scroll-offset'), 10) || 122;
      return Math.abs(element.getBoundingClientRect().top - offset) < 80;
    })).toBe(true);
  }

  await openAnchor();
  await page.waitForTimeout(900);
  expect(await page.locator('#guia-operador').evaluate(element => {
    const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--scroll-offset'), 10) || 122;
    return Math.abs(element.getBoundingClientRect().top - offset) < 80;
  })).toBe(true);

  await openAnchor();
  const before = await page.evaluate(() => window.scrollY);
  if (info.project.name === 'app' || info.project.name === 'web-narrow') {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 220, y: 650 }] });
    await page.waitForTimeout(60);
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 220, y: 250 }] });
    await page.waitForTimeout(60);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    const viewport = page.viewportSize()!;
    await page.mouse.move(viewport.width - 50, 450);
    await page.mouse.wheel(0, 550);
  }
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 150);
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 150);
});
