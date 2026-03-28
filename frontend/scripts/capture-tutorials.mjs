/**
 * SITREP — Capture Tutorial Animations
 * =====================================
 * Uses Playwright to navigate the system and record videos
 * of the most complex features for the /ayuda page.
 *
 * Usage: node frontend/scripts/capture-tutorials.mjs
 * Output: docs/screenshots/animations-new/*.webm → *.webp
 *
 * The 8 output files match AyudaPage.tsx's expected filenames:
 *   login_dashboard.webp, admin_menu_navegacion.webp,
 *   transportista_viaje.webp, tracking_gps_mapa.webp,
 *   operador_recepcion.webp, reportes_exportacion.webp,
 *   cambio_perfil_menu.webp, demoapp_selector_onboarding.webp
 */

import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BASE = 'https://sitrep.ultimamilla.com.ar';
const OUTPUT = 'docs/screenshots/animations-new';
const VIEWPORT = { width: 1280, height: 800 };

fs.mkdirSync(OUTPUT, { recursive: true });

/**
 * Pre-seed localStorage to suppress ALL auto-triggered overlays:
 * - OnboardingWizard (first login per user)
 * - DemoAppOnboarding (per role)
 * - InstallPWAModal (45s timer)
 * - OnboardingTour (spotlight tour)
 */
async function suppressOverlays(page) {
  await page.evaluate(() => {
    // Suppress OnboardingWizard for all possible user IDs
    for (let i = 0; i < 50; i++) {
      localStorage.setItem(`sitrep_onboarding_user_${i}`, 'true');
    }
    // Suppress by common UUID patterns (seed users)
    localStorage.setItem('sitrep_onboarding_done', 'true');

    // Suppress DemoAppOnboarding for all roles
    for (const role of ['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'AUDITOR',
                        'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR']) {
      localStorage.setItem(`sitrep_onboarding_${role}`, 'true');
    }

    // Suppress InstallPWAModal (7-day dismiss)
    localStorage.setItem('sitrep_pwa_dismiss', new Date().toISOString());

    // Suppress OnboardingTour
    localStorage.setItem('sitrep_tour_completed', 'true');
  });
}

/**
 * Aggressively dismiss any overlays that managed to appear despite pre-seeding
 */
