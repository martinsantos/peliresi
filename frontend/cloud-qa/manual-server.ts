/** Static manual only; no backend, credentials or application sessions. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('../../docs/manual/', import.meta.url)));
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url!, 'http://127.0.0.1').pathname);
    if (req.method !== 'GET' || !pathname.startsWith('/manual/')) { res.writeHead(404).end(); return; }
    const file = path.resolve(root, pathname.slice('/manual/'.length) || 'index.html');
    if (!file.startsWith(root + path.sep)) { res.writeHead(404).end(); return; }
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
server.listen(4186, '127.0.0.1');
process.on('SIGTERM', () => server.close());
