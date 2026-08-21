/* ==========================================================================
   Blitz Mother Hub Planogram — Node.js Backend Server & Database
   ========================================================================== */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3456;
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'planogram.db');
const db = new DatabaseSync(DB_PATH);

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    name TEXT,
    created_at TEXT,
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    user_email TEXT,
    name TEXT,
    city TEXT,
    length_ft REAL,
    width_ft REAL,
    cols INTEGER,
    rows INTEGER,
    inbound_docks INTEGER,
    outbound_docks INTEGER,
    data_json TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY(user_email) REFERENCES users(email)
  );
`);

console.log('✓ SQLite Database initialized at:', DB_PATH);

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) { // 20MB limit
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function getUserEmail(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim().toLowerCase();
  }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  return (url.searchParams.get('email') || '').trim().toLowerCase();
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // ================= API ENDPOINTS =================

  // 1. Auth: Login / Register user by email
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { email, name } = await parseBody(req);
      if (!email || !email.includes('@')) {
        return sendJson(res, 400, { error: 'Valid email address required' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const userName = (name || cleanEmail.split('@')[0]).trim();
      const now = new Date().toISOString();

      const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
      if (existing) {
        db.prepare('UPDATE users SET last_login_at = ? WHERE email = ?').run(now, cleanEmail);
      } else {
        db.prepare('INSERT INTO users (email, name, created_at, last_login_at) VALUES (?, ?, ?, ?)').run(cleanEmail, userName, now, now);
        
        // Seed an initial demo Mother Hub layout for the new user
        const siteId = 'site-' + Date.now();
        const demoData = {
          name: "Blitz Mother Hub — Bengaluru South",
          city: "Bengaluru",
          lengthFt: 150,
          widthFt: 100,
          inboundDocks: 4,
          outboundDocks: 4,
          grids: []
        };
        db.prepare(`
          INSERT INTO sites (id, user_email, name, city, length_ft, width_ft, cols, rows, inbound_docks, outbound_docks, data_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          siteId, cleanEmail, demoData.name, demoData.city, 150, 100, 46, 30, 4, 4, JSON.stringify(demoData), now, now
        );
      }

      return sendJson(res, 200, {
        user: { email: cleanEmail, name: userName },
        token: cleanEmail
      });
    } catch (e) {
      console.error('Error logging in:', e);
      return sendJson(res, 500, { error: e.message });
    }
  }

  // 2. Auth: List recent users for quick chip sign-in
  if (pathname === '/api/auth/recent-users' && req.method === 'GET') {
    const rows = db.prepare('SELECT email, name, last_login_at FROM users ORDER BY last_login_at DESC LIMIT 6').all();
    return sendJson(res, 200, rows);
  }

  // 3. Sites: List all sites for current user
  if (pathname === '/api/sites' && req.method === 'GET') {
    const email = getUserEmail(req);
    if (!email) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    const rows = db.prepare('SELECT id, user_email, name, city, length_ft, width_ft, cols, rows, inbound_docks, outbound_docks, data_json, created_at, updated_at FROM sites WHERE user_email = ? ORDER BY updated_at DESC').all(email);
    
    const formatted = rows.map(r => {
      let data = {};
      try { data = JSON.parse(r.data_json); } catch(e) {}
      return {
        id: r.id,
        userEmail: r.user_email,
        name: r.name,
        city: r.city,
        lengthFt: r.length_ft,
        widthFt: r.width_ft,
        cols: r.cols,
        rows: r.rows,
        inboundDocks: r.inbound_docks,
        outboundDocks: r.outbound_docks,
        grids: data.grids || [],
        cells: data.cells || null,
        rots: data.rots || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });

    return sendJson(res, 200, formatted);
  }

  // 4. Sites: Create new site
  if (pathname === '/api/sites' && req.method === 'POST') {
    const email = getUserEmail(req);
    if (!email) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    try {
      const site = await parseBody(req);
      const siteId = site.id || ('site-' + Date.now());
      const now = new Date().toISOString();

      const dataJson = JSON.stringify({
        grids: site.grids || [],
        cells: site.cells || null,
        rots: site.rots || null
      });

      db.prepare(`
        INSERT OR REPLACE INTO sites (id, user_email, name, city, length_ft, width_ft, cols, rows, inbound_docks, outbound_docks, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        siteId,
        email,
        site.name || 'Untitled Mother Hub',
        site.city || 'Custom',
        site.lengthFt || 150,
        site.widthFt || 100,
        site.cols || 46,
        site.rows || 30,
        site.inboundDocks || 4,
        site.outboundDocks || 4,
        dataJson,
        site.createdAt || now,
        now
      );

      return sendJson(res, 201, { id: siteId, success: true, updatedAt: now });
    } catch (e) {
      console.error('Error creating site:', e);
      return sendJson(res, 500, { error: e.message });
    }
  }

  // 5. Sites: Update existing site
  if (pathname.startsWith('/api/sites/') && req.method === 'PUT') {
    const email = getUserEmail(req);
    if (!email) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    const siteId = pathname.slice('/api/sites/'.length);
    try {
      const site = await parseBody(req);
      const now = new Date().toISOString();

      const dataJson = JSON.stringify({
        grids: site.grids || [],
        cells: site.cells || null,
        rots: site.rots || null
      });

      db.prepare(`
        UPDATE sites SET
          name = ?,
          city = ?,
          length_ft = ?,
          width_ft = ?,
          cols = ?,
          rows = ?,
          inbound_docks = ?,
          outbound_docks = ?,
          data_json = ?,
          updated_at = ?
        WHERE id = ? AND user_email = ?
      `).run(
        site.name || 'Untitled Mother Hub',
        site.city || 'Custom',
        site.lengthFt || 150,
        site.widthFt || 100,
        site.cols || 46,
        site.rows || 30,
        site.inboundDocks || 4,
        site.outboundDocks || 4,
        dataJson,
        now,
        siteId,
        email
      );

      return sendJson(res, 200, { id: siteId, success: true, updatedAt: now });
    } catch (e) {
      console.error('Error updating site:', e);
      return sendJson(res, 500, { error: e.message });
    }
  }

  // 6. Sites: Delete site
  if (pathname.startsWith('/api/sites/') && req.method === 'DELETE') {
    const email = getUserEmail(req);
    if (!email) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    const siteId = pathname.slice('/api/sites/'.length);
    try {
      const result = db.prepare('DELETE FROM sites WHERE id = ? AND user_email = ?').run(siteId, email);
      return sendJson(res, 200, { success: true, deletedCount: result.changes });
    } catch (e) {
      console.error('Error deleting site:', e);
      return sendJson(res, 500, { error: e.message });
    }
  }

  // ================= STATIC FILE SERVING =================
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Error: ' + err.message);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Blitz Mother Hub Server listening on http://localhost:${PORT}`);
});
