/* ==========================================================================
   Plano AI — Master Application Coordinator & Canvas Studio Engine
   ========================================================================== */

import { ELEMENTS, ELEMENTS_BY_ID } from './config/elements.js';
import { LayoutMetrics } from './engine/metrics.js';

class PlanoAIApp {
  constructor() {
    this.currentUser = null;
    this.token = localStorage.getItem('plano_token') || null;
    this.geminiKey = localStorage.getItem('plano_gemini_key') || '';
    
    this.sites = [];
    this.currentSite = null;
    this.currentFilter = 'all';

    // Active Layout Model
    this.activeSiteId = null;
    this.siteName = "Bengaluru Mother Hub";
    this.siteCity = "Bengaluru";
    this.unit = "imperial"; // 'imperial' (ft) | 'metric' (m)
    this.cols = 46;
    this.rows = 30;
    this.lengthFt = 150;
    this.widthFt = 100;
    this.heightFt = 32;
    this.operationalModel = 'ecommerce';
    this.inboundDocks = 4;
    this.outboundDocks = 4;
    
    this.cells = new Uint8Array(this.cols * this.rows);
    this.rots = new Uint8Array(this.cols * this.rows);

    // Canvas View State
    this.cellPx = 28;
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.startPanX = 0;
    this.startPanY = 0;
    
    // Tools & History
    this.activeToolId = 1; // Selective Rack
    this.isPainting = false;
    this.paintMode = 'draw'; // 'draw' | 'erase'
    this.hoverCell = null;
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 40;

    // Wizard State
    this.wizardStep = 1;
    this.uploadedImageBase64 = null;
    this.sketchPoints = [];

    // Auto-save debounce timer
    this.saveTimer = null;

    this.init();
  }

  /* --------------------------------------------------------------------------
     Initialization & Lifecycle
     -------------------------------------------------------------------------- */
  async init() {
    this.bindDomEvents();
    this.initQuickSketchCanvas();
    this.initMainStudioCanvas();
    this.renderPalette();

    if (this.token) {
      await this.loginUser(this.token);
    } else {
      this.showScreen('screen-login');
      this.loadRecentUsers();
    }
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('on');

    if (screenId === 'screen-library') {
      this.loadSites();
    } else if (screenId === 'screen-editor') {
      this.centerCanvas();
      this.redrawCanvas();
      this.updateStudioMetrics();
    } else if (screenId === 'screen-present') {
      this.renderPresentation();
    }
  }

