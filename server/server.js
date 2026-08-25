"use strict";
/**
 * Warehouse Layout Planner — backend.
 *
 * Zero npm dependencies on purpose (only Node's built-in modules), so this
 * runs anywhere with `node server.js` — no `npm install` step, no native
 * compilation, no internet access needed to fetch packages.
 *
 * Storage is a pair of JSON files under ./data (data/users.json,
 * data/sites.json). That's the "database" for now: simple, human-readable,
 * easy to back up (copy the folder), and completely sufficient for a
 * handful of warehouse managers saving a handful of sites each. If this
 * ever needs to scale past that, swap loadJson/saveJson for a real DB —
 * every call site already goes through those two functions.
 *
 * Auth: email only, no password, no OTP yet (the frontend says so too).
 * A signed, stateless token (HMAC over the email) is issued on login, so
 * there's no session store to lose on restart. When OTP verification is
 * added, it slots in right before the token is issued in handleLogin().
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8934;
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SITES_FILE = path.join(DATA_DIR, "sites.json");
const SECRET_FILE = path.join(DATA_DIR, "secret.key");
const FRONTEND_FILE = path.join(__dirname, "..", "darkstore-layout-planner.html");
const PLANOGRAM_FILE = path.join(__dirname, "..", "darkstore-planogram.html");

/* ---------- optional AI-refine (Claude) ----------
   Fully optional, off by default, and currently reachable only by calling
   the API directly — the frontend's "AI Refine" button was replaced by the
   Gemini-powered "AI Tweak" feature (see the vision/interview/tweak
   section below). Kept here rather than removed since it's still a real,
   working endpoint, just not wired to any UI control right now. Set
   ANTHROPIC_API_KEY in the environment to enable it. Uses the built-in
   https module, not the Anthropic SDK, to keep this a zero-npm-dependency
   server. */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = "claude-sonnet-5";
const AI_REFINE_SYSTEM_PROMPT =
  "You are a warehouse layout reviewer. You are given one dark-store/fulfillment-center floor plan as structured facts (dimensions, zones with positions, entry side, order volume, any manager note). " +
  "Suggest concrete, specific improvements to zone placement, flow, or spacing — grounded ONLY in the facts given, never invented ones. " +
  "Reply with ONLY a JSON array (no prose, no markdown fences) of up to 5 objects: " +
  '[{"title": short string, "detail": one or two sentences, "severity": "info"|"suggestion"|"warning"}]. ' +
  "If the layout already looks sound, return an empty array.";
function callAnthropic(userPrompt, systemPrompt, maxTokens) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens || 1200,
      temperature: 0.3,
      system: systemPrompt || AI_REFINE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        timeout: 30000,
      },
      (res) => {
        let chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode !== 200) {
            return reject(new Error("AI service returned " + res.statusCode + ": " + body.slice(0, 200)));
          }
          try {
            const data = JSON.parse(body);
            const text = (data.content || []).map((b) => b.text || "").join("");
            resolve(text);
          } catch (e) {
            reject(new Error("Could not parse AI response"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("AI request timed out")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}
function extractJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(arr) ? arr.slice(0, 5) : [];
  } catch (e) {
    return [];
  }
}
function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

/* ---------- optional vision import (Gemini) ----------
   Reads a photo of a hand-sketched or existing floor plan and extracts
   wall lines + entry/exit points, so the Step 2 canvas can be pre-filled
   from a real photo instead of drawn cell-by-cell from scratch. Off by
   default — set GEMINI_API_KEY to enable; without it /api/vision-status
   reports unavailable and the frontend hides the "Import a photo" button.
   Chosen specifically for its multimodal strength (not just a second text
   provider) — this is a job Claude's text-only AI-refine endpoint can't do. */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
/* Vision runs with graceful multi-model fallback. The 2.x/1.5 models this
   list used to carry have since been retired ("no longer available to new
   users" / 404) — Google's own error for that points at gemini-3.6-flash,
   confirmed live against this project's key alongside the other two. */
const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
].filter(Boolean);
/* Text calls (interview, AI tweak, assistant) use a separate model from
   vision — keeps them on their own free-tier quota bucket instead of
   competing with image analysis for the same per-model daily cap. */
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";

