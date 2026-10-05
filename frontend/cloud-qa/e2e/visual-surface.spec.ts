import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createSpontaneousInspection, login, prefix, readablePageHeading, readableWholeWords } from './helpers';
import { ACTOR_COLORS } from '../../src-v6/utils/actor-identity';

/** Evidence is scoped to a route, role, viewport and state, never "all UI passed". */
type Surface = { name: string; route: string; state?: string; expectedFailure?: boolean; viewportPosition?: 'start' | 'end' };

async function capture(page: Page, info: TestInfo, surface: Surface, navigate = true) {
  const errors: string[] = [];
  const onError = (error: Error) => errors.push(error.message);
  page.on('pageerror', onError);
  if (navigate) await page.goto(prefix(info) + surface.route);
  // Initial HTML, auth and lazy-route fallbacks are NOT page evidence. The
  // baseline exposed false-green screenshots of "Cargando SITREP...".
  await expect(page.locator('#root').locator('h1:visible,h2:visible,h3:visible,form:visible,header:visible,.wr-layout:visible').first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/^Cargando(?:\s.*|[.\s…]*)$/).filter({ visible: true })).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator('[class*="animate-spin"]:visible')).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  // Wait for actual pending queries, not an arbitrary delay or fake response.
  await expect.poll(() => page.locator('[aria-busy="true"]').count(), { timeout: 15000 }).toBe(0);
  await page.evaluate(() => document.fonts.ready);
  const headerTitle = await readablePageHeading(page);
  const roleBadge = page.locator('header [aria-label="Función actual"]:visible');
  const roleReading = await roleBadge.count() ? await readableWholeWords(roleBadge) : null;
  const measurement = await page.evaluate(() => {
    type Color = [number, number, number, number];
    const color = (css: string): Color | null => {
      const numbers = css.match(/[\d.]+/g)?.map(Number);
      return css.startsWith('rgb') && numbers && numbers.length >= 3 ? [numbers[0], numbers[1], numbers[2], numbers[3] ?? 1] : null;
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
    let measuredSvgTextNodes = 0;
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
      // An opaque child background hides a gradient/image behind it. Opacity,
      // filters and blending still affect descendants even across that boundary.
      let unsupported = styles.some(s => Number(s.opacity) !== 1 || s.mixBlendMode !== 'normal' || s.filter !== 'none');
      const layers: Color[] = [];
      for (const s of styles) {
        const layer = color(s.backgroundColor);
        if (s.backgroundImage !== 'none' || !layer) { unsupported = true; break; }
        layers.push(layer);
        if (layer[3] === 1) break;
      }
      const style = styles[0];
      // SVG text is painted with fill, NOT the HTML color inherited by tspan.
      // Checking color alone made pale chart axes look compliant in QA89.
      const foregroundProperty = element.namespaceURI === 'http://www.w3.org/2000/svg' ? 'fill' : 'color';
      const foregroundCss = style[foregroundProperty];
      const foreground = color(foregroundCss);
      const disabled = !!element.closest(':disabled,[aria-disabled="true"]');
      const record = { text: text.slice(0, 140), tag: element.tagName, className: element.getAttribute('class'),
        foreground: foregroundCss, foregroundProperty, fontSize: style.fontSize, fontWeight: style.fontWeight, disabled,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
      if (unsupported || !foreground) { findings.push({ ...record, kind: 'contrast-unmeasured', reason: 'image/gradient/opacity/filter or unsupported color' }); continue; }
      let background: Color = [255, 255, 255, 1];
      for (const layer of layers.reverse()) background = over(layer, background);
      const ink = over(foreground, background);
      const values = [luminance(ink), luminance(background)].sort((a, b) => b - a);
      const ratio = (values[0] + .05) / (values[1] + .05);
      const size = parseFloat(style.fontSize);
      const threshold = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
      measured++;
      if (foregroundProperty === 'fill') measuredSvgTextNodes++;
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
      scroll: { windowY: scrollY, main: Array.from(document.querySelectorAll('main')).map(el => ({ top: el.scrollTop, height: el.clientHeight, contentHeight: el.scrollHeight })) },
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      title: document.title, headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(e => e.textContent?.trim()),
      measuredTextNodes: measured, measuredSvgTextNodes, findings, icons };
  });
  await page.screenshot({ path: info.outputPath(`${surface.name}.png`), animations: 'disabled', scale: 'css' });
  await info.attach(surface.name, { body: JSON.stringify({ ...surface, ...measurement, headerTitle, roleReading, errors,
    captureScope: surface.viewportPosition ? `current viewport at ${surface.viewportPosition}; not all intermediate scroll positions or interaction states` : 'first viewport; not all scroll positions or interaction states', businessAPIIntercepted: false,
    physicalAndroid: false, visuallyReviewed: false }, null, 2), contentType: 'application/json' });
  page.off('pageerror', onError);
  expect.soft(errors, surface.name + ' unhandled exceptions').toEqual([]);
  expect.soft(measurement.overflow, surface.name + ' document overflow').toBeLessThanOrEqual(1);
  expect.soft(measurement.measuredTextNodes + measurement.findings.length, surface.name + ' actual visible content was measured').toBeGreaterThan(3);
  // Only resolved compositions are gated; unmeasured gradients/images stay in
  // the evidence as pending rather than being silently treated as compliant.
  expect.soft(measurement.findings.filter(f => f.kind === 'contrast-candidate'), surface.name + ' enabled text contrast').toEqual([]);
  if (!surface.expectedFailure) expect.soft(await page.locator('body').innerText(), surface.name + ' unexpected dead end').not.toMatch(/Página no encontrada|Error al cargar/);
  return measurement;
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
  for (const surface of surfaces) await test.step(surface.name, async () => {
    if (surface.name === 'public-reset-without-token') {
      await page.goto(prefix(info) + surface.route);
      await expect(page).toHaveURL(/\/recuperar$/);
      await expect(page.getByRole('heading', { name: 'Recuperar contraseña' }).filter({ visible: true })).toBeVisible();
      await capture(page, info, surface, false);
    } else await capture(page, info, surface);
    if (surface.name === 'public-register') {
      const heading = page.getByRole('heading', { name: 'Crear cuenta en SITREP', exact: true });
      const spacing = await heading.evaluate(element => {
        const frame = element.closest('main.auth-form-panel');
        if (!frame) return null;
        const bounds = frame.getBoundingClientRect();
        const formBounds = element.parentElement!.getBoundingClientRect();
        return { left: formBounds.left - bounds.left, right: bounds.right - formBounds.right,
          insideViewport: formBounds.left >= 0 && formBounds.right <= innerWidth };
      });
      expect(spacing, 'Registration keeps the actual institutional form frame in app and web').not.toBeNull();
      expect(spacing!.left).toBeGreaterThanOrEqual(16);
      expect(spacing!.right).toBeGreaterThanOrEqual(16);
      expect(spacing!.insideViewport).toBe(true);
      await info.attach('registration-frame-spacing', { body: JSON.stringify({ spacing, accountCreated: false }), contentType: 'application/json' });
    }
  });
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
    { name: 'scanner', route: prefix(info) ? '/escaner-qr' : '/mobile/escaner-qr', state: 'browser camera capability, not physical Android proof' },
    { name: 'statistics', route: prefix(info) ? '/estadisticas' : '/mobile/estadisticas' },
  ];
  for (const surface of surfaces) await test.step(surface.name, async () => {
    await capture(page, info, surface);
    if (['generators', 'operators', 'transporters', 'wastes', 'treatments'].includes(surface.name)) {
      const summary = page.getByRole('group', { name: 'Resumen de registros', exact: true });
      await expect(summary).toBeVisible();
      const cards = await summary.evaluate(element => Array.from(element.children).map(card => {
        const [value, label] = card.querySelectorAll('p');
        const style = getComputedStyle(label);
        const bounds = label.getBoundingClientRect();
        const cardBounds = card.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(label);
        const textBounds = Array.from(range.getClientRects());
        return { value: value.textContent?.trim(), label: label.textContent?.trim(),
          whiteSpace: style.whiteSpace, overflow: label.scrollWidth - label.clientWidth,
          padding: getComputedStyle(card).padding, insideCard: bounds.left >= cardBounds.left && bounds.right <= cardBounds.right,
          textInsideCard: textBounds.every(r => r.left >= cardBounds.left - 1 && r.right <= cardBounds.right + 1
            && r.top >= cardBounds.top - 1 && r.bottom <= cardBounds.bottom + 1),
        };
      }));
      expect(cards).toHaveLength(surface.name === 'wastes' ? 5 : 4);
      for (const card of cards) {
        expect(card.label).toBeTruthy();
        expect(card.value).toBeTruthy(); // Zero is data too; never replace it with an empty placeholder.
        expect(card.whiteSpace).toBe('normal');
        expect(card.overflow, card.label + ' must be readable in its actual card').toBeLessThanOrEqual(1);
        expect(card.insideCard, card.label + ' must not leave its own surface').toBe(true);
        expect(card.textInsideCard, card.label + ' actual text must remain in its own surface').toBe(true);
        expect(card.padding, 'Only CardContent owns padding, not both layers').toBe('0px');
      }
      if (surface.name === 'generators') {
        expect(cards.map(card => card.label).join(' ')).toMatch(/TEF sin pago \d{4}.*DDJJ pendiente \d{4}/);
      } else if (['operators', 'transporters'].includes(surface.name)) {
        expect(cards.map(card => card.label)).toContain('Activos · esta página');
        expect(cards.map(card => card.label)).toContain('Inactivos · esta página');
      }
      await info.attach(surface.name + '-summary-readability', { body: JSON.stringify(cards), contentType: 'application/json' });
    }
    if (surface.name === 'actors') {
      const cards = [];
      for (const [label, route] of [['Generadores', 'generadores'], ['Transportistas', 'transportistas'], ['Operadores', 'operadores']] as const) {
        const link = page.getByRole('link', { name: new RegExp('^' + label + ' \\d+$') });
        await expect(link).toHaveAttribute('href', prefix(info) + '/admin/actores/' + route);
        const geometry = await link.evaluate(element => {
          const card = element.firstElementChild!;
          const label = card.querySelector('[data-actor-summary-label]')!;
          const bounds = card.getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(label);
          const texts = Array.from(range.getClientRects());
          return { label: label.textContent, value: card.querySelector('[data-actor-summary-value]')!.textContent,
            padding: getComputedStyle(card).padding, whiteSpace: getComputedStyle(label).whiteSpace,
            textInsideCard: texts.every(r => r.left >= bounds.left - 1 && r.right <= bounds.right + 1
              && r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1),
            horizontalOverflow: label.scrollWidth - label.clientWidth };
        });
        expect(geometry).toMatchObject({ padding: '0px', whiteSpace: 'normal', textInsideCard: true });
        expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
        const words = await readableWholeWords(link.locator('[data-actor-summary-label]'));
        await link.focus();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(new RegExp('/admin/actores/' + route + '$'));
        await readablePageHeading(page);
        cards.push({ ...geometry, words, keyboardDestination: await page.url() });
        await page.goto(prefix(info) + surface.route);
        await expect(page.getByRole('link', { name: /^Generadores \d+$/ })).toBeVisible();
      }
      if (prefix(info)) {
        const original = page.viewportSize()!;
        await page.setViewportSize({ width: 320, height: original.height });
        for (const caption of await page.locator('[data-actor-summary-label]').all()) await readableWholeWords(caption);
        await readablePageHeading(page);
        await page.screenshot({ path: info.outputPath('actor-category-320.png'), animations: 'disabled', scale: 'css' });
        await page.setViewportSize(original);
      }
      await info.attach('actor-category-native-links', { body: JSON.stringify({ cards, businessAPIIntercepted: false }), contentType: 'application/json' });
    }
    if (surface.name === 'wastes' && page.viewportSize()!.width >= 768) {
      const row = page.getByRole('row').filter({ has: page.getByText('TOXICO', { exact: true }) }).first();
      const symbol = row.getByRole('img', { name: 'Peligroso', exact: true });
      await expect(symbol).toBeVisible();
      await expect(symbol.locator('svg.lucide-triangle-alert')).toBeVisible();
      await expect(row.locator('svg.lucide-leaf')).toHaveCount(0);
      await info.attach('waste-declared-identity', { body: JSON.stringify({ declaration: await row.getByText('TOXICO', { exact: true }).innerText(),
        accessibleIdentity: await symbol.getAttribute('aria-label'), classificationChanged: false }), contentType: 'application/json' });
    }
    if (surface.name === 'bulk-upload') {
      const symbols = [];
      for (const [category, glyph] of [['generador', 'factory'], ['transportista', 'truck'], ['operador', 'flask-conical']] as const) {
        const symbol = page.locator(`[data-map-symbol="${category}"]`);
        await expect(symbol).toBeVisible();
        await expect(symbol.locator(`svg.lucide-${glyph}`)).toBeVisible();
        const appearance = await symbol.evaluate(element => ({
          category: element.getAttribute('data-map-symbol'),
          color: (element.querySelector('[data-map-symbol-background]') as HTMLElement).style.backgroundColor,
          cursor: getComputedStyle(element.closest('.rounded-\\[12px\\]')!).cursor,
        }));
        const color = ACTOR_COLORS[category].match(/\w\w/g)!.map(hex => parseInt(hex, 16));
        expect(appearance.color).toBe(`rgb(${color.join(', ')})`);
        expect(appearance.cursor, 'Only the actual download button looks actionable').not.toBe('pointer');
        symbols.push(appearance);
      }
      await info.attach('bulk-template-category-identity', { body: JSON.stringify({ symbols, uploadTriggered: false }), contentType: 'application/json' });
    }
    if (surface.name === 'control') {
      const today = await page.evaluate(() => new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Argentina/Mendoza', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date()));
      const ranges = [];
      for (const [days, label] of [[30, '30 días'], [1, 'Hoy'], [7, '7 días'], [30, '30 días']] as const) {
        const button = page.getByRole('button', { name: label, exact: true });
        if (ranges.length) await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        const badge = page.getByText(/^\d{4}-\d{2}-\d{2} — \d{4}-\d{2}-\d{2}$/);
        await expect(badge).toBeVisible();
        const [desde, hasta] = (await badge.innerText()).split(' — ');
        expect(hasta).toBe(today);
        expect((Date.parse(hasta + 'T00:00:00Z') - Date.parse(desde + 'T00:00:00Z')) / 86400000 + 1,
          label + ' includes the selected end day exactly once').toBe(days);
        ranges.push({ days, desde, hasta });
      }
      await info.attach('control-inclusive-calendar-periods', { body: JSON.stringify({ ranges,
        backendInstantBoundaryValidated: false, businessAPIIntercepted: false }), contentType: 'application/json' });
    }
  });
  const inspection = await createSpontaneousInspection(page, info);
  // Discover the actual available sections rather than guessing a hash that
  // silently falls back to Visita. A spontaneous inspection has no declaration.
  const navigation = page.getByRole('navigation', { name: 'Secciones del expediente', exact: true });
  const sections = await navigation.getByRole('link').evaluateAll(links => links.map(link => ({
    href: link.getAttribute('href')!, label: link.textContent!.trim(),
  })));
  const inspectedSections: string[] = [];
  for (const section of sections) {
    await navigation.locator(`a[href="${section.href}"]`).click();
    const subnavigation = page.getByRole('navigation', { name: 'Apartados de ' + section.label, exact: true });
    const entries = await subnavigation.count()
      ? await subnavigation.getByRole('link').evaluateAll(links => links.map(link => ({ href: link.getAttribute('href')!, label: link.textContent!.trim() })))
      : [section];
    for (const entry of entries) {
      if (await subnavigation.count()) await subnavigation.locator(`a[href="${entry.href}"]`).click();
      await expect(page.getByTestId('inspection-step-content')).toBeVisible();
      if (entry.href !== '#verificacion') await expect(page.getByTestId('inspection-step-content')).toHaveAttribute('id', entry.href.slice(1));
      inspectedSections.push(entry.href);
      await test.step('inspection-' + entry.href.slice(1), () => capture(page, info, {
        name: 'inspection-' + entry.href.slice(1), route: `/inspecciones/${inspection.id}${entry.href}`,
        state: 'synthetic spontaneous draft · ' + section.label + ' · ' + entry.label,
      }, false));
    }
  }
  expect(inspectedSections).toContain('#revision');
  expect(inspectedSections).not.toContain('#declaracion');
  // List every registered path too. Uncaptured aliases and states stay pending;
  // this prevents a capture count from being represented as 100% of the product.
  const routes = {} as Record<string, string[]>;
  for (const source of ['App.tsx', 'AppMobile.tsx']) {
    const content = await readFile(path.join(process.cwd(), 'src-v6', source), 'utf8');
    routes[source] = [...new Set(Array.from(content.matchAll(/<Route\b[^>]*\bpath="([^"]+)"/g), match => match[1]))];
  }
  await info.attach('registered-route-inventory', { body: JSON.stringify({ routes, captured: surfaces, inspectedSections,
    pending: 'aliases, additional roles, full scroll positions, hover/focus/disabled/loading/error/modals unless separately exercised; physical APK and hardware',
    businessAPIIntercepted: false, role: 'ADMIN', viewport: page.viewportSize() }, null, 2), contentType: 'application/json' });
});

test('visual inventory: real report tabs, selected state and reachable bottom content', async ({ page }, info) => {
  test.setTimeout(240000);
  await login(page, info);
  await page.goto(prefix(info) + '/reportes');
  const navigation = page.getByRole('navigation', { name: 'Tipos de reporte', exact: true });
  await expect(navigation).toBeVisible();
  const tabs = await navigation.getByRole('button').allTextContents();
  expect(tabs.map(label => label.trim())).toEqual(['Inspecciones', 'Manifiestos', 'Residuos Tratados', 'Transporte', 'Generadores', 'Operadores', 'Tratamientos', 'Departamentos', 'Mapa de Actores']);
  for (const [index, label] of tabs.entries()) {
    const tab = navigation.getByRole('button', { name: label.trim(), exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-pressed', 'true');
    await expect(navigation.locator('[aria-pressed="true"]')).toHaveCount(1);
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('main').forEach(el => { el.scrollTop = 0; }); });
    await capture(page, info, { name: `report-${index}-start`, route: '/reportes', state: label.trim(), viewportPosition: 'start' }, false);
    if (index >= 1 && index <= 7) {
      const metrics = page.locator('.bg-gradient-to-br:has(p.font-extrabold)');
      await expect(metrics).toHaveCount([0, 4, 3, 4, 4, 4, 4, 4][index]);
      const captions = await metrics.locator('p.font-medium,p.text-xs').evaluateAll(elements => elements.map(el => ({
        text: el.textContent?.trim(), color: getComputedStyle(el).color,
        opacity: getComputedStyle(el).opacity,
        backgroundImage: getComputedStyle(el.closest('.bg-gradient-to-br')!).backgroundImage,
      })));
      expect(captions.length).toBeGreaterThanOrEqual(await metrics.count());
      for (const caption of captions) {
        expect(caption.text).toBeTruthy();
        expect(caption.color, 'Metric caption is fully opaque, including its scope').toBe('rgb(255, 255, 255)');
        expect(caption.opacity).toBe('1');
      }
      // This verifies rendered foreground transparency, NOT the gradient's
      // final contrast. The generic inventory keeps that composition pending.
      await info.attach(`report-${index}-metric-caption-contract`, {
        body: JSON.stringify({ captions, gradientContrastMeasured: false }), contentType: 'application/json',
      });
    }
    // Scroll the actual shell, not the window alone: /app has a contained main.
    await page.evaluate(() => { document.querySelectorAll('main').forEach(el => { el.scrollTop = el.scrollHeight; }); window.scrollTo(0, document.documentElement.scrollHeight); });
    await capture(page, info, { name: `report-${index}-end`, route: '/reportes', state: label.trim(), viewportPosition: 'end' }, false);
    if (index === 7) {
      const generatorKey = page.getByRole('columnheader', { name: 'Gen.', exact: true }).locator('span[aria-hidden="true"]');
      await expect(generatorKey).toBeVisible();
      const rgb = ACTOR_COLORS.generador.slice(1).match(/../g)!.map(channel => parseInt(channel, 16)).join(', ');
      await expect(generatorKey).toHaveCSS('background-color', `rgb(${rgb})`);
      const axis = page.locator('.recharts-cartesian-axis-tick-value').first();
      await axis.scrollIntoViewIfNeeded();
      await expect(axis).toBeVisible();
      await expect(axis).toHaveCSS('fill', 'rgb(71, 85, 105)');
      const painted = await capture(page, info, { name: 'report-7-svg-axes', route: '/reportes', state: 'Departamento · actual painted SVG text' }, false);
      expect(painted.measuredSvgTextNodes, 'The audit must measure visible SVG fill, not only surrounding HTML').toBeGreaterThan(0);
    }
  }
});

for (const user of ['generador', 'transportista', 'operador', 'inspector', 'lector-generadores']) {
  test(`visual inventory: ${user} dashboard and global operation`, async ({ page }, info) => {
    test.setTimeout(90000);
    await login(page, info, user);
    for (const [name, route] of [['dashboard', '/dashboard'], ['control', '/centro-control'], ['monitor', '/monitor']]) {
      await capture(page, info, { name: `${user}-${name}`, route, state: user });
      if (user === 'inspector') {
        const badge = page.locator('header [aria-label="Función actual"]');
        await expect(badge).toHaveText('Inspector');
        await expect(badge).toHaveAttribute('title', 'Rol base: GENERADOR');
      }
      if (prefix(info) && name === 'control' && ['inspector', 'lector-generadores'].includes(user)) {
        const original = page.viewportSize()!;
        await page.setViewportSize({ width: 320, height: original.height });
        await readableWholeWords(page.locator('header [aria-label="Función actual"]'));
        await readablePageHeading(page);
        await page.screenshot({ path: info.outputPath(`${user}-control-320.png`), animations: 'disabled', scale: 'css' });
        await page.setViewportSize(original);
      }
    }
    if (prefix(info)) {
      const writes: string[] = [];
      const denied: string[] = [];
      const onRequest = (request: import('@playwright/test').Request) => {
        if (new URL(request.url()).pathname.startsWith('/api/actores/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method());
      };
      const onResponse = (response: import('@playwright/test').Response) => {
        if (new URL(response.url()).pathname.startsWith('/api/actores/') && response.status() >= 400) denied.push(`${response.status()} ${new URL(response.url()).pathname}`);
      };
      page.on('request', onRequest); page.on('response', onResponse);
      await capture(page, info, { name: `${user}-actor-overview`, route: '/actores', state: 'real consultation; no actor mutation' });
      const create = page.getByRole('button', { name: 'Nuevo Actor', exact: true });
      if (user === 'lector-generadores') {
        await expect(create).toBeVisible();
        await create.click();
        const dialog = page.getByRole('dialog', { name: 'Nuevo Actor', exact: true });
        await dialog.getByLabel('Tipo de Actor', { exact: true }).click();
        await expect(page.getByRole('option')).toHaveCount(1);
        await expect(page.getByRole('option', { name: 'Generador', exact: true })).toHaveAttribute('aria-selected', 'true');
        await page.getByRole('option', { name: 'Generador', exact: true }).click();
        await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      } else {
        await expect(create).toHaveCount(0);
        await expect(page.getByRole('button', { name: /^Eliminar / })).toHaveCount(0);
      }
      const category = user === 'lector-generadores' ? 'operador' : user === 'inspector' ? 'generador' : user;
      const categoryLabel = { generador: 'Generadores', transportista: 'Transportistas', operador: 'Operadores' }[category]!;
      const categoryButton = page.getByRole('button', { name: new RegExp(`^${categoryLabel} \\d+$`) });
      await expect(categoryButton.locator('svg.lucide-funnel')).toBeVisible();
      await expect(categoryButton.locator('svg.lucide-chevron-right')).toHaveCount(0);
      await categoryButton.click();
      await expect(categoryButton).toHaveAttribute('aria-pressed', 'true');
      await expect(categoryButton.locator('svg.lucide-check')).toBeVisible();
      await expect(page).toHaveURL(/\/app\/actores$/);
      const name = { generador: 'QA Generador 1', transportista: 'QA Transporte 1', operador: 'QA Operador 1' }[category]!;
      await page.getByText(name, { exact: true }).filter({ visible: true }).first().click();
      const detail = page.getByRole('dialog', { name: 'Detalle del Actor', exact: true });
      await expect(detail).toBeVisible();
      await detail.getByRole('button', { name: 'Ver detalle completo', exact: true }).click();
      const path = { generador: 'generadores', transportista: 'transportistas', operador: 'operadores' }[category]!;
      await expect(page).toHaveURL(new RegExp(`/app/admin/actores/${path}/[^/]+$`));
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Volver', exact: true }).first().click();
      await expect(page).toHaveURL(/\/app\/actores$/);
      await info.attach('actor-overview-permission-affordances', { body: JSON.stringify({ user, category, writes, denied,
        consultationReturnedToOrigin: true, businessAPIIntercepted: false }), contentType: 'application/json' });
      expect(writes).toEqual([]); expect(denied).toEqual([]);
      page.off('request', onRequest); page.off('response', onResponse);
    }
  });
}
