/* ==========================================================================
   Properties & Layout Compliance Inspector Sidebar
   ========================================================================== */

import { LayoutValidator } from '../engine/validator.js';
import { LayoutMetrics } from '../engine/metrics.js';

export class InspectorController {
  constructor(app) {
    this.app = app;
    this.complianceContainer = document.getElementById('compliance-list');
    this.utilContainer = document.getElementById('utilization-breakdown');
    this.statsContainer = document.getElementById('operational-stats');

    this.initControls();
  }

  initControls() {
    // Dimension Steppers
    document.getElementById('col-add-btn')?.addEventListener('click', () => this.app.resizeActiveGrid(1, 0));
    document.getElementById('col-del-btn')?.addEventListener('click', () => this.app.resizeActiveGrid(-1, 0));
    document.getElementById('row-add-btn')?.addEventListener('click', () => this.app.resizeActiveGrid(0, 1));
    document.getElementById('row-del-btn')?.addEventListener('click', () => this.app.resizeActiveGrid(0, -1));

    // Shift Grid Controls
    document.querySelectorAll('[data-shift]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [dc, dr] = btn.dataset.shift.split(',').map(Number);
        this.app.shiftGrid(dc, dr);
      });
    });

    // Option Toggles
    document.getElementById('opt-labels')?.addEventListener('change', e => {
      this.app.renderer.showRackLabels = e.target.checked;
      this.app.redraw();
    });

    document.getElementById('opt-coords')?.addEventListener('change', e => {
      this.app.renderer.showRulers = e.target.checked;
      this.app.renderer.resizeCanvas(this.app.activeGrid.cols, this.app.activeGrid.rows, this.app.cellPx);
      this.app.redraw();
    });
  }

  update() {
    const grid = this.app.activeGrid;
    if (!grid) return;

    // Update Dimension Indicators
    const colCountEl = document.getElementById('inspect-cols-n');
    const rowCountEl = document.getElementById('inspect-rows-n');
    if (colCountEl) colCountEl.textContent = grid.cols;
    if (rowCountEl) rowCountEl.textContent = grid.rows;

    const badge = document.getElementById('dim-badge');
    if (badge) badge.textContent = `${grid.cols} × ${grid.rows} (${grid.cols * grid.rows}m²)`;

    // 1. Run Real-Time Compliance Auditor
    const audits = LayoutValidator.auditLayout(grid);
    if (this.complianceContainer) {
      this.complianceContainer.innerHTML = audits.map(a => `
        <div class="compliance-pill ${a.type}">
          <span>${a.type === 'pass' ? '✓' : (a.type === 'warn' ? '⚠' : '✖')}</span>
          <div>
            <strong>${a.title}</strong>
            <p>${a.detail}</p>
          </div>
        </div>
      `).join('');
    }

    // 2. Space Utilization Progress & Breakdown
    const metrics = LayoutMetrics.calculate(grid, this.app.unit);
    if (this.utilContainer) {
      const sortPct = Math.round(metrics.categoryBreakdown['Sortation & Segregation']?.percentage || 0);
      const stagePct = Math.round(metrics.categoryBreakdown['Trolley & Pallet Staging']?.percentage || 0);
      const logPct = Math.round(metrics.categoryBreakdown['Linehaul Docking Bays']?.percentage || 0);
      const circPct = Math.round(metrics.categoryBreakdown['Trolley Transit Aisles']?.percentage || 0);
      const adminPct = Math.round(metrics.categoryBreakdown['Admin & Life Safety']?.percentage || 0);
      const storePct = Math.round(metrics.categoryBreakdown['Buffer Pallet Storage']?.percentage || 0);

      this.utilContainer.innerHTML = `
        <div class="utilization-bar-container">
          <div class="util-label">
            <span>Floor Utilization</span>
            <strong>${Math.round(metrics.occupancyPercentage)}%</strong>
          </div>
          <div class="util-track">
            <div class="util-segment" style="width:${sortPct}%; background:#8b5cf6;" title="Sortation: ${sortPct}%"></div>
            <div class="util-segment" style="width:${logPct}%; background:#0284c7;" title="Docking: ${logPct}%"></div>
            <div class="util-segment" style="width:${stagePct}%; background:#e11d48;" title="Staging: ${stagePct}%"></div>
            <div class="util-segment" style="width:${adminPct}%; background:#d97706;" title="Admin: ${adminPct}%"></div>
          </div>
        </div>
        <div style="font-size:11px; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px;">
          <div class="flex-between"><span>⚡ Sorter & Put-Walls:</span> <strong>${sortPct}% (${Math.round(metrics.categoryBreakdown['Sortation & Segregation']?.area || 0)} ${metrics.areaUnitStr})</strong></div>
          <div class="flex-between"><span>🚛 Linehaul Docks & Aprons:</span> <strong>${logPct}% (${Math.round(metrics.categoryBreakdown['Linehaul Docking Bays']?.area || 0)} ${metrics.areaUnitStr})</strong></div>
          <div class="flex-between"><span>🛒 Trolley & Outbound Staging:</span> <strong>${stagePct}% (${Math.round(metrics.categoryBreakdown['Trolley & Pallet Staging']?.area || 0)} ${metrics.areaUnitStr})</strong></div>
          <div class="flex-between"><span>🚶 Heavy Trolley Aisles:</span> <strong>${circPct}% (${Math.round(metrics.categoryBreakdown['Trolley Transit Aisles']?.area || 0)} ${metrics.areaUnitStr})</strong></div>
        </div>
      `;
    }

    // 3. Operational Throughput & Mother Hub Stats
    if (this.statsContainer) {
      this.statsContainer.innerHTML = `
        <div class="flex-between" style="padding:4px 0; border-bottom:1px solid var(--border-subtle);">
          <span style="color:var(--text-secondary)">Hub-Level Put-Walls:</span>
          <strong style="color:#8b5cf6;">${metrics.hubSortWallCount} Area Matrices</strong>
        </div>
        <div class="flex-between" style="padding:4px 0; border-bottom:1px solid var(--border-subtle);">
          <span style="color:var(--text-secondary)">Inter-City Big Bins:</span>
          <strong style="color:#d946ef;">${metrics.cityBigBinCount} City Gaylords</strong>
        </div>
        <div class="flex-between" style="padding:4px 0; border-bottom:1px solid var(--border-subtle);">
          <span style="color:var(--text-secondary)">Linehaul Dock Doors:</span>
          <strong>${metrics.totalDocks} Bays (${metrics.inDockCount} In / ${metrics.outDockCount} Out)</strong>
        </div>
        <div class="flex-between" style="padding:4px 0;">
          <span style="color:var(--text-secondary)">Daily Sorter Throughput:</span>
          <strong style="color:#34d399;">~${metrics.estimatedThroughput.toLocaleString()} parcels/day</strong>
        </div>
      `;
    }

    // Status bar summary
    const statUsedEl = document.getElementById('stat-used');
    const statOccEl = document.getElementById('stat-occ');
    if (statUsedEl) statUsedEl.textContent = `${metrics.occupiedCells} cells used (${Math.round(metrics.totalFloorArea)} ${metrics.areaUnitStr})`;
    if (statOccEl) statOccEl.textContent = `${Math.round(metrics.occupancyPercentage)}% occupancy`;
  }
}