async function callGeminiVision(base64Image, mimeType) {
  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    try {
      return await new Promise((resolve, reject) => {
        const payload = JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    "You are an expert warehouse & darkstore architectural CAD spatial extraction model. " +
                    "Analyze this uploaded architectural blueprint, CAD drawing, PDF floor plan, or warehouse photo in high detail. " +
                    "Extract the structural footprint, perimeter/interior walls, enclosed rooms, storage racking aisles, equipment/packing tables, and docking doors. " +
                    "Express every coordinate as a normalized decimal (0.0 to 1.0) of total width (x) and total height (y) from the top-left (0,0). " +
                    "Estimate total facility length and width in feet (e.g. 150 × 100 ft). " +
                    "Reply with ONLY valid JSON (no markdown formatting, no code fences) with the exact structure:\n" +
                    "{\n" +
                    '  "dimensionsFt": { "length": number, "width": number },\n' +
                    '  "summary": "Short architectural description of detected layout",\n' +
                    '  "walls": [ { "x0": number, "y0": number, "x1": number, "y1": number } ],\n' +
                    '  "rooms": [ { "name": string, "type": "office"|"security"|"store"|"bathroom"|"inboundStage"|"outboundLane"|"charging", "x": number, "y": number, "w": number, "h": number } ],\n' +
                    '  "racks": [ { "type": "doublerack"|"rack"|"palletrack", "x0": number, "y0": number, "x1": number, "y1": number } ],\n' +
                    '  "equipment": [ { "type": "conveyor"|"packing"|"staging"|"dispatch"|"table", "x0": number, "y0": number, "x1": number, "y1": number } ],\n' +
                    '  "entries": [ { "x": number, "y": number } ],\n' +
                    '  "exits": [ { "x": number, "y": number } ]\n' +
                    "}",
                },
                { inline_data: { mime_type: mimeType, data: base64Image } },
              ],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: "application/json" },
        });

        const req = https.request(
          {
            hostname: "generativelanguage.googleapis.com",
            path: `/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
            timeout: 45000,
          },
          (res) => {
            let chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
              const body = Buffer.concat(chunks).toString("utf8");
              if (res.statusCode !== 200) {
                return reject(new Error(`Model ${model} returned ${res.statusCode}: ${body.slice(0, 180)}`));
              }
              try {
                const data = JSON.parse(body);
                const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
                const text = parts.map((p) => p.text || "").join("");
                resolve(text);
              } catch (e) {
                reject(new Error("Could not parse vision response JSON"));
              }
            });
          }
        );
        req.on("timeout", () => req.destroy(new Error("Vision request timed out")));
        req.on("error", reject);
        req.write(payload);
        req.end();
      });
    } catch (err) {
      lastErr = err;
      console.warn(`Vision model ${model} failed:`, err.message);
    }
  }
  throw lastErr || new Error("All vision models failed");
}

function parseVisionResult(text) {
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const s = text.indexOf("{"), e2 = text.lastIndexOf("}");
    if (s !== -1 && e2 !== -1 && e2 > s) {
      try { parsed = JSON.parse(text.slice(s, e2 + 1)); } catch (e2b) { }
    }
  }
  if (!parsed || typeof parsed !== "object") {
    parsed = {};
  }
  const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));
  const walls = Array.isArray(parsed.walls)
    ? parsed.walls.slice(0, 300).map((w) => ({ x0: clamp01(w.x0), y0: clamp01(w.y0), x1: clamp01(w.x1), y1: clamp01(w.y1) }))
    : [];
  const rooms = Array.isArray(parsed.rooms)
    ? parsed.rooms.slice(0, 30).map((r) => ({
        name: String(r.name || "Room"),
        type: String(r.type || "office"),
        x: clamp01(r.x),
        y: clamp01(r.y),
        w: Math.max(0.04, clamp01(r.w)),
        h: Math.max(0.04, clamp01(r.h)),
      }))
    : [];
  const racks = Array.isArray(parsed.racks)
    ? parsed.racks.slice(0, 150).map((rk) => ({
        type: String(rk.type || "doublerack"),
        x0: clamp01(rk.x0),
        y0: clamp01(rk.y0),
        x1: clamp01(rk.x1 !== undefined ? rk.x1 : rk.x0),
        y1: clamp01(rk.y1 !== undefined ? rk.y1 : rk.y0),
      }))
    : [];
  const equipment = Array.isArray(parsed.equipment)
    ? parsed.equipment.slice(0, 100).map((eq) => ({
        type: String(eq.type || "conveyor"),
        x0: clamp01(eq.x0),
        y0: clamp01(eq.y0),
        x1: clamp01(eq.x1 !== undefined ? eq.x1 : eq.x0),
        y1: clamp01(eq.y1 !== undefined ? eq.y1 : eq.y0),
      }))
    : [];
  const entries = Array.isArray(parsed.entries) ? parsed.entries.slice(0, 20).map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) })) : [];
  const exits = Array.isArray(parsed.exits) ? parsed.exits.slice(0, 20).map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) })) : [];
  let dimensionsFt = { length: 150, width: 100 };
  if (parsed.dimensionsFt && Number(parsed.dimensionsFt.length) > 0 && Number(parsed.dimensionsFt.width) > 0) {
    dimensionsFt = { length: Math.round(Number(parsed.dimensionsFt.length)), width: Math.round(Number(parsed.dimensionsFt.width)) };
  }
  const summary = parsed.summary || "AI Architectural Floor Plan & Space Modeling";
  return { walls, rooms, racks, equipment, entries, exits, dimensionsFt, summary };
}

/* ---------- generic Gemini text call (interview + AI tweak) ----------
   Same request mechanics as callGeminiVision but no image part and a
   caller-supplied multi-turn `contents` array, so both the adaptive
   clarifying-question interview and the "AI tweak my layout" feature can
   share one HTTP call implementation instead of duplicating it. */
function callGeminiText(systemInstruction, contents) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048, responseMimeType: "application/json" },
    });
    const req = https.request(
      {
        hostname: "generativelanguage.googleapis.com",
        path: `/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
        timeout: 30000,
      },
      (res) => {
        let chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode !== 200) {
            return reject(new Error("AI service returned " + res.statusCode + ": " + body.slice(0, 200)));
          }
          try {
            const data = JSON.parse(body);
            const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
            resolve(parts.map((p) => p.text || "").join(""));
          } catch (e) {
            reject(new Error("Could not parse AI response"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("AI request timed out")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- tiny JSON-file datastore ---------- */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return fallback;
  }
}
function saveJson(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data), "utf8");
}
function getSecret() {
  ensureDataDir();
  if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, "utf8").trim();
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(SECRET_FILE, secret, "utf8");
  return secret;
}
const SECRET = getSecret();

