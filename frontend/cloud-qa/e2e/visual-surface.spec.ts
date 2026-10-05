import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createSpontaneousInspection, login, prefix } from './helpers';

/** Evidence is scoped to a route, role, viewport and state, never "all UI passed". */
type Surface = { name: string; route: string; state?: string; expectedFailure?: boolean };

async function capture(page: Page, info: TestInfo, surface: Surface) {
  const errors: string[] = [];
  const onError = (error: Error) => errors.push(error.message);
  page.on('pageerror', onError);
  await page.goto(prefix(info) + surface.route);
  await expect(page.locator('body')).not.toBeEmpty();
  await expect.poll(() => page.locator('body').innerText(), { timeout: 15000 }).not.toMatch(/^\s*(Cargando[.\s…]*)?$/);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  // Wait for actual pending queries, not an arbitrary delay or fake response.
  await expect.poll(() => page.locator('[aria-busy="true"]').count(), { timeout: 15000 }).toBe(0);
  const measurement = await page.evaluate(() => {
    type Color = [number, number, number, number];
    const color = (css: string): Color | null => {
      const numbers = css.match(/[\d.]+/g)?.map(Number);
      return numbers && numbers.length >= 3 ? [numbers[0], numbers[1], numbers[2], numbers[3] ?? 1] : null;
    };
    const over = (front: Color, back: Color): Color => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [0, 1, 2].map(i => alpha ? (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / alpha : 0)
        .concat(alpha) as Color;
    };
    const luminance = (value: Color) => {
      const channels = value.slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    };
    const findings: Array<Record<string, unknown>> = [];
    let measured = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const element = node.parentElement;
      const text = node.textContent?.trim();
      if (!element || !text || element.closest('script,style,option,[aria-hidden="true"]')) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const bounds = range.getBoundingClientRect();
      if (!bounds.width || !bounds.height || bounds.bottom <= 0 || bounds.top >= innerHeight || bounds.right <= 0 || bounds.left >= innerWidth) continue;
      const chain: Element[] = [];
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) chain.push(ancestor);
      const styles = chain.map(e => getComputedStyle(e));
      if (styles.some(s => s.visibility !== 'visible' || s.display === 'none' || Number(s.opacity) === 0)) continue;
      const unsupported = styles.some(s => s.backgroundImage !== 'none' || Number(s.opacity) !== 1 || s.mixBlendMode !== 'normal' || s.filter !== 'none');
      const style = styles[0];
      const foreground = color(style.color);
      const disabled = !!element.closest(':disabled,[aria-disabled="true"]');
      const record = { text: text.slice(0, 140), tag: element.tagName, className: element.getAttribute('class'),
        foreground: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight, disabled,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
      if (unsupported || !foreground) { findings.push({ ...record, kind: 'contrast-unmeasured', reason: 'image/gradient/opacity/filter or unsupported color' }); continue; }
      let background: Color = [255, 255, 255, 1];
      for (const s of [...styles].reverse()) {
        const layer = color(s.backgroundColor);
        if (layer) background = over(layer, background);
      }
      const ink = over(foreground, background);
      const values = [luminance(ink), luminance(background)].sort((a, b) => b - a);
      const ratio = (values[0] + .05) / (values[1] + .05);
      const size = parseFloat(style.fontSize);
      const threshold = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
      measured++;
      if (ratio < threshold) findings.push({ ...record, kind: disabled ? 'disabled-contrast-review' : 'contrast-candidate', background, ratio, threshold });
    }
    const icons = Array.from(document.querySelectorAll('svg[class*="lucide"]')).flatMap(element => {
      const r = element.getBoundingClientRect();
      if (!r.width || !r.height || r.top >= innerHeight || r.bottom <= 0) return [];
      const style = getComputedStyle(element);
      return [{ className: element.getAttribute('class'), stroke: style.stroke, width: r.width, height: r.height,
        parentBackground: getComputedStyle(element.parentElement!).backgroundColor, nearby: element.parentElement?.textContent?.trim().slice(0, 100) }];
    });
    return { url: location.href, viewport: { width: innerWidth, height: innerHeight },
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      title: document.title, headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(e => e.textContent?.trim()),
      measuredTextNodes: measured, findings, icons };
  });
  await page.screenshot({ path: info.outputPath(`${surface.name}.png`), animations: 'disabled' });
  await info.attach(surface.name, { body: JSON.stringify({ ...surface, ...measurement, errors,
    captureScope: 'first viewport; not all scroll positions or interaction states', businessAPIIntercepted: false,
    physicalAndroid: false, visuallyReviewed: false }, null, 2), contentType: 'application/json' });
  page.off('pageerror', onError);
  expect.soft(errors, surface.name + ' unhandled exceptions').toEqual([]);
  expect.soft(measurement.overflow, surface.name + ' document overflow').toBeLessThanOrEqual(1);
  if (!surface.expectedFailure) expect.soft(await page.locator('body').innerText(), surface.name + ' unexpected dead end').not.toMatch(/Página no encontrada|Error al cargar/);
}

