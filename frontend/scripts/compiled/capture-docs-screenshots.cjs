"use strict";
/**
 * capture-docs-screenshots.ts — SITREP v2026.2
 * Captura screenshots del diseño NUEVO contra producción.
 * Ejecutar: npx ts-node scripts/capture-docs-screenshots.ts
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// ── Configuración ──────────────────────────────────────────────────────────
const BASE = 'https://sitrep.ultimamilla.com.ar';
const APP = 'https://sitrep.ultimamilla.com.ar/app';
const CREDS = {
    ADMIN: { email: 'admin@dgfa.mendoza.gov.ar', password: 'admin123' },
    GENERADOR: { email: 'quimica.mendoza@industria.com', password: 'gen123' },
    TRANSPORTISTA: { email: 'transportes.andes@logistica.com', password: 'trans123' },
    OPERADOR: { email: 'tratamiento.residuos@planta.com', password: 'op123' },
};
const OUT_D = path.resolve(__dirname, '../../docs/screenshots/desktop');
const OUT_M = path.resolve(__dirname, '../../docs/screenshots/mobile');
[OUT_D, OUT_M].forEach(d => fs.mkdirSync(d, { recursive: true }));
const DT = { width: 1440, height: 900 };
const MB = { width: 390, height: 844 };
let capturedDesktop = 0;
let capturedMobile = 0;
// ── Helpers ────────────────────────────────────────────────────────────────
async function login(page, role) {
    const isApp = page.url().startsWith(APP);
    const loginUrl = (isApp ? APP : BASE) + '/login';
    await page.goto(loginUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    // Try quick-login buttons first (faster, no typing)
    const quickMap = {
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
        }
        catch { }
    }
    // Fallback: manual credentials (input type="text" on this login form)
    await page.locator('input[type="text"], input[type="email"]').first().fill(CREDS[role].email);
    await page.fill('input[type="password"]', CREDS[role].password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
}
async function go(page, path, wait = 1800) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(wait);
}
async function goApp(page, path, wait = 1800) {
    await page.goto(APP + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(wait);
}
async function snap(page, dir, name) {
    try {
        await page.screenshot({ path: path.join(dir, name), fullPage: false });
        const type = dir === OUT_D ? 'desktop' : 'mobile';
        if (type === 'desktop')
            capturedDesktop++;
        else
            capturedMobile++;
        console.log(`  ✓ ${name}`);
    }
    catch (e) {
        console.error(`  ✗ ${name}: ${e.message}`);
    }
}
const D = (page, name) => snap(page, OUT_D, name);
const M = (page, name) => snap(page, OUT_M, name);
async function clickIfExists(page, selector) {
    try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 2000 }))
            await el.click();
    }
    catch { }
}
async function getFirstManifiestoId(page) {
    var _a;
    try {
        await go(page, '/manifiestos', 1500);
        // Try table row link
        const href = await page.locator('tbody tr a').first().getAttribute('href', { timeout: 3000 });
        if (href)
            return (_a = href.split('/').pop()) !== null && _a !== void 0 ? _a : null;
    }
    catch { }
    return null;
}
// ── DESKTOP ─────────────────────────────────────────────────────────────────
async function desktop(browser) {
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
    await p.mouse.move(900, 500).catch(() => { });
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
    }
    catch { }
    // EN_TRANSITO
    await go(p, '/manifiestos?estado=EN_TRANSITO', 2000);
    await D(p, '10_manifiestos_en_transito.png');
    try {
        const href = await p.locator('tbody tr a').first().getAttribute('href', { timeout: 2000 });
        if (href) {
            await go(p, href, 2000);
            await D(p, '11_manifiesto_detalle_transito_mapa.png');
        }
    }
    catch { }
    // TRATADO → certificado disponible
    await go(p, '/manifiestos?estado=TRATADO', 2000);
    await D(p, '12_manifiestos_tratados.png');
    try {
        const href = await p.locator('tbody tr a').first().getAttribute('href', { timeout: 2000 });
        if (href) {
            await go(p, href, 2000);
            await D(p, '13_manifiesto_detalle_tratado_certificado.png');
        }
    }
    catch { }
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
    }
    catch { }
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
    }
    catch { }
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
async function mobile(browser) {
    console.log('\n📱 Mobile PWA (390×844)');
    const ctx = await browser.newContext({
        viewport: MB,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    });
    const p = await ctx.newPage();
    const mgo = (path, wait = 1800) => goApp(p, path, wait);
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
    }
    catch { }
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
    }
    catch { }
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
    }
    catch { }
    await mgo('/reportes', 2000);
    await M(p, 'M20_reportes_operador_mobile.png');
    await ctx.close();
}
// ── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
    console.log('🚀 SITREP Screenshot Capture v2026.2 → producción');
    console.log(`   ${BASE}`);
    const browser = await playwright_1.chromium.launch({ headless: true });
    try {
        await desktop(browser);
        await mobile(browser);
        console.log(`\n✅ Listo — ${capturedDesktop} desktop, ${capturedMobile} mobile`);
    }
    catch (e) {
        console.error('\n❌', e);
    }
    finally {
        await browser.close();
    }
})();