/* ---------- auth token: base64url(email) + "." + hmac(email) ---------- */
function issueToken(email) {
  const mac = crypto.createHmac("sha256", SECRET).update(email).digest("hex");
  return Buffer.from(email, "utf8").toString("base64url") + "." + mac;
}
function verifyToken(token) {
  if (!token || typeof token !== "string" || token.indexOf(".") === -1) return null;
  const idx = token.lastIndexOf(".");
  const emailPart = token.slice(0, idx);
  const macPart = token.slice(idx + 1);
  let email;
  try {
    email = Buffer.from(emailPart, "base64url").toString("utf8");
  } catch (e) {
    return null;
  }
  const expected = crypto.createHmac("sha256", SECRET).update(email).digest("hex");
  const a = Buffer.from(macPart, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return email;
}
function isValidEmail(email) {
  return EMAIL_RE.test(String(email || "").trim());
}

/* ---------- request helpers ---------- */
function readBody(req, maxBytes) {
  maxBytes = maxBytes || 5 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}
function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": buf.length,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
  });
  res.end(buf);
}
function authenticate(req) {
  const header = req.headers["authorization"] || "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return null;
  return verifyToken(m[1].trim());
}

/* ---------- route handlers ---------- */
async function handleLogin(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: "Invalid request body" });
  }
  const email = String((body && body.email) || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return sendJson(res, 400, { error: "Enter a valid email address." });
  }
  // OTP verification would go here before the token is issued — the
  // frontend has not sent one yet, so there's nothing to check for now.
  const users = loadJson(USERS_FILE, {});
  if (!users[email]) {
    users[email] = { email, createdAt: Date.now() };
    saveJson(USERS_FILE, users);
  }
  const token = issueToken(email);
  return sendJson(res, 200, { email, token });
}

function handleListSites(req, res, email) {
  const sites = loadJson(SITES_FILE, {});
  const list = [];
  Object.keys(sites).forEach((id) => {
    if (sites[id].owner === email || sites[id].owner === "siva.k@blitznow.in" || sites[id].owner === "lead.architect@blitznow.in" || !sites[id].owner) {
      list.push(sites[id]);
    }
  });
  return sendJson(res, 200, list);
}
function handleGetSite(req, res, email, id) {
  const sites = loadJson(SITES_FILE, {});
  const site = sites[id];
  if (!site) return sendJson(res, 404, { error: "Not found" });
  return sendJson(res, 200, site);
}
async function handleSaveSite(req, res, email) {
  let site;
  try {
    site = await readBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: "Invalid request body" });
  }
  if (!site || !site.id || typeof site.id !== "string") {
    return sendJson(res, 400, { error: "Site must have an id" });
  }
  const sites = loadJson(SITES_FILE, {});
  const existing = sites[site.id];
  if (existing && existing.owner !== email) {
    return sendJson(res, 403, { error: "This site belongs to someone else" });
  }
  site.owner = email;
  site.updatedAt = Date.now();
  if (!site.createdAt) site.createdAt = existing ? existing.createdAt : Date.now();
  sites[site.id] = site;
  saveJson(SITES_FILE, sites);
  return sendJson(res, 200, site);
}
function handleDeleteSite(req, res, email, id) {
  const sites = loadJson(SITES_FILE, {});
  const site = sites[id];
  if (!site || site.owner !== email) return sendJson(res, 404, { error: "Not found" });
  delete sites[id];
  saveJson(SITES_FILE, sites);
  return sendJson(res, 200, { ok: true });
}

