/**
 * Capture inscripcion & admin screenshots for documentation
 *
 * Prerequisites: npx playwright install chromium
 * Usage: cd frontend && node scripts/capture-inscripcion-screenshots.cjs
 *
 * Captures (all desktop 1440x900):
 *   docs/screenshots/desktop/70_inscripcion_generador_paso1.png
 *   docs/screenshots/desktop/71_inscripcion_generador_tef.png
 *   docs/screenshots/desktop/72_inscripcion_operador_paso1.png
 *   docs/screenshots/desktop/73_inscripcion_operador_representantes.png
 *   docs/screenshots/desktop/74_inscripcion_transportista_paso1.png
 *   docs/screenshots/desktop/75_inscripcion_transportista_vehiculos.png
 *   docs/screenshots/desktop/76_admin_solicitudes_lista.png
 *   docs/screenshots/desktop/77_admin_solicitud_detalle.png
 *   docs/screenshots/desktop/78_nuevo_transportista_wizard.png
 *   docs/screenshots/desktop/79_nuevo_transportista_vehiculos.png
 *   docs/screenshots/desktop/80_nuevo_transportista_choferes.png
 *   docs/screenshots/desktop/81_badge_blockchain_pill.png
 *   docs/screenshots/desktop/82_sorting_estado.png
 *   docs/screenshots/desktop/83_operador_representantes.png
 *   docs/screenshots/desktop/84_generador_actividad_rubro.png
 */
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'https://sitrep.ultimamilla.com.ar';
const DOCS_DIR = path.resolve(__dirname, '../../docs/screenshots');
const CREDS = { email: 'juan.perez@dgfa.gob.ar', password: 'admin123' };

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  // Click the "Administrador" demo user button
  await page.locator('button:has-text("Administrador")').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

/**
 * Try to click a "Siguiente" / "Next" button to advance wizard steps.
 * Returns true if a button was found and clicked.
 */
async function clickSiguiente(page) {
  const btn = page.locator('button:has-text("Siguiente")').first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

/**
 * Fill Phase 1 (account creation) fields with minimal data and submit.
 * Fields vary per inscripcion type but typically: email, password, confirm, nombre, CUIT.
 */
async function fillPhase1AndSubmit(page, suffix) {
  const timestamp = Date.now();
  const fields = {
    email: `test_${suffix}_${timestamp}@test.com`,
    password: 'TestPass123!',
    nombre: `Test ${suffix}`,
    cuit: '20-12345678-9',
  };

  // Try filling common Phase 1 fields by various selectors
  for (const input of await page.locator('input[type="email"], input[name="email"]').all()) {
    await input.fill(fields.email);
  }
  for (const input of await page.locator('input[type="password"]').all()) {
    await input.fill(fields.password);
  }
  for (const input of await page.locator('input[name="nombre"], input[placeholder*="nombre" i], input[placeholder*="razon" i]').all()) {
    await input.fill(fields.nombre);
  }
  for (const input of await page.locator('input[name="cuit"], input[placeholder*="CUIT" i]').all()) {
    await input.fill(fields.cuit);
  }

  await page.waitForTimeout(500);

  // Try submitting Phase 1
  const submitBtn = page.locator('button[type="submit"], button:has-text("Crear Cuenta"), button:has-text("Registrar"), button:has-text("Siguiente")').first();
  if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await submitBtn.click();
    await page.waitForTimeout(2000);
  }
}

// ---------------------------------------------------------------------------
// Public inscripcion pages (no login needed)
// ---------------------------------------------------------------------------
async function capturePublicPages(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // --- 70: Inscripcion Generador - Phase 1 ---
  console.log('70: Inscripcion Generador - Phase 1...');
  await page.goto(`${BASE}/inscripcion/generador`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '70_inscripcion_generador_paso1.png'),
    fullPage: false,
  });
  console.log('  -> 70_inscripcion_generador_paso1.png');

  // --- 71: Inscripcion Generador - TEF step ---
  console.log('71: Inscripcion Generador - TEF step...');
  // Try filling Phase 1 and advancing to wizard step 5 (TEF)
  await fillPhase1AndSubmit(page, 'gen');
  // Attempt to advance through wizard steps to reach TEF (step 5)
  for (let i = 0; i < 5; i++) {
    const advanced = await clickSiguiente(page);
    if (!advanced) break;
  }
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '71_inscripcion_generador_tef.png'),
    fullPage: false,
  });
  console.log('  -> 71_inscripcion_generador_tef.png');

  // --- 72: Inscripcion Operador - Phase 1 ---
  console.log('72: Inscripcion Operador - Phase 1...');
  await page.goto(`${BASE}/inscripcion/operador`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '72_inscripcion_operador_paso1.png'),
    fullPage: false,
  });
  console.log('  -> 72_inscripcion_operador_paso1.png');

  // --- 73: Inscripcion Operador - Representantes (step 4) ---
  console.log('73: Inscripcion Operador - Representantes...');
  await fillPhase1AndSubmit(page, 'oper');
  for (let i = 0; i < 4; i++) {
    const advanced = await clickSiguiente(page);
    if (!advanced) break;
  }
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '73_inscripcion_operador_representantes.png'),
    fullPage: false,
  });
  console.log('  -> 73_inscripcion_operador_representantes.png');

  // --- 74: Inscripcion Transportista - Phase 1 ---
  console.log('74: Inscripcion Transportista - Phase 1...');
  await page.goto(`${BASE}/inscripcion/transportista`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '74_inscripcion_transportista_paso1.png'),
    fullPage: false,
  });
  console.log('  -> 74_inscripcion_transportista_paso1.png');

  // --- 75: Inscripcion Transportista - Vehiculos (step 3) ---
  console.log('75: Inscripcion Transportista - Vehiculos...');
  await fillPhase1AndSubmit(page, 'trans');
  for (let i = 0; i < 3; i++) {
    const advanced = await clickSiguiente(page);
    if (!advanced) break;
  }
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '75_inscripcion_transportista_vehiculos.png'),
    fullPage: false,
  });
  console.log('  -> 75_inscripcion_transportista_vehiculos.png');

  await ctx.close();
}