test('visual inventory: public entry, recovery and explicit error states', async ({ page }, info) => {
  test.setTimeout(180000);
  const surfaces: Surface[] = [
    { name: 'public-login', route: '/login' },
    { name: 'public-register', route: '/registro' },
    { name: 'public-recovery', route: '/recuperar' },
    { name: 'public-claim', route: '/reclamar' },
    { name: 'public-reset-without-token', route: '/reset-password', state: 'missing token', expectedFailure: true },
    { name: 'public-generator-registration', route: '/inscripcion/generador' },
    { name: 'public-transporter-registration', route: '/inscripcion/transportista' },
    { name: 'public-operator-registration', route: '/inscripcion/operador' },
    { name: 'public-verification', route: '/manifiestos/verificar/2026-990001' },
    { name: 'public-verification-not-found', route: '/manifiestos/verificar/QA-NO-EXISTE', state: 'missing record', expectedFailure: true },
    { name: 'public-inspection-invalid-token', route: '/verificar/inspecciones/QA-NO-EXISTE', state: 'invalid token', expectedFailure: true },
    { name: 'not-found', route: '/qa-route-does-not-exist', expectedFailure: true },
  ];
  for (const surface of surfaces) await test.step(surface.name, () => capture(page, info, surface));
});

test('visual inventory: authenticated workspaces, ABM and actor forms', async ({ page }, info) => {
  test.setTimeout(360000);
  const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  expect(fixture.database).toBe('sitrep_night_qa_20260926');
  expect(fixture.externalDelivery).toBe(false);
  await login(page, info);
  const surfaces: Surface[] = [
    { name: 'dashboard', route: '/dashboard' }, { name: 'control', route: '/centro-control' },
    { name: 'monitor-live', route: '/monitor' }, { name: 'manifests', route: '/manifiestos' },
    { name: 'manifest-detail', route: `/manifiestos/${fixture.deviceManifest.id}` },
    { name: 'manifest-new', route: '/manifiestos/nuevo' }, { name: 'inspections', route: '/inspecciones' },
    { name: 'reports', route: '/reportes' }, { name: 'alerts', route: '/alertas' },
    { name: 'notifications', route: '/notificaciones' }, { name: 'configuration', route: '/configuracion' },
    { name: 'profile', route: '/mi-perfil' }, { name: 'help', route: '/ayuda' },
    { name: 'switcher', route: '/switch-user' }, { name: 'users', route: '/admin/usuarios' },
    { name: 'actors', route: '/admin/actores' }, { name: 'generators', route: '/admin/actores/generadores' },
    { name: 'generator-detail', route: `/admin/actores/generadores/${fixture.actors.generador}` },
    { name: 'generator-new', route: '/admin/actores/generadores/nuevo' },
    { name: 'generator-edit', route: `/admin/actores/generadores/${fixture.actors.generador}/editar` },
    { name: 'transporters', route: '/admin/actores/transportistas' },
    { name: 'transporter-detail', route: `/admin/actores/transportistas/${fixture.actors.transportista}` },
    { name: 'transporter-new', route: '/admin/actores/transportistas/nuevo' },
    { name: 'transporter-edit', route: `/admin/actores/transportistas/${fixture.actors.transportista}/editar` },
    { name: 'operators', route: '/admin/actores/operadores' },
    { name: 'operator-detail', route: `/admin/actores/operadores/${fixture.actors.operador}` },
    { name: 'operator-new', route: '/admin/actores/operadores/nuevo' },
    { name: 'operator-edit', route: `/admin/actores/operadores/${fixture.actors.operador}/editar` },
    { name: 'renewals', route: '/admin/renovaciones' }, { name: 'requests', route: '/admin/solicitudes' },
    { name: 'vehicles', route: '/admin/vehiculos' }, { name: 'wastes', route: '/admin/residuos' },
    { name: 'treatments', route: '/admin/tratamientos' }, { name: 'blockchain', route: '/admin/blockchain' },
    { name: 'audit', route: '/admin/auditoria' }, { name: 'bulk-upload', route: '/admin/carga-masiva' },
  ];
  for (const surface of surfaces) await test.step(surface.name, () => capture(page, info, surface));
  const inspection = await createSpontaneousInspection(page, info);
  for (const [hash, name] of [['resumen', 'visit'], ['checklist', 'controls'], ['acta', 'record'], ['evidencias', 'evidence'], ['expediente', 'file']]) {
    await test.step('inspection-' + name, () => capture(page, info, { name: 'inspection-' + name,
      route: `/inspecciones/${inspection.id}#${hash}`, state: 'synthetic spontaneous inspection draft' }));
  }
  // List every registered path too. Uncaptured aliases and states stay pending;
  // this prevents a capture count from being represented as 100% of the product.
  const routes = {} as Record<string, string[]>;
  for (const source of ['App.tsx', 'AppMobile.tsx']) {
    const content = await readFile(path.join(process.cwd(), 'src-v6', source), 'utf8');
    routes[source] = [...new Set(Array.from(content.matchAll(/<Route\b[^>]*\bpath="([^"]+)"/g), match => match[1]))];
  }
  await info.attach('registered-route-inventory', { body: JSON.stringify({ routes, captured: surfaces,
    pending: 'aliases, additional roles, full scroll positions, hover/focus/disabled/loading/error/modals unless separately exercised; physical APK and hardware',
    businessAPIIntercepted: false, role: 'ADMIN', viewport: page.viewportSize() }, null, 2), contentType: 'application/json' });
});

for (const user of ['generador', 'transportista', 'operador', 'inspector', 'lector-generadores']) {
  test(`visual inventory: ${user} dashboard and global operation`, async ({ page }, info) => {
    test.setTimeout(90000);
    await login(page, info, user);
    for (const [name, route] of [['dashboard', '/dashboard'], ['control', '/centro-control'], ['monitor', '/monitor']]) {
      await capture(page, info, { name: `${user}-${name}`, route, state: user });
    }
  });
}