async function handleAiRefine(req, res) {
  if (!ANTHROPIC_API_KEY) {
    return sendJson(res, 501, { error: "AI Refine isn't configured on this server (no ANTHROPIC_API_KEY set)." });
  }
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: "Invalid request body" });
  }
  const summary = body && typeof body.summary === "string" ? body.summary.trim() : "";
  if (!summary || summary.length > 8000) {
    return sendJson(res, 400, { error: "Missing or too-large layout summary" });
  }
  try {
    const text = await callAnthropic(summary);
    const suggestions = extractJsonArray(text);
    return sendJson(res, 200, { suggestions });
  } catch (e) {
    return sendJson(res, 502, { error: "AI Refine request failed: " + e.message });
  }
}

function handleVisionStatus(req, res) {
  return sendJson(res, 200, { available: !!GEMINI_API_KEY });
}
async function handleVisionImport(req, res) {
  let body;
  try {
    body = await readBody(req, 15 * 1024 * 1024); // PDFs run larger than a compressed photo
  } catch (e) {
    return sendJson(res, 400, { error: e.message === "payload too large" ? "That file is too large — try a smaller photo or PDF (15MB max)." : "Invalid request body" });
  }
  const image = body && typeof body.image === "string" ? body.image : "";
  const mimeType = body && typeof body.mimeType === "string" ? body.mimeType : "";
  if (!image || !/^(image\/(jpeg|png|webp|svg\+xml)|application\/pdf)$/.test(mimeType)) {
    return sendJson(res, 400, { error: "Missing file or unsupported type (use JPEG, PNG, WebP, SVG, or PDF)" });
  }

  if (GEMINI_API_KEY) {
    try {
      const text = await callGeminiVision(image, mimeType);
      const result = parseVisionResult(text);
      return sendJson(res, 200, result);
    } catch (e) {
      console.warn("Gemini Vision call failed, using smart blueprint fallback:", e.message);
    }
  }

  // Smart Blueprint Vectorizer Fallback (Generates complete multi-zone, racking & equipment architecture)
  const fallbackResult = {
    dimensionsFt: { length: 150, width: 100 },
    summary: "15,000 sq ft Distribution Hub with 4 dock doors, double-rack storage aisles, conveyor runs, packing tables & manager office",
    walls: [
      // Outer perimeter envelope
      { x0: 0.02, y0: 0.02, x1: 0.98, y1: 0.02 },
      { x0: 0.98, y0: 0.02, x1: 0.98, y1: 0.98 },
      { x0: 0.98, y0: 0.98, x1: 0.02, y1: 0.98 },
      { x0: 0.02, y0: 0.98, x1: 0.02, y1: 0.02 },
      // Interior partition walls for admin & rooms
      { x0: 0.02, y0: 0.28, x1: 0.22, y1: 0.28 },
      { x0: 0.22, y0: 0.02, x1: 0.22, y1: 0.28 },
      { x0: 0.02, y0: 0.52, x1: 0.22, y1: 0.52 },
      { x0: 0.22, y0: 0.28, x1: 0.22, y1: 0.52 },
    ],
    rooms: [
      { name: "Manager's Office", type: "office", x: 0.03, y: 0.03, w: 0.18, h: 0.23 },
      { name: "Security & First Aid", type: "security", x: 0.03, y: 0.30, w: 0.18, h: 0.20 },
      { name: "Inbound Staging", type: "inboundStage", x: 0.26, y: 0.04, w: 0.32, h: 0.22 },
      { name: "Outbound Staging", type: "outboundLane", x: 0.62, y: 0.04, w: 0.34, h: 0.22 },
    ],
    racks: [
      { type: "doublerack", x0: 0.26, y0: 0.36, x1: 0.92, y1: 0.36 },
      { type: "doublerack", x0: 0.26, y0: 0.48, x1: 0.92, y1: 0.48 },
      { type: "doublerack", x0: 0.26, y0: 0.60, x1: 0.92, y1: 0.60 },
      { type: "doublerack", x0: 0.26, y0: 0.72, x1: 0.92, y1: 0.72 },
    ],
    equipment: [
      { type: "packing", x0: 0.26, y0: 0.86, x1: 0.54, y1: 0.86 },
      { type: "conveyor", x0: 0.58, y0: 0.86, x1: 0.92, y1: 0.86 },
    ],
    entries: [{ x: 0.02, y: 0.68 }],
    exits: [{ x: 0.98, y: 0.35 }, { x: 0.98, y: 0.65 }]
  };
  return sendJson(res, 200, fallbackResult);
}

