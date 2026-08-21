/* ==========================================================================
   Main Application & Lifecycle Coordinator
   ========================================================================== */

import { ELEMENTS, ELEMENTS_BY_ID } from './config/elements.js';
import { CanvasRenderer } from './canvas/renderer.js';
import { CanvasInteraction } from './canvas/interaction.js';
import { HistoryManager } from './canvas/history.js';
import { LayoutExporter } from './canvas/exporter.js';
import { WizardController } from './ui/wizard.js';
import { PaletteController } from './ui/palette.js';
import { InspectorController } from './ui/inspector.js';
import { TabController } from './ui/tabs.js';
import { LayoutMetrics } from './engine/metrics.js';

class PlanogramApp {
  constructor() {
    this.siteName = "Blitz Mother Hub — MH-BLR-01";
    this.unit = "metric"; // 'metric' | 'imperial'
    this.cellPx = 26;
    this.activeToolId = 1; // Standard Rack by default
    this.activeGridIndex = 0;

    this.grids = [
      {
        name: "Ground Floor Layout",
        cols: 46,
        rows: 30,
        cells: new Uint8Array(46 * 30),
        rots: new Uint8Array(46 * 30)
      }
    ];

    this.popoverCell = null;

    this.initCanvas();
    this.initControllers();
    this.bindHeaderEvents();
    this.bindKeyboardShortcuts();
    this.bindPopoverEvents();
    this.bindPresentationEvents();

    // Start with Wizard Open
    this.wizard.show();
  }

  get activeGrid() {
    return this.grids[this.activeGridIndex];
  }

  initCanvas() {
    this.canvas = document.getElementById('planogram-canvas');
    this.renderer = new CanvasRenderer(this.canvas);
    this.history = new HistoryManager();
    this.interaction = new CanvasInteraction(this.canvas, this);

    this.syncCanvasSize();
  }

  initControllers() {
    this.wizard = new WizardController(this);
    this.palette = new PaletteController(this);
    this.inspector = new InspectorController(this);
    this.tabs = new TabController(this);

    this.tabs.render();
    this.inspector.update();
  }

  syncCanvasSize() {
    const grid = this.activeGrid;
    this.renderer.resizeCanvas(grid.cols, grid.rows, this.cellPx);
    this.redraw();
  }

  redraw() {
    this.renderer.render(this.activeGrid, this.cellPx, {
      hoverCell: this.interaction.hoverCell,
      isPainting: this.interaction.isPainting
    });
  }

  onLayoutChanged() {
    this.palette.updateCounts();
    this.inspector.update();
    this.updateUndoRedoButtons();
    this.redraw();
  }

  setActiveTool(toolId) {
    this.activeToolId = toolId;
    this.palette.render();
  }

  setToolMode(mode) {
    this.interaction.toolMode = mode;
    this.updateToolModeUI();
  }

