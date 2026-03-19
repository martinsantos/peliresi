/**
 * Wrapper that runs ONLY detailShots() — skips desktop/mobile re-capture.
 * Ejecutar: npx ts-node scripts/capture-detail-shots-only.ts
 */

// Re-export everything from the main script by importing the detailShots function
// Since the main script uses a self-executing IIFE we need to restructure.
// Instead, we duplicate the minimal setup here.

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE  = 'https://sitrep.ultimamilla.com.ar';
const APP   = 'https://sitrep.ultimamilla.com.ar/app';

const CREDS = {
  ADMIN:         { email: 'admin@dgfa.mendoza.gov.ar',        password: 'admin123' },
  GENERADOR:     { email: 'quimica.mendoza@industria.com',     password: 'gen123'   },
  TRANSPORTISTA: { email: 'transportes.andes@logistica.com',  password: 'trans123' },
  OPERADOR:      { email: 'tratamiento.residuos@planta.com',  password: 'op123'    },
};

const OUT_D = path.resolve(__dirname, '../../docs/screenshots/desktop');
const OUT_M = path.resolve(__dirname, '../../docs/screenshots/mobile');
[OUT_D, OUT_M].forEach(d => fs.mkdirSync(d, { recursive: true }));

const DT = { width: 1440, height: 900 };
const MB = { width: 390,  height: 844 };

let capturedDesktop = 0;
let capturedMobile  = 0;

