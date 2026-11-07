// Visual check (web 1365x900 and app 393x852) of the exception panel and generator history, against API 3053.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';

const X = '/qa/excepcion-y-20261107', OUT = X + '/ui';
fs.mkdirSync(OUT, { recursive: true });
const fixture = JSON.parse(fs.readFileSync('/qa/inspection-intake-chief-20261105/fixture.json', 'utf8'));
const pid = fs.readFileSync(X + '/api.pid', 'utf8').trim();
const env = Object.fromEntries(fs.readFileSync('/proc/' + pid + '/environ', 'utf8').split('\0').filter(Boolean).map(kv => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]));
assert.equal(env.PORT, '3053'); assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const db = new (createRequire(X + '/backend/package.json')('@prisma/client').PrismaClient)({ datasources: { db: { url: env.DATABASE_URL.replace(/&connection_limit=\d+/, '') + '&connection_limit=1' } } });
const { chromium } = createRequire('/qa/inspection-intake-chief-20261105/frontend/package.json')('@playwright/test');
const root = X + '/frontend/dist';
if (!fs.existsSync(root + '/app')) fs.symlinkSync('../dist-app', root + '/app');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) { const p = http.request({ hostname: '127.0.0.1', port: 3053, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:3053', 'x-sitrep-synthetic-preview': '1' } }, out => { res.writeHead(out.statusCode, out.headers); out.pipe(res); }); p.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(p); return; }
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); let file = path.resolve(root, '.' + pathname); if (!file.startsWith(root + '/')) file = root + '/index.html';
  try { if (!(await stat(file)).isFile()) throw 0; } catch { file = root + (pathname.startsWith('/app/') ? '/app/index.html' : '/index.html'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(await readFile(file));
});
await new Promise(r => server.listen(4208, '127.0.0.1', r));
const origin = 'http://127.0.0.1:4208';
const H = { 'x-sitrep-synthetic-preview': '1', 'content-type': 'application/json' };
const apiLogin = async email => (await (await fetch('http://127.0.0.1:3053/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email, password: fixture.password }) })).json()).data.tokens.accessToken;
const g = fixture.actors.generator, c = fixture.actors.carrier, o = fixture.actors.operator;
const original = (await db.generador.findUniqueOrThrow({ where: { id: g.id }, select: { corrientesControl: true } })).corrientesControl;
const results = [], errors = [];
const rec = (n, d) => { results.push({ n, ...d }); console.log(n.padEnd(40), JSON.stringify(d).slice(0, 300)); };
const browser = await chromium.launch({ executablePath: '/qa/browsers/chromium-1208/chrome-linux64/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--js-flags=--max-old-space-size=256'] });
async function session(email, mode) {
  const ctx = await browser.newContext({ viewport: mode === 'web' ? { width: 1365, height: 900 } : { width: 393, height: 852 }, serviceWorkers: 'block', timezoneId: 'America/Argentina/Mendoza' });
  await ctx.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  const p = await ctx.newPage(); p.setDefaultTimeout(15000); p.on('pageerror', e => errors.push(mode + ': ' + e.message));
  const cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const pre = mode === 'app' ? '/app' : '';
  await p.goto(origin + pre + '/login');
  await p.locator('input[type=email],input[autocomplete=username]').first().fill(email);
  await p.locator('input[type=password]').fill(fixture.password);
  await p.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await p.waitForURL(u => !u.pathname.endsWith('/login'));
  return { ctx, p, pre };
}
try {
  await db.generador.update({ where: { id: g.id }, data: { corrientesControl: 'Y8' } });
  await db.excepcionCorrienteGenerador.updateMany({ where: { generadorId: g.id, cerradaAt: null }, data: { cerradaAt: new Date(), cierre: { motivo: 'REINICIO_QA', fuente: 'CONTROL' } } });
  const y34 = await db.tipoResiduo.findUniqueOrThrow({ where: { codigo: 'Y34' } });
  let id = null;
  for (const mode of ['web', 'app']) {
    const s = await session(fixture.users.generator.email, mode);
    if (!id) {
      // Created with the UI session's own token, so it carries the same company context the page uses.
      const token = await s.p.evaluate(() => localStorage.getItem('sitrep_access_token'));
      const r = await s.ctx.request.post(origin + '/api/manifiestos', { headers: { authorization: 'Bearer ' + token }, data: { idempotencyKey: randomUUID(), transportistaId: c.id, operadorId: o.id, modalidad: 'FIJO', fechaEstimadaRetiro: new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10), residuos: [{ tipoResiduoId: y34.id, cantidad: 3, unidad: 'kg' }] } });
      const created = await r.json(); assert.equal(r.status(), 201, JSON.stringify(created).slice(0, 300));
      id = created.data.manifiesto.id; rec('setup', { numero: created.data.manifiesto.numero, contexto: !!created.data.manifiesto.contextoEmpresa });
    }
    const panel = s.p.getByRole('alert').filter({ hasText: 'Corriente no inscripta · Y34' });
    const statusCalls = [];
    await (async()=>{})();
    s.p.on('response', async r => { if (r.url().includes('/api/manifiestos/')) statusCalls.push(r.status() + ' ' + new URL(r.url()).pathname + ' ' + (await r.text().catch(() => '')).slice(0, 220) + ' ' + JSON.stringify(r.request().headers()).slice(0, 200)); });
    await s.p.goto(`${origin}${s.pre}/manifiestos/${id}`);
    try { await panel.waitFor(); } catch (e) {
      await s.p.screenshot({ path: `${OUT}/debug-generador-${mode}.png`, fullPage: true });
      console.log('DEBUG', statusCalls.filter(x => x.includes('excepcion')).map(x => x.slice(0, 260)), statusCalls.length, (await s.p.locator('main').first().innerText()).replace(/\s+/g, ' ').slice(0, 900)); throw e; }
    await panel.screenshot({ path: `${OUT}/panel-generador-${mode}.png` });
    rec('generador ' + mode, { texto: (await panel.innerText()).replace(/\s+/g, ' ').slice(0, 220), otorgar: await s.p.getByRole('button', { name: 'Otorgar excepción' }).count() });
    await s.ctx.close();
  }
  for (const mode of ['app', 'web']) {
    const s = await session(fixture.users.sector.email, mode);
    await s.p.goto(`${origin}${s.pre}/manifiestos/${id}`);
    const panel = s.p.getByRole('alert').filter({ hasText: 'Corriente no inscripta · Y34' });
    await panel.waitFor();
    const button = s.p.getByRole('button', { name: 'Otorgar excepción' });
    const box = await button.boundingBox();
    await panel.screenshot({ path: `${OUT}/panel-autoridad-${mode}.png` });
    rec('autoridad ' + mode, { botonDeshabilitado: await button.isDisabled(), alto: Math.round(box?.height || 0) });
    if (mode === 'web') {
      await s.p.getByLabel('Motivo de la excepción').fill('Generación puntual verificada por la autoridad (QA)');
      await button.click();
      const granted = s.p.getByRole('region', { name: 'Excepción de corriente' });
      await granted.waitFor();
      await granted.screenshot({ path: `${OUT}/panel-otorgada-web.png` });
      rec('otorgada web', { texto: (await granted.innerText()).replace(/\s+/g, ' ').slice(0, 200) });
      await s.p.goto(`${origin}/admin/actores/generadores/${g.id}`);
      await s.p.getByRole('tab', { name: /Residuos/ }).click();
      const history = s.p.getByText('Excepciones por corriente no inscripta');
      await history.waitFor();
      await history.scrollIntoViewIfNeeded();
      await s.p.screenshot({ path: `${OUT}/historial-web.png`, fullPage: false });
      rec('historial web', { abierta: await s.p.getByText('Abierta', { exact: true }).count(), enlace: await s.p.getByRole('link', { name: /Ver / }).count() });
    }
    await s.ctx.close();
  }
} finally {
  await browser.close(); server.close();
  await db.generador.update({ where: { id: g.id }, data: { corrientesControl: original } });
  await db.excepcionCorrienteGenerador.updateMany({ where: { generadorId: g.id, cerradaAt: null }, data: { cerradaAt: new Date(), cierre: { motivo: 'FIN_QA', fuente: 'CONTROL' } } });
  fs.writeFileSync(OUT + '/resultado.json', JSON.stringify({ results, errors, enviados: await db.emailQueue.count({ where: { estado: 'ENVIADO' } }) }, null, 2));
  console.log('errores de página', errors.length, errors.slice(0, 3));
  await db.$disconnect();
}
