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

async function clickSiguiente(page) {
  const btn = page.locator('button:has-text("Siguiente")').first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

async function shot(page, dir, filename, fullPage = false) {
  await page.screenshot({ path: path.join(dir, filename), fullPage });
  console.log(`  -> ${filename}`);
}

async function fillPhase1(page, suffix) {
  const ts = Date.now();
  for (const input of await page.locator('input[type="email"], input[name="email"]').all()) {
    await input.fill(`test_${suffix}_${ts}@test.com`);
  }
  for (const input of await page.locator('input[type="password"]').all()) {
    await input.fill('TestPass123!');
  }
  for (const input of await page.locator('input[name="nombre"], input[placeholder*="nombre" i], input[placeholder*="razon" i]').all()) {
    await input.fill(`Test ${suffix}`);
  }
  for (const input of await page.locator('input[name="cuit"], input[placeholder*="CUIT" i]').all()) {
    await input.fill('20-12345678-9');
  }
  await page.waitForTimeout(500);
  const submitBtn = page.locator('button[type="submit"], button:has-text("Crear Cuenta"), button:has-text("Registrar"), button:has-text("Siguiente")').first();
  if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await submitBtn.click();
    await page.waitForTimeout(2000);
  }
}

// ---------------------------------------------------------------------------
// A. Public Inscripcion — Generador (W01-W07)
// ---------------------------------------------------------------------------
async function capturePublicGenerador(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // W01: Phase 1 — account creation form
  console.log('W01: Public Generador — Fase 1...');
  await page.goto(`${BASE}/inscripcion/generador`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await shot(page, DESKTOP_DIR, 'W01_pub_gen_fase1.png');

  // Fill Phase 1 and advance to wizard
  await fillPhase1(page, 'gen');

  // W02: Step 1 — Establecimiento
  console.log('W02: Public Generador — Paso 1 Establecimiento...');
  await page.waitForTimeout(1000);
  await shot(page, DESKTOP_DIR, 'W02_pub_gen_paso1.png');

  // W03: Step 2 — Regulatorio
  console.log('W03: Public Generador — Paso 2 Regulatorio...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W03_pub_gen_paso2.png');

  // W04: Step 3 — Domicilios
  console.log('W04: Public Generador — Paso 3 Domicilios...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W04_pub_gen_paso3.png');

  // Advance through step 4 (Adicional) to reach TEF
  await clickSiguiente(page);

  // W05: Step 5 — Calculo TEF
  console.log('W05: Public Generador — Paso 5 TEF...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W05_pub_gen_paso5.png');

  // W06: Step 6 — Documentos
  console.log('W06: Public Generador — Paso 6 Documentos...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W06_pub_gen_paso6.png');

  // W07: Step 7 — Resumen
  console.log('W07: Public Generador — Paso 7 Resumen...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W07_pub_gen_paso7.png', true);

  await ctx.close();
}

// ---------------------------------------------------------------------------
// B. Public Inscripcion — Operador (W08-W12)
// ---------------------------------------------------------------------------
async function capturePublicOperador(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log('W08: Public Operador — Paso 1 Establecimiento...');
  await page.goto(`${BASE}/inscripcion/operador`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await fillPhase1(page, 'oper');
  await page.waitForTimeout(1000);
  await shot(page, DESKTOP_DIR, 'W08_pub_oper_paso1.png');

  // Advance to step 4 (Representantes)
  for (let i = 0; i < 3; i++) await clickSiguiente(page);
  console.log('W09: Public Operador — Paso 4 Representantes...');
  await shot(page, DESKTOP_DIR, 'W09_pub_oper_paso4.png');

  // W10: Step 5 — Corrientes Y
  console.log('W10: Public Operador — Paso 5 Corrientes...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W10_pub_oper_paso5.png');

  // W11: Step 6 — TEF
  console.log('W11: Public Operador — Paso 6 TEF...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W11_pub_oper_paso6.png');

  // Advance to Resumen (skip Documentos)
  await clickSiguiente(page);
  // W12: Step 8 — Resumen
  console.log('W12: Public Operador — Paso 8 Resumen...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W12_pub_oper_paso8.png', true);

  await ctx.close();
}

// ---------------------------------------------------------------------------
// C. Public Inscripcion — Transportista (W13-W16)
// ---------------------------------------------------------------------------
async function capturePublicTransportista(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log('W13: Public Transportista — Paso 1 Datos...');
  await page.goto(`${BASE}/inscripcion/transportista`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await fillPhase1(page, 'trans');
  await page.waitForTimeout(1000);
  await shot(page, DESKTOP_DIR, 'W13_pub_trans_paso1.png');

  // W14: Step 2 — Habilitacion
  console.log('W14: Public Transportista — Paso 2 Habilitacion...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W14_pub_trans_paso2.png');

  // W15: Step 3 — Vehiculos
  console.log('W15: Public Transportista — Paso 3 Vehiculos...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W15_pub_trans_paso3.png');

  // Advance through Documentos to Resumen
  await clickSiguiente(page);
  // W16: Step 5 — Resumen
  console.log('W16: Public Transportista — Paso 5 Resumen...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W16_pub_trans_paso5.png', true);

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
  await shot(page, DESKTOP_DIR, 'W17_adm_gen_paso1.png');

  // W18: Step 2 — Domicilios
  console.log('W18: Admin Generador — Paso 2 Domicilios...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W18_adm_gen_paso2.png');

  // W19: Step 3 — Residuos (corrientes Y checkboxes)
  console.log('W19: Admin Generador — Paso 3 Residuos...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W19_adm_gen_paso3.png');

  // W20: Step 4 — Calculo TEF (top: result + zona)
  console.log('W20: Admin Generador — Paso 4 TEF resultado...');
  await clickSiguiente(page);
  await page.waitForTimeout(1000);
  await shot(page, DESKTOP_DIR, 'W20_adm_gen_paso4_tef.png');

  // W21: TEF — scroll to see A coefficients
  console.log('W21: Admin Generador — Paso 4 TEF coeficientes A...');
  // Scroll down within the page to show A coefficients
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(800);
  await shot(page, DESKTOP_DIR, 'W21_adm_gen_paso4_tef_a.png');

  // Also capture TEF detail screenshots (W36-W41) from the same step
  // W36: TEF result header
  console.log('W36: TEF — resultado header...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  // Try to capture just the TEF result area
  const tefResult = page.locator('[class*="bg-neutral-900"], [class*="bg-gray-900"], [class*="dark"]').first();
  if (await tefResult.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tefResult.screenshot({ path: path.join(DESKTOP_DIR, 'W36_tef_resultado.png') });
    console.log('  -> W36_tef_resultado.png');
  } else {
    await shot(page, DESKTOP_DIR, 'W36_tef_resultado.png');
  }

  // W37: TEF zona section
  console.log('W37: TEF — zona section...');
  const zonaSection = page.locator('text=Coeficiente Zonal').first();
  if (await zonaSection.isVisible({ timeout: 2000 }).catch(() => false)) {
    await zonaSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const zonaCard = zonaSection.locator('xpath=ancestor::div[contains(@class,"rounded")]').first();
    if (await zonaCard.isVisible({ timeout: 1000 }).catch(() => false)) {
      await zonaCard.screenshot({ path: path.join(DESKTOP_DIR, 'W37_tef_zona.png') });
      console.log('  -> W37_tef_zona.png');
    }
  }

  // W38: TEF magnitude D section
  console.log('W38: TEF — magnitud D...');
  const dSection = page.locator('text=Magnitud D').first();
  if (await dSection.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  await shot(page, DESKTOP_DIR, 'W38_tef_magnitud_d.png');

  // W39: TEF peligrosidad A section
  console.log('W39: TEF — peligrosidad A...');
  const aSection = page.locator('text=Peligrosidad Ambiental').first();
  if (await aSection.isVisible({ timeout: 2000 }).catch(() => false)) {
    await aSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  await shot(page, DESKTOP_DIR, 'W39_tef_coef_a.png');

  // W40: TEF coeficiente C section
  console.log('W40: TEF — coeficiente C...');
  const cSection = page.locator('text=Coeficiente de Corriente').first();
  if (await cSection.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  await shot(page, DESKTOP_DIR, 'W40_tef_coef_c.png');

  // W41: TEF full-page desglose
  console.log('W41: TEF — desglose completo...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await shot(page, DESKTOP_DIR, 'W41_tef_desglose.png', true);

  // Back to regular wizard steps — scroll to top for step 5
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  // W22: Step 5 — Regulatorio
  console.log('W22: Admin Generador — Paso 5 Regulatorio...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W22_adm_gen_paso5.png');

  // W23: Step 6 — Adjuntos + Resumen
  console.log('W23: Admin Generador — Paso 6 Adjuntos...');
  await clickSiguiente(page);
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
  await shot(page, DESKTOP_DIR, 'W24_adm_oper_paso1.png');

  // W25: Step 2 — Domicilios
  console.log('W25: Admin Operador — Paso 2 Domicilios...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W25_adm_oper_paso2.png');

  // W26: Step 3 — Representantes
  console.log('W26: Admin Operador — Paso 3 Representantes...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W26_adm_oper_paso3.png');

  // W27: Step 4 — Residuos (corrientes Y + tecnologia)
  console.log('W27: Admin Operador — Paso 4 Residuos...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W27_adm_oper_paso4.png');

  // W28: Step 5 — Calculo TEF
  console.log('W28: Admin Operador — Paso 5 TEF...');
  await clickSiguiente(page);
  await page.waitForTimeout(1000);
  await shot(page, DESKTOP_DIR, 'W28_adm_oper_paso5_tef.png');

  // W29: Step 6 — Regulatorio
  console.log('W29: Admin Operador — Paso 6 Regulatorio...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W29_adm_oper_paso6.png');

  // W30: Step 7 — Adjuntos + Resumen
  console.log('W30: Admin Operador — Paso 7 Adjuntos...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W30_adm_oper_paso7.png');

  await ctx.close();
}

// ---------------------------------------------------------------------------
// F. Admin — NuevoTransportistaPage (W31-W35)
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
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W32_adm_trans_paso2.png');

  // W33: Step 3 — Vehiculos
  console.log('W33: Admin Transportista — Paso 3 Vehiculos...');
  await clickSiguiente(page);
  // Click "Agregar Vehiculo" to show a vehicle row
  const addVehBtn = page.locator('button:has-text("Agregar"), button:has-text("vehiculo" i)').first();
  if (await addVehBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addVehBtn.click();
    await page.waitForTimeout(800);
  }
  await shot(page, DESKTOP_DIR, 'W33_adm_trans_paso3.png');

  // W34: Step 4 — Choferes
  console.log('W34: Admin Transportista — Paso 4 Choferes...');
  await clickSiguiente(page);
  // Click "Agregar Chofer" to show a chofer row
  const addChofBtn = page.locator('button:has-text("Agregar"), button:has-text("chofer" i)').first();
  if (await addChofBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addChofBtn.click();
    await page.waitForTimeout(800);
  }
  await shot(page, DESKTOP_DIR, 'W34_adm_trans_paso4.png');

  // W35: Step 5 — Confirmar
  console.log('W35: Admin Transportista — Paso 5 Confirmar...');
  await clickSiguiente(page);
  await shot(page, DESKTOP_DIR, 'W35_adm_trans_paso5.png', true);

  await ctx.close();
}

// ---------------------------------------------------------------------------
// H. Mobile PWA captures (W42-W46)
// ---------------------------------------------------------------------------
async function captureMobile(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();

  // W42: Mobile Generador paso 1 (admin, needs login)
  console.log('W42: Mobile — Admin Generador paso 1...');
  await login(page);
  await page.goto(`${BASE}/mobile/admin/actores/generadores/nuevo`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot(page, MOBILE_DIR, 'W42_mob_gen_paso1.png');

  // W43: Mobile TEF (advance to step 4)
  console.log('W43: Mobile — TEF calculator...');
  for (let i = 0; i < 3; i++) await clickSiguiente(page);
  await page.waitForTimeout(1000);
  await shot(page, MOBILE_DIR, 'W43_mob_gen_tef.png');

  // W44: Mobile Operador representantes
  console.log('W44: Mobile — Operador representantes...');
  await page.goto(`${BASE}/mobile/admin/actores/operadores/nuevo`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  // Advance to step 3 (Representantes)
  for (let i = 0; i < 2; i++) await clickSiguiente(page);
  await page.waitForTimeout(1000);
  await shot(page, MOBILE_DIR, 'W44_mob_oper_representantes.png');

  // W45: Mobile Transportista vehiculos
  console.log('W45: Mobile — Transportista vehiculos...');
  await page.goto(`${BASE}/mobile/admin/actores/transportistas/nuevo`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  // Advance to step 3 (Vehiculos)
  for (let i = 0; i < 2; i++) await clickSiguiente(page);
  await page.waitForTimeout(1000);
  await shot(page, MOBILE_DIR, 'W45_mob_trans_vehiculos.png');

  // W46: Mobile inscripcion publica fase 1
  console.log('W46: Mobile — Inscripcion publica fase 1...');
  const ctxPub = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const pagePub = await ctxPub.newPage();
  await pagePub.goto(`${BASE}/inscripcion/generador`, { waitUntil: 'networkidle', timeout: 30000 });
  await pagePub.waitForTimeout(2000);
  await shot(pagePub, MOBILE_DIR, 'W46_mob_inscripcion_fase1.png');
  await ctxPub.close();

  await ctx.close();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('=== Capture Wizards Detailed ===');
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
