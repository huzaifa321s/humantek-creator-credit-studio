/**
 * scripts/company-server-hub.cjs
 * ------------------------------
 * Unified 24/7 Company Server Hub for Humantek Creator Credit Studio:
 *   1. Embedded Pusher Protocol v7 WebSocket Engine + REST API (`/app/<APP_KEY>`, `/apps/:appId/events`)
 *   2. HMAC-Signed Disk Storage Service (`/storage/v1/object/:bucket/*`, `/storage/v1/list`, `/storage/v1/remove`)
 *
 * Run via PM2 on your Windows Company Server:
 *   pm2 start scripts/company-server-hub.cjs --name "creator-studio-hub"
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Optional `ws` package (already present on Company Server in Social-Media-Reports-System or node_modules)
let WebSocket;
try {
  WebSocket = require('ws');
} catch {
  console.warn('[CompanyHub] Note: `ws` package not found in local node_modules. Install with `npm i ws` on the Company Server for WebSocket support.');
}

// ─── CONFIGURATION ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.HUB_PORT || process.env.PORT || '4005', 10);
const HOST = process.env.HUB_HOST || '0.0.0.0';
const APP_ID = process.env.PUSHER_APP_ID || 'company-app-id';
const APP_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY || 'company-app-key';
const HUB_SECRET = (process.env.COMPANY_HUB_SECRET || process.env.PUSHER_SECRET || 'company-app-secret-12345').trim();
const STORAGE_ROOT = process.env.COMPANY_STORAGE_DIR || path.join(process.cwd(), 'company-storage');

const ALLOWED_BUCKETS = new Set(['project-references', 'project-attachments']);
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024; // 60 MB ceiling

// Ensure root storage directories exist
for (const bucket of ALLOWED_BUCKETS) {
  const dir = path.join(STORAGE_ROOT, bucket);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── SECURITY & SIGNATURE HELPERS ─────────────────────────────────────────────
function verifySecretHeader(req) {
  const provided = String(req.headers['x-hub-secret'] || '').trim();
  if (!provided || !HUB_SECRET) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(HUB_SECRET).digest();
  return crypto.timingSafeEqual(a, b);
}

function verifySignedToken(action, bucket, objectPath, expStr, sigStr) {
  const exp = parseInt(String(expStr || '0'), 10);
  if (!exp || Math.floor(Date.now() / 1000) > exp) return false;
  if (!sigStr) return false;

  const payload = `${action}:${bucket}:${objectPath}:${exp}`;
  const expected = crypto.createHmac('sha256', HUB_SECRET).update(payload).digest('hex');
  if (expected.length !== sigStr.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigStr));
}

function resolveSafeDiskPath(bucket, relativeObjectPath) {
  if (!ALLOWED_BUCKETS.has(bucket)) return null;
  const cleaned = String(relativeObjectPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('..')) return null;

  const bucketRoot = path.resolve(STORAGE_ROOT, bucket);
  const resolved = path.resolve(bucketRoot, cleaned);
  if (!resolved.startsWith(bucketRoot + path.sep)) return null;
  return resolved;
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.zip': 'application/zip',
    '.psd': 'application/vnd.adobe.photoshop',
    '.ai': 'application/illustrator',
  };
  return map[ext] || 'application/octet-stream';
}

// ─── IN-MEMORY PUSHER STATE ───────────────────────────────────────────────────
const channels = new Map(); // channelName -> Set<ws>
const sockets = new Map();  // ws -> { socketId, channels: Set<string> }

function generateSocketId() {
  return `${Math.floor(Math.random() * 1e9)}.${Math.floor(Math.random() * 1e9)}`;
}

function sendPusherMessage(ws, event, data, channel = null) {
  if (!WebSocket || ws.readyState !== WebSocket.OPEN) return;
  const payload = { event, data: typeof data === 'string' ? data : JSON.stringify(data) };
  if (channel) payload.channel = channel;
  ws.send(JSON.stringify(payload));
}

function broadcastToChannel(channelName, event, data, exceptSocketId = null) {
  const clientSet = channels.get(channelName);
  let delivered = 0;
  if (clientSet) {
    clientSet.forEach((ws) => {
      const info = sockets.get(ws);
      if (!info) return;
      if (exceptSocketId && info.socketId === exceptSocketId) return;
      sendPusherMessage(ws, event, data, channelName);
      delivered++;
    });
  }
  return delivered;
}

// ─── HTTP REQUEST HANDLER ─────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS headers for direct browser PUT/GET from Hostinger domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-hub-secret');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. Health Check
  if (req.method === 'GET' && (pathname === '/health' || pathname === '/pusher/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'online',
        service: 'Humantek-Company-Server-Hub',
        storageRoot: STORAGE_ROOT,
        activeConnections: sockets.size,
        activeChannels: channels.size,
        uptimeSeconds: Math.floor(process.uptime()),
      })
    );
    return;
  }

  // 2. Pusher Event Trigger: POST /apps/:appId/events
  if (req.method === 'POST' && pathname.match(/^\/apps\/[^/]+\/events$/)) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { name, data, socket_id: exceptSocketId } = payload;
        const targetChannels = payload.channels || (payload.channel ? [payload.channel] : []);
        let delivered = 0;
        for (const ch of targetChannels) {
          delivered += broadcastToChannel(ch, name, data, exceptSocketId);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, delivered }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 3. Storage Object Upload (PUT) or Download (GET): /storage/v1/object/:bucket/*
  const objMatch = pathname.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
  if (objMatch) {
    const bucket = decodeURIComponent(objMatch[1]);
    const objectPath = objMatch[2]
      .split('/')
      .map((s) => decodeURIComponent(s))
      .join('/');

    const exp = parsedUrl.searchParams.get('exp');
    const sig = parsedUrl.searchParams.get('sig');
    const diskPath = resolveSafeDiskPath(bucket, objectPath);

    if (!diskPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid storage path or bucket' }));
      return;
    }

    // PUT (Browser Signed Upload or Server Upload)
    if (req.method === 'PUT') {
      const validSig = verifySignedToken('put', bucket, objectPath, exp, sig);
      const validHeader = verifySecretHeader(req);
      if (!validSig && !validHeader) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or expired upload signature' }));
        return;
      }

      fs.mkdirSync(path.dirname(diskPath), { recursive: true });
      const writeStream = fs.createWriteStream(diskPath);
      let receivedBytes = 0;
      let aborted = false;

      req.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_UPLOAD_BYTES) {
          aborted = true;
          writeStream.destroy();
          fs.unlink(diskPath, () => {});
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File exceeds maximum size limit' }));
          req.destroy();
        }
      });

      req.pipe(writeStream);

      writeStream.on('finish', () => {
        if (aborted) return;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, path: objectPath, size: receivedBytes }));
      });

      writeStream.on('error', (err) => {
        if (aborted) return;
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      return;
    }

    // GET (Browser Signed View / Download)
    if (req.method === 'GET') {
      if (!verifySignedToken('get', bucket, objectPath, exp, sig)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or expired view signature' }));
        return;
      }

      if (!fs.existsSync(diskPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }

      const stat = fs.statSync(diskPath);
      res.writeHead(200, {
        'Content-Type': guessMimeType(diskPath),
        'Content-Length': stat.size,
        'Cache-Control': 'private, max-age=3600',
      });
      fs.createReadStream(diskPath).pipe(res);
      return;
    }
  }

  // 4. Storage Folder Listing: GET /storage/v1/list?bucket=...&prefix=...
  if (req.method === 'GET' && pathname === '/storage/v1/list') {
    if (!verifySecretHeader(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }
    const bucket = parsedUrl.searchParams.get('bucket') || '';
    const prefix = parsedUrl.searchParams.get('prefix') || '';
    const dirPath = resolveSafeDiskPath(bucket, prefix);

    if (!dirPath || !fs.existsSync(dirPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files: [] }));
      return;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile())
        .map((e) => {
          const full = path.join(dirPath, e.name);
          const stat = fs.statSync(full);
          return {
            name: e.name,
            size: stat.size,
            mimeType: guessMimeType(full),
            createdAt: stat.birthtime ? stat.birthtime.toISOString() : null,
          };
        });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 5. Storage Batch Remove: POST /storage/v1/remove
  if (req.method === 'POST' && pathname === '/storage/v1/remove') {
    if (!verifySecretHeader(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const { bucket, paths } = JSON.parse(body || '{}');
        let removed = 0;
        if (Array.isArray(paths)) {
          for (const p of paths) {
            const diskPath = resolveSafeDiskPath(bucket, p);
            if (diskPath && fs.existsSync(diskPath)) {
              fs.unlinkSync(diskPath);
              removed++;
            }
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, removed }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ─── ATTACH PUSHER WEBSOCKET ENGINE ───────────────────────────────────────────
if (WebSocket) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (parsedUrl.pathname.startsWith('/app/')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    const socketId = generateSocketId();
    sockets.set(ws, { socketId, channels: new Set() });

    sendPusherMessage(ws, 'pusher:connection_established', {
      socket_id: socketId,
      activity_timeout: 120,
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const eventName = msg.event;
        let data = msg.data;
        if (typeof data === 'string' && data.startsWith('{')) {
          try {
            data = JSON.parse(data);
          } catch {}
        }

        if (eventName === 'pusher:ping') {
          sendPusherMessage(ws, 'pusher:pong', {});
          return;
        }

        if (eventName === 'pusher:subscribe') {
          const channelName = data?.channel;
          if (!channelName) return;
          if (!channels.has(channelName)) channels.set(channelName, new Set());
          channels.get(channelName).add(ws);
          sockets.get(ws)?.channels.add(channelName);
          sendPusherMessage(ws, 'pusher_internal:subscription_succeeded', {}, channelName);
          return;
        }

        if (eventName === 'pusher:unsubscribe') {
          const channelName = data?.channel;
          if (!channelName) return;
          const set = channels.get(channelName);
          if (set) {
            set.delete(ws);
            if (set.size === 0) channels.delete(channelName);
          }
          sockets.get(ws)?.channels.delete(channelName);
        }
      } catch {}
    });

    ws.on('close', () => {
      const info = sockets.get(ws);
      if (info) {
        info.channels.forEach((ch) => {
          const set = channels.get(ch);
          if (set) {
            set.delete(ws);
            if (set.size === 0) channels.delete(ch);
          }
        });
        sockets.delete(ws);
      }
    });
  });
}

server.listen(PORT, HOST, () => {
  console.log(`[CompanyHub] Listening on http://${HOST}:${PORT} (AppID: ${APP_ID}, Key: ${APP_KEY})`);
  console.log(`[CompanyHub] Storage Root: ${STORAGE_ROOT}`);
});
