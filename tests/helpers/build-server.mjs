// A static server whose files can change under a running test: a deploy, as
// a phone with a worker installed meets one (v116). The repo root, no
// caching, like static-server.mjs — plus an overlay the test sets and clears:
//   server.overlay.set('/js/v3/foot.js', { body, type })  serve these bytes instead
//   server.overlay.set('HEAD /', 'drop')                  hang up on that request (lie-fi)
// A key may name a method ('HEAD /') or just a path ('/js/x.js', any method;
// the query is ignored, so '/api/crew' answers '/api/crew?t=…').
//   server.setRoot(dir)   serve another tree from now on (a whole other build)
// Routing the same thing through Playwright would not reach a worker's own
// requests in WebKit; a server serves every engine and every client alike.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

export function serveBuild(root) {
  const overlay = new Map();
  let base = root;
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); res.end(); return; }
    if (p.includes('..')) { res.writeHead(403); res.end(); return; }
    // vercel.json rewrites a festival link (/f/<id>) to api/share, which
    // answers with this build's index.html (its preview tags swapped in).
    if (p === '/f' || p.startsWith('/f/')) p = '/';
    const o = overlay.has(`${req.method} ${p}`) ? overlay.get(`${req.method} ${p}`) : overlay.get(p);
    if (o === 'drop') { req.socket.destroy(); return; }
    if (o) {
      res.writeHead(o.status || 200, { 'content-type': o.type || TYPES[path.extname(p)] || 'text/plain', 'cache-control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : o.body);
      return;
    }
    if (p === '/' || p === '') p = '/index.html';
    let file = path.join(base, p);
    if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += '.html';
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        overlay,
        setRoot: (dir) => { base = dir; },
        close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
      });
    });
  });
}