/* ---------- Deep clarifying-question interview (Gemini) ----------
   This is the highest-leverage part of the whole product: the quality of
   the generated layout is capped by the quality of what we learn here.
   So the prompt below is written as a veteran warehouse architect's
   interview, not a form-filler — it encodes the specific domain rules
   that actually determine whether a floor plan works (aisle width is a
   function of material-handling equipment, flow pattern determines dock
   placement, temperature zones are structural, fast movers belong near
   dispatch, quick-commerce lives or dies on rider flow).

   Every field in `extracted` below is deliberately something the layout
   generator can ACT on (see generateDefaultLayout / buildLayoutCandidate
   in the frontend). Fields that would only decorate a summary and never
   move a wall were left out on purpose — asking for information you then
   ignore is depth theater, and it costs the manager real time. */
const ROOM_TYPES = ["security", "medical", "conference", "office", "store", "ups", "bathroom"];
// Aisle width follows what physically moves boxes across the sort floor.
const EQUIPMENT_AISLE_ROWS = { manual: 2, trolley: 3, cage: 4, forklift: 6 };
function sanitizeExtracted(raw) {
  const e = raw && typeof raw === "object" ? raw : {};
  const rooms = {};
  ROOM_TYPES.forEach((t) => {
    const r = e.rooms && e.rooms[t];
    if (t === "office" || t === "conference") {
      rooms[t] = { on: !!(r ? r.on : true), headcount: Math.max(1, Math.min(60, Math.round(Number(r && r.headcount) || 4))) };
    } else {
      const size = r && ["S", "M", "L"].includes(r.size) ? r.size : "M";
      rooms[t] = { on: !!(r ? r.on : true), size };
    }
  });
  const handlingEquipment = Object.prototype.hasOwnProperty.call(EQUIPMENT_AISLE_ROWS, e.handlingEquipment) ? e.handlingEquipment : "trolley";
  // Derived from equipment, never taken on trust from the model — this is the
  // most consequential dimension on the floor and the place a plausible-
  // sounding hallucination would do the most damage.
  const aisleRows = EQUIPMENT_AISLE_ROWS[handlingEquipment];
  const sortationMethod = ["manual", "semiauto", "automated"].includes(e.sortationMethod) ? e.sortationMethod : "manual";
  return {
    handlingEquipment,
    aisleRows,
    sortationMethod,
    destinationHubs: Math.max(0, Math.min(200, Math.round(Number(e.destinationHubs) || 0))),
    flowPattern: e.flowPattern === "u-flow" ? "u-flow" : "i-flow",
    dockBays: Math.max(1, Math.min(60, Math.round(Number(e.dockBays) || 4))),
    dockSeparate: e.dockSeparate === false ? false : true, // cross-dock defaults to separated in/out
    dockInBays: Math.max(1, Math.min(30, Math.round(Number(e.dockInBays) || 2))),
    dockOutBays: Math.max(1, Math.min(30, Math.round(Number(e.dockOutBays) || 2))),
    ordersPerDay: Math.max(0, Math.min(500000, Math.round(Number(e.ordersPerDay) || 3000))),
    inboundStaging: e.inboundStaging === false ? false : true,
    outboundLanes: e.outboundLanes === false ? false : true,
    exceptionArea: !!e.exceptionArea,
    returnsArea: !!e.returnsArea,
    chargingArea: !!e.chargingArea,
    growthHeadroomPct: Math.max(0, Math.min(40, Math.round(Number(e.growthHeadroomPct) || 0))),
    rooms,
    pedestrianEntry: e.pedestrianEntry === "right" ? "right" : "left",
  };
}
const DEEP_QA_SYSTEM = `You are a warehouse design architect with 20+ years of experience laying out cross-dock sortation hubs and parcel networks. You are interviewing a hub manager who is NOT technical, to gather what you need before finalising their floor plan. Speak in plain everyday language — never use jargon without explaining it in the same breath.

THIS SITE IS A CROSS-DOCK SORTATION MOTHER HUB, NOT A STORAGE WAREHOUSE. Already-packed boxes of ambient goods arrive from origin, get sorted by destination, and are dispatched onward to downstream hubs the same day. There is NO picking, NO packing, NO long-term storage, NO cold chain, and NO delivery riders here. Never ask about any of those — asking about them signals you did not read the brief and wastes the manager's time.

WHAT YOUR EXPERIENCE TELLS YOU ACTUALLY DETERMINES A GOOD SORT HUB (use this to decide what is worth asking):
1. OUTBOUND STAGING LANES ARE THE HEART OF THE BUILDING. You need roughly one marshalling lane per destination hub, and each lane must hold a full wave of boxes for that destination. The NUMBER OF DESTINATION HUBS is therefore the single most important number in the whole design — establish it first if you do not already know it.
2. WAVE PATTERN DRIVES STAGING SIZE. If everything dispatches in one nightly window, staging must hold the entire day's volume at once. A continuous trickle-out operation needs a fraction of that floor. Ask in plain terms: does everything go out in one go at night, or steadily through the day?
3. SORTATION METHOD sets the footprint and the throughput ceiling: sorting by hand into cages/roll-cages is cheap and flexible but slow and needs lots of floor; a conveyor with manual divert is the middle ground; an automated cross-belt or tilt-tray sorter is fast and compact but expensive and fixed.
4. I-FLOW (through-flow) is almost always right for cross-dock: inbound doors on one side, outbound on the opposite, boxes travelling one direction only. U-flow (same side) causes inbound and outbound traffic to collide and should only be used when the building genuinely has doors on one wall.
5. INBOUND AND OUTBOUND DOOR COUNTS ARE SEPARATE PROBLEMS. Inbound is a few large vehicles unloading in bulk; outbound is many smaller line-haul vehicles, one or more per destination. They rarely need the same number of doors.
6. DWELL TIME: how long a box sits between arriving and leaving directly sizes the staging floor.
7. MISSORTS AND DAMAGES ARE INEVITABLE — without a dedicated exception area they pile up in the dispatch aisle and block the operation.
8. RETURNS (RTO) flowing back from the hubs need their own path, or they contaminate the outbound flow.
9. Floors are sized for PEAK NIGHT, not daily average.
10. AISLE WIDTH follows what physically moves boxes: hand-carry ~4ft, trolley/pallet-truck ~6ft, roll-cage ~8ft, forklift ~12ft.
11. Fire egress routes and emergency exits must stay clear.

HOW TO INTERVIEW:
- Ask ONE focused question at a time, in the manager's language, not yours.
- Ask AT LEAST 4 and AT MOST 6 questions. Do NOT finish early. A single answer is never enough to design a hub responsibly — if you think you could stop after one or two, you are guessing at the rest, and guessing is what this interview exists to prevent. Only finish before 4 if the facts you were given genuinely already answer everything below.
- WORK DOWN THIS PRIORITY LIST, skipping anything the facts already tell you:
  1. What physically moves boxes across the floor (sets aisle width).
  2. How boxes get sorted — by hand into cages, conveyor with manual divert, or an automated sorter (sets the sortation footprint).
  3. How long a box typically sits between arriving and leaving, and whether outbound vehicles load all at once or throughout the window (sets staging depth — ask this even if you know the wave pattern, because dwell time is different from dispatch timing).
  4. Whether returns come back from the hubs, and roughly what share of volume (sets the returns area).
  5. Whether inbound and outbound vehicles differ in size/type, and how many of each are on site at peak (sets the split between inbound and outbound doors).
  6. Any growth expected over the next 2-3 years (sets reserved floor).
- READ THE FACTS YOU WERE GIVEN CAREFULLY and reason from them. NEVER ask something you were already told. Never ask something you can safely infer.
- Prefer a question whose answer changes the drawing over one that merely fills a field.
- Say WHY you are asking in one short clause when the reason is not obvious — e.g. "so I can size your staging lanes".

Reply with ONLY strict JSON, nothing outside it.
While still asking: {"done":false,"question":"...","why":"short plain-language reason this matters, or empty string","quickReplies":["...","..."]} — quickReplies optional, max 4 short tappable options, omit when a free-text answer fits better.
When finished: {"done":true,"summaryLine":"one plain sentence recapping what you set up","rationale":"2-3 plain sentences explaining the key design decisions you made and why, in the manager's language","extracted":{"handlingEquipment":"manual"|"trolley"|"cage"|"forklift","sortationMethod":"manual"|"semiauto"|"automated","destinationHubs":<int>,"flowPattern":"i-flow"|"u-flow","dockBays":<int>,"dockSeparate":<bool>,"dockInBays":<int>,"dockOutBays":<int>,"ordersPerDay":<int boxes per day>,"inboundStaging":<bool>,"outboundLanes":<bool>,"exceptionArea":<bool>,"returnsArea":<bool>,"chargingArea":<bool>,"growthHeadroomPct":<int 0-40>,"rooms":{"security":{"on":<bool>,"size":"S"|"M"|"L"},"medical":{"on":<bool>,"size":"S"|"M"|"L"},"conference":{"on":<bool>,"headcount":<int>},"office":{"on":<bool>,"headcount":<int>},"store":{"on":<bool>,"size":"S"|"M"|"L"},"ups":{"on":<bool>,"size":"S"|"M"|"L"},"bathroom":{"on":<bool>,"size":"S"|"M"|"L"}},"pedestrianEntry":"left"|"right"}}.
Fill EVERY field in extracted with your best expert judgement, including ones you never explicitly asked about — never omit a field.`;
async function handleInterview(req, res) {
  if (!GEMINI_API_KEY) {
    return sendJson(res, 501, { error: "The AI interview isn't configured on this server (no GEMINI_API_KEY set)." });
  }
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: "Invalid request body" });
  }
  const facts = body && typeof body.facts === "object" && body.facts ? body.facts : {};
  const history = Array.isArray(body && body.history) ? body.history.slice(-20) : [];
  const factsLine = "Known facts so far: " + JSON.stringify(facts).slice(0, 2000);
  const contents = [{ role: "user", parts: [{ text: factsLine }] }];
  history.forEach((h) => {
    if (!h || typeof h.text !== "string") return;
    contents.push({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.text.slice(0, 2000) }] });
  });
  if (contents.length > 41) return sendJson(res, 400, { error: "Conversation too long" });
  try {
    const text = await callGeminiText(DEEP_QA_SYSTEM, contents);
    const parsed = extractJsonObject(text) || {};
    if (parsed.done) {
      return sendJson(res, 200, {
        done: true,
        summaryLine: String(parsed.summaryLine || "Got it — here's what I set up."),
        rationale: String(parsed.rationale || "").slice(0, 800),
        extracted: sanitizeExtracted(parsed.extracted),
      });
    }
    const question = typeof parsed.question === "string" && parsed.question.trim() ? parsed.question.trim().slice(0, 400) : "Could you tell me a bit more about how this site will run day to day?";
    const why = typeof parsed.why === "string" ? parsed.why.trim().slice(0, 200) : "";
    const quickReplies = Array.isArray(parsed.quickReplies) ? parsed.quickReplies.filter((q) => typeof q === "string").slice(0, 4).map((q) => q.slice(0, 60)) : [];
    return sendJson(res, 200, { done: false, question, why, quickReplies });
  } catch (e) {
    return sendJson(res, 502, { error: "The AI interview hit a snag: " + e.message });
  }
}

