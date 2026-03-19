/**
 * capture-docs-screenshots.ts — SITREP v2026.2
 * Captura screenshots del diseño NUEVO contra producción.
 * Ejecutar: npx ts-node scripts/capture-docs-screenshots.ts
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Configuración ──────────────────────────────────────────────────────────
const BASE  = 'https://sitrep.ultimamilla.com.ar';
const APP   = 'https://sitrep.ultimamilla.com.ar/app';

const CREDS = {
  ADMIN:         { email: 'admin@dgfa.mendoza.gov.ar',         password: 'admin123' },
  GENERADOR:     { email: 'quimica.mendoza@industria.com',      password: 'gen123'   },
  TRANSPORTISTA: { email: 'transportes.andes@logistica.com',   password: 'trans123' },
  OPERADOR:      { email: 'tratamiento.residuos@planta.com',   password: 'op123'    },
};

const OUT_D = path.resolve(__dirname, '../../docs/screenshots/desktop');
const OUT_M = path.resolve(__dirname, '../../docs/screenshots/mobile');
[OUT_D, OUT_M].forEach(d => fs.mkdirSync(d, { recursive: true }));

const DT = { width: 1440, height: 900 };
const MB = { width: 390,  height: 844 };

let capturedDesktop = 0;
let capturedMobile  = 0;

// ── Helpers ────────────────────────────────────────────────────────────────
async function login(page: Page, role: keyof typeof CREDS) {
  const isApp = page.url().startsWith(APP);
  const loginUrl = (isApp ? APP : BASE) + '/login';
  await page.goto(loginUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Try quick-login buttons first (faster, no typing)
  const quickMap: Record<string, string> = {
    ADMIN: 'Administrador',
    GENERADOR: 'Generador',
    TRANSPORTISTA: 'Transportista',
    OPERADOR: 'Operador',
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

  // Fallback: manual credentials (input type="text" on this login form)
  await page.locator('input[type="text"], input[type="email"]').first().fill(CREDS[role].email);
  await page.fill('input[type="password"]', CREDS[role].password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
}

async function go(page: Page, path: string, wait = 1800) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
}

async function goApp(page: Page, path: string, wait = 1800) {
  await page.goto(APP + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
}

async function snap(page: Page, dir: string, name: string) {
  try {
    await page.screenshot({ path: path.join(dir, name), fullPage: false });
    const type = dir === OUT_D ? 'desktop' : 'mobile';
    if (type === 'desktop') capturedDesktop++;
    else capturedMobile++;
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

async function getFirstManifiestoId(page: Page): Promise<string | null> {
  try {
    await go(page, '/manifiestos', 1500);
    // Try table row link
    const href = await page.locator('tbody tr a').first().getAttribute('href', { timeout: 3000 });
    if (href) return href.split('/').pop() ?? null;
  } catch {}
  return null;
}

// ── DESKTOP ─────────────────────────────────────────────────────────────────
async function desktop(browser: Browser) {
  console.log('\n🖥️  Desktop (1440×900)');
  const ctx = await browser.newContext({ viewport: DT });
  const p = await ctx.newPage();

  // ── AUTH ──
  console.log('  › Auth');
  await go(p, '/login', 800);
  await D(p, '01_login.png');

  await go(p, '/manifiestos/verificar/2026-000001', 1000);
  await D(p, '02_verificar_qr_publico.png');

  // ── ADMIN ──
  console.log('  › Admin');
  await login(p, 'ADMIN');
  await go(p, '/switch-user', 800);
  await D(p, '03_user_switcher.png');

  await go(p, '/dashboard', 2500);
  await D(p, '04_dashboard_admin.png');

  // Centro de Control
  await go(p, '/centro-control', 3000);
  await D(p, '05_centro_control.png');
  // Zoom map area
  await p.mouse.move(900, 500).catch(() => {});
  await p.waitForTimeout(600);
  await D(p, '06_centro_control_mapa_zoom.png');

  // Manifiestos lista
  await go(p, '/manifiestos', 2000);
  await D(p, '07_manifiestos_lista.png');

  // Manifiesto detalle — primer BORRADOR disponible
  const manifiestoId = await getFirstManifiestoId(p);

  // Navega a un manifiesto en BORRADOR (intentamos filtrar)
  await go(p, '/manifiestos?estado=BORRADOR', 2000);
  await D(p, '08_manifiestos_filtro_borrador.png');
  try {
    const href = await p.locator('tbody tr a').first().getAttribute('href', { timeout: 2000 });
    if (href) {
      await go(p, href, 2000);
      await D(p, '09_manifiesto_detalle_borrador.png');
    }
  } catch {}

  // EN_TRANSITO
  await go(p, '/manifiestos?estado=EN_TRANSITO', 2000);
  await D(p, '10_manifiestos_en_transito.png');
  try {
    const href = await p.locator('tbody tr a').first().getAttribute('href', { timeout: 2000 });
    if (href) {
      await go(p, href, 2000);
      await D(p, '11_manifiesto_detalle_transito_mapa.png');
    }
  } catch {}

  // TRATADO → certificado disponible
  await go(p, '/manifiestos?estado=TRATADO', 2000);
  await D(p, '12_manifiestos_tratados.png');
  try {
    const href = await p.locator('tbody tr a').first().getAttribute('href', { timeout: 2000 });
    if (href) {
      await go(p, href, 2000);
      await D(p, '13_manifiesto_detalle_tratado_certificado.png');
    }
  } catch {}

  // Nuevo manifiesto (paso 1)
  await go(p, '/manifiestos/nuevo', 1500);
  await D(p, '14_nuevo_manifiesto_paso1.png');
  // Avanzar al paso 2 si hay un botón
  await clickIfExists(p, 'button:has-text("Siguiente")');
  await p.waitForTimeout(800);
  await D(p, '15_nuevo_manifiesto_paso2.png');

  // Alertas
  await go(p, '/alertas', 1800);
  await D(p, '16_alertas_timeline.png');

  // Reportes — tab Manifiestos
  await go(p, '/reportes', 2500);
  await D(p, '17_reportes_manifiestos.png');

  // Tab Transporte
  await clickIfExists(p, 'button:has-text("Transporte")');
  await p.waitForTimeout(1200);
  await D(p, '18_reportes_transporte.png');

  // Tab Departamentos (mapa coroplético)
  await clickIfExists(p, 'button:has-text("Departamento")');
  await p.waitForTimeout(1800);
  await D(p, '19_reportes_departamentos_mapa.png');

  // Tab Mapa de Actores (Leaflet)
  await clickIfExists(p, 'button:has-text("Mapa")');
  await p.waitForTimeout(2000);
  await D(p, '20_reportes_mapa_actores.png');

  // Tab Generadores
  await clickIfExists(p, 'button:has-text("Generador")');
  await p.waitForTimeout(1000);
  await D(p, '21_reportes_generadores.png');

  // Tab Operadores
  await clickIfExists(p, 'button:has-text("Operador")');
  await p.waitForTimeout(1000);
  await D(p, '22_reportes_operadores.png');

  // Admin — Usuarios
  await go(p, '/admin/usuarios', 1800);
  await D(p, '23_admin_usuarios.png');

  // Modal crear usuario
  await clickIfExists(p, 'button:has-text("Crear")');
  await p.waitForTimeout(800);
  await D(p, '24_admin_usuario_crear_modal.png');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);

  // Cmd+K busqueda global
  await go(p, '/dashboard', 1000);
  await p.keyboard.press('Meta+k');
  await p.waitForTimeout(700);
  await p.keyboard.type('quimica', { delay: 60 });
  await p.waitForTimeout(1200);
  await D(p, '25_busqueda_global_cmd_k.png');
  await p.keyboard.press('Escape');

  // Actores — Generadores
  await go(p, '/admin/actores/generadores', 2000);
  await D(p, '26_admin_generadores.png');

  // Generador detalle
  try {
    const href = await p.locator('a[href*="/generadores/"]').first().getAttribute('href', { timeout: 2000 });
    if (href) {
      await go(p, href, 1800);
      await D(p, '27_generador_detalle.png');
    }
  } catch {}

  // Actores — Transportistas
  await go(p, '/admin/actores/transportistas', 2000);
  await D(p, '28_admin_transportistas.png');

  // Transportista detalle con flota
  try {
    const href = await p.locator('a[href*="/transportistas/"]').first().getAttribute('href', { timeout: 2000 });
    if (href) {
      await go(p, href, 1800);
      await D(p, '29_transportista_detalle_flota.png');
      // Abrir modal editar vehiculo
      await clickIfExists(p, 'button:has-text("Editar")');
      await p.waitForTimeout(700);
      await D(p, '30_transportista_vehiculo_modal_vencimiento.png');
      await p.keyboard.press('Escape');
    }
  } catch {}

  // Actores — Operadores
  await go(p, '/admin/actores/operadores', 2000);
  await D(p, '31_admin_operadores.png');

  // Catálogo Residuos
  await go(p, '/admin/residuos', 2000);
  await D(p, '32_admin_catalogo_residuos.png');

  // Tratamientos
  await go(p, '/admin/tratamientos', 2000);
  await D(p, '33_admin_tratamientos_grid.png');

  // Vehículos
  await go(p, '/admin/vehiculos', 2000);
  await D(p, '34_admin_vehiculos.png');

  // Auditoría
  await go(p, '/admin/auditoria', 2000);
  await D(p, '35_admin_auditoria.png');

  // Carga Masiva
  await go(p, '/admin/carga-masiva', 1500);
  await D(p, '36_carga_masiva.png');

  // Configuración — Notificaciones
  await go(p, '/configuracion', 1500);
  await D(p, '37_configuracion_general.png');
  await clickIfExists(p, 'button:has-text("Notificacion")');
  await p.waitForTimeout(600);
  await D(p, '38_configuracion_notificaciones_email.png');

  // Perfil del usuario
  await go(p, '/mi-perfil', 1500);
  await D(p, '39_mi_perfil.png');

  // Ayuda (nueva ruta desktop)
  await go(p, '/ayuda', 1500);
  await D(p, '40_ayuda_workflow_faq.png');

  // ── TRANSPORTISTA ──
  console.log('  › Transportista (desktop)');
  await login(p, 'TRANSPORTISTA');

  await go(p, '/dashboard', 2000);
  await D(p, '41_dashboard_transportista.png');

  await go(p, '/transporte/perfil', 2000);
  await D(p, '42_transporte_perfil_tab_viaje.png');
  await clickIfExists(p, 'button:has-text("Info")');
  await p.waitForTimeout(600);
  await D(p, '43_transporte_perfil_tab_info.png');
  await clickIfExists(p, 'button:has-text("Historial")');
  await p.waitForTimeout(600);
  await D(p, '44_transporte_perfil_historial.png');

  await go(p, '/manifiestos', 2000);
  await D(p, '45_manifiestos_transportista.png');

  await go(p, '/escaner-qr', 1200);
  await D(p, '46_escaner_qr_desktop.png');

  // ── GENERADOR ──
  console.log('  › Generador (desktop)');
  await login(p, 'GENERADOR');

  await go(p, '/dashboard', 2000);
  await D(p, '47_dashboard_generador.png');

  await go(p, '/manifiestos', 2000);
  await D(p, '48_manifiestos_generador.png');

  await go(p, '/manifiestos/nuevo', 1500);
  await D(p, '49_nuevo_manifiesto_generador.png');

  // ── OPERADOR ──
  console.log('  › Operador (desktop)');
  await login(p, 'OPERADOR');

  await go(p, '/dashboard', 2000);
  await D(p, '50_dashboard_operador.png');

  await go(p, '/manifiestos', 2000);
  await D(p, '51_manifiestos_operador.png');

  await go(p, '/reportes', 2500);
  await D(p, '52_reportes_operador.png');

  await ctx.close();
}

// ── MOBILE ───────────────────────────────────────────────────────────────────
async function mobile(browser: Browser) {
  console.log('\n📱 Mobile PWA (390×844)');
  const ctx = await browser.newContext({
    viewport: MB,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });
  const p = await ctx.newPage();

  const mgo  = (path: string, wait = 1800) => goApp(p, path, wait);

  // ── AUTH ──
  console.log('  › Auth mobile');
  await p.goto(APP + '/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await M(p, 'M01_login_mobile.png');

  // ── ADMIN mobile ──
  console.log('  › Admin mobile');
  await login(p, 'ADMIN');

  // Rutas PWA: SIN prefijo /mobile/ — el app vive en /app/ con rutas /dashboard, /alertas, etc.
  await mgo('/dashboard', 2500);
  await M(p, 'M02_dashboard_admin_mobile.png');

  await mgo('/alertas', 1800);
  await M(p, 'M03_alertas_mobile.png');

  await mgo('/reportes', 2500);
  await M(p, 'M04_reportes_mobile.png');

  await mgo('/admin/usuarios', 1800);
  await M(p, 'M05_usuarios_mobile.png');

  // ── GENERADOR mobile ──
  console.log('  › Generador mobile');
  await login(p, 'GENERADOR');

  await mgo('/dashboard', 2500);
  await M(p, 'M06_dashboard_generador_mobile.png');

  await mgo('/manifiestos', 2000);
  await M(p, 'M07_manifiestos_generador_mobile.png');

  // Manifiesto detalle
  try {
    const href = await p.locator('a[href*="/manifiestos/"]').first().getAttribute('href', { timeout: 2000 });
    if (href) {
      // href is relative to /app/ base, e.g. "/manifiestos/123"
      await p.goto(APP + href, { waitUntil: 'networkidle' });
      await p.waitForTimeout(1500);
      await M(p, 'M08_manifiesto_detalle_mobile.png');
    }
  } catch {}

  await mgo('/manifiestos/nuevo', 1500);
  await M(p, 'M09_nuevo_manifiesto_paso1_mobile.png');

  // ── TRANSPORTISTA mobile ──
  console.log('  › Transportista mobile');
  await login(p, 'TRANSPORTISTA');

  await mgo('/dashboard', 2500);
  await M(p, 'M10_dashboard_transportista_mobile.png');

  await mgo('/transporte/perfil', 2000);
  await M(p, 'M11_transporte_perfil_viaje_mobile.png');
  await clickIfExists(p, 'button:has-text("Info")');
  await p.waitForTimeout(600);
  await M(p, 'M12_transporte_perfil_info_mobile.png');

  await mgo('/manifiestos', 2000);
  await M(p, 'M13_manifiestos_transportista_mobile.png');

  // Viaje en curso
  try {
    const href = await p.locator('a[href*="/manifiestos/"]').first().getAttribute('href', { timeout: 2000 });
    if (href) {
      await p.goto(APP + href, { waitUntil: 'networkidle' });
      await p.waitForTimeout(1800);
      await M(p, 'M14_manifiesto_transito_transportista.png');
    }
  } catch {}

  await mgo('/escaner-qr', 1200);
  await M(p, 'M15_escaner_qr_mobile.png');

  await mgo('/configuracion', 1500);
  await M(p, 'M16_configuracion_mobile.png');

  // ── OPERADOR mobile ──
  console.log('  › Operador mobile');
  await login(p, 'OPERADOR');

  await mgo('/dashboard', 2500);
  await M(p, 'M17_dashboard_operador_mobile.png');

  await mgo('/manifiestos', 2000);
  await M(p, 'M18_manifiestos_operador_mobile.png');

  try {
    const href = await p.locator('a[href*="/manifiestos/"]').first().getAttribute('href', { timeout: 2000 });
    if (href) {
      await p.goto(APP + href, { waitUntil: 'networkidle' });
      await p.waitForTimeout(1500);
      await M(p, 'M19_manifiesto_operador_detalle.png');
    }
  } catch {}

  await mgo('/reportes', 2000);
  await M(p, 'M20_reportes_operador_mobile.png');

  await ctx.close();
}

// ── DETAIL SHOTS (estados de manifiesto + modales) ───────────────────────────
async function detailShots(browser: Browser) {
  console.log('\n🔍 Detail Shots — estados de manifiesto y modales');
  const ctx = await browser.newContext({ viewport: DT });
  const p = await ctx.newPage();
  await login(p, 'ADMIN');

  // Helper: navigate to manifiestos filtered by estado, click first, snap
  async function snapManifiestoDetalle(estado: string, filename: string) {
    try {
      await go(p, `/manifiestos?estado=${estado}`, 2000);
      const href = await p.locator('tbody tr a').first().getAttribute('href', { timeout: 3000 });
      if (href) {
        await go(p, href, 2500);
        await D(p, filename);
      } else {
        console.log(`  ✗ ${filename}: no hay manifiestos en estado ${estado}`);
      }
    } catch {
      console.log(`  ✗ ${filename}: error capturando estado ${estado}`);
    }
  }

  // 53 — Manifiesto BORRADOR detalle
  await snapManifiestoDetalle('BORRADOR', '53_manifiesto_borrador_detalle.png');

  // 54 — Manifiesto APROBADO detalle
  await snapManifiestoDetalle('APROBADO', '54_manifiesto_aprobado_detalle.png');

  // 55 — Manifiesto ENTREGADO detalle
  await snapManifiestoDetalle('ENTREGADO', '55_manifiesto_entregado_detalle.png');

  // 56 — Manifiesto RECIBIDO detalle
  await snapManifiestoDetalle('RECIBIDO', '56_manifiesto_recibido_detalle.png');

  // 57 — Manifiesto TRATADO detalle
  await snapManifiestoDetalle('TRATADO', '57_manifiesto_tratado_detalle.png');

  // 58 — Timeline de manifiesto TRATADO (scroll down)
  try {
    await go(p, '/manifiestos?estado=TRATADO', 2000);
    const href = await p.locator('tbody tr a').first().getAttribute('href', { timeout: 3000 });
    if (href) {
      await go(p, href, 2500);
      await p.evaluate(() => window.scrollBy(0, 600));
      await p.waitForTimeout(800);
      await D(p, '58_manifiesto_timeline.png');
    } else {
      console.log('  ✗ 58_manifiesto_timeline.png: no hay manifiestos TRATADO');
    }
  } catch { console.log('  ✗ 58_manifiesto_timeline.png: error'); }

  // 59 — Reportes → botón Exportar
  try {
    await go(p, '/reportes', 2500);
    await clickIfExists(p, 'button:has-text("Exportar")');
    await p.waitForTimeout(800);
    await D(p, '59_reportes_exportar.png');
  } catch { console.log('  ✗ 59_reportes_exportar.png: error'); }

  // 60 — Alertas → tab Reglas
  try {
    await go(p, '/alertas', 1800);
    await clickIfExists(p, 'button:has-text("Reglas")');
    await p.waitForTimeout(800);
    await D(p, '60_alertas_reglas.png');
  } catch { console.log('  ✗ 60_alertas_reglas.png: error'); }

  // 61 — Centro de Control → expandir panel Viajes Activos
  try {
    await go(p, '/centro-control', 3000);
    await clickIfExists(p, 'button:has-text("Viajes")');
    await p.waitForTimeout(1000);
    await D(p, '61_centro_control_viajes.png');
  } catch { console.log('  ✗ 61_centro_control_viajes.png: error'); }

  // 62 — Generador: Nuevo manifiesto → agregar residuos (paso con residuos)
  try {
    await login(p, 'GENERADOR');
    await go(p, '/manifiestos/nuevo', 1500);
    // Intenta avanzar dos pasos para llegar al paso de residuos
    await clickIfExists(p, 'button:has-text("Siguiente")');
    await p.waitForTimeout(800);
    await clickIfExists(p, 'button:has-text("Siguiente")');
    await p.waitForTimeout(1000);
    await D(p, '62_manifiesto_nuevo_paso3_residuos.png');
    await login(p, 'ADMIN');
  } catch { console.log('  ✗ 62_manifiesto_nuevo_paso3_residuos.png: error'); }

  // 63 — Transportista detalle con flota
  try {
    await go(p, '/admin/actores/transportistas', 2000);
    const href = await p.locator('a[href*="/transportistas/"]').first().getAttribute('href', { timeout: 3000 });
    if (href) {
      await go(p, href, 2000);
      await D(p, '63_transportista_detalle_flota.png');
    } else {
      console.log('  ✗ 63_transportista_detalle_flota.png: no hay transportistas');
    }
  } catch { console.log('  ✗ 63_transportista_detalle_flota.png: error'); }

  // 64 — Generador detalle
  try {
    await go(p, '/admin/actores/generadores', 2000);
    const href = await p.locator('a[href*="/generadores/"]').first().getAttribute('href', { timeout: 3000 });
    if (href) {
      await go(p, href, 1800);
      await D(p, '64_generador_detalle.png');
    } else {
      console.log('  ✗ 64_generador_detalle.png: no hay generadores');
    }
  } catch { console.log('  ✗ 64_generador_detalle.png: error'); }

  // 65 — Operador detalle
  try {
    await go(p, '/admin/actores/operadores', 2000);
    const href = await p.locator('a[href*="/operadores/"]').first().getAttribute('href', { timeout: 3000 });
    if (href) {
      await go(p, href, 1800);
      await D(p, '65_operador_detalle.png');
    } else {
      console.log('  ✗ 65_operador_detalle.png: no hay operadores');
    }
  } catch { console.log('  ✗ 65_operador_detalle.png: error'); }

  // 66 — Verificar manifiesto público
  try {
    await go(p, '/manifiestos/verificar/2026-000001', 1500);
    await D(p, '66_verificar_manifiesto_detalle.png');
  } catch { console.log('  ✗ 66_verificar_manifiesto_detalle.png: error'); }

  // 67 — Centro de Control KPIs (panel izquierdo)
  try {
    await go(p, '/centro-control', 3000);
    await D(p, '67_centro_control_kpis.png');
  } catch { console.log('  ✗ 67_centro_control_kpis.png: error'); }

  await ctx.close();

  // ── Mobile detail shots ─────────────────────────────────────────────────
  console.log('\n📱 Mobile Detail Shots');
  const mctx = await browser.newContext({
    viewport: MB,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });
  const mp = await mctx.newPage();

  // M21 — Transportista → perfil → lista APROBADO con botón Tomar Viaje
  try {
    await login(mp, 'TRANSPORTISTA');
    await goApp(mp, '/transporte/perfil', 2500);
    await M(mp, 'M21_tomar_viaje_mobile.png');
  } catch { console.log('  ✗ M21_tomar_viaje_mobile.png: error'); }

  // M22 — Viaje en curso (EN_TRANSITO) con controles GPS
  try {
    // Buscar manifiesto EN_TRANSITO del transportista
    await goApp(mp, '/manifiestos', 2000);
    const href = await mp.locator('a[href*="/manifiestos/"]').first().getAttribute('href', { timeout: 3000 });
    if (href) {
      await mp.goto(APP + href, { waitUntil: 'networkidle' });
      await mp.waitForTimeout(2000);
      await M(mp, 'M22_viaje_gps_activo_mobile.png');
    } else {
      // Fallback: pantalla de perfil en tab viaje
      await goApp(mp, '/transporte/perfil', 2000);
      await M(mp, 'M22_viaje_gps_activo_mobile.png');
    }
  } catch { console.log('  ✗ M22_viaje_gps_activo_mobile.png: error'); }

  // M23 — Operador → manifiesto ENTREGADO → botón Confirmar Recepción
  try {
    await login(mp, 'OPERADOR');
    await goApp(mp, '/manifiestos', 2000);
    const href = await mp.locator('a[href*="/manifiestos/"]').first().getAttribute('href', { timeout: 3000 });
    if (href) {
      await mp.goto(APP + href, { waitUntil: 'networkidle' });
      await mp.waitForTimeout(2000);
      await M(mp, 'M23_manifiesto_entregado_operador_mobile.png');
    } else {
      console.log('  ✗ M23_manifiesto_entregado_operador_mobile.png: no hay manifiestos');
    }
  } catch { console.log('  ✗ M23_manifiesto_entregado_operador_mobile.png: error'); }

  // M24 — Operador → manifiesto RECIBIDO → modal Registrar Pesaje
  try {
    await goApp(mp, '/manifiestos', 2000);
    const href = await mp.locator('a[href*="/manifiestos/"]').first().getAttribute('href', { timeout: 3000 });
    if (href) {
      await mp.goto(APP + href, { waitUntil: 'networkidle' });
      await mp.waitForTimeout(1500);
      await clickIfExists(mp, 'button:has-text("Pesaje")');
      await mp.waitForTimeout(1000);
      await M(mp, 'M24_pesaje_modal_mobile.png');
    } else {
      console.log('  ✗ M24_pesaje_modal_mobile.png: no hay manifiestos');
    }
  } catch { console.log('  ✗ M24_pesaje_modal_mobile.png: error'); }

  // M25 — Generador → detalle manifiesto APROBADO → timeline
  try {
    await login(mp, 'GENERADOR');
    await goApp(mp, '/manifiestos', 2000);
    const href = await mp.locator('a[href*="/manifiestos/"]').first().getAttribute('href', { timeout: 3000 });
    if (href) {
      await mp.goto(APP + href, { waitUntil: 'networkidle' });
      await mp.waitForTimeout(1800);
      await M(mp, 'M25_manifiesto_detalle_generador_mobile.png');
    } else {
      console.log('  ✗ M25_manifiesto_detalle_generador_mobile.png: no hay manifiestos');
    }
  } catch { console.log('  ✗ M25_manifiesto_detalle_generador_mobile.png: error'); }

  await mctx.close();
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('🚀 SITREP Screenshot Capture v2026.2 → producción');
  console.log(`   ${BASE}`);
  const browser = await chromium.launch({ headless: true });
  try {
    await desktop(browser);
    await mobile(browser);
    await detailShots(browser);
    console.log(`\n✅ Listo — ${capturedDesktop} desktop, ${capturedMobile} mobile`);
  } catch (e) {
    console.error('\n❌', e);
  } finally {
    await browser.close();
  }
})();