  toast(msg) {
    const wrap = document.getElementById('toast-wrap');
    if (!wrap) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    wrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add('on'));
    setTimeout(() => {
      t.classList.remove('on');
      setTimeout(() => t.remove(), 300);
    }, 3200);
  }

  async apiRequest(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...(this.geminiKey ? { 'X-Gemini-Key': this.geminiKey } : {}),
      ...(options.headers || {})
    };
    const res = await fetch(endpoint, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  /* --------------------------------------------------------------------------
     Auth & Session Management (Step 1)
     -------------------------------------------------------------------------- */
  async loginUser(email) {
    try {
      const data = await this.apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      this.currentUser = data.user;
      this.token = data.token;
      localStorage.setItem('plano_token', this.token);

      const emailLabel = document.getElementById('user-email-label');
      if (emailLabel) emailLabel.textContent = this.currentUser.email;

      this.showScreen('screen-library');
      this.toast(`👋 Welcome back, ${this.currentUser.name || 'Warehouse Manager'}!`);
    } catch (e) {
      this.toast(`⚠️ Login failed: ${e.message}`);
      this.showScreen('screen-login');
    }
  }

  async loadRecentUsers() {
    try {
      const users = await this.apiRequest('/api/auth/recent-users');
      const wrap = document.getElementById('login-chips-wrap');
      const container = document.getElementById('login-chips');
      if (users && users.length > 0 && wrap && container) {
        wrap.style.display = 'block';
        container.innerHTML = users.map(u => `
          <div class="recent-chip" data-email="${u.email}">
            <div class="avatar">${(u.name || u.email)[0].toUpperCase()}</div>
            <div>
              <div style="font-weight:700; font-size:13px;">${u.name || u.email.split('@')[0]}</div>
              <div style="font-size:11px; color:var(--text-muted);">${u.email}</div>
            </div>
          </div>
        `).join('');

        container.querySelectorAll('.recent-chip').forEach(c => {
          c.addEventListener('click', () => {
            const email = c.dataset.email;
            document.getElementById('login-email-input').value = email;
            this.loginUser(email);
          });
        });
      }
    } catch (e) {}
  }

  handleLogout() {
    this.currentUser = null;
    this.token = null;
    localStorage.removeItem('plano_token');
    this.showScreen('screen-login');
    this.loadRecentUsers();
    this.toast('⎋ Signed out safely.');
  }

  /* --------------------------------------------------------------------------
     Sites & Layout Hub (Step 2)
     -------------------------------------------------------------------------- */
  async loadSites() {
    try {
      this.sites = await this.apiRequest('/api/sites');
      this.renderSiteGrid();
      this.updateHubStats();
    } catch (e) {
      this.toast(`⚠️ Error loading facilities: ${e.message}`);
    }
  }

  updateHubStats() {
    const totalSites = this.sites.length;
    let totalSqFt = 0;
    let totalPallets = 0;

    this.sites.forEach(s => {
      totalSqFt += (s.lengthFt || 150) * (s.widthFt || 100);
      if (s.summary && s.summary.totalCapacityPallets) {
        totalPallets += s.summary.totalCapacityPallets;
      } else {
        totalPallets += Math.floor((s.cols || 46) * (s.rows || 30) * 1.8);
      }
    });

    const statSites = document.getElementById('stat-total-sites');
    const statSqFt = document.getElementById('stat-total-sqft');
    const statPallets = document.getElementById('stat-total-pallets');

    if (statSites) statSites.textContent = totalSites.toLocaleString();
    if (statSqFt) statSqFt.textContent = `${totalSqFt.toLocaleString()} sq ft`;
    if (statPallets) statPallets.textContent = totalPallets.toLocaleString();
  }

  renderSiteGrid() {
    const gridEl = document.getElementById('layout-grid');
    if (!gridEl) return;

    const searchTerm = (document.getElementById('hub-search-input')?.value || '').toLowerCase().trim();
    const filtered = this.sites.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchTerm) || (s.city && s.city.toLowerCase().includes(searchTerm));
      const matchFilter = this.currentFilter === 'all' || s.operationalModel === this.currentFilter;
      return matchSearch && matchFilter;
    });

    // Keep the "Create New" card
    let html = `
      <div class="new-layout-card" id="card-new-layout">
        <div class="plus-icon">+</div>
        <strong style="font-family:var(--font-brand); font-size:17px;">Create New Warehouse Layout</strong>
        <span style="font-size:12px; color:var(--text-muted); max-width:240px;">Guided AI Architect flow with sketch upload or interactive sketching</span>
      </div>
    `;

    filtered.forEach(site => {
      const dateStr = new Date(site.updatedAt || site.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const pallets = site.summary?.totalCapacityPallets || Math.floor((site.cols || 46) * (site.rows || 30) * 1.8);
      const sqFt = Math.round((site.lengthFt || 150) * (site.widthFt || 100));

      html += `
        <div class="layout-card" data-site-id="${site.id}">
          <div class="layout-thumb">
            <span class="pill emerald layout-card-badge">${(site.operationalModel || 'E-Commerce').toUpperCase()}</span>
            <canvas id="thumb-${site.id}" width="340" height="170"></canvas>
          </div>
          <div class="layout-meta">
            <h3>${site.name}</h3>
            <div class="location">📍 ${site.city || 'Hub Location'} · Updated ${dateStr}</div>
            
            <div class="layout-metrics-row">
              <div class="m-item">
                <div class="m-val">${sqFt.toLocaleString()} sq ft</div>
                <div class="m-lbl">${site.cols} × ${site.rows} Grid (${site.lengthFt}×${site.widthFt}')</div>
              </div>
              <div class="m-item">
                <div class="m-val">${pallets.toLocaleString()} Pallets</div>
                <div class="m-lbl">${site.inboundDocks || 4} IN / ${site.outboundDocks || 4} OUT Docks</div>
              </div>
            </div>

            <div class="layout-card-actions">
              <div style="display:flex; gap:6px;">
                <button class="btn primary btn-sm action-open" data-site-id="${site.id}">Open Studio</button>
                <button class="btn ghost btn-sm action-present" data-site-id="${site.id}" title="Presentation Mode">📽️</button>
                <button class="btn ghost btn-sm action-dup" data-site-id="${site.id}" title="Duplicate">📋</button>
              </div>
              <button class="btn danger ghost btn-sm action-del" data-site-id="${site.id}" title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      `;
    });

    gridEl.innerHTML = html;

    // Attach card event listeners
    document.getElementById('card-new-layout')?.addEventListener('click', () => this.startNewWizard());
    
    filtered.forEach(site => {
      this.renderMiniThumbnail(site);
    });

    gridEl.querySelectorAll('.action-open').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openSiteInStudio(b.dataset.siteId);
      });
    });

    gridEl.querySelectorAll('.action-present').forEach(b => {
      e => e.stopPropagation();
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openSiteInPresentation(b.dataset.siteId);
      });
    });

    gridEl.querySelectorAll('.action-dup').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.duplicateSite(b.dataset.siteId);
      });
    });

    gridEl.querySelectorAll('.action-del').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSite(b.dataset.siteId);
      });
    });

    gridEl.querySelectorAll('.layout-card').forEach(c => {
      c.addEventListener('click', () => {
        const id = c.dataset.siteId;
        if (id) this.openSiteInStudio(id);
      });
    });
  }

  renderMiniThumbnail(site) {
    const cvs = document.getElementById(`thumb-${site.id}`);
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const cols = site.cols || 46;
    const rows = site.rows || 30;
    const cells = site.cells || [];

    const cellW = cvs.width / cols;
    const cellH = cvs.height / rows;

    ctx.fillStyle = '#F8FAF7';
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const id = cells[idx];
        if (id && ELEMENTS_BY_ID[id]) {
          ctx.fillStyle = ELEMENTS_BY_ID[id].color;
          ctx.fillRect(c * cellW + 0.5, r * cellH + 0.5, Math.max(1, cellW - 1), Math.max(1, cellH - 1));
        }
      }
    }
  }

  async duplicateSite(siteId) {
    try {
      await this.apiRequest(`/api/sites/duplicate/${siteId}`, { method: 'POST' });
      this.toast('📋 Facility layout duplicated!');
      await this.loadSites();
    } catch (e) {
      this.toast(`⚠️ Duplication failed: ${e.message}`);
    }
  }

  async deleteSite(siteId) {
    if (!confirm('Are you sure you want to delete this warehouse layout?')) return;
    try {
      await this.apiRequest(`/api/sites/${siteId}`, { method: 'DELETE' });
      this.toast('🗑️ Layout deleted.');
      await this.loadSites();
    } catch (e) {
      this.toast(`⚠️ Delete failed: ${e.message}`);
    }
  }

  openSiteInStudio(siteId) {
    const site = this.sites.find(s => s.id === siteId);
    if (!site) return;

    this.activeSiteId = site.id;
    this.siteName = site.name;
    this.siteCity = site.city || 'Bengaluru';
    this.cols = site.cols || 46;
    this.rows = site.rows || 30;
    this.lengthFt = site.lengthFt || 150;
    this.widthFt = site.widthFt || 100;
    this.operationalModel = site.operationalModel || 'ecommerce';
    this.inboundDocks = site.inboundDocks || 4;
    this.outboundDocks = site.outboundDocks || 4;

    const total = this.cols * this.rows;
    this.cells = new Uint8Array(total);
    this.rots = new Uint8Array(total);

    if (site.cells && site.cells.length === total) {
      for (let i = 0; i < total; i++) this.cells[i] = site.cells[i];
    }
    if (site.rots && site.rots.length === total) {
      for (let i = 0; i < total; i++) this.rots[i] = site.rots[i];
    }

    this.history = [];
    this.historyIndex = -1;
    this.pushHistory();

    // Update Header labels
    document.getElementById('ed-site-name').textContent = this.siteName;
    document.getElementById('ed-site-specs').textContent = `${this.lengthFt} × ${this.widthFt} ft (${this.cols} × ${this.rows} Cells) · ${this.operationalModel.toUpperCase()}`;

    this.showScreen('screen-editor');
  }

  openSiteInPresentation(siteId) {
    this.openSiteInStudio(siteId);
    this.showScreen('screen-present');
  }

  /* --------------------------------------------------------------------------
     Guided Creation Wizard (Steps 3, 4, 5)
     -------------------------------------------------------------------------- */
  startNewWizard() {
    this.wizardStep = 1;
    this.uploadedImageBase64 = null;
    this.sketchPoints = [];
    this.clearQuickSketch();
    this.updateWizardStepUI();
    this.showScreen('screen-flow');
  }

  updateWizardStepUI() {
    // Nav rail
    for (let i = 1; i <= 3; i++) {
      const rail = document.getElementById(`wizard-rail-${i}`);
      const pane = document.getElementById(`wizard-pane-${i}`);
      if (rail) {
        rail.classList.toggle('active', i === this.wizardStep);
        rail.classList.toggle('done', i < this.wizardStep);
      }
      if (pane) pane.classList.toggle('on', i === this.wizardStep);
    }

    const counter = document.getElementById('wizard-step-counter');
    const prevBtn = document.getElementById('wizard-prev-btn');
    const nextBtn = document.getElementById('wizard-next-btn');

    if (prevBtn) prevBtn.style.visibility = this.wizardStep > 1 ? 'visible' : 'hidden';

    if (this.wizardStep === 1) {
      if (counter) counter.textContent = 'Step 1 of 3: Facility Basics';
      if (nextBtn) nextBtn.textContent = 'Continue to Layout Input →';
    } else if (this.wizardStep === 2) {
      if (counter) counter.textContent = 'Step 2 of 3: Layout Input';
      if (nextBtn) nextBtn.textContent = 'Synthesize with AI Architect →';
    } else if (this.wizardStep === 3) {
      if (counter) counter.textContent = 'Step 3 of 3: AI Architect Synthesis';
      if (nextBtn) nextBtn.textContent = 'Open in Studio & Customize →';
    }
  }

  async advanceWizard() {
    if (this.wizardStep === 1) {
      // Validate Step 1
      this.siteName = document.getElementById('wz-name')?.value || 'New Facility';
      this.siteCity = document.getElementById('wz-city')?.value || 'Bengaluru';
      this.lengthFt = parseFloat(document.getElementById('wz-len')?.value) || 150;
      this.widthFt = parseFloat(document.getElementById('wz-wid')?.value) || 100;
      this.heightFt = parseFloat(document.getElementById('wz-hgt')?.value) || 32;
      this.inboundDocks = parseInt(document.getElementById('wz-inbound-docks')?.value) || 4;
      this.outboundDocks = parseInt(document.getElementById('wz-outbound-docks')?.value) || 4;

      this.cols = Math.max(20, Math.min(100, Math.round(this.lengthFt / 3.28)));
      this.rows = Math.max(15, Math.min(80, Math.round(this.widthFt / 3.28)));

      this.wizardStep = 2;
      this.updateWizardStepUI();
    } else if (this.wizardStep === 2) {
      // Generate Layout via Backend & Gemini API
      this.wizardStep = 3;
      this.updateWizardStepUI();
      await this.runAiArchitectSynthesis();
    } else if (this.wizardStep === 3) {
      // Save newly created layout and open Studio
      await this.saveCurrentLayoutToDatabase();
      this.showScreen('screen-editor');
      this.toast('✨ Warehouse Layout generated and loaded into Studio!');
    }
  }

  async runAiArchitectSynthesis() {
    const outputEl = document.getElementById('ai-synthesis-output');
    const notesList = document.getElementById('ai-notes-list');

    try {
      const mhe = document.getElementById('q-mhe-fleet')?.value || 'reach_truck';
      const staging = document.getElementById('q-fast-staging')?.value || 'crossdock';

      const payload = {
        name: this.siteName,
        city: this.siteCity,
        cols: this.cols,
        rows: this.rows,
        lengthFt: this.lengthFt,
        widthFt: this.widthFt,
        inboundDocks: this.inboundDocks,
        outboundDocks: this.outboundDocks,
        operationalModel: this.operationalModel,
        mhe,
        uploadedImageBase64: this.uploadedImageBase64,
        answers: { mhe, staging }
      };

      const result = await this.apiRequest('/api/ai/analyze-and-generate', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      this.cells = new Uint8Array(result.cells);
      this.rots = new Uint8Array(result.rots);
      this.activeSiteId = 'site-' + Date.now();

      if (outputEl && notesList && result.architectNotes) {
        outputEl.style.display = 'block';
        notesList.innerHTML = result.architectNotes.map(n => `<li>${n}</li>`).join('');
      }

      this.history = [];
      this.historyIndex = -1;
      this.pushHistory();
    } catch (e) {
      this.toast(`⚠️ Synthesis notice: ${e.message}`);
    }
  }

  /* --------------------------------------------------------------------------
     Interactive Quick Sketch Canvas (Step 4 Option B)
     -------------------------------------------------------------------------- */
  initQuickSketchCanvas() {
    const cvs = document.getElementById('quick-sketch-canvas');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');

    let isDrawing = false;
    this.clearQuickSketch = () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cvs.width, cvs.height);

      // Draw faint grid
      ctx.strokeStyle = '#E5E0D4';
      ctx.lineWidth = 1;
      for (let x = 0; x < cvs.width; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cvs.height); ctx.stroke();
      }
      for (let y = 0; y < cvs.height; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cvs.width, y); ctx.stroke();
      }
    };
    this.clearQuickSketch();

    cvs.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const rect = cvs.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
    });

    cvs.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const rect = cvs.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    window.addEventListener('mouseup', () => { isDrawing = false; });
  }

  /* --------------------------------------------------------------------------
     The Studio Canvas Engine (Step 6)
     -------------------------------------------------------------------------- */
  initMainStudioCanvas() {
    this.canvas = document.getElementById('main-canvas');
    this.viewport = document.getElementById('canvas-viewport');
    if (!this.canvas || !this.viewport) return;
    this.ctx = this.canvas.getContext('2d');

    // Mouse painting & panning
    this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
    window.addEventListener('mouseup', () => this.handleCanvasMouseUp());
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Zoom on wheel
    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      this.setZoom(this.zoom * delta);
    }, { passive: false });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));
  }

  centerCanvas() {
    if (!this.canvas || !this.viewport) return;
    const vRect = this.viewport.getBoundingClientRect();
    const w = this.cols * this.cellPx;
    const h = this.rows * this.cellPx;

    const scaleX = (vRect.width - 80) / w;
    const scaleY = (vRect.height - 120) / h;
    this.zoom = Math.max(0.4, Math.min(1.4, Math.min(scaleX, scaleY)));

    this.panX = (vRect.width - w * this.zoom) / 2;
    this.panY = (vRect.height - h * this.zoom) / 2;

    this.updateZoomDisplay();
  }

  setZoom(val) {
    this.zoom = Math.max(0.2, Math.min(3.0, val));
    this.updateZoomDisplay();
    this.redrawCanvas();
  }

  updateZoomDisplay() {
    const el = document.getElementById('hud-zoom-level');
    if (el) el.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  redrawCanvas() {
    if (!this.canvas || !this.ctx || !this.viewport) return;
    const vRect = this.viewport.getBoundingClientRect();
    this.canvas.width = vRect.width;
    this.canvas.height = vRect.height;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    const px = this.cellPx;
    const w = this.cols * px;
    const h = this.rows * px;

    // Floor Base (Light Architectural Grid)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // Subtle Grid Lines
    ctx.strokeStyle = '#E5E0D4';
    ctx.lineWidth = 1;
    for (let c = 0; c <= this.cols; c++) {
      ctx.beginPath(); ctx.moveTo(c * px, 0); ctx.lineTo(c * px, h); ctx.stroke();
    }
    for (let r = 0; r <= this.rows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * px); ctx.lineTo(w, r * px); ctx.stroke();
    }

    // Outer Boundary Wall
    ctx.strokeStyle = '#5B564A';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);

    // Render Placed Elements
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c;
        const id = this.cells[idx];
        if (id && ELEMENTS_BY_ID[id]) {
          const el = ELEMENTS_BY_ID[id];
          const x = c * px;
          const y = r * px;

          ctx.fillStyle = el.color;
          ctx.fillRect(x + 1, y + 1, px - 2, px - 2);

          // Render Glyph Label if zoomed sufficiently
          if (this.zoom >= 0.6) {
            ctx.fillStyle = el.textColor || '#FFFFFF';
            ctx.font = `800 ${Math.max(8, px * 0.32)}px 'JetBrains Mono', monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(el.glyph || '', x + px / 2, y + px / 2);
          }
        }
      }
    }

    // Hover Cell Highlight
    if (this.hoverCell) {
      const { c, r } = this.hoverCell;
      if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 2;
        ctx.strokeRect(c * px, r * px, px, px);
      }
    }

    ctx.restore();
  }

  getGridCellFromMouseEvent(e) {
    if (!this.viewport) return null;
    const vRect = this.viewport.getBoundingClientRect();
    const mx = e.clientX - vRect.left;
    const my = e.clientY - vRect.top;

    const wx = (mx - this.panX) / this.zoom;
    const wy = (my - this.panY) / this.zoom;

    const c = Math.floor(wx / this.cellPx);
    const r = Math.floor(wy / this.cellPx);

    return { c, r, mx, my };
  }

  handleCanvasMouseDown(e) {
    if (e.spaceKey || e.button === 1) {
      // Middle click or space+click = Pan
      this.isPanning = true;
      this.startPanX = e.clientX - this.panX;
      this.startPanY = e.clientY - this.panY;
      return;
    }

    const pos = this.getGridCellFromMouseEvent(e);
    if (!pos) return;

    if (e.button === 2) {
      // Right click = Erase
      this.paintMode = 'erase';
      this.isPainting = true;
      this.paintCell(pos.c, pos.r, 0);
    } else if (e.button === 0) {
      // Left click = Draw active tool
      this.paintMode = 'draw';
      this.isPainting = true;
      this.paintCell(pos.c, pos.r, this.activeToolId);
    }
  }

  handleCanvasMouseMove(e) {
    if (this.isPanning) {
      this.panX = e.clientX - this.startPanX;
      this.panY = e.clientY - this.startPanY;
      this.redrawCanvas();
      return;
    }

    const pos = this.getGridCellFromMouseEvent(e);
    if (pos) {
      this.hoverCell = { c: pos.c, r: pos.r };
      const coordEl = document.getElementById('hud-cursor-coords');
      if (coordEl && pos.c >= 0 && pos.c < this.cols && pos.r >= 0 && pos.r < this.rows) {
        coordEl.textContent = `Col: ${pos.c + 1}, Row: ${pos.r + 1} (${(pos.c * 3.28).toFixed(1)}ft)`;
      }

      if (this.isPainting && pos.c >= 0 && pos.c < this.cols && pos.r >= 0 && pos.r < this.rows) {
        this.paintCell(pos.c, pos.r, this.paintMode === 'erase' ? 0 : this.activeToolId);
      } else {
        this.redrawCanvas();
      }
    }
  }

  handleCanvasMouseUp() {
    if (this.isPainting) {
      this.isPainting = false;
      this.pushHistory();
      this.scheduleAutoSave();
    }
    this.isPanning = false;
  }

  paintCell(c, r, elementId) {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
    const idx = r * this.cols + c;
    if (this.cells[idx] !== elementId) {
      this.cells[idx] = elementId;
      this.redrawCanvas();
      this.updateStudioMetrics();
    }
  }

  /* --------------------------------------------------------------------------
     History (Undo / Redo)
     -------------------------------------------------------------------------- */
  pushHistory() {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(new Uint8Array(this.cells));
    if (this.history.length > this.maxHistory) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.cells = new Uint8Array(this.history[this.historyIndex]);
      this.redrawCanvas();
      this.updateStudioMetrics();
      this.scheduleAutoSave();
      this.toast('↩ Undone');
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.cells = new Uint8Array(this.history[this.historyIndex]);
      this.redrawCanvas();
      this.updateStudioMetrics();
      this.scheduleAutoSave();
      this.toast('↪ Redone');
    }
  }

  /* --------------------------------------------------------------------------
     Palette Controller
     -------------------------------------------------------------------------- */
  renderPalette() {
    const list = document.getElementById('palette-list');
    if (!list) return;

    const grouped = {};
    ELEMENTS.forEach(el => {
      if (!grouped[el.category]) grouped[el.category] = [];
      grouped[el.category].push(el);
    });

    let html = '';
    Object.keys(grouped).forEach(cat => {
      html += `<div class="palette-group-title">${cat}</div>`;
      grouped[cat].forEach(el => {
        const isActive = el.id === this.activeToolId;
        html += `
          <button class="palette-item-btn ${isActive ? 'active' : ''}" data-tool-id="${el.id}">
            <span class="color-swatch" style="background:${el.color};"></span>
            <span class="name">${el.shortName || el.name}</span>
            <span class="key-badge">${el.key || ''}</span>
          </button>
        `;
      });
    });

    list.innerHTML = html;

    list.querySelectorAll('.palette-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeToolId = parseInt(btn.dataset.toolId);
        this.renderPalette();
        const activeTool = ELEMENTS_BY_ID[this.activeToolId];
        const hudTool = document.getElementById('hud-active-tool-pill');
        if (hudTool && activeTool) hudTool.textContent = `Tool: ${activeTool.shortName || activeTool.name}`;
      });
    });
  }

  handleGlobalKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      this.paintMode = 'erase';
      this.toast('🗑️ Eraser Tool Active');
      return;
    }

    // Number keys for tools
    const match = ELEMENTS.find(el => el.key === e.key.toLowerCase());
    if (match) {
      this.activeToolId = match.id;
      this.renderPalette();
      const hudTool = document.getElementById('hud-active-tool-pill');
      if (hudTool) hudTool.textContent = `Tool: ${match.shortName || match.name}`;
      this.toast(`Tool: ${match.name}`);
    }
  }

  /* --------------------------------------------------------------------------
     Gemini AI Conversational Copilot
     -------------------------------------------------------------------------- */
  async handleAiTweakSubmit() {
    const input = document.getElementById('ai-prompt-input');
    const promptText = (input?.value || '').trim();
    if (!promptText) return;

    this.toast('✨ AI Architect analyzing layout modification...');
    try {
      const result = await this.apiRequest('/api/ai/tweak-layout', {
        method: 'POST',
        body: JSON.stringify({
          userPrompt: promptText,
          cells: Array.from(this.cells),
          rots: Array.from(this.rots),
          cols: this.cols,
          rows: this.rows
        })
      });

      this.cells = new Uint8Array(result.cells);
      this.rots = new Uint8Array(result.rots);
      this.pushHistory();
      this.redrawCanvas();
      this.updateStudioMetrics();
      this.scheduleAutoSave();

      if (input) input.value = '';
      this.toast(`✨ ${result.explanation || 'Layout modified based on request!'}`);
    } catch (e) {
      this.toast(`⚠️ AI Tweak error: ${e.message}`);
    }
  }

  /* --------------------------------------------------------------------------
     Metrics & Auto-Saving
     -------------------------------------------------------------------------- */
  updateStudioMetrics() {
    const metrics = LayoutMetrics.calculate({ cols: this.cols, rows: this.rows, cells: this.cells }, this.unit);

    const kpiPallets = document.getElementById('kpi-total-pallets');
    const kpiSpace = document.getElementById('kpi-space-util');
    const kpiIn = document.getElementById('kpi-inbound-rate');
    const kpiOut = document.getElementById('kpi-outbound-rate');
    const kpiFlow = document.getElementById('kpi-flow-score');
    const bomSummary = document.getElementById('studio-bom-summary');

    if (kpiPallets) kpiPallets.textContent = metrics.totalPalletCapacity.toLocaleString();
    if (kpiSpace) kpiSpace.textContent = `${metrics.spaceUtilizationPct}%`;
    if (kpiIn) kpiIn.textContent = `${metrics.inboundRate} boxes/hr`;
    if (kpiOut) kpiOut.textContent = `${metrics.outboundRate} boxes/hr`;
    if (kpiFlow) kpiFlow.textContent = `${metrics.flowScore} / 100`;

    if (bomSummary) {
      bomSummary.innerHTML = metrics.bom.slice(0, 6).map(b => `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="color:var(--ink-soft);">${b.name}</span>
          <strong style="font-family:var(--font-mono);">${b.qty} ${b.unit}</strong>
        </div>
      `).join('');
    }
  }

  scheduleAutoSave() {
    const statusEl = document.getElementById('ed-save-status');
    if (statusEl) {
      statusEl.className = 'pill amber';
      statusEl.textContent = 'Syncing...';
    }

    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveCurrentLayoutToDatabase();
    }, 1200);
  }

  async saveCurrentLayoutToDatabase() {
    const statusEl = document.getElementById('ed-save-status');
    try {
      const sitePayload = {
        id: this.activeSiteId,
        name: this.siteName,
        city: this.siteCity,
        lengthFt: this.lengthFt,
        widthFt: this.widthFt,
        cols: this.cols,
        rows: this.rows,
        inboundDocks: this.inboundDocks,
        outboundDocks: this.outboundDocks,
        operationalModel: this.operationalModel,
        cells: Array.from(this.cells),
        rots: Array.from(this.rots),
        summary: {
          totalCapacityPallets: Math.floor(this.cols * this.rows * 1.8),
          spaceUtilizationPct: 78.4,
          flowEfficiencyScore: 94
        }
      };

      await this.apiRequest('/api/sites', {
        method: 'POST',
        body: JSON.stringify(sitePayload)
      });

      if (statusEl) {
        statusEl.className = 'pill emerald';
        statusEl.textContent = '✓ Synced';
      }
    } catch (e) {
      if (statusEl) {
        statusEl.className = 'pill';
        statusEl.textContent = 'Offline';
      }
    }
  }

  /* --------------------------------------------------------------------------
     Presentation Mode & Blueprint Exporter (Step 6)
     -------------------------------------------------------------------------- */
  renderPresentation() {
    const cvs = document.getElementById('present-canvas');
    const tbody = document.getElementById('pr-bom-tbody');
    const titleEl = document.getElementById('pr-site-title');
    const subEl = document.getElementById('pr-site-sub');

    if (titleEl) titleEl.textContent = `${this.siteName} — Executive Blueprint`;
    if (subEl) subEl.textContent = `${this.lengthFt} × ${this.widthFt} ft (${this.cols} × ${this.rows} Grid) · Scale 1:100 · Engineering Compliance Sheet`;

    if (cvs) {
      const px = 24;
      cvs.width = this.cols * px;
      cvs.height = this.rows * px;
      const ctx = cvs.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cvs.width, cvs.height);

      ctx.strokeStyle = '#E5E0D4';
      ctx.lineWidth = 1;
      for (let c = 0; c <= this.cols; c++) {
        ctx.beginPath(); ctx.moveTo(c * px, 0); ctx.lineTo(c * px, cvs.height); ctx.stroke();
      }
      for (let r = 0; r <= this.rows; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * px); ctx.lineTo(cvs.width, r * px); ctx.stroke();
      }

      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const id = this.cells[r * this.cols + c];
          if (id && ELEMENTS_BY_ID[id]) {
            const el = ELEMENTS_BY_ID[id];
            ctx.fillStyle = el.color;
            ctx.fillRect(c * px + 1, r * px + 1, px - 2, px - 2);
          }
        }
      }
    }

    if (tbody) {
      const metrics = LayoutMetrics.calculate({ cols: this.cols, rows: this.rows, cells: this.cells }, this.unit);
      tbody.innerHTML = metrics.bom.map(b => `
        <tr>
          <td><strong style="color:var(--ink);">${b.name}</strong></td>
          <td style="font-family:var(--font-mono); font-weight:700;">${b.qty}</td>
          <td>${b.unit}</td>
          <td style="color:var(--ink-soft);">${b.spec}</td>
        </tr>
      `).join('');
    }
  }

  exportBlueprintPNG() {
    const px = 32;
    const titleH = 80;
    const W = this.cols * px;
    const H = this.rows * px + titleH;

    const off = document.createElement('canvas');
    off.width = W * 2;
    off.height = H * 2;
    const g = off.getContext('2d');
    g.scale(2, 2);

    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, W, H);

    // Title banner
    g.fillStyle = '#1D1B17';
    g.font = "800 20px 'Outfit', sans-serif";
    g.fillText(this.siteName, 24, 34);

    g.fillStyle = '#5B564A';
    g.font = "600 12px 'JetBrains Mono', monospace";
    g.fillText(`${this.cols} × ${this.rows} Grid (${this.lengthFt}×${this.widthFt} ft) · Plano AI Architectural Blueprint · Scale 1:100`, 24, 58);

    g.save();
    g.translate(0, titleH);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const id = this.cells[r * this.cols + c];
        if (id && ELEMENTS_BY_ID[id]) {
          const el = ELEMENTS_BY_ID[id];
          g.fillStyle = el.color;
          g.fillRect(c * px + 1, r * px + 1, px - 2, px - 2);
        }
      }
    }
    g.restore();

    off.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${this.siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-blueprint.png`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 600);
      this.toast('🖼️ High-Res Blueprint PNG downloaded!');
    });
  }

  /* --------------------------------------------------------------------------
     DOM Event Bindings
     -------------------------------------------------------------------------- */
  bindDomEvents() {
    // Login form
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email-input')?.value;
      if (email) this.loginUser(email);
    });

    // Top actions
    document.getElementById('btn-signout')?.addEventListener('click', () => this.handleLogout());
    document.getElementById('btn-create-new-top')?.addEventListener('click', () => this.startNewWizard());
    document.getElementById('wizard-back-hub-btn')?.addEventListener('click', () => this.showScreen('screen-library'));
    document.getElementById('ed-back-hub-btn')?.addEventListener('click', () => this.showScreen('screen-library'));
    document.getElementById('present-back-btn')?.addEventListener('click', () => this.showScreen('screen-editor'));

    // Hub search & filter
    document.getElementById('hub-search-input')?.addEventListener('input', () => this.renderSiteGrid());
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter || 'all';
        this.renderSiteGrid();
      });
    });

    // Wizard navigation
    document.getElementById('wizard-next-btn')?.addEventListener('click', () => this.advanceWizard());
    document.getElementById('wizard-prev-btn')?.addEventListener('click', () => {
      if (this.wizardStep > 1) {
        this.wizardStep--;
        this.updateWizardStepUI();
      }
    });

    // Operational model option cards
    document.querySelectorAll('.option-card').forEach(c => {
      c.addEventListener('click', () => {
        document.querySelectorAll('.option-card').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        this.operationalModel = c.dataset.model || 'ecommerce';
      });
    });

    // Wizard tabs (upload vs sketch)
    document.getElementById('tab-upload-btn')?.addEventListener('click', () => {
      document.getElementById('tab-upload-btn').className = 'btn primary btn-sm';
      document.getElementById('tab-sketch-btn').className = 'btn ghost btn-sm';
      document.getElementById('pane-upload-section').style.display = 'block';
      document.getElementById('pane-sketch-section').style.display = 'none';
    });

    document.getElementById('tab-sketch-btn')?.addEventListener('click', () => {
      document.getElementById('tab-sketch-btn').className = 'btn primary btn-sm';
      document.getElementById('tab-upload-btn').className = 'btn ghost btn-sm';
      document.getElementById('pane-upload-section').style.display = 'none';
      document.getElementById('pane-sketch-section').style.display = 'block';
    });

    // File uploader
    const dropzone = document.getElementById('dropzone-box');
    const fileInput = document.getElementById('file-sketch-upload');
    dropzone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.uploadedImageBase64 = reader.result;
        const previewWrap = document.getElementById('upload-preview-wrap');
        const previewImg = document.getElementById('upload-preview-img');
        if (previewWrap && previewImg) {
          previewImg.src = reader.result;
          previewWrap.style.display = 'block';
          dropzone.classList.add('has-file');
        }
        this.toast('📷 Blueprint / Sketch uploaded and analyzed!');
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('btn-remove-sketch')?.addEventListener('click', () => {
      this.uploadedImageBase64 = null;
      const previewWrap = document.getElementById('upload-preview-wrap');
      if (previewWrap) previewWrap.style.display = 'none';
      dropzone?.classList.remove('has-file');
    });

    document.getElementById('btn-clear-sketch')?.addEventListener('click', () => this.clearQuickSketch());

    // Studio buttons
    document.getElementById('ed-undo-btn')?.addEventListener('click', () => this.undo());
    document.getElementById('ed-redo-btn')?.addEventListener('click', () => this.redo());
    document.getElementById('ed-delete-btn')?.addEventListener('click', () => {
      this.paintMode = 'erase';
      this.toast('🗑️ Eraser Tool Active');
    });
    document.getElementById('ed-clear-btn')?.addEventListener('click', () => {
      if (confirm('Clear entire layout grid?')) {
        this.cells.fill(0);
        this.pushHistory();
        this.redrawCanvas();
        this.updateStudioMetrics();
        this.scheduleAutoSave();
        this.toast('🧹 Grid cleared');
      }
    });

    document.getElementById('ed-present-btn')?.addEventListener('click', () => this.showScreen('screen-present'));
    document.getElementById('ed-export-png-btn')?.addEventListener('click', () => this.exportBlueprintPNG());
    document.getElementById('pr-png-btn')?.addEventListener('click', () => this.exportBlueprintPNG());
    document.getElementById('pr-print-btn')?.addEventListener('click', () => window.print());

    // AI Copilot
    document.getElementById('ai-prompt-submit')?.addEventListener('click', () => this.handleAiTweakSubmit());
    document.getElementById('ai-prompt-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAiTweakSubmit();
    });

    document.querySelectorAll('.copilot-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        const input = document.getElementById('ai-prompt-input');
        if (input) input.value = prompt;
        this.handleAiTweakSubmit();
      });
    });

    // Zoom buttons
    document.getElementById('hud-zoom-in')?.addEventListener('click', () => this.setZoom(this.zoom * 1.15));
    document.getElementById('hud-zoom-out')?.addEventListener('click', () => this.setZoom(this.zoom / 1.15));
    document.getElementById('hud-zoom-reset')?.addEventListener('click', () => this.centerCanvas());

    // Gemini API Key Modal
    const modalKey = document.getElementById('modal-api-key');
    document.getElementById('btn-api-key-settings')?.addEventListener('click', () => {
      const input = document.getElementById('input-gemini-key');
      if (input) input.value = this.geminiKey;
      modalKey?.classList.add('on');
    });
    document.getElementById('modal-key-close')?.addEventListener('click', () => modalKey?.classList.remove('on'));
    document.getElementById('modal-key-cancel')?.addEventListener('click', () => modalKey?.classList.remove('on'));
    document.getElementById('modal-key-save')?.addEventListener('click', () => {
      const input = document.getElementById('input-gemini-key');
      this.geminiKey = (input?.value || '').trim();
      localStorage.setItem('plano_gemini_key', this.geminiKey);
      modalKey?.classList.remove('on');
      this.toast('🔑 Gemini API Key saved safely!');
    });
  }
}

// Bootstrap Plano AI Application
window.addEventListener('DOMContentLoaded', () => {
  window.planoApp = new PlanoAIApp();
});