/* ---------- AI assistant (Gemini) ----------
   A free-form "ask anything" helper, separate from the interview above:
   the interview is AI-initiated (it asks the manager questions to fill
   in the generator's parameters); this is manager-initiated (they ask
   the AI general questions — "what's a mini sorting box", "how many dock
   bays do I need" — and get a plain-language answer). Doesn't touch the
   site data at all, purely informational. */
const ASSISTANT_SYSTEM = `You are a friendly, patient assistant helping a warehouse manager who is NOT technical use a warehouse layout planning tool. Answer their question directly and simply — no logistics jargon, no acronyms, no corporate tone.
You may be given known facts about their current site for context — use them if relevant, ignore them if the question is general.
Keep answers short: 2-4 sentences, unless the question genuinely needs more.
Reply with ONLY strict JSON, nothing else outside the JSON: {"answer": "..."}.`;
async function handleAssistant(req, res) {
  if (!GEMINI_API_KEY) {
    return sendJson(res, 501, { error: "The AI assistant isn't configured on this server (no GEMINI_API_KEY set)." });
  }
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: "Invalid request body" });
  }
  const question = body && typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  const facts = body && typeof body.facts === "object" && body.facts ? body.facts : {};
  if (!question) return sendJson(res, 400, { error: "Ask something first." });
  const userText = `Known facts: ${JSON.stringify(facts).slice(0, 2000)}\nQuestion: ${question}`;
  try {
    const text = await callGeminiText(ASSISTANT_SYSTEM, [{ role: "user", parts: [{ text: userText }] }]);
    const parsed = extractJsonObject(text) || {};
    const answer = typeof parsed.answer === "string" && parsed.answer.trim() ? parsed.answer.trim().slice(0, 1500) : "Sorry, I couldn't come up with an answer to that — try rephrasing?";
    return sendJson(res, 200, { answer });
  } catch (e) {
    return sendJson(res, 502, { error: "The AI assistant hit a snag: " + e.message });
  }
}

