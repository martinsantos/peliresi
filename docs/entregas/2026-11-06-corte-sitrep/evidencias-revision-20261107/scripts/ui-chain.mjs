// UI chain on web and app against the review API: agenda -> visit -> act header -> eventual -> return,
// with two external parties, plus direct-URL denials. Browser only reaches the local preview origin.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { guard, login, call, fixture, cases, API, OUT } from './common.mjs';

const { db, sentBefore } = await guard();
const { chromium } = createRequire('/qa/inspection-intake-chief-20261105/frontend/package.json')('@playwright/test');
const root = '/qa/alta-ocr-correcciones-20261106/release-8a575c7e/frontend/dist';
const apiPort = Number(new URL(API).port);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const p = http.request({ hostname: '127.0.0.1', port: apiPort, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:' + apiPort, 'x-sitrep-synthetic-preview': '1' } }, out => { res.writeHead(out.statusCode, out.headers); out.pipe(res); });
    p.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(p); return;
  }
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.resolve(root, '.' + pathname); if (!file.startsWith(root + '/')) file = root + '/index.html';
  try { if (!(await stat(file)).isFile()) throw 0; } catch { file = root + (pathname.startsWith('/app/') ? '/app/index.html' : '/index.html'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(await readFile(file));
});
await new Promise(r => server.listen(4207, '127.0.0.1', r));
const origin = 'http://127.0.0.1:4207';
const results = [], errors = [];
const rec = (name, data) => { results.push({ name, ...data }); console.log(name, JSON.stringify(data).slice(0, 500)); };

// --- Setup (API): eventual with two external parties, both linked while the case is still planned.
const tag = 'ui-' + randomUUID().slice(0, 8);
const [gen, chief, insp] = [await login(fixture.users.generator.email), await login(fixture.users.chief.email), await login(fixture.users.inspector.email)];
const evId = randomUUID();
await call(gen, 'POST', '/api/manifiestos/baja-intensidad', { id: evId, motivo: 'UI ' + tag, patente: '',
  transportista: { nombre: 'Externo transporte ' + tag, identificacion: 'T-' + tag, domicilio: 'Predio T' },
  operador: { nombre: 'Externo operador ' + tag, identificacion: 'O-' + tag, domicilio: 'Predio O' }, residuos: [{ corriente: 'Y1', cantidad: 1, unidad: 'kg' }] });
const intakes = (await call(chief, 'GET', '/api/inspecciones/antecedentes?search=' + evId)).body.data.items.sort((a, b) => a.tipoActor.localeCompare(b.tipoActor));
const day = new Date(Date.now() + 10 * 86400000); day.setUTCHours(13, 0, 0, 0);
const created = (await call(chief, 'POST', '/api/inspecciones', { tipoInspeccion: 'ESPONTANEA', antecedenteId: intakes[0].id, inspectorId: fixture.users.inspector.id, clienteId: 'ui-' + randomUUID(), fechaProgramada: day.toISOString(), ubicacion: 'Predio ' + tag })).body.data;
const second = (await call(chief, 'GET', '/api/inspecciones/antecedentes?search=' + evId)).body.data.items.find(i => i.id === intakes[1].id);
const linked = await call(chief, 'POST', `/api/inspecciones/antecedentes/${second.id}/decisiones`, { id: randomUUID(), version: second.version, accion: 'VINCULADA', motivo: 'Segunda parte externa', inspeccionId: created.id });
let cur = (await call(insp, 'GET', '/api/inspecciones/' + created.id)).body.data;
await call(insp, 'POST', `/api/inspecciones/${created.id}/estado`, { estado: 'EN_CAMPO', version: cur.version });
cur = (await call(insp, 'GET', '/api/inspecciones/' + created.id)).body.data;
await call(insp, 'PATCH', '/api/inspecciones/' + created.id, { version: cur.version, numeroActa: 'ACTA-' + tag, observaciones: 'Observaciones reemplazadas ' + tag });
rec('setup', { eventual: evId, numero: created.numero, inspeccion: created.id, link2: linked.status, nombres: intakes.map(i => i.actorNombre) });
const fecha = day.toISOString().slice(0, 10);
const twoCase = { numero: created.numero, inspeccion: created.id, eventual: evId, fecha, nombres: intakes.map(i => i.actorNombre), ref: 'BI-' + evId };
const c1 = cases[0];
const c1Name = (await db.antecedenteFiscalizacion.findUniqueOrThrow({ where: { id: c1.antecedente } })).actorNombre;
const oneCase = { numero: c1.numero, inspeccion: c1.inspeccion, eventual: c1.eventual, fecha: c1.fecha, nombres: [c1Name], ref: 'BI-' + c1.eventual };

const browser = await chromium.launch({ executablePath: '/qa/browsers/chromium-1208/chrome-linux64/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--js-flags=--max-old-space-size=256'] });
async function session(email, mode) {
  const ctx = await browser.newContext({ viewport: mode === 'web' ? { width: 1365, height: 900 } : { width: 393, height: 852 }, serviceWorkers: 'block', timezoneId: 'America/Argentina/Mendoza' });
  await ctx.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  const p = await ctx.newPage(); p.setDefaultTimeout(12000); p.on('pageerror', e => errors.push(mode + ': ' + e.message));
  const pre = mode === 'app' ? '/app' : '';
  await p.goto(origin + pre + '/login');
  await p.locator('input[type=email],input[autocomplete=username]').first().fill(email);
  await p.locator('input[type=password]').fill(fixture.password);
  await p.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await p.waitForURL(u => !u.pathname.endsWith('/login'));
  return { ctx, p, pre, mode };
}
const box = async l => { const b = await l.boundingBox(); return b && { h: Math.round(b.height), w: Math.round(b.width), y: Math.round(b.y) }; };

