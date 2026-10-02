import { assertCloudEnvironment } from './safety.ts';
assertCloudEnvironment();
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

// Serve real release assets and proxy API bytes unchanged to the isolated backend.
const web = process.env.QA_WEB_BUILD;
const app = process.env.QA_APP_BUILD;
const manual = process.env.QA_MANUAL_ROOT || path.resolve('../docs/manual');
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
    const upstream = http.request({ hostname: '127.0.0.1', port: 3037, path: req.url,
      method: req.method, headers: { ...req.headers, host: '127.0.0.1:3037', ...(clientIp ? { 'x-forwarded-for': clientIp } : {}) } }, response => {
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
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  createReadStream(file).pipe(res);
}).listen(4177, '127.0.0.1', () => console.log('QA web and app: http://127.0.0.1:4177'));