  updateToolModeUI() {
    document.querySelectorAll('.tool-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this.interaction.toolMode);
    });
  }

  updateCursorPos(cell) {
    const posEl = document.getElementById('cell-pos');
    if (!posEl) return;
    if (!cell) {
      posEl.textContent = '–';
    } else {
      posEl.textContent = `${this.renderer.colName(cell.c)}${cell.r + 1} (${(cell.c * 1.0).toFixed(1)}m, ${(cell.r * 1.0).toFixed(1)}m)`;
    }
  }

  loadSynthesizedLayout(name, layout) {
    this.siteName = name || "Quick-Commerce Darkstore";
    const siteInput = document.getElementById('layout-site-name');
    if (siteInput) siteInput.value = this.siteName;

    this.grids = [
      {
        name: "Main Floor",
        cols: layout.cols,
        rows: layout.rows,
        cells: layout.cells,
        rots: layout.rots
      }
    ];
    this.activeGridIndex = 0;
    this.history.clear();

    this.syncCanvasSize();
    this.tabs.render();
    this.onLayoutChanged();
  }

  addGrid(name, cols, rows) {
    const newGrid = {
      name,
      cols,
      rows,
      cells: new Uint8Array(cols * rows),
      rots: new Uint8Array(cols * rows)
    };
    this.grids.push(newGrid);
    this.switchGrid(this.grids.length - 1);
  }

  switchGrid(idx) {
    if (idx >= 0 && idx < this.grids.length) {
      this.activeGridIndex = idx;
      this.hidePopover();
      this.history.clear();
      this.syncCanvasSize();
      this.tabs.render();
      this.onLayoutChanged();
    }
  }

  deleteGrid(idx) {
    if (this.grids.length <= 1) return;
    this.grids.splice(idx, 1);
    if (this.activeGridIndex >= this.grids.length) {
      this.activeGridIndex = this.grids.length - 1;
    }
    this.switchGrid(this.activeGridIndex);
  }

  resizeActiveGrid(dc, dr) {
    const grid = this.activeGrid;
    const nc = Math.max(8, Math.min(120, grid.cols + dc));
    const nr = Math.max(8, Math.min(100, grid.rows + dr));

    this.history.snapshot(grid);

    const oldCells = grid.cells;
    const oldRots = grid.rots;
    const oc = grid.cols;
    const or_ = grid.rows;

    const newCells = new Uint8Array(nc * nr);
    const newRots = new Uint8Array(nc * nr);

    for (let r = 0; r < Math.min(nr, or_); r++) {
      for (let c = 0; c < Math.min(nc, oc); c++) {
        newCells[r * nc + c] = oldCells[r * oc + c];
        newRots[r * nc + c] = oldRots[r * oc + c];
      }
    }

    grid.cols = nc;
    grid.rows = nr;
    grid.cells = newCells;
    grid.rots = newRots;

    this.syncCanvasSize();
    this.onLayoutChanged();
  }

  shiftGrid(dc, dr) {
    const grid = this.activeGrid;
    this.history.snapshot(grid);

    const nc = new Uint8Array(grid.cols * grid.rows);
    const nr = new Uint8Array(grid.cols * grid.rows);

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const v = grid.cells[r * grid.cols + c];
        if (!v) continue;
        const c2 = c + dc;
        const r2 = r + dr;
        if (c2 >= 0 && c2 < grid.cols && r2 >= 0 && r2 < grid.rows) {
          nc[r2 * grid.cols + c2] = v;
          nr[r2 * grid.cols + c2] = grid.rots[r * grid.cols + c];
        }
      }
    }

    grid.cells = nc;
    grid.rots = nr;
    this.hidePopover();
    this.onLayoutChanged();
  }

  // Popover Context Menu for Element Deletion & Rotation
  showPopover(cell) {
    const grid = this.activeGrid;
    const v = grid.cells[cell.r * grid.cols + cell.c];
    if (!v) return;

    this.popoverCell = cell;
    const el = ELEMENTS_BY_ID[v];
    const pop = document.getElementById('element-popover');
    if (!pop || !el) return;

    document.getElementById('pop-element-name').textContent = `${el.name} · ${this.renderer.colName(cell.c)}${cell.r + 1}`;
    
    // Show rotate button if element supports rotation
    const rotBtn = document.getElementById('pop-rot-btn');
    if (rotBtn) {
      rotBtn.style.display = (el.rotatable || v === 4 || v === 30 || v === 31 || v === 32) ? 'inline-flex' : 'none';
    }

    const m = this.renderer.getMargin();
    const x = this.canvas.offsetLeft + m + cell.c * this.cellPx + this.cellPx / 2;
    const y = this.canvas.offsetTop + m + cell.r * this.cellPx - 6;

    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
    pop.classList.add('active');
  }

  hidePopover() {
    this.popoverCell = null;
    document.getElementById('element-popover')?.classList.remove('active');
  }

  bindPopoverEvents() {
    document.getElementById('pop-del-btn')?.addEventListener('click', () => {
      if (!this.popoverCell) return;
      const grid = this.activeGrid;
      this.history.snapshot(grid);
      const idx = this.popoverCell.r * grid.cols + this.popoverCell.c;
      grid.cells[idx] = 0;
      grid.rots[idx] = 0;
      this.hidePopover();
      this.onLayoutChanged();
    });

    document.getElementById('pop-rot-btn')?.addEventListener('click', () => {
      if (!this.popoverCell) return;
      const grid = this.activeGrid;
      const idx = this.popoverCell.r * grid.cols + this.popoverCell.c;
      this.history.snapshot(grid);
      grid.rots[idx] = (grid.rots[idx] + 1) & 3;
      this.onLayoutChanged();
    });

    document.getElementById('pop-close-btn')?.addEventListener('click', () => this.hidePopover());
  }

  bindHeaderEvents() {
    document.getElementById('layout-site-name')?.addEventListener('input', e => {
      this.siteName = e.target.value.trim() || 'Darkstore Layout';
    });

    document.getElementById('btn-undo')?.addEventListener('click', () => {
      this.history.undo(this.activeGrid);
      this.onLayoutChanged();
    });

    document.getElementById('btn-redo')?.addEventListener('click', () => {
      this.history.redo(this.activeGrid);
      this.onLayoutChanged();
    });

    document.getElementById('btn-clear')?.addEventListener('click', () => {
      if (confirm('Clear entire floor layout? This cannot be undone.')) {
        this.history.snapshot(this.activeGrid);
        this.activeGrid.cells.fill(0);
        this.activeGrid.rots.fill(0);
        this.onLayoutChanged();
      }
    });

    document.getElementById('btn-wizard')?.addEventListener('click', () => {
      this.wizard.show();
    });

    document.getElementById('btn-save-json')?.addEventListener('click', () => {
      LayoutExporter.saveJSON(this);
    });

    document.getElementById('btn-load-json')?.addEventListener('click', () => {
      document.getElementById('file-input-json')?.click();
    });

    document.getElementById('file-input-json')?.addEventListener('change', ev => {
      const f = ev.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          this.loadFromJSON(data);
        } catch (e) {
          alert('Could not open file: ' + e.message);
        }
      };
      reader.readAsText(f);
      ev.target.value = '';
    });

    document.getElementById('btn-export-png')?.addEventListener('click', () => {
      LayoutExporter.exportPNG(this);
    });

    document.getElementById('btn-presentation-mode')?.addEventListener('click', () => {
      this.openPresentationMode();
    });

    // Zoom slider
    document.getElementById('zoom-slider')?.addEventListener('input', e => {
      this.cellPx = parseInt(e.target.value, 10);
      this.hidePopover();
      this.syncCanvasSize();
    });

    // Tool modes buttons
    document.querySelectorAll('.tool-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.setToolMode(mode);
      });
    });
  }

  loadFromJSON(d) {
    if (!d || d.format !== 'darkstore-planogram') throw new Error('Not a valid planogram file');
    this.siteName = d.siteName || d.name || 'Darkstore Floor';
    const siteInput = document.getElementById('layout-site-name');
    if (siteInput) siteInput.value = this.siteName;

    if (Array.isArray(d.grids) && d.grids.length) {
      this.grids = d.grids.map(g => ({
        name: g.name || 'Floor 1',
        cols: g.cols,
        rows: g.rows,
        cells: new Uint8Array(g.cells),
        rots: new Uint8Array(g.rots || new Array(g.cells.length).fill(0))
      }));
      this.activeGridIndex = Math.min(Math.max(0, d.activeGridIndex || 0), this.grids.length - 1);
    } else if (Array.isArray(d.cells)) {
      this.grids = [
        {
          name: 'Main Floor',
          cols: d.cols,
          rows: d.rows,
          cells: new Uint8Array(d.cells),
          rots: new Uint8Array(d.rots || new Array(d.cells.length).fill(0))
        }
      ];
      this.activeGridIndex = 0;
    }

    this.history.clear();
    this.syncCanvasSize();
    this.tabs.render();
    this.onLayoutChanged();
  }

  updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = !this.history.canUndo();
    if (btnRedo) btnRedo.disabled = !this.history.canRedo();
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', ev => {
      if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;

      const key = ev.key.toLowerCase();

      // Undo / Redo
      if ((ev.metaKey || ev.ctrlKey) && key === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) {
          this.history.redo(this.activeGrid);
        } else {
          this.history.undo(this.activeGrid);
        }
        this.onLayoutChanged();
        return;
      }

      // Tool modes: B = Brush, L = Line, R = Rect, P = Picker, 0/E = Eraser
      if (key === 'b') { this.setToolMode('brush'); return; }
      if (key === 'l') { this.setToolMode('line'); return; }
      if (key === 'e' || key === '0') { this.setActiveTool(0); return; }

      // Elements shortcut map
      const matched = ELEMENTS.find(el => el.key.toLowerCase() === key);
      if (matched) {
        this.setActiveTool(matched.id);
      }
    });
  }

  // Executive Architectural Presentation Mode
  bindPresentationEvents() {
    document.getElementById('pres-close-btn')?.addEventListener('click', () => {
      document.getElementById('presentation-view').classList.add('hidden');
    });

    document.getElementById('pres-png-btn')?.addEventListener('click', () => {
      LayoutExporter.exportPNG(this);
    });

    document.getElementById('pres-print-btn')?.addEventListener('click', () => {
      window.print();
    });
  }

  openPresentationMode() {
    const presView = document.getElementById('presentation-view');
    const grid = this.activeGrid;
    const metrics = LayoutMetrics.calculate(grid, this.unit);

    // Populate Titles & Metadata
    document.getElementById('pres-title-facility').textContent = this.siteName;
    document.getElementById('pres-meta-grid').textContent = `${grid.cols} × ${grid.rows} Grid (${Math.round(metrics.totalFloorArea)} ${metrics.areaUnitStr})`;
    document.getElementById('pres-meta-capacity').textContent = `${metrics.hubSortWallCount} Hub Put-Walls · ${metrics.cityBigBinCount} City Big Bins`;
    document.getElementById('pres-meta-throughput').textContent = `~${metrics.estimatedThroughput.toLocaleString()} parcels/day (${metrics.totalDocks} Docks)`;
    document.getElementById('pres-meta-date').textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    // Render Preview Canvas
    const presCanvas = document.getElementById('presentation-canvas');
    if (presCanvas) {
      const presRenderer = new CanvasRenderer(presCanvas);
      presRenderer.showRulers = true;
      presRenderer.showRackLabels = true;
      presRenderer.resizeCanvas(grid.cols, grid.rows, 32);
      presRenderer.render(grid, 32, { forExport: true });
    }

    // Render Space Breakdown Table
    const tableBody = document.getElementById('pres-space-tbody');
    if (tableBody) {
      tableBody.innerHTML = Object.entries(metrics.categoryBreakdown).map(([cat, info]) => `
        <tr>
          <td><strong>${info.label || cat}</strong></td>
          <td style="font-family:var(--font-mono);">${info.count}</td>
          <td style="font-family:var(--font-mono);">${Math.round(info.area)} ${metrics.areaUnitStr}</td>
          <td style="font-family:var(--font-mono); font-weight:700;">${Math.round(info.percentage)}%</td>
        </tr>
      `).join('') + `
        <tr>
          <td><strong>TOTAL GROSS FLOOR</strong></td>
          <td style="font-family:var(--font-mono); font-weight:700;">${metrics.totalCells}</td>
          <td style="font-family:var(--font-mono); font-weight:700;">${Math.round(metrics.totalFloorArea)} ${metrics.areaUnitStr}</td>
          <td style="font-family:var(--font-mono); font-weight:700;">100%</td>
        </tr>
      `;
    }

    // Render Legend
    const legendContainer = document.getElementById('pres-legend-grid');
    if (legendContainer) {
      const counts = {};
      for (let i = 0; i < grid.cells.length; i++) {
        const id = grid.cells[i];
        if (id > 0) counts[id] = (counts[id] || 0) + 1;
      }

      legendContainer.innerHTML = Object.keys(counts).map(id => {
        const el = ELEMENTS_BY_ID[id];
        if (!el) return '';
        return `
          <div class="legend-item">
            <span class="legend-color-box" style="background:${el.color};"></span>
            <span><strong>${el.name}</strong> (×${counts[id]})</span>
          </div>
        `;
      }).join('');
    }

    presView.classList.remove('hidden');
  }
}

// Instantiate on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new PlanogramApp();
});
