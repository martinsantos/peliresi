// Mide Inicio y Lista de Inspecciones a 344×760 en el preview del laboratorio y guarda capturas.
// Uso: SITREP_PREVIEW_USER=... SITREP_PREVIEW_PASS=... node measure-344.mjs <etiqueta> <directorio-de-salida>
// Sólo preview con datos artificiales (http://127.0.0.1:4188, túnel local). No toca producción.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('/Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/peliresi/frontend/package.json');
const { chromium } = require('playwright');

const [label, outDir] = process.argv.slice(2);
if (!label || !outDir) { console.error('uso: measure-344.mjs <etiqueta> <dir>'); process.exit(2); }
const user = process.env.SITREP_PREVIEW_USER, pass = process.env.SITREP_PREVIEW_PASS;
if (!user || !pass) { console.error('faltan SITREP_PREVIEW_USER / SITREP_PREVIEW_PASS'); process.exit(2); }
const base = process.env.SITREP_PREVIEW_URL || 'http://127.0.0.1:4188';
mkdirSync(join(outDir, 'capturas'), { recursive: true });

// Métrica, igual para las dos pantallas y para antes/después:
//  headerBottom  = fin del título de la página (último h1/h2 visible en la cabecera o el primero del contenido)
//  firstActionTop = borde superior del primer botón/enlace tocable dentro del contenido (<main>), sin la barra de la app
//  firstItemTop  = borde superior de la primera tarjeta de inspección (expediente o visita de hoy); null si no hay
//  buttons       = botones, enlaces y summary visibles en el contenido; labels = sus textos (para el registro)
//  paragraphs    = párrafos visibles en el contenido; contentHeight = alto total desplazable del contenido
const probe = () => {
  // Se descartan los elementos sólo para lectores de pantalla (1×1 px) y el contenido de desplegables cerrados.
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('details:not([open]) > :not(summary)'); };
  const main = document.querySelector('main') || document.body;
  const title = [...main.querySelectorAll('h1,h2')].find(visible);
  const actions = [...main.querySelectorAll('a,button,summary,[role=button]')].filter(visible);
  const first = actions.map((el) => el.getBoundingClientRect().top).sort((a, b) => a - b)[0];
  const item = [...main.querySelectorAll('[data-testid^="inspection-row-"],[data-testid^="inspection-today-"]')].find(visible);
  const paragraphs = [...main.querySelectorAll('p')].filter(visible).length;
  const clip = (t) => t.replace(/\s+/g, ' ').trim().slice(0, 40);
  return {
    headerBottom: title ? Math.round(title.getBoundingClientRect().bottom) : null,
    firstActionTop: first == null ? null : Math.round(first),
    firstItemTop: item ? Math.round(item.getBoundingClientRect().top) : null,
    buttons: actions.length,
    labels: actions.map((el) => clip(el.getAttribute('aria-label') || el.textContent || '')).filter(Boolean),
    paragraphs,
    contentHeight: main.scrollHeight,
    viewportHeight: innerHeight,
  };
};

const browser = await chromium.launch();
const results = { label, viewport: '344x760, app PWA, cuenta artificial inspector', at: new Date().toISOString(), pages: {} };
try {
  const context = await browser.newContext({ viewport: { width: 344, height: 760 }, deviceScaleFactor: 2, locale: 'es-AR', timezoneId: 'America/Argentina/Mendoza' });
  const page = await context.newPage();
  const stamp = Date.now();
  await page.goto(`${base}/app/login?r=${stamp}`, { waitUntil: 'networkidle' });
  await page.fill('#login-identifier', user);
  await page.fill('#login-password', pass);
  await page.click('button[type=submit]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  // Tercera pantalla: la lista con una apertura guardada en el dispositivo (se abre Nueva, se escribe un dato y se vuelve).
  const draft = async () => {
    await page.click('button[aria-label="Nueva inspección"]');
    await page.waitForSelector('[role=dialog]');
    await page.fill('[role=dialog] input[placeholder="Opcional · distinto del legajo"]', 'ACTA-PRUEBA-344');
    await page.click('[role=dialog] button:has-text("Volver")');
    await page.waitForSelector('[role=dialog]', { state: 'detached' });
    await page.goto(`${base}/app/inspecciones?r=${stamp}d`, { waitUntil: 'networkidle' });
  };
  for (const [key, path, prepare] of [['inicio', '/app/dashboard'], ['inspecciones', '/app/inspecciones'], ['inspecciones-con-apertura', '/app/inspecciones', draft]]) {
    await page.goto(`${base}${path}?r=${stamp}`, { waitUntil: 'networkidle' });
    if (prepare) await prepare();
    await page.waitForTimeout(1500);
    await page.evaluate(() => (document.querySelector('main') || document.scrollingElement).scrollTo(0, 0));
    results.pages[key] = await page.evaluate(probe);
    await page.screenshot({ path: join(outDir, 'capturas', `${label}-${key}-344.jpg`), type: 'jpeg', quality: 80 });
    // El contenido se desplaza dentro de <main> (raíz h-screen): para la captura completa se libera esa altura.
    await page.evaluate(() => { let el = document.querySelector('main'); while (el) { el.style.height = 'auto'; el.style.maxHeight = 'none'; el.style.minHeight = '0'; el.style.overflow = 'visible'; el = el.parentElement; } });
    await page.screenshot({ path: join(outDir, 'capturas', `${label}-${key}-344-completa.jpg`), type: 'jpeg', quality: 70, fullPage: true });
  }
} finally {
  await browser.close();
}
const file = join(outDir, 'measurements-344.json');
const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
all[label] = results;
writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