async function dismissOverlays(page) {
  for (let attempt = 0; attempt < 5; attempt++) {
    // Try specific dismiss buttons from OnboardingWizard
    const skipBtn = page.locator('button:has-text("Saltar introducción")').first();
    if (await skipBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
      continue;
    }

    // Try "Comenzar" (DemoAppOnboarding final action)
    const comenzarBtn = page.locator('button:has-text("Comenzar")').first();
    if (await comenzarBtn.isVisible({ timeout: 200 }).catch(() => false)) {
      await comenzarBtn.click();
      await page.waitForTimeout(500);
      continue;
    }

    // Try "Empezar" (OnboardingWizard final action)
    const empezarBtn = page.locator('button:has-text("Empezar")').first();
    if (await empezarBtn.isVisible({ timeout: 200 }).catch(() => false)) {
      await empezarBtn.click();
      await page.waitForTimeout(500);
      continue;
    }

    // Try "Ahora no" (InstallPWAModal)
    const ahoraNoBtn = page.locator('button:has-text("Ahora no")').first();
    if (await ahoraNoBtn.isVisible({ timeout: 200 }).catch(() => false)) {
      await ahoraNoBtn.click();
      await page.waitForTimeout(500);
      continue;
    }

    // Try generic close buttons
    const closeBtn = page.locator('button[aria-label="Cerrar"], button:has-text("Cerrar"), button:has-text("Omitir"), button:has-text("Entendido")').first();
    if (await closeBtn.isVisible({ timeout: 200 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
      continue;
    }

    // Try Escape key for any remaining overlay
    const overlay = page.locator('div.fixed.inset-0').first();
    if (await overlay.isVisible({ timeout: 200 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      continue;
    }

    // No overlay found, we're clear
    break;
  }
}

/**
 * Login as a specific demo user role
 */
async function login(page, role = 'Administrador') {
  // Pre-seed localStorage BEFORE navigating
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await suppressOverlays(page);
  await page.waitForTimeout(1000);

  // Reload to apply localStorage suppression
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Click the demo user button for the requested role
  const roleBtn = page.locator(`button:has-text("${role}")`).first();
  if (await roleBtn.isVisible({ timeout: 5000 })) {
    await roleBtn.click();
  } else {
    // Fallback: click first available demo button
    console.log(`  ⚠️  Role "${role}" button not found, clicking first demo button`);
    const anyBtn = page.locator('button:has-text("Ingresar como")').first();
    await anyBtn.click();
  }

  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Re-suppress and dismiss any overlays that appeared after login
  await suppressOverlays(page);
  await dismissOverlays(page);
  await page.waitForTimeout(1000);
}

/**
 * Login as Transportista
 */
async function loginTransportista(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await suppressOverlays(page);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const transBtn = page.locator('button:has-text("Transportista")').first();
  if (await transBtn.isVisible({ timeout: 5000 })) {
    await transBtn.click();
  }
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForTimeout(2000);
  await suppressOverlays(page);
  await dismissOverlays(page);
  await page.waitForTimeout(1000);
}

/**
 * Login as Operador
 */
async function loginOperador(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await suppressOverlays(page);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const opBtn = page.locator('button:has-text("Operador")').first();
  if (await opBtn.isVisible({ timeout: 5000 })) {
    await opBtn.click();
  }
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForTimeout(2000);
  await suppressOverlays(page);
  await dismissOverlays(page);
  await page.waitForTimeout(1000);
}

async function captureSequence(name, fn) {
  console.log(`\n📹 Capturing: ${name}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: OUTPUT, size: VIEWPORT },
    locale: 'es-AR',
  });
  const page = await context.newPage();

  try {
    await fn(page);
    console.log(`  ✅ Done recording ${name}`);
  } catch (err) {
    console.error(`  ❌ Error in ${name}:`, err.message);
  }

  await page.close();
  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  if (videoPath) {
    const dest = path.join(OUTPUT, `${name}.webm`);
    fs.renameSync(videoPath, dest);
    console.log(`  📁 Saved: ${dest}`);
    return dest;
  }
  return null;
}

// ============================================================
// 1. login_dashboard — Login flow + Dashboard overview
// ============================================================
await captureSequence('login_dashboard', async (page) => {
  // Show login page first (don't pre-suppress — we WANT to show it)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Pre-seed overlays before clicking login
  await suppressOverlays(page);

  // Click Administrador demo button
  const adminBtn = page.locator('button:has-text("Administrador")').first();
  await adminBtn.click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await dismissOverlays(page);

  // Show dashboard content
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
});

// ============================================================
// 2. admin_menu_navegacion — Admin navigating sidebar menus
// ============================================================
await captureSequence('admin_menu_navegacion', async (page) => {
  await login(page);
  await page.waitForTimeout(1500);

  // Navigate through main sections
  for (const section of ['Manifiestos', 'Centro de Control', 'Reportes', 'Usuarios', 'Alertas', 'Dashboard']) {
    const link = page.locator(`a:has-text("${section}")`).first();
    if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
      await link.click();
      await page.waitForTimeout(2000);
    }
  }
});

// ============================================================
// 3. transportista_viaje — Transportista trip workflow
// ============================================================
await captureSequence('transportista_viaje', async (page) => {
  await loginTransportista(page);
  await page.waitForTimeout(1500);

  // Show transportista dashboard with trip cards
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(2000);

  // Navigate to manifiestos
  const manifLink = page.locator('a:has-text("Manifiestos")').first();
  if (await manifLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await manifLink.click();
    await page.waitForTimeout(2500);
  }

  // Navigate to perfil transporte
  const perfilLink = page.locator('a:has-text("Mi Perfil"), a:has-text("Perfil")').first();
  if (await perfilLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await perfilLink.click();
    await page.waitForTimeout(2500);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
});

// ============================================================
// 4. tracking_gps_mapa — Centro de Control with GPS map
// ============================================================
await captureSequence('tracking_gps_mapa', async (page) => {
  await login(page);

  // Navigate to Centro de Control
  const ccLink = page.locator('a:has-text("Centro de Control")').first();
  await ccLink.click();
  await page.waitForTimeout(5000); // Wait for map tiles to load

  // Scroll to show map fully
  await page.evaluate(() => window.scrollBy(0, 100));
  await page.waitForTimeout(2500);

  // Scroll down to see stats/pipeline
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(2500);

  // Back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);
});

// ============================================================
// 5. operador_recepcion — Operador receiving manifiestos
// ============================================================
await captureSequence('operador_recepcion', async (page) => {
  await loginOperador(page);
  await page.waitForTimeout(1500);

  // Show operador dashboard
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(2000);

  // Navigate to manifiestos
  const manifLink = page.locator('a:has-text("Manifiestos")').first();
  if (await manifLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await manifLink.click();
    await page.waitForTimeout(2500);

    // Click first manifiesto for detail
    const firstRow = page.locator('tr[class*="cursor"], tbody tr').first();
    if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(2500);
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1500);
    }
  }
});

// ============================================================
// 6. reportes_exportacion — Reports tabs + export
// ============================================================
await captureSequence('reportes_exportacion', async (page) => {
  await login(page);

  // Navigate to Reportes
  const repLink = page.locator('a:has-text("Reportes")').first();
  await repLink.click();
  await page.waitForTimeout(3000);

  // Click through tabs
  for (const tab of ['Tratados', 'Transporte', 'Generadores', 'Operadores', 'Departamentos', 'Mapa']) {
    const tabBtn = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first();
    if (await tabBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await tabBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  // Go back to Manifiestos tab and show export button
  const manifTab = page.locator('button:has-text("Manifiestos"), [role="tab"]:has-text("Manifiestos")').first();
  if (await manifTab.isVisible({ timeout: 1000 }).catch(() => false)) {
    await manifTab.click();
    await page.waitForTimeout(1500);
  }
});

// ============================================================
// 7. cambio_perfil_menu — Profile switching / user menu
// ============================================================
await captureSequence('cambio_perfil_menu', async (page) => {
  await login(page);
  await page.waitForTimeout(1500);

  // Navigate to user profile
  const perfilLink = page.locator('a:has-text("Mi Perfil"), a:has-text("Perfil")').first();
  if (await perfilLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await perfilLink.click();
    await page.waitForTimeout(2500);
  }

  // Navigate to Configuracion
  const configLink = page.locator('a:has-text("Configuración")').first();
  if (await configLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await configLink.click();
    await page.waitForTimeout(2500);
  }

  // Navigate to user switcher (if exists)
  const switchLink = page.locator('a:has-text("Cambiar"), button:has-text("Cambiar usuario")').first();
  if (await switchLink.isVisible({ timeout: 1000 }).catch(() => false)) {
    await switchLink.click();
    await page.waitForTimeout(2500);
  }

  await page.waitForTimeout(1500);
});

// ============================================================
// 8. demoapp_selector_onboarding — Demo user selection + app
// ============================================================
await captureSequence('demoapp_selector_onboarding', async (page) => {
  // Show login page with all demo user cards
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Scroll to show all demo users
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);

  // Now show the mobile app login
  await page.goto(`${BASE}/app/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Scroll mobile login
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(2000);
});

// ============================================================
// Convert WebM → WebP
// ============================================================
console.log('\n🔄 Converting videos to animated WebP...');
const webmFiles = fs.readdirSync(OUTPUT).filter(f => f.endsWith('.webm'));

for (const file of webmFiles) {
  const input = path.join(OUTPUT, file);
  const output = path.join(OUTPUT, file.replace('.webm', '.webp'));

  if (fs.statSync(input).size < 1000) {
    console.log(`  ⚠️  Skipping ${file} (too small — recording may have failed)`);
    continue;
  }

  try {
    execFileSync('ffmpeg', [
      '-y', '-i', input,
      '-vf', 'fps=8,scale=800:-1:flags=lanczos',
      '-loop', '0',
      '-quality', '60',
      '-compression_level', '4',
      output
    ], { stdio: 'pipe', timeout: 120000 });
    const sz = (fs.statSync(output).size / 1024 / 1024).toFixed(1);
    console.log(`  ✅ ${file} → ${path.basename(output)} (${sz}MB)`);
  } catch {
    console.log(`  ⚠️  ffmpeg conversion failed for ${file} — keeping .webm`);
  }
}

console.log('\n✅ All tutorials captured!');
console.log(`📁 Output: ${OUTPUT}/`);
console.log('\nExpected files for AyudaPage.tsx:');
const expected = [
  'login_dashboard', 'admin_menu_navegacion', 'transportista_viaje',
  'tracking_gps_mapa', 'operador_recepcion', 'reportes_exportacion',
  'cambio_perfil_menu', 'demoapp_selector_onboarding'
];
for (const name of expected) {
  const webp = path.join(OUTPUT, `${name}.webp`);
  const webm = path.join(OUTPUT, `${name}.webm`);
  const exists = fs.existsSync(webp) ? '✅ .webp' : fs.existsSync(webm) ? '⚠️  .webm only' : '❌ missing';
  console.log(`  ${exists} — ${name}`);
}
