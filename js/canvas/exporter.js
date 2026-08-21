/* ==========================================================================
   Presentation Exporter & File Serialization (PNG, PDF, JSON)
   ========================================================================== */

import { ELEMENTS_BY_ID } from '../config/elements.js';
import { LayoutMetrics } from '../engine/metrics.js';

export class LayoutExporter {
  static exportPNG(app) {
    const grid = app.activeGrid;
    const { cols, rows } = grid;
    const px = 36; // High-resolution cell pixel size
    const m = 44;
    const titleH = 80;
    const legendH = 100;
    const W = cols * px + m * 2;
    const H = rows * px + m + titleH + legendH;

    const canvas = document.createElement('canvas');
    const scale = 2; // 2x Retina resolution
    canvas.width = W * scale;
    canvas.height = H * scale;
    const g = canvas.getContext('2d');
    g.scale(scale, scale);

    // 1. Executive White Sheet Background
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);

    // Border and Blueprint Line
    g.strokeStyle = '#0f172a';
    g.lineWidth = 3;
    g.strokeRect(16, 16, W - 32, H - 32);
    g.strokeStyle = '#cbd5e1';
    g.lineWidth = 1;
    g.strokeRect(22, 22, W - 44, H - 44);

    // 2. Executive Title Block with Brand Logo
    const logoImg = new Image();
    logoImg.src = 'assets/logo.png';
    logoImg.onload = () => {
      try {
        g.drawImage(logoImg, m, 26, 40, 40);
      } catch (e) {}
    };

    g.fillStyle = '#0f172a';
    g.font = '800 22px "Outfit", "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    const siteTitle = `${app.siteName} — ${grid.name}`;
    g.fillText(siteTitle, m + 50, 26);

    g.fillStyle = '#64748b';
    g.font = '500 12px "JetBrains Mono", monospace';
    const metrics = LayoutMetrics.calculate(grid, app.unit);
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const subtext = `Scale: 1:100 (1 cell = 1.0m) · Floor Area: ${Math.round(metrics.totalFloorArea)} ${metrics.areaUnitStr} · ${grid.cols}×${grid.rows} Grid · Exported: ${dateStr}`;
    g.fillText(subtext, m + 50, 52);

    // 3. Render Canvas Floorplan
    g.save();
    g.translate(m - app.renderer.getMargin(), titleH);
    app.renderer.render(grid, px, { forExport: true, ctx: g });
    g.restore();

    // 4. Architectural Legend & Space Breakdown
    const ly = titleH + rows * px + 28;
    let lx = m;
    g.font = '600 12px "Inter", -apple-system, sans-serif';
    g.textBaseline = 'middle';

    const counts = {};
    for (let i = 0; i < grid.cells.length; i++) {
      const id = grid.cells[i];
      if (id > 0) counts[id] = (counts[id] || 0) + 1;
    }

    Object.keys(counts).forEach(id => {
      const el = ELEMENTS_BY_ID[id];
      if (!el) return;

      g.fillStyle = el.color;
      app.renderer.drawRoundRect(g, lx, ly, 16, 16, 3);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.15)';
      g.stroke();

      g.fillStyle = '#1e293b';
      g.textAlign = 'left';
      const label = `${el.name} (×${counts[id]})`;
      g.fillText(label, lx + 22, ly + 8);

      lx += 24 + g.measureText(label).width + 20;
      if (lx > W - 180) {
        lx = m; // Wrap legend row
      }
    });

    canvas.toBlob(blob => {
      this.downloadBlob(blob, `${this.slug(app.siteName)}-${this.slug(grid.name)}-layout.png`);
    });
  }

  static saveJSON(app) {
    const data = {
      format: 'darkstore-planogram',
      version: 2,
      siteName: app.siteName,
      unit: app.unit,
      activeGridIndex: app.activeGridIndex,
      grids: app.grids.map(g => ({
        name: g.name,
        cols: g.cols,
        rows: g.rows,
        cells: Array.from(g.cells),
        rots: Array.from(g.rots)
      })),
      savedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, `${this.slug(app.siteName)}-planogram.json`);
  }

  static slug(s) {
    return (s || 'darkstore')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'darkstore';
  }

  static downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }
}
