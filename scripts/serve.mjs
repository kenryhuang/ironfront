import { createServer } from 'node:http';
import { createTerritoryRooms } from './territory-rooms.mjs';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.env.SERVE_DIST === '1' ? 'dist' : '.');
const port = Number(process.env.PORT || 5173);
const types = { '.bin': 'application/octet-stream', '.txt':'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.json': 'application/json' };
const rooms = createTerritoryRooms();
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/1939') return await rooms.handle(req, res, url);
    const path = decodeURIComponent(url.pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep) || !['.bin', '.txt', '.html', '.js', '.css', '.svg', '.png', '.webp', '.wav', '.mp3', '.ogg', '.flac', '.json'].includes(extname(file)) || path.split('/').some(s => s.startsWith('.'))) { res.writeHead(403); res.end('Forbidden'); return; }
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('close', rooms.close);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => console.log(`IronFront ready: http://127.0.0.1:${port}`));