// ---------------------------------------------------------------------------
// Admin pages (login required)
// ---------------------------------------------------------------------------
async function captureAdminPages(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page);

  // --- 76: Admin Solicitudes lista ---
  console.log('76: Admin Solicitudes lista...');
  await page.goto(`${BASE}/admin/solicitudes`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '76_admin_solicitudes_lista.png'),
    fullPage: false,
  });
  console.log('  -> 76_admin_solicitudes_lista.png');

  // --- 77: Admin Solicitud detalle ---
  console.log('77: Admin Solicitud detalle...');
  // Click first row in the solicitudes table
  const firstRow = page.locator('table tbody tr, [class*="card"], [class*="solicitud"]').first();
  if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstRow.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '77_admin_solicitud_detalle.png'),
    fullPage: false,
  });
  console.log('  -> 77_admin_solicitud_detalle.png');

  // --- 78: Nuevo Transportista Wizard - Step 1 ---
  console.log('78: Nuevo Transportista Wizard - Step 1...');
  await page.goto(`${BASE}/admin/actores/transportistas/nuevo`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '78_nuevo_transportista_wizard.png'),
    fullPage: false,
  });
  console.log('  -> 78_nuevo_transportista_wizard.png');

  // --- 79: Nuevo Transportista - Vehiculos (step 3) ---
  console.log('79: Nuevo Transportista - Vehiculos...');
  // Advance to step 3
  for (let i = 0; i < 2; i++) {
    await clickSiguiente(page);
  }
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '79_nuevo_transportista_vehiculos.png'),
    fullPage: false,
  });
  console.log('  -> 79_nuevo_transportista_vehiculos.png');

  // --- 80: Nuevo Transportista - Choferes (step 4) ---
  console.log('80: Nuevo Transportista - Choferes...');
  await clickSiguiente(page);
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '80_nuevo_transportista_choferes.png'),
    fullPage: false,
  });
  console.log('  -> 80_nuevo_transportista_choferes.png');

  // --- 81: Badge blockchain pill on manifiestos list ---
  console.log('81: Badge blockchain pill on manifiestos list...');
  await page.goto(`${BASE}/manifiestos`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '81_badge_blockchain_pill.png'),
    fullPage: false,
  });
  console.log('  -> 81_badge_blockchain_pill.png');

  // --- 82: Sorting by estado ---
  console.log('82: Sorting by estado on manifiestos...');
  // Click the "Estado" column header to sort
  const estadoHeader = page.locator('th:has-text("Estado"), button:has-text("Estado")').first();
  if (await estadoHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
    await estadoHeader.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '82_sorting_estado.png'),
    fullPage: false,
  });
  console.log('  -> 82_sorting_estado.png');

  // --- 83: Operador representantes (detail page) ---
  console.log('83: Operador representantes...');
  await page.goto(`${BASE}/admin/actores/operadores`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  // Click first operador row to open detail
  const operadorRow = page.locator('table tbody tr, a[href*="operador"]').first();
  if (await operadorRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    await operadorRow.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '83_operador_representantes.png'),
    fullPage: false,
  });
  console.log('  -> 83_operador_representantes.png');

  // --- 84: Generador actividad/rubro (detail page) ---
  console.log('84: Generador actividad/rubro...');
  await page.goto(`${BASE}/admin/actores/generadores`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  // Click first generador row to open detail
  const generadorRow = page.locator('table tbody tr, a[href*="generador"]').first();
  if (await generadorRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    await generadorRow.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '84_generador_actividad_rubro.png'),
    fullPage: false,
  });
  console.log('  -> 84_generador_actividad_rubro.png');

  await ctx.close();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });

  try {
    await capturePublicPages(browser);
    await captureAdminPages(browser);
    console.log('\nAll 15 inscripcion screenshots captured successfully.');
  } catch (err) {
    console.error('Error capturing screenshots:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