try {
  for (const mode of ['web', 'app']) {
    const s = await session(fixture.users.inspector.email, mode);
    for (const c of [twoCase, oneCase]) {
      const { p, pre } = s;
      await p.goto(`${origin}${pre}/inspecciones?vista=agenda&agendaDesde=${c.fecha}&agendaHasta=${c.fecha}`);
      const row = p.getByRole('link').filter({ hasText: c.numero });
      await row.first().waitFor();
      const rowCount = await row.count();
      await row.first().click();
      await p.waitForURL(u => u.pathname.endsWith('/inspecciones/' + c.inspeccion));
      const prep = p.getByRole('button', { name: 'Preparar acta para lectura', exact: true });
      await prep.waitFor();
      await prep.click();
      const header = p.getByRole('article', { name: 'Acta presentada para firma' }).locator('header');
      await header.waitFor();
      const htext = await header.innerText();
      const links = header.getByRole('link', { name: 'Ver eventual de origen · ' + c.ref });
      const nLinks = await links.count();
      const linkBox = await box(links.first());
      await header.screenshot({ path: `${OUT}/ui-encabezado-${mode}-${c.numero}.png` });
      await links.first().click();
      await p.waitForURL(u => u.pathname.endsWith('/eventuales/' + c.eventual));
      await p.getByRole('heading', { name: c.ref, exact: true }).waitFor();
      const ptext = await p.locator('main').last().innerText();
      const back = p.getByRole('link', { name: 'Volver a la inspección' });
      const backBox = await box(back);
      await p.screenshot({ path: `${OUT}/ui-eventual-${mode}-${c.numero}.png` });
      await back.click();
      await p.waitForURL(u => u.pathname === pre + '/inspecciones/' + c.inspeccion);
      await p.waitForTimeout(800);
      const url = new URL(p.url());
      const panel = p.getByRole('region', { name: 'Revisión y firma del acta' });
      const panelVisible = await panel.isVisible().catch(() => false);
      const panelBox = panelVisible ? await box(panel) : null;
      const actStillOpen = await p.getByRole('article', { name: 'Acta presentada para firma' }).isVisible().catch(() => false);
      await p.screenshot({ path: `${OUT}/ui-regreso-${mode}-${c.numero}.png` });
      rec(`acta ${mode} ${c.numero}`, { filasAgenda: rowCount, nombresEnEncabezado: c.nombres.map(n => htext.includes(n)), sinResponsable: htext.includes('Lugar sin responsable identificado'),
        enlacesOrigen: nLinks, enlaceAlto: linkBox?.h, partesEnEventual: c.nombres.map(n => ptext.includes(n)), estadoEventual: /tratado|registrado|retirado|recibido/i.exec(ptext)?.[0],
        volverAlto: backBox?.h, regreso: url.pathname + url.hash, panelVisible, panelEnVista: panelBox ? panelBox.y >= 0 && panelBox.y < (mode === 'web' ? 900 : 852) : null, actaSigueAbierta: actStillOpen });
    }
    await s.ctx.close();
  }
  // Direct URL by people who must not see the case.
  for (const [who, email] of [['inspector2', 'qa-review-20261107-inspector2@example.invalid'], ['generador', fixture.users.generator.email]]) {
    for (const mode of ['web', 'app']) {
      const s = await session(email, mode);
      const seen = [];
      for (const target of [`/inspecciones/${oneCase.inspeccion}/eventuales/${oneCase.eventual}`, `/inspecciones/${oneCase.inspeccion}`]) {
        const responses = [];
        s.p.on('response', r => { if (r.url().includes('/api/inspecciones/')) responses.push(r.status()); });
        await s.p.goto(origin + s.pre + target); await s.p.waitForTimeout(2500);
        const text = await s.p.locator('body').innerText();
        seen.push({ target, api: [...new Set(responses)], url: new URL(s.p.url()).pathname, revelaNombre: text.includes(oneCase.nombres[0]), revelaNumero: text.includes(oneCase.numero), revelaRef: text.includes(oneCase.ref), extracto: text.replace(/\s+/g, ' ').slice(0, 160) });
      }
      rec(`denegado ${who} ${mode}`, { seen });
      await s.ctx.close();
    }
  }
} finally {
  await browser.close();
  server.close();
  const sentAfter = await db.emailQueue.count({ where: { estado: 'ENVIADO' } });
  fs.writeFileSync(OUT + '/ui-chain-' + (process.env.TARGET || 'corte') + '.json', JSON.stringify({ twoCase, oneCase, results, errors, sentBefore, sentAfter }, null, 2));
  console.log('errors', errors.length, errors.slice(0, 5), 'mail', sentBefore, sentAfter);
  await db.$disconnect();
}
