const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const falEditHandler = require('./api/fal-edit.js');
const storeProfileImageHandler = require('./api/store-profile-image.js');
const shareCardsHandler = require('./api/share-cards.js');
const stripeCheckoutHandler = require('./api/stripe-checkout.js');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
  if (ext === '.bin') return 'application/octet-stream';
  return 'application/octet-stream';
}

function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function safeFilePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const candidate = path.join(ROOT, decoded);
  const normalized = path.normalize(candidate);
  if (!normalized.startsWith(ROOT)) return null;
  return normalized;
}

loadEnvFile();

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  req.body = Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (reqUrl.pathname === '/api/fal-edit') {
    try {
      await readRequestBody(req);
      await falEditHandler(req, res);
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unexpected server error.' }));
    }
    return;
  }

  if (reqUrl.pathname === '/api/store-profile-image') {
    try {
      await readRequestBody(req);
      await storeProfileImageHandler(req, res);
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unexpected server error.' }));
    }
    return;
  }

  if (reqUrl.pathname === '/api/share-cards') {
    try {
      await readRequestBody(req);
      await shareCardsHandler(req, res);
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unexpected server error.' }));
    }
    return;
  }

  if (reqUrl.pathname === '/api/stripe-checkout') {
    try {
      if (req.method === 'POST') {
        await readRequestBody(req);
      }
      await stripeCheckoutHandler(req, res);
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unexpected server error.' }));
    }
    return;
  }

  const pathname = reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname;
  const target = safeFilePath(pathname);
  if (!target) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(target, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallback = path.join(ROOT, 'index.html');
      fs.readFile(fallback, (fallbackErr, data) => {
        if (fallbackErr) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        setNoCacheHeaders(res);
        res.end(data);
      });
      return;
    }

    fs.readFile(target, (readErr, data) => {
      if (readErr) {
        res.statusCode = 500;
        res.end('Internal server error');
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', contentTypeFor(target));
      setNoCacheHeaders(res);
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`CyberTwin local server running at http://localhost:${PORT}`);
  console.log('Using /api/fal-edit with FAL_KEY from .env (if present).');
});
