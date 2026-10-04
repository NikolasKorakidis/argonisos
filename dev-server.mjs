// Dev server: serves the game and reloads open pages whenever a file in the project changes.
// No dependencies. Run with `npm run dev` (or `node dev-server.mjs`), then open http://localhost:8000
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.fbx': 'application/octet-stream', '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};
// injected into every HTML page: reload when the server says something changed, reconnect if the server restarts
const CLIENT = `<script>(() => { let up = false; const c = () => { const es = new EventSource('/__reload');
  es.onopen = () => { if (up) location.reload(); up = true; };
  es.onmessage = () => location.reload();
  es.onerror = () => { es.close(); setTimeout(c, 1000); }; }; c(); })();</script>`;

const clients = new Set();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n'); clients.add(res); req.on('close', () => clients.delete(res));
    return;
  }
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    const ext = path.extname(file).toLowerCase();
    if (ext === '.html') { const s = data.toString(); data = s.includes('</body>') ? s.replace('</body>', CLIENT + '</body>') : s + CLIENT; }
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

// editors and scripts often write a file in several steps: wait for things to settle, then reload once
let timer = null;
fs.watch(ROOT, { recursive: true }, (_, name) => {
  if (!name || /(^|[\\/])(\.git|node_modules)([\\/]|$)|\.DS_Store$|~$|\.swp$/.test(name)) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log(`${new Date().toLocaleTimeString()}  changed ${name}, reloading ${clients.size} page(s)`);
    for (const c of clients) c.write('data: reload\n\n');
  }, 200);
});

server.listen(PORT, () => console.log(`Argonisos dev server: http://localhost:${PORT}  (pages reload when files change)`));