async function login(page: Page, role: keyof typeof CREDS) {
  const isApp = page.url().startsWith(APP);
  const loginUrl = (isApp ? APP : BASE) + '/login';
  await page.goto(loginUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const quickMap: Record<string, string> = {
    ADMIN: 'Administrador', GENERADOR: 'Generador',
    TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador',
  };
  const quickText = quickMap[role];
  if (quickText) {
    try {
      const btn = page.locator(`button:has-text("${quickText}")`).first();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(800);
        return;
      }
    } catch {}
  }
  await page.locator('input[type="text"], input[type="email"]').first().fill(CREDS[role].email);
  await page.fill('input[type="password"]', CREDS[role].password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
}

async function go(page: Page, p: string, wait = 1800) {
  await page.goto(BASE + p, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
}

async function goApp(page: Page, p: string, wait = 1800) {
  await page.goto(APP + p, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
}

async function snap(page: Page, dir: string, name: string) {
  try {
    await page.screenshot({ path: path.join(dir, name), fullPage: false });
    if (dir === OUT_D) capturedDesktop++; else capturedMobile++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}: ${(e as Error).message}`);
  }
}
const D = (page: Page, name: string) => snap(page, OUT_D, name);
const M = (page: Page, name: string) => snap(page, OUT_M, name);

async function clickIfExists(page: Page, selector: string) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 })) await el.click();
  } catch {}
}

async function detailShots(browser: Browser) {
  console.log('\n🔍 Detail Shots — estados de manifiesto y modales');
  const ctx = await browser.newContext({ viewport: DT });
  const p = await ctx.newPage();
  await login(p, 'ADMIN');

  async function snapManifiestoDetalle(estado: string, filename: string) {
    try {
      await go(p, `/manifiestos?estado=${estado}`, 2500);
      // Pages use useNavigate onClick — click first row to navigate
      const firstRow = p.locator('tbody tr').first();
      const rowCount = await p.locator('tbody tr').count();
      if (rowCount === 0) {
        console.log(`  ✗ ${filename}: no hay manifiestos en estado ${estado}`);
        return;
      }
      await firstRow.click();
      await p.waitForURL(/\/manifiestos\/[^/]+$/, { timeout: 5000 });
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(2000);
      await D(p, filename);
    } catch (err) {
      console.log(`  ✗ ${filename}: error capturando estado ${estado}: ${(err as Error).message?.slice(0,80)}`);
    }
  }

  await snapManifiestoDetalle('BORRADOR',   '53_manifiesto_borrador_detalle.png');
  await snapManifiestoDetalle('APROBADO',   '54_manifiesto_aprobado_detalle.png');
  await snapManifiestoDetalle('ENTREGADO',  '55_manifiesto_entregado_detalle.png');
  await snapManifiestoDetalle('RECIBIDO',   '56_manifiesto_recibido_detalle.png');
  await snapManifiestoDetalle('TRATADO',    '57_manifiesto_tratado_detalle.png');

  try {
    await go(p, '/manifiestos?estado=TRATADO', 2500);
    const rowCount = await p.locator('tbody tr').count();
    if (rowCount > 0) {
      await p.locator('tbody tr').first().click();
      await p.waitForURL(/\/manifiestos\/[^/]+$/, { timeout: 5000 });
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(1500);
      await p.evaluate(() => window.scrollBy(0, 600));
      await p.waitForTimeout(800);
      await D(p, '58_manifiesto_timeline.png');
    } else { console.log('  ✗ 58_manifiesto_timeline.png: no hay manifiestos TRATADO'); }
  } catch (err) { console.log(`  ✗ 58_manifiesto_timeline.png: ${(err as Error).message?.slice(0, 80)}`); }

  try {
    await go(p, '/reportes', 2500);
    await clickIfExists(p, 'button:has-text("Exportar")');
    await p.waitForTimeout(800);
    await D(p, '59_reportes_exportar.png');
  } catch { console.log('  ✗ 59_reportes_exportar.png: error'); }

  try {
    await go(p, '/alertas', 1800);
    await clickIfExists(p, 'button:has-text("Reglas")');
    await p.waitForTimeout(800);
    await D(p, '60_alertas_reglas.png');
  } catch { console.log('  ✗ 60_alertas_reglas.png: error'); }

  try {
    await go(p, '/centro-control', 3000);
    await clickIfExists(p, 'button:has-text("Viajes")');
    await p.waitForTimeout(1000);
    await D(p, '61_centro_control_viajes.png');
  } catch { console.log('  ✗ 61_centro_control_viajes.png: error'); }

  try {
    await login(p, 'GENERADOR');
    await go(p, '/manifiestos/nuevo', 1500);
    await clickIfExists(p, 'button:has-text("Siguiente")');
    await p.waitForTimeout(800);
    await clickIfExists(p, 'button:has-text("Siguiente")');
    await p.waitForTimeout(1000);
    await D(p, '62_manifiesto_nuevo_paso3_residuos.png');
    await login(p, 'ADMIN');
  } catch { console.log('  ✗ 62_manifiesto_nuevo_paso3_residuos.png: error'); }

  // Actor detail pages use onClick navigate — click first table row
  async function snapActorDetalle(route: string, urlPattern: RegExp, filename: string) {
    try {
      await go(p, route, 2200);
      const rowCount = await p.locator('tbody tr').count();
      if (rowCount === 0) { console.log(`  ✗ ${filename}: tabla vacía en ${route}`); return; }
      await p.locator('tbody tr').first().click();
      await p.waitForURL(urlPattern, { timeout: 5000 });
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(2000);
      await D(p, filename);
    } catch (err) {
      console.log(`  ✗ ${filename}: error: ${(err as Error).message?.slice(0, 80)}`);
    }
  }

  await snapActorDetalle('/admin/actores/transportistas', /transportistas\/[^/]+/, '63_transportista_detalle_flota.png');
  await snapActorDetalle('/admin/actores/generadores',   /generadores\/[^/]+/,    '64_generador_detalle.png');
  await snapActorDetalle('/admin/actores/operadores',    /operadores\/[^/]+/,     '65_operador_detalle.png');

  try {
    await go(p, '/manifiestos/verificar/2026-000001', 1500);
    await D(p, '66_verificar_manifiesto_detalle.png');
  } catch { console.log('  ✗ 66_verificar_manifiesto_detalle.png: error'); }

  try {
    await go(p, '/centro-control', 3000);
    await D(p, '67_centro_control_kpis.png');
  } catch { console.log('  ✗ 67_centro_control_kpis.png: error'); }

  await ctx.close();

  // Mobile
  console.log('\n📱 Mobile Detail Shots');
  const mctx = await browser.newContext({
    viewport: MB,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });
  const mp = await mctx.newPage();

  try {
    await login(mp, 'TRANSPORTISTA');
    await goApp(mp, '/transporte/perfil', 2500);
    await M(mp, 'M21_tomar_viaje_mobile.png');
  } catch { console.log('  ✗ M21_tomar_viaje_mobile.png: error'); }

  // M22 — transportista viaje en curso o perfil viaje
  try {
    await goApp(mp, '/manifiestos', 2000);
    const rowCount = await mp.locator('tbody tr').count();
    if (rowCount > 0) {
      await mp.locator('tbody tr').first().click();
      await mp.waitForLoadState('networkidle');
      await mp.waitForTimeout(2000);
      await M(mp, 'M22_viaje_gps_activo_mobile.png');
    } else {
      await goApp(mp, '/transporte/perfil', 2000);
      await M(mp, 'M22_viaje_gps_activo_mobile.png');
    }
  } catch { console.log('  ✗ M22_viaje_gps_activo_mobile.png: error'); }

  try {
    await login(mp, 'OPERADOR');
    await goApp(mp, '/manifiestos', 2000);
    const rowCount = await mp.locator('tbody tr').count();
    if (rowCount > 0) {
      await mp.locator('tbody tr').first().click();
      await mp.waitForLoadState('networkidle');
      await mp.waitForTimeout(2000);
      await M(mp, 'M23_manifiesto_entregado_operador_mobile.png');
    } else { console.log('  ✗ M23: no hay manifiestos'); }
  } catch { console.log('  ✗ M23_manifiesto_entregado_operador_mobile.png: error'); }

  try {
    await goApp(mp, '/manifiestos', 2000);
    const rowCount = await mp.locator('tbody tr').count();
    if (rowCount > 0) {
      await mp.locator('tbody tr').first().click();
      await mp.waitForLoadState('networkidle');
      await mp.waitForTimeout(1500);
      await clickIfExists(mp, 'button:has-text("Pesaje")');
      await mp.waitForTimeout(1000);
      await M(mp, 'M24_pesaje_modal_mobile.png');
    } else { console.log('  ✗ M24: no hay manifiestos'); }
  } catch { console.log('  ✗ M24_pesaje_modal_mobile.png: error'); }

  try {
    await login(mp, 'GENERADOR');
    await goApp(mp, '/manifiestos', 2000);
    const rowCount = await mp.locator('tbody tr').count();
    if (rowCount > 0) {
      await mp.locator('tbody tr').first().click();
      await mp.waitForLoadState('networkidle');
      await mp.waitForTimeout(1800);
      await M(mp, 'M25_manifiesto_detalle_generador_mobile.png');
    } else { console.log('  ✗ M25: no hay manifiestos'); }
  } catch { console.log('  ✗ M25_manifiesto_detalle_generador_mobile.png: error'); }

  await mctx.close();
}

(async () => {
  console.log('🚀 SITREP Detail Shots Only — producción');
  const browser = await chromium.launch({ headless: true });
  try {
    await detailShots(browser);
    console.log(`\n✅ Listo — ${capturedDesktop} desktop, ${capturedMobile} mobile`);
  } catch (e) {
    console.error('\n❌', e);
  } finally {
    await browser.close();
  }
})();