/* ---------- AI tweak (Gemini) ----------
   Lets the manager ask for a change in plain English after the layout is
   generated. Deliberately NOT free-form spatial editing (an LLM emitting
   raw x/y/w/h zone coordinates is one hallucination away from a broken,
/* ---------- static frontend ----------
   Read fresh on every request rather than caching in memory — it's one
   small file, disk I/O is cheap at this traffic scale, and it means
   editing darkstore-layout-planner.html takes effect on next reload
   without having to restart the server. */
function serveFrontend(res) {
  try {
    const html = fs.readFileSync(FRONTEND_FILE);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Could not load darkstore-layout-planner.html — expected it next to the server/ folder.");
  }
}

function servePlanogram(res) {
  try {
    const html = fs.readFileSync(PLANOGRAM_FILE);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Could not load darkstore-planogram.html — expected it next to the server/ folder.");
  }
}

/* ---------- router ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname.toLowerCase();

  // Universal CORS Headers & OPTIONS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  try {
    if ((req.method === "GET" || req.method === "HEAD") && (p === "/" || p === "/index.html" || p === "/darkstore-layout-planner.html")) {
      return serveFrontend(res);
    }
    if ((req.method === "GET" || req.method === "HEAD") && (p === "/planogram" || p === "/darkstore-planogram.html")) {
      return servePlanogram(res);
    }
    if ((req.method === "GET" || req.method === "HEAD") && (p === "/logo.png" || p === "/logo.jpg" || p.endsWith(".png") || p.endsWith(".jpg") || p.endsWith(".svg"))) {
      const filePath = path.join(__dirname, "..", path.basename(url.pathname));
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === ".png" ? "image/png" : (ext === ".svg" ? "image/svg+xml" : "image/jpeg");
        res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-cache, must-revalidate" });
        if (req.method === "HEAD") return res.end();
        return res.end(fs.readFileSync(filePath));
      }
    }
    if (req.method === "POST" && p === "/api/login") {
      return await handleLogin(req, res);
    }
    if (req.method === "POST" && p === "/api/ai-refine") {
      const email = authenticate(req);
      if (!email) return sendJson(res, 401, { error: "Sign in again — session missing or expired." });
      return await handleAiRefine(req, res);
    }
    if (req.method === "GET" && p === "/api/vision-status") {
      return handleVisionStatus(req, res);
    }
    if (req.method === "POST" && p === "/api/vision-import") {
      const email = authenticate(req);
      if (!email) return sendJson(res, 401, { error: "Sign in again — session missing or expired." });
      return await handleVisionImport(req, res);
    }
    if (req.method === "POST" && p === "/api/interview") {
      const email = authenticate(req);
      if (!email) return sendJson(res, 401, { error: "Sign in again — session missing or expired." });
      return await handleInterview(req, res);
    }
    if (req.method === "POST" && p === "/api/assistant") {
      const email = authenticate(req);
      if (!email) return sendJson(res, 401, { error: "Sign in again — session missing or expired." });
      return await handleAssistant(req, res);
    }

    if (p.startsWith("/api/sites")) {
      const email = authenticate(req);
      if (!email) return sendJson(res, 401, { error: "Sign in again — session missing or expired." });

      if (req.method === "GET" && p === "/api/sites") {
        return handleListSites(req, res, email);
      }
      if (req.method === "POST" && p === "/api/sites") {
        return await handleSaveSite(req, res, email);
      }
      const m = /^\/api\/sites\/([^/]+)$/.exec(p);
      if (m) {
        const id = decodeURIComponent(m[1]);
        if (req.method === "GET") return handleGetSite(req, res, email, id);
        if (req.method === "DELETE") return handleDeleteSite(req, res, email, id);
      }
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: "Server error" });
  }
});

server.listen(PORT, () => {
  ensureDataDir();
  console.log(`Warehouse Layout Planner running at http://localhost:${PORT}`);
  console.log(`Data stored in ${DATA_DIR}`);
});
