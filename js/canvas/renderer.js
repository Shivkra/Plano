/* ==========================================================================
   Ultra-High-Definition Architectural Canvas Rendering Engine
   ========================================================================== */

import { ELEMENTS_BY_ID } from '../config/elements.js';

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.showRulers = true;
    this.showRackLabels = true;
    this.rulerMargin = 30;
  }

  getMargin() {
    return this.showRulers ? this.rulerMargin : 6;
  }

  resizeCanvas(cols, rows, cellPx) {
    const dpr = window.devicePixelRatio || 1;
    const m = this.getMargin();
    const w = cols * cellPx + m + 8;
    const h = rows * cellPx + m + 8;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  colName(i) {
    let s = "";
    i++;
    while (i > 0) {
      i--;
      s = String.fromCharCode(65 + (i % 26)) + s;
      i = Math.floor(i / 26);
    }
    return s;
  }

  computeRackLabels(grid) {
    const { cols, rows, cells } = grid;
    const rackLabels = [];
    if (!this.showRackLabels) return rackLabels;

    const inRun = new Uint8Array(cols * rows);
    let n = 1;

    // Horizontal runs
    for (let r = 0; r < rows; r++) {
      let c = 0;
      while (c < cols) {
        const v = cells[r * cols + c];
        if (v === 1 || v === 2) {
          let e = c;
          while (e + 1 < cols && (cells[r * cols + e + 1] === 1 || cells[r * cols + e + 1] === 2)) e++;
          if (e > c) {
            rackLabels.push({ c, r, label: `R${n < 10 ? '0' + n : n}` });
            for (let x = c; x <= e; x++) inRun[r * cols + x] = 1;
            n++;
          }
          c = e + 1;
        } else c++;
      }
    }

    // Vertical runs
    for (let c = 0; c < cols; c++) {
      let r = 0;
      while (r < rows) {
        const v = cells[r * cols + c];
        if ((v === 1 || v === 2) && !inRun[r * cols + c]) {
          let e = r;
          while (e + 1 < rows && (cells[(e + 1) * cols + c] === 1 || cells[(e + 1) * cols + c] === 2) && !inRun[(e + 1) * cols + c]) e++;
          if (e > r) {
            rackLabels.push({ c, r, label: `R${n < 10 ? '0' + n : n}` });
            for (let y = r; y <= e; y++) inRun[y * cols + c] = 1;
            n++;
          }
          r = e + 1;
        } else r++;
      }
    }

    return rackLabels.sort((a, b) => a.r - b.r || a.c - b.c);
  }

  drawRoundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  render(grid, cellPx, options = {}) {
    const g = options.ctx || this.ctx;
    const { cols, rows, cells, rots } = grid;
    const m = this.getMargin();
    const W = cols * cellPx;
    const H = rows * cellPx;
    const isExport = !!options.forExport;

    if (!options.ctx) {
      g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // 1. Warehouse Floor Slab
    g.fillStyle = isExport ? "#ffffff" : "#0a0e17";
    g.fillRect(m, m, W, H);

    // 2. High-Precision Grid Lines
    g.strokeStyle = isExport ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.04)";
    g.lineWidth = 1;
    g.beginPath();
    for (let c = 0; c <= cols; c++) {
      g.moveTo(m + c * cellPx + 0.5, m);
      g.lineTo(m + c * cellPx + 0.5, m + H);
    }
    for (let r = 0; r <= rows; r++) {
      g.moveTo(m, m + r * cellPx + 0.5);
      g.lineTo(m + W, m + r * cellPx + 0.5);
    }
    g.stroke();

    // 3. Render Architectural Elements
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = cells[r * cols + c];
        if (!val) continue;

        const el = ELEMENTS_BY_ID[val];
        if (!el) continue;

        const x = m + c * cellPx;
        const y = m + r * cellPx;
        const pad = Math.max(1, cellPx * 0.05);
        const sz = cellPx - 2 * pad;
        const rot = rots ? rots[r * cols + c] || 0 : 0;

        // Base Element Background
        g.fillStyle = el.color;
        this.drawRoundRect(g, x + pad, y + pad, sz, sz, Math.max(2, cellPx * 0.12));
        g.fill();

        // Architectural Details per element type:
        if (val === 1 || val === 2) {
          // --- STORAGE RACKS (Render internal shelf beam slots) ---
          g.fillStyle = "rgba(0, 0, 0, 0.18)";
          g.fillRect(x + pad + 2, y + pad + 2, sz - 4, sz - 4);

          g.strokeStyle = val === 2 ? "rgba(6, 182, 212, 0.6)" : "rgba(255, 255, 255, 0.3)";
          g.lineWidth = 1;
          // Internal rack dividing shelf lines
          const shelfStep = sz / 3;
          g.beginPath();
          g.moveTo(x + pad + 2, y + pad + shelfStep);
          g.lineTo(x + pad + sz - 2, y + pad + shelfStep);
          g.moveTo(x + pad + 2, y + pad + shelfStep * 2);
          g.lineTo(x + pad + sz - 2, y + pad + shelfStep * 2);
          g.stroke();

          // Corner Upright Post Accents
          g.fillStyle = val === 2 ? "#e0f2fe" : "#ffffff";
          const dotSz = Math.max(2, cellPx * 0.08);
          g.fillRect(x + pad + 1, y + pad + 1, dotSz, dotSz);
          g.fillRect(x + pad + sz - 1 - dotSz, y + pad + 1, dotSz, dotSz);
          g.fillRect(x + pad + 1, y + pad + sz - 1 - dotSz, dotSz, dotSz);
          g.fillRect(x + pad + sz - 1 - dotSz, y + pad + sz - 1 - dotSz, dotSz);

        } else if (val === 4) {
          // --- CONVEYOR BELT (Dynamic rollers & flow arrows) ---
          g.save();
          g.translate(x + cellPx / 2, y + cellPx / 2);
          g.rotate((rot * Math.PI) / 2);

          // Dark Belt Track
          g.fillStyle = "#1e293b";
          g.fillRect(-sz/2 + 2, -sz/2 + 4, sz - 4, sz - 8);

          // Roller Bars
          g.strokeStyle = "rgba(255, 255, 255, 0.25)";
          g.lineWidth = 1;
          for (let ro = -sz/2 + 6; ro < sz/2 - 4; ro += 4) {
            g.beginPath();
            g.moveTo(ro, -sz/2 + 4);
            g.lineTo(ro, sz/2 - 4);
            g.stroke();
          }

          // Flow Direction Chevrons
          g.strokeStyle = "#f59e0b";
          g.lineWidth = Math.max(2, cellPx * 0.12);
          g.lineJoin = "round";
          g.lineCap = "round";
          const s = cellPx * 0.16;
          for (const off of [-s * 1.5, 0, s * 1.5]) {
            g.beginPath();
            g.moveTo(off - s * 0.6, -s * 0.8);
            g.lineTo(off + s * 0.6, 0);
            g.lineTo(off - s * 0.6, s * 0.8);
            g.stroke();
          }
          g.restore();

        } else if (val === 10 || val === 11) {
          // --- VEHICLE DOCK BAYS (Roller Shutter Lines) ---
          g.strokeStyle = "rgba(0, 0, 0, 0.4)";
          g.lineWidth = 1.5;
          for (let sy = y + pad + 3; sy < y + pad + sz - 2; sy += 3.5) {
            g.beginPath();
            g.moveTo(x + pad + 3, sy);
            g.lineTo(x + pad + sz - 3, sy);
            g.stroke();
          }
          // Dock Badge
          g.fillStyle = el.textColor || "#ffffff";
          g.font = `800 ${Math.floor(cellPx * 0.3)}px "JetBrains Mono", monospace`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(val === 10 ? "IN" : "OUT", x + cellPx / 2, y + cellPx / 2);

        } else if (val === 34) {
          // --- PERIMETER WALL HATCHING ---
          g.save();
          g.beginPath();
          this.drawRoundRect(g, x + pad, y + pad, sz, sz, Math.max(2, cellPx * 0.12));
          g.clip();
          g.strokeStyle = "rgba(0, 0, 0, 0.4)";
          g.lineWidth = Math.max(1.5, cellPx * 0.09);
          for (let i = -cellPx; i < cellPx * 2; i += cellPx / 2.5) {
            g.beginPath();
            g.moveTo(x + i, y + cellPx);
            g.lineTo(x + i + cellPx, y);
            g.stroke();
          }
          g.restore();

        } else if (val === 33) {
          // --- STRUCTURAL COLUMN (I-Beam / Cross Reinforcement) ---
          g.fillStyle = "#0f172a";
          g.fillRect(x + cellPx * 0.2, y + cellPx * 0.2, cellPx * 0.6, cellPx * 0.6);
          g.strokeStyle = "#94a3b8";
          g.lineWidth = 1.5;
          g.strokeRect(x + cellPx * 0.2, y + cellPx * 0.2, cellPx * 0.6, cellPx * 0.6);
          // Diagonal cross
          g.beginPath();
          g.moveTo(x + cellPx * 0.2, y + cellPx * 0.2);
          g.lineTo(x + cellPx * 0.8, y + cellPx * 0.8);
          g.moveTo(x + cellPx * 0.8, y + cellPx * 0.2);
          g.lineTo(x + cellPx * 0.2, y + cellPx * 0.8);
          g.stroke();

        } else if (val === 30 || val === 31 || val === 32) {
          // --- DOORS & EMERGENCY EXITS ---
          g.save();
          g.translate(x + cellPx / 2, y + cellPx / 2);
          g.rotate((rot * Math.PI) / 2 + (val === 31 ? Math.PI : 0));
          const s = cellPx * 0.26;
          g.fillStyle = "#ffffff";
          g.beginPath();
          g.moveTo(s * 1.3, 0);
          g.lineTo(-s, -s * 0.9);
          g.lineTo(-s * 0.3, 0);
          g.lineTo(-s, s * 0.9);
          g.closePath();
          g.fill();
          g.restore();

        } else if (cellPx >= 16 && el.glyph) {
          // Standard Room / Packing Glyphs
          g.fillStyle = el.textColor || "#ffffff";
          const fontSize = Math.floor(cellPx * (el.glyph.length > 3 ? 0.26 : 0.36));
          g.font = `800 ${fontSize}px "Outfit", "Inter", sans-serif`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(el.glyph, x + cellPx / 2, y + cellPx / 2 + 1);
        }
      }
    }

    // 4. Warehouse Outer Perimeter Wall Frame
    g.strokeStyle = isExport ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.4)";
    g.lineWidth = 2.5;
    g.strokeRect(m, m, W, H);

    // 5. Sleek Auto-Numbered Rack Aisle Badges
    const rackLabels = this.computeRackLabels(grid);
    if (rackLabels.length && cellPx >= 16) {
      g.font = `700 ${Math.max(9, Math.floor(cellPx * 0.28))}px "JetBrains Mono", monospace`;
      g.textAlign = "left";
      g.textBaseline = "top";
      for (const rl of rackLabels) {
        const lx = m + rl.c * cellPx + 3;
        const ly = m + rl.r * cellPx + 3;
        const tw = g.measureText(rl.label).width + 8;
        g.fillStyle = "rgba(15, 23, 42, 0.92)";
        this.drawRoundRect(g, lx, ly, tw, Math.max(13, cellPx * 0.36), 4);
        g.fill();
        g.strokeStyle = "rgba(255, 255, 255, 0.15)";
        g.lineWidth = 1;
        g.stroke();
        g.fillStyle = "#ffffff";
        g.fillText(rl.label, lx + 4, ly + 2);
      }
    }

    // 6. Architectural Coordinate Rulers
    if (this.showRulers && m >= this.rulerMargin) {
      g.fillStyle = isExport ? "#475569" : "#64748b";
      g.font = `600 ${Math.max(10, Math.min(12, cellPx * 0.36))}px "JetBrains Mono", monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";

      const step = cellPx < 18 ? 2 : 1;
      for (let c = 0; c < cols; c += step) {
        g.fillText(this.colName(c), m + c * cellPx + cellPx / 2, m / 2 + 2);
      }

      g.textAlign = "right";
      for (let r = 0; r < rows; r += step) {
        g.fillText(r + 1, m - 8, m + r * cellPx + cellPx / 2);
      }
    }

    // 7. Dynamic Hover Indicator
    if (options.hoverCell && !options.isPainting) {
      const { c, r } = options.hoverCell;
      g.strokeStyle = "#818cf8";
      g.lineWidth = 2;
      g.strokeRect(m + c * cellPx + 1, m + r * cellPx + 1, cellPx - 2, cellPx - 2);
    }
  }
}
