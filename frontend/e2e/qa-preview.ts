/** Serves both compiled surfaces locally; API must be an isolated SSH tunnel. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.QA_CONFIRM_ISOLATED !== 'YES') throw new Error('QA_CONFIRM_ISOLATED=YES required');
const upstream = new URL(process.env.QA_API_URL || 'http://127.0.0.1:13103');
const port = Number(process.env.QA_PREVIEW_PORT || 4179);
if (!['127.0.0.1', 'localhost'].includes(upstream.hostname) || upstream.protocol !== 'http:') throw new Error('QA API must use a local tunnel');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('QA_PREVIEW_PORT must be a valid unprivileged TCP port');
// A bundled ephemeral runner lives under /tmp, so it must be able to provide
// the real frontend root explicitly instead of inferring it from import.meta.
const frontend = process.env.QA_FRONTEND_ROOT
  ? path.resolve(process.env.QA_FRONTEND_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!fs.existsSync(frontend)) throw new Error('QA frontend root does not exist');
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.pdf': 'application/pdf' };

http.createServer((request, response) => {
  if (request.url?.startsWith('/api/')) {
    const proxied = http.request(new URL(request.url, upstream), { method: request.method, headers: { ...request.headers, host: upstream.host } }, incoming => {
      response.writeHead(incoming.statusCode || 502, incoming.headers); incoming.pipe(response);
    });
    proxied.on('error', () => { response.writeHead(502, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ message: 'QA API tunnel unavailable' })); });
    request.pipe(proxied); return;
  }
  let pathname: string;
  try { pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname); } catch { response.writeHead(400); response.end(); return; }
  const app = pathname === '/app' || pathname.startsWith('/app/');
  const root = path.join(frontend, app ? 'dist-app' : 'dist');
  let file = path.resolve(root, '.' + (app ? pathname.slice(4) || '/' : pathname));
  if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(file)) { response.writeHead(404); response.end(); return; }
    file = path.join(root, app ? 'app.html' : 'index.html');
  }
  response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`QA web/PWA preview http://127.0.0.1:${port} (no public bind)`));
