import { assertCloudEnvironment, root as projectRoot } from './safety.ts';
assertCloudEnvironment();
import http from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Serve real release assets and proxy API bytes unchanged to the isolated backend.
const web = process.env.QA_WEB_BUILD;
const app = process.env.QA_APP_BUILD;
const manual = process.env.QA_MANUAL_ROOT || path.join(projectRoot, 'docs/manual');
if (!web || !app || !existsSync(path.join(web, 'index.html')) || !existsSync(path.join(app, 'index.html'))) {
  throw new Error('QA_WEB_BUILD and QA_APP_BUILD must point to compiled release artifacts');
}
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1:4177');
  if (url.pathname.startsWith('/api/')) {
    // Local test-client metadata, not authentication. Avoid adding X-Forwarded-For
    // to the browser globally: that breaks cross-origin font CORS preflights.
    const clientIp = /(?:^|;\s*)sitrep_qa_client=(127\.11\.\d{1,3}\.\d{1,3})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    const headers = { ...req.headers, host: '127.0.0.1:3037', ...(clientIp ? { 'x-forwarded-for': clientIp } : {}) };
    if (url.pathname === '/api/centro-control/monitor-live') {
      delete headers['if-none-match'];
      delete headers['if-modified-since'];
    }
    const upstream = http.request({ hostname: '127.0.0.1', port: 3037, path: req.url,
      method: req.method, headers }, response => {
      if (url.pathname === '/api/centro-control/monitor-live') console.log(JSON.stringify({ monitor: true, status: response.statusCode, stageFile: existsSync(process.env.QA_ARTIFACTS + '/monitor-reading-stage.json') }));
      if (url.pathname === '/api/centro-control/monitor-live' && req.method === 'GET' && response.statusCode === 200 && existsSync(process.env.QA_ARTIFACTS + '/monitor-reading-stage.json')) {
        // Only after the real isolated API has authorized the request. GET-only,
        // synthetic response projection; never touches stored manifests or GPS.
        response.resume();
        const stage = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/monitor-reading-stage.json', 'utf8')).stage;
        if (stage === 'error') { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'QA: actualización interrumpida' })); return; }
        const fresh = stage === 'latest';
        const trip = { manifiestoId: 'qa-monitor-reading-20261025', numero: 'QA-MONITOR-LECTURA', transportista: fresh ? 'QA Relevo vigente' : 'QA Transporte inicial', origen: { razonSocial: 'QA Origen', lat: -32.9, lng: -68.8 }, destino: { razonSocial: 'QA Destino', lat: -32.95, lng: -68.85 }, fechaRetiro: null,
          ultimaPosicion: { latitud: fresh ? -32.92 : -32.9, longitud: fresh ? -68.82 : -68.8, timestamp: new Date(Date.now() - (fresh ? 20000 : 600000)).toISOString(), velocidad: fresh ? 0 : 25 }, ruta: [] };
        const data = { estadisticas: { porEstado: { EN_TRANSITO: stage === 'absent' ? 0 : 1 }, total: 1, manifiestosHoy: 0, toneladas: 0, enTransitoActivos: stage === 'absent' ? 0 : 1 }, enTransito: stage === 'absent' ? [] : [trip], eventosRecientes: [], actores: { generadores: [], transportistas: [], operadores: [] }, topGeneradores: [], topOperadores: [], porDia: [], topResiduos: [], tratamientosActivos: [] };
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ data })); return;
      }
      res.writeHead(response.statusCode || 502, response.headers); response.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502); res.end('QA backend unavailable'); });
    req.pipe(upstream); return;
  }
  const isApp = url.pathname.startsWith('/app/');
  const isManual = url.pathname.startsWith('/manual/');
  const root = path.resolve(isManual ? manual : isApp ? app : web);
  const relative = decodeURIComponent(url.pathname.slice(isManual ? 8 : isApp ? 5 : 1));
  let file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  if (!existsSync(file) || !statSync(file).isFile()) {
    if (path.extname(relative)) { res.writeHead(404); res.end('Asset not found'); return; }
    file = path.join(root, 'index.html');
  }
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('Asset not found'); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  const stream = createReadStream(file);
  stream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end('QA asset read failed'); });
  stream.pipe(res);
}).listen(4177, '127.0.0.1', () => console.log('QA web and app: http://127.0.0.1:4177'));
