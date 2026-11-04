// Mide el formulario de campo en una sola pantalla a 344×760 (app) y 1365×900 (web) en el preview del
// laboratorio y guarda capturas. Uso: SITREP_PREVIEW_USER=... SITREP_PREVIEW_PASS=... node measure-344.mjs <dir> [caso]
// Sólo preview con datos artificiales (http://127.0.0.1:4188, túnel local). No toca producción.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('/Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/peliresi/frontend/package.json');
const { chromium } = require('playwright');

const [outDir, caseId = 'qa-field-case'] = process.argv.slice(2);
if (!outDir) { console.error('uso: measure-344.mjs <dir> [caso]'); process.exit(2); }
const user = process.env.SITREP_PREVIEW_USER, pass = process.env.SITREP_PREVIEW_PASS;
if (!user || !pass) { console.error('faltan SITREP_PREVIEW_USER / SITREP_PREVIEW_PASS'); process.exit(2); }
const base = process.env.SITREP_PREVIEW_URL || 'http://127.0.0.1:4188';
mkdirSync(join(outDir, 'capturas'), { recursive: true });

// Métrica del formulario:
//  tabs        = pestañas de pasos (nav «Secciones del expediente»)          → 0 esperado
//  accordions  = cabeceras con aria-expanded dentro del formulario, sin el índice de controles → 0 esperado
//  blocks      = títulos h2 numerados de la hoja; saveButtons = botones cuyo texto empieza con «Guardar»
//  stageButtons= botones de etapa visibles (Iniciar visita / Enviar a revisión)
//  firstFieldTop = borde superior del primer campo editable; mapTop = borde superior del mapa
//  crosshair   = la cruz fija existe; markButton = botón «Marcar … aquí» existe
//  contentHeight = alto desplazable del formulario
const probe = () => {
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('details:not([open]) > :not(summary)'); };
  const sheet = document.querySelector('[data-testid="inspection-field-sheet"]');
  const region = document.querySelector('[data-inspection-page-scroll]') || document.scrollingElement;
  const buttons = [...document.querySelectorAll('button')].filter(visible);
  const field = [...(sheet || document).querySelectorAll('input:not([type=hidden]):not([type=file]),textarea,select')].find(visible);
  const map = document.querySelector('[aria-label="Mapa del lugar inspeccionado"]');
  return {
    sheet: Boolean(sheet),
    tabs: document.querySelectorAll('nav[aria-label="Secciones del expediente"] a').length,
    accordions: [...(sheet || document).querySelectorAll('[aria-expanded]')].filter((el) => visible(el) && !/Ir a un control/.test(el.getAttribute('aria-label') || '')).length,
    blocks: [...(sheet || document).querySelectorAll('h2')].filter(visible).map((el) => el.textContent.replace(/\s+/g, ' ').trim()),
    saveButtons: buttons.filter((el) => /^Guardar/.test((el.textContent || '').trim()) || /^Guardar/.test(el.getAttribute('aria-label') || '')).length,
    stageButtons: buttons.filter((el) => /Iniciar visita|Enviar a revisión/.test(el.textContent || '')).map((el) => el.textContent.trim()),
    firstFieldTop: field ? Math.round(field.getBoundingClientRect().top) : null,
    mapTop: map ? Math.round(map.getBoundingClientRect().top) : null,
    crosshair: Boolean(document.querySelector('[data-testid="map-crosshair"]')),
    markButton: buttons.some((el) => /aquí$/.test((el.textContent || '').trim())),
    status: document.querySelector('[data-testid="inspection-field-status"]')?.textContent.trim() || null,
    contentHeight: region.scrollHeight,
    scrollTop: Math.round(region.scrollTop),
    viewportHeight: innerHeight,
  };
};

