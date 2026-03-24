/**
 * Capture detailed wizard screenshots for manual documentation (section 3.12)
 *
 * Prerequisites: npx playwright install chromium
 * Usage: cd frontend && node scripts/capture-wizards-detailed.cjs
 *
 * Captures ~46 screenshots (W01-W46):
 *   A. Public inscripcion — Generador (7 captures)
 *   B. Public inscripcion — Operador (5 captures)
 *   C. Public inscripcion — Transportista (4 captures)
 *   D. Admin — NuevoGeneradorPage (7 captures)
 *   E. Admin — NuevoOperadorPage (8 captures)
 *   F. Admin — NuevoTransportistaPage (6 captures)
 *   G. CalculadoraTEF detail (6 captures from admin gen step 4)
 *   H. Mobile PWA (5 captures)
 *
 * KEY: Admin wizards fill required fields (razonSocial, cuit, email) to pass
 * step validation. Public wizards call /api/solicitudes/iniciar to complete Phase 1.
 */
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'https://sitrep.ultimamilla.com.ar';
const DESKTOP_DIR = path.resolve(__dirname, '../../docs/screenshots/desktop');
const MOBILE_DIR = path.resolve(__dirname, '../../docs/screenshots/mobile');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('button:has-text("Administrador")').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

/** Click the "Siguiente" / "Continuar" button to advance wizard steps. */
async function clickNext(page) {
  // Try "Continuar" first (admin wizards), then "Siguiente" (transportista/public)
  for (const text of ['Continuar', 'Siguiente']) {
    const btn = page.locator(`button:has-text("${text}")`).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1500);
      return true;
    }
  }
  return false;
}

async function shot(page, dir, filename, fullPage = false) {
  await page.screenshot({ path: path.join(dir, filename), fullPage });
  console.log(`  -> ${filename}`);
}

/** Fill an input by placeholder text (exact or partial match). */
async function fillByPlaceholder(page, placeholderText, value) {
  const input = page.locator(`input[placeholder="${placeholderText}"]`).first();
  if (await input.isVisible({ timeout: 1500 }).catch(() => false)) {
    await input.fill(value);
    return true;
  }
  // Try partial match
  const partial = page.locator(`input[placeholder*="${placeholderText}"]`).first();
  if (await partial.isVisible({ timeout: 1000 }).catch(() => false)) {
    await partial.fill(value);
    return true;
  }
  return false;
}

/** Fill admin wizard step 1 required fields (razonSocial, cuit, email). */
async function fillAdminStep1(page, { razonSocial, razonPlaceholder, emailPlaceholder }) {
  await fillByPlaceholder(page, razonPlaceholder || 'Empresa S.A.', razonSocial || 'Test Generador S.A.');
  await fillByPlaceholder(page, '30-12345678-9', '30-71234567-8');
  await fillByPlaceholder(page, emailPlaceholder || 'contacto@empresa.com', `test_${Date.now()}@test.com`);
  await page.waitForTimeout(300);
}

/** Fill Phase 1 of public inscription wizard and submit. */
async function fillPhase1AndSubmit(page, suffix) {
  const ts = Date.now();
  await fillByPlaceholder(page, 'Juan Perez', `Test ${suffix} ${ts}`);
  await fillByPlaceholder(page, 'correo@empresa.com', `test_${suffix}_${ts}@test.com`);
  await fillByPlaceholder(page, '30-12345678-9', '20-12345678-9');
  // Password fields
  const pwInputs = await page.locator('input[type="password"]').all();
  for (const pw of pwInputs) {
    await pw.fill('TestPass1A!');
  }
  // Also try placeholder match for visible password field
  await fillByPlaceholder(page, 'Min 8 chars', 'TestPass1A!');
  await fillByPlaceholder(page, 'Repetir password', 'TestPass1A!');
  await page.waitForTimeout(500);

  // Click submit
  const submitBtn = page.locator('button:has-text("Crear cuenta y continuar")').first();
  if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await submitBtn.click();
    // Wait for API response (Phase 2 transition)
    await page.waitForTimeout(4000);
  }
}

/** Check if we're in Phase 2 (wizard stepped UI visible). */
async function isInPhase2(page) {
  // Look for step indicators or "Siguiente" button that appears in Phase 2
  const stepIndicator = page.locator('text=Paso 1').first();
  const siguiente = page.locator('button:has-text("Siguiente")').first();
  return (
    (await stepIndicator.isVisible({ timeout: 1000 }).catch(() => false)) ||
    (await siguiente.isVisible({ timeout: 1000 }).catch(() => false))
  );
}

