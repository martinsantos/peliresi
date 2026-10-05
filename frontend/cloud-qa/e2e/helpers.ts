import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/** A real notice must not cover the identity, tabs or the scrollable workspace. */
export async function nonObstructingNotices(page: Page) {
  const notice = page.getByRole('region', { name: 'Avisos del sistema', exact: true });
  await expect(notice).toBeVisible();
  const geometry = await notice.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const overlaps = (other: Element | null) => {
      if (!other) return false;
      const r = other.getBoundingClientRect();
      return Math.min(rect.right, r.right) - Math.max(rect.left, r.left) > 1
        && Math.min(rect.bottom, r.bottom) - Math.max(rect.top, r.top) > 1;
    };
    const viewport = visualViewport;
    return {
      headerOverlap: overlaps(document.querySelector('header')),
      formOverlap: overlaps(document.querySelector('main')),
      overlayPosition: ['fixed', 'absolute'].includes(getComputedStyle(element).position),
      insideViewport: rect.top >= (viewport?.offsetTop ?? 0) - 1
        && rect.bottom <= (viewport ? viewport.offsetTop + viewport.height : innerHeight) + 1,
    };
  });
  expect(geometry).toEqual({ headerOverlap: false, formOverlap: false, overlayPosition: false, insideViewport: true });
  await readableFixedAction(notice.getByRole('button', { name: 'Cerrar notificación' }).first(), notice);
}

/** Page overflow alone misses clipped text in fixed navigation and dialog actions. */
export async function readableFixedAction(action: Locator, container: Locator) {
  await expect(action).toBeVisible();
  const containerBounds = await container.boundingBox();
  expect(containerBounds).not.toBeNull();
  const result = await action.evaluate((element, parent) => {
    const bounds = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    const visible = { left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0,
      right: (viewport?.offsetLeft ?? 0) + (viewport?.width ?? document.documentElement.clientWidth),
      bottom: (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) };
    const inside = (rect: { left: number; right: number; top: number; bottom: number }, area: typeof visible) =>
      rect.left >= area.left - 1 && rect.right <= area.right + 1 && rect.top >= area.top - 1 && rect.bottom <= area.bottom + 1;
    const texts: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.trim()) {
        const range = document.createRange(); range.selectNodeContents(node);
        texts.push(...Array.from(range.getClientRects()).map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })));
      }
      node = walker.nextNode();
    }
    return { name: element.textContent?.trim(), width: bounds.width, height: bounds.height,
      button: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }, visible,
      containedByParent: inside(bounds, { left: parent.x, top: parent.y, right: parent.x + parent.width, bottom: parent.y + parent.height }),
      containedByViewport: inside(bounds, visible), textContained: texts.every(rect => inside(rect, bounds)), texts };
  }, containerBounds!);
  expect(result, `Readable fixed action: ${result.name}`).toMatchObject({ containedByParent: true, containedByViewport: true, textContained: true });
  expect(result.height).toBeGreaterThanOrEqual(44);
}

/** Real text geometry, not just a page-overflow check: long names/counts must not collide. */
export async function readableMapLayers(group: Locator) {
  for (const button of await group.getByRole('button').all()) {
    const result = await button.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const content = { left: bounds.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
        right: bounds.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
        top: bounds.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop),
        bottom: bounds.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom) };
      const pieces = Array.from(element.querySelectorAll('[data-map-label], [data-map-count]')).flatMap(text => {
        const range = document.createRange(); range.selectNodeContents(text);
        return Array.from(range.getClientRects()).map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
      });
      const state = element.querySelector('[data-map-state]')!.getBoundingClientRect();
      const collides = pieces.some(rect => Math.min(rect.right, state.right) - Math.max(rect.left, state.left) > 1 && Math.min(rect.bottom, state.bottom) - Math.max(rect.top, state.top) > 1);
      const contained = pieces.every(rect => rect.left >= bounds.left && rect.right <= bounds.right + 1 && rect.top >= bounds.top && rect.bottom <= bounds.bottom + 1);
      const padded = pieces.every(rect => rect.left >= content.left - 1 && rect.right <= content.right + 1 && rect.top >= content.top - 1 && rect.bottom <= content.bottom + 1);
      return { name: element.getAttribute('aria-label'), collides, contained, padded, height: bounds.height };
    });
    expect(result, `Readable map control: ${result.name}`).toMatchObject({ collides: false, contained: true, padded: true });
    expect(result.height).toBeGreaterThanOrEqual(44);
  }
}

export const prefix = (info: TestInfo) => info.project.name === 'app' ? '/app' : '';

/** Real synthetic-account login; no auth storage or business API interception. */
export async function login(page: Page, info: TestInfo, user = 'admin', options: { showWelcome?: boolean } = {}) {
  // Metadata consumed only by the loopback QA reverse proxy. Login still goes
  // through the real form and real backend; this cookie carries no credentials.
  await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.11.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`, url: 'http://127.0.0.1:4177' }]);
  if (!options.showWelcome) await page.addInitScript(() => {
    // Only presentation preferences. Authentication still uses the actual form.
    for (const role of ['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'AUDITOR',
      'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR', 'INSPECTOR']) localStorage.setItem(`sitrep_onboarding_${role}`, 'true');
  });
  await page.goto(`${prefix(info)}/login`);
  await page.getByLabel('Correo electrónico o CUIT').fill(`${user}@night-qa.invalid`);
  await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const response = page.waitForResponse(res => res.url().endsWith('/api/auth/login') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page.getByRole('banner')).toBeVisible();
  const skipWelcome = page.getByRole('button', { name: 'Saltar introducción', exact: true });
  if (!options.showWelcome && await skipWelcome.isVisible()) await skipWelcome.click();
}

export async function createSpontaneousInspection(page: Page, info: TestInfo) {
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill('QA hallazgo sintético de resiliencia');
  await page.getByLabel('Ubicación prevista').fill('QA lugar sintético sin actor');
  const response = page.waitForResponse(res => res.url().endsWith('/api/inspecciones') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  const saved = await response;
  expect(saved.status()).toBe(201);
  const inspection = (await saved.json()).data;
  await page.getByRole('navigation', { name: 'Secciones del expediente' }).getByRole('link', { name: 'Registro', exact: true }).click();
  await expect(page.locator('#inspection-observations')).toBeVisible();
  return inspection as { id: string; numero: string; items: Array<{ id: string; etiqueta: string }> };
}