const browser = await chromium.launch();
const results = { at: new Date().toISOString(), caseId, pages: {} };
try {
  const login = async (context, path) => {
    const page = await context.newPage();
    await page.goto(`${base}${path}/login?r=${Date.now()}`, { waitUntil: 'networkidle' });
    await page.fill('#login-identifier', user); await page.fill('#login-password', pass);
    await page.click('button[type=submit]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
    return page;
  };
  // Teléfono: app a 344 px, con puntos táctiles para que el mapa ceda el scroll.
  const phone = await browser.newContext({ viewport: { width: 344, height: 760 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'es-AR', timezoneId: 'America/Argentina/Mendoza' });
  const page = await login(phone, '/app');
  await page.goto(`${base}/app/inspecciones/${caseId}?r=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="inspection-field-sheet"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  results.pages.app344 = await page.evaluate(probe);
  await page.screenshot({ path: join(outDir, 'capturas', 'hoja-344-arriba.jpg'), type: 'jpeg', quality: 80 });
  // Desplazamiento a Controles y respuesta en un control: la página no debe moverse sola.
  const region = () => document.querySelector('[data-inspection-page-scroll]');
  await page.evaluate(() => { const el = document.getElementById('checklist'); const r = document.querySelector('[data-inspection-page-scroll]'); if (el && r) r.scrollTop += el.getBoundingClientRect().top - r.getBoundingClientRect().top - 8; });
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => Math.round(document.querySelector('[data-inspection-page-scroll]').scrollTop));
  await page.screenshot({ path: join(outDir, 'capturas', 'hoja-344-controles.jpg'), type: 'jpeg', quality: 80 });
  // Un control que cumple pasa a «No cumple» (se abre el hallazgo debajo) y vuelve a «Cumple»: el dato queda como estaba.
  // Playwright desplaza la tarjeta a la vista antes de tocar; la medición toma el scroll después de ese desplazamiento.
  const card = page.locator('[id^="control-"][data-result="CUMPLE"]').first();
  if (await card.count() > 0) {
    await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
    const id = await card.evaluate((el) => el.id);
    const settled = await page.evaluate(() => Math.round(document.querySelector('[data-inspection-page-scroll]').scrollTop));
    await card.locator('button', { hasText: 'No cumple' }).click({ force: true });
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => Math.round(document.querySelector('[data-inspection-page-scroll]').scrollTop));
    results.pages.app344.answerJump = { card: id, scrollBeforeTap: settled, scrollAfterTap: after, delta: after - settled };
    await page.screenshot({ path: join(outDir, 'capturas', 'hoja-344-control-respondido.jpg'), type: 'jpeg', quality: 80 });
    await card.locator('button', { hasText: 'Cumple' }).first().click({ force: true });
    await page.waitForTimeout(600);
    results.pages.app344.answerJump.scrollAfterRestore = await page.evaluate(() => Math.round(document.querySelector('[data-inspection-page-scroll]').scrollTop));
    await page.waitForTimeout(2500);
  }
  results.pages.app344.scrollAtChecklist = before;
  await page.evaluate(() => { const r = document.querySelector('[data-inspection-page-scroll]'); if (r) r.scrollTop = 0; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'capturas', 'hoja-344-completa.jpg'), type: 'jpeg', quality: 70, fullPage: true }).catch(() => {});
  await phone.close();
  // Escritorio: web a 1365 px.
  const desktop = await browser.newContext({ viewport: { width: 1365, height: 900 }, locale: 'es-AR', timezoneId: 'America/Argentina/Mendoza' });
  const web = await login(desktop, '');
  await web.goto(`${base}/inspecciones/${caseId}?r=${Date.now()}`, { waitUntil: 'networkidle' });
  await web.waitForSelector('[data-testid="inspection-field-sheet"]', { timeout: 30_000 });
  await web.waitForTimeout(1500);
  results.pages.web1365 = await web.evaluate(probe);
  await web.screenshot({ path: join(outDir, 'capturas', 'hoja-web-1365.jpg'), type: 'jpeg', quality: 80 });
  await desktop.close();
  writeFileSync(join(outDir, 'measurements.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