// ---------------------------------------------------------------------------
// A. Public Inscripcion — Generador (W01-W07)
// ---------------------------------------------------------------------------
async function capturePublicGenerador(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // W01: Phase 1 — account creation form (blank)
  console.log('W01: Public Generador — Fase 1...');
  await page.goto(`${BASE}/inscripcion/generador`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await shot(page, DESKTOP_DIR, 'W01_pub_gen_fase1.png');

  // Fill Phase 1 and try to advance to Phase 2
  await fillPhase1AndSubmit(page, 'gen');

  const inPhase2 = await isInPhase2(page);
  if (inPhase2) {
    console.log('  Phase 1 completed successfully, capturing Phase 2 steps...');

    // W02: Step 1 — Establecimiento
    // Fill razonSocial to pass step 1 validation
    const firstInput = page.locator('input').first();
    if (await firstInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await firstInput.fill('Empresa Generadora Test S.A.');
    }
    console.log('W02: Public Generador — Paso 1 Establecimiento...');
    await shot(page, DESKTOP_DIR, 'W02_pub_gen_paso1.png');

    // W03: Step 2 — Regulatorio
    console.log('W03: Public Generador — Paso 2 Regulatorio...');
    await clickNext(page);
    await shot(page, DESKTOP_DIR, 'W03_pub_gen_paso2.png');

    // W04: Step 3 — Domicilios
    console.log('W04: Public Generador — Paso 3 Domicilios...');
    await clickNext(page);
    await shot(page, DESKTOP_DIR, 'W04_pub_gen_paso3.png');

    // Step 4 — Adicional (advance through)
    await clickNext(page);

    // W05: Step 5 — Calculo TEF
    console.log('W05: Public Generador — Paso 5 TEF...');
    await clickNext(page);
    await shot(page, DESKTOP_DIR, 'W05_pub_gen_paso5.png');

    // W06: Step 6 — Documentos
    console.log('W06: Public Generador — Paso 6 Documentos...');
    await clickNext(page);
    await shot(page, DESKTOP_DIR, 'W06_pub_gen_paso6.png');

    // W07: Step 7 — Resumen
    console.log('W07: Public Generador — Paso 7 Resumen...');
    await clickNext(page);
    await shot(page, DESKTOP_DIR, 'W07_pub_gen_paso7.png', true);
  } else {
    console.log('  Phase 1 did not complete (API may have rejected). Using Phase 1 screenshots.');
    // Still save the current state as W02 so we have something
    await shot(page, DESKTOP_DIR, 'W02_pub_gen_paso1.png');
  }

  await ctx.close();
}

// ---------------------------------------------------------------------------
// B. Public Inscripcion — Operador (W08-W12)
// ---------------------------------------------------------------------------
async function capturePublicOperador(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/inscripcion/operador`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await fillPhase1AndSubmit(page, 'oper');

  const inPhase2 = await isInPhase2(page);
  if (inPhase2) {
    console.log('  Operador Phase 1 completed, capturing steps...');
    // Fill razonSocial
    const firstInput = page.locator('input').first();
    if (await firstInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await firstInput.fill('Operador de Tratamiento Test S.A.');
    }
    console.log('W08: Public Operador — Paso 1 Establecimiento...');
    await shot(page, DESKTOP_DIR, 'W08_pub_oper_paso1.png');

    // Advance to step 4 (Representantes)
    for (let i = 0; i < 3; i++) await clickNext(page);
    console.log('W09: Public Operador — Paso 4 Representantes...');
    await shot(page, DESKTOP_DIR, 'W09_pub_oper_paso4.png');

    console.log('W10: Public Operador — Paso 5 Corrientes...');
    await clickNext(page);
    await shot(page, DESKTOP_DIR, 'W10_pub_oper_paso5.png');

    console.log('W11: Public Operador — Paso 6 TEF...');
    await clickNext(page);
    await shot(page, DESKTOP_DIR, 'W11_pub_oper_paso6.png');

    await clickNext(page); // skip Documentos
    console.log('W12: Public Operador — Paso 8 Resumen...');
    await clickNext(page);
    await shot(page, DESKTOP_DIR, 'W12_pub_oper_paso8.png', true);
  } else {
    console.log('  Operador Phase 1 did not complete. Saving what we have.');
    await shot(page, DESKTOP_DIR, 'W08_pub_oper_paso1.png');
  }

  await ctx.close();
}

// ---------------------------------------------------------------------------
// C. Public Inscripcion — Transportista (W13-W16)
// ---------------------------------------------------------------------------
async function capturePublicTransportista(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/inscripcion/transportista`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await fillPhase1AndSubmit(page, 'trans');

  const inPhase2 = await isInPhase2(page);
  if (inPhase2) {
    console.log('  Transportista Phase 1 completed, capturing steps...');
    const firstInput = page.locator('input').first();
    if (await firstInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await firstInput.fill('Transporte de RRPP Test S.A.');
    }
    console.log('W13: Public Transportista — Paso 1 Datos...');
    await shot(page, DESKTOP_DIR, 'W13_pub_trans_paso1.png');

    console.log('W14: Public Transportista — Paso 2 Habilitacion...');
    await clickNext(page);
    await shot(page, DESKTOP_DIR, 'W14_pub_trans_paso2.png');

    console.log('W15: Public Transportista — Paso 3 Vehiculos...');
    await clickNext(page);
    await shot(page, DESKTOP_DIR, 'W15_pub_trans_paso3.png');

    await clickNext(page); // Documentos
    console.log('W16: Public Transportista — Paso 5 Resumen...');
    await clickNext(page);
    await shot(page, DESKTOP_DIR, 'W16_pub_trans_paso5.png', true);
  } else {
    console.log('  Transportista Phase 1 did not complete. Saving what we have.');
    await shot(page, DESKTOP_DIR, 'W13_pub_trans_paso1.png');
  }

  await ctx.close();
}

// ---------------------------------------------------------------------------
// D. Admin — NuevoGeneradorPage (W17-W23) + TEF detail (W36-W41)
// ---------------------------------------------------------------------------
async function captureAdminGenerador(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page);

  console.log('W17: Admin Generador — Paso 1 Identificacion...');
  await page.goto(`${BASE}/admin/actores/generadores/nuevo`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Fill required fields for step 1 validation
  await fillAdminStep1(page, {
    razonSocial: 'Metalurgica Cuyana S.A.',
    razonPlaceholder: 'Empresa S.A.',
    emailPlaceholder: 'contacto@empresa.com',
  });
  await shot(page, DESKTOP_DIR, 'W17_adm_gen_paso1.png');

  // W18: Step 2 — Domicilios (no validation needed)
  console.log('W18: Admin Generador — Paso 2 Domicilios...');
  await clickNext(page);
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W18_adm_gen_paso2.png');

  // W19: Step 3 — Residuos (corrientes Y checkboxes)
  console.log('W19: Admin Generador — Paso 3 Residuos...');
  await clickNext(page);
  await page.waitForTimeout(500);
  // Click a few corrientes Y checkboxes to show them active
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < Math.min(3, count); i++) {
    await checkboxes.nth(i).check().catch(() => {});
  }
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W19_adm_gen_paso3.png');

  // W20: Step 4 — Calculo TEF
  console.log('W20: Admin Generador — Paso 4 TEF resultado...');
  await clickNext(page);
  await page.waitForTimeout(1500);
  await shot(page, DESKTOP_DIR, 'W20_adm_gen_paso4_tef.png');

  // W21: TEF — scroll to see A coefficients
  console.log('W21: Admin Generador — Paso 4 TEF coeficientes A...');
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(800);
  await shot(page, DESKTOP_DIR, 'W21_adm_gen_paso4_tef_a.png');

  // --- TEF detail screenshots (W36-W41) ---
  // W36: TEF result header
  console.log('W36: TEF — resultado header...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const tefHeader = page.locator('[class*="bg-neutral-900"], [class*="bg-gray-900"]').first();
  if (await tefHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tefHeader.screenshot({ path: path.join(DESKTOP_DIR, 'W36_tef_resultado.png') });
    console.log('  -> W36_tef_resultado.png (element)');
  } else {
    await shot(page, DESKTOP_DIR, 'W36_tef_resultado.png');
  }

  // W38: TEF magnitude D section
  console.log('W38: TEF — magnitud D...');
  const dLabel = page.locator('text=Magnitud D').first();
  if (await dLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dLabel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  await shot(page, DESKTOP_DIR, 'W38_tef_magnitud_d.png');

  // W39: TEF peligrosidad A section
  console.log('W39: TEF — peligrosidad A...');
  const aLabel = page.locator('text=Peligrosidad Ambiental').first();
  if (await aLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await aLabel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  await shot(page, DESKTOP_DIR, 'W39_tef_coef_a.png');

  // W40: TEF coeficiente C section
  console.log('W40: TEF — coeficiente C...');
  const cLabel = page.locator('text=Coeficiente de Corriente').first();
  if (await cLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cLabel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  await shot(page, DESKTOP_DIR, 'W40_tef_coef_c.png');

  // W41: TEF full-page desglose
  console.log('W41: TEF — desglose completo...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W41_tef_desglose.png', true);

  // Back to wizard steps
  await page.evaluate(() => window.scrollTo(0, 0));

  // W22: Step 5 — Regulatorio
  console.log('W22: Admin Generador — Paso 5 Regulatorio...');
  await clickNext(page);
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W22_adm_gen_paso5.png');

  // W23: Step 6 — Adjuntos + Resumen
  console.log('W23: Admin Generador — Paso 6 Adjuntos...');
  await clickNext(page);
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W23_adm_gen_paso6.png');

  await ctx.close();
}

// ---------------------------------------------------------------------------
// E. Admin — NuevoOperadorPage (W24-W30)
// ---------------------------------------------------------------------------
async function captureAdminOperador(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page);

  console.log('W24: Admin Operador — Paso 1 Identificacion...');
  await page.goto(`${BASE}/admin/actores/operadores/nuevo`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Fill required fields for step 1 validation
  await fillAdminStep1(page, {
    razonSocial: 'Planta de Tratamiento Cuyo S.A.',
    razonPlaceholder: 'Planta de Tratamiento S.A.',
    emailPlaceholder: 'contacto@operador.com',
  });
  await shot(page, DESKTOP_DIR, 'W24_adm_oper_paso1.png');

  // W25: Step 2 — Domicilios
  console.log('W25: Admin Operador — Paso 2 Domicilios...');
  await clickNext(page);
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W25_adm_oper_paso2.png');

  // W26: Step 3 — Representantes
  console.log('W26: Admin Operador — Paso 3 Representantes...');
  await clickNext(page);
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W26_adm_oper_paso3.png');

  // W27: Step 4 — Residuos (corrientes Y + tecnologia)
  console.log('W27: Admin Operador — Paso 4 Residuos...');
  await clickNext(page);
  await page.waitForTimeout(500);
  // Check a few corrientes
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < Math.min(3, count); i++) {
    await checkboxes.nth(i).check().catch(() => {});
  }
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W27_adm_oper_paso4.png');

  // W28: Step 5 — Calculo TEF
  console.log('W28: Admin Operador — Paso 5 TEF...');
  await clickNext(page);
  await page.waitForTimeout(1500);
  await shot(page, DESKTOP_DIR, 'W28_adm_oper_paso5_tef.png');

  // W29: Step 6 — Regulatorio
  console.log('W29: Admin Operador — Paso 6 Regulatorio...');
  await clickNext(page);
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W29_adm_oper_paso6.png');

  // W30: Step 7 — Adjuntos + Resumen
  console.log('W30: Admin Operador — Paso 7 Adjuntos...');
  await clickNext(page);
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W30_adm_oper_paso7.png');

  await ctx.close();
}

// ---------------------------------------------------------------------------
// F. Admin — NuevoTransportistaPage (W31-W35)
// No step validation — advances freely
// ---------------------------------------------------------------------------
async function captureAdminTransportista(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page);

  console.log('W31: Admin Transportista — Paso 1 Datos...');
  await page.goto(`${BASE}/admin/actores/transportistas/nuevo`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot(page, DESKTOP_DIR, 'W31_adm_trans_paso1.png');

  // W32: Step 2 — Habilitacion DPA
  console.log('W32: Admin Transportista — Paso 2 Habilitacion DPA...');
  await clickNext(page);
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W32_adm_trans_paso2.png');

  // W33: Step 3 — Vehiculos
  console.log('W33: Admin Transportista — Paso 3 Vehiculos...');
  await clickNext(page);
  await page.waitForTimeout(500);
  // Click "Agregar Vehiculo" to show a vehicle row
  const addVehBtn = page.locator('button:has-text("Agregar")').first();
  if (await addVehBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addVehBtn.click();
    await page.waitForTimeout(800);
  }
  await shot(page, DESKTOP_DIR, 'W33_adm_trans_paso3.png');

  // W34: Step 4 — Choferes
  console.log('W34: Admin Transportista — Paso 4 Choferes...');
  await clickNext(page);
  await page.waitForTimeout(500);
  const addChofBtn = page.locator('button:has-text("Agregar")').first();
  if (await addChofBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addChofBtn.click();
    await page.waitForTimeout(800);
  }
  await shot(page, DESKTOP_DIR, 'W34_adm_trans_paso4.png');

  // W35: Step 5 — Confirmar
  console.log('W35: Admin Transportista — Paso 5 Confirmar...');
  await clickNext(page);
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W35_adm_trans_paso5.png', true);

  await ctx.close();
}

// ---------------------------------------------------------------------------
// H. Mobile PWA captures (W42-W46)
// ---------------------------------------------------------------------------
async function captureMobile(browser) {
  // Admin mobile captures
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  await login(page);

  // W42: Mobile Generador paso 1
  console.log('W42: Mobile — Admin Generador paso 1...');
  await page.goto(`${BASE}/mobile/admin/actores/generadores/nuevo`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot(page, MOBILE_DIR, 'W42_mob_gen_paso1.png');

  // W43: Mobile TEF (fill step 1 & advance to step 4)
  console.log('W43: Mobile — TEF calculator...');
  await fillAdminStep1(page, {
    razonSocial: 'Test Mobile S.A.',
    razonPlaceholder: 'Empresa S.A.',
    emailPlaceholder: 'contacto@empresa.com',
  });
  for (let i = 0; i < 3; i++) await clickNext(page);
  await page.waitForTimeout(1500);
  await shot(page, MOBILE_DIR, 'W43_mob_gen_tef.png');

  // W44: Mobile Operador representantes
  console.log('W44: Mobile — Operador representantes...');
  await page.goto(`${BASE}/mobile/admin/actores/operadores/nuevo`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await fillAdminStep1(page, {
    razonSocial: 'Operador Mobile S.A.',
    razonPlaceholder: 'Planta de Tratamiento S.A.',
    emailPlaceholder: 'contacto@operador.com',
  });
  // Advance to step 3 (Representantes)
  for (let i = 0; i < 2; i++) await clickNext(page);
  await page.waitForTimeout(1000);
  await shot(page, MOBILE_DIR, 'W44_mob_oper_representantes.png');

  // W45: Mobile Transportista vehiculos (no validation needed)
  console.log('W45: Mobile — Transportista vehiculos...');
  await page.goto(`${BASE}/mobile/admin/actores/transportistas/nuevo`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  for (let i = 0; i < 2; i++) await clickNext(page);
  await page.waitForTimeout(1000);
  await shot(page, MOBILE_DIR, 'W45_mob_trans_vehiculos.png');

  await ctx.close();

  // W46: Mobile inscripcion publica fase 1 (separate context, no login)
  console.log('W46: Mobile — Inscripcion publica fase 1...');
  const ctxPub = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const pagePub = await ctxPub.newPage();
  await pagePub.goto(`${BASE}/inscripcion/generador`, { waitUntil: 'networkidle', timeout: 30000 });
  await pagePub.waitForTimeout(2000);
  await shot(pagePub, MOBILE_DIR, 'W46_mob_inscripcion_fase1.png');
  await ctxPub.close();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('=== Capture Wizards Detailed (v2) ===');
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  let captured = 0;
  let failed = 0;

  const sections = [
    { name: 'A. Public Generador (W01-W07)', fn: capturePublicGenerador, count: 7 },
    { name: 'B. Public Operador (W08-W12)', fn: capturePublicOperador, count: 5 },
    { name: 'C. Public Transportista (W13-W16)', fn: capturePublicTransportista, count: 4 },
    { name: 'D. Admin Generador (W17-W23 + W36-W41)', fn: captureAdminGenerador, count: 13 },
    { name: 'E. Admin Operador (W24-W30)', fn: captureAdminOperador, count: 7 },
    { name: 'F. Admin Transportista (W31-W35)', fn: captureAdminTransportista, count: 5 },
    { name: 'H. Mobile (W42-W46)', fn: captureMobile, count: 5 },
  ];

  for (const section of sections) {
    console.log(`\n--- ${section.name} ---`);
    try {
      await section.fn(browser);
      captured += section.count;
    } catch (err) {
      console.error(`  ERROR in ${section.name}:`, err.message);
      failed += section.count;
    }
  }

  await browser.close();
  console.log(`\n=== Done: ~${captured} screenshots captured, ${failed} failed ===`);
})();
