/* ==========================================================================
   Interactive Canvas Interaction & Tool Controller
   ========================================================================== */

import { ELEMENTS_BY_ID } from '../config/elements.js';

export class CanvasInteraction {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.app = app;

    this.isPainting = false;
    this.strokeAnchor = null;
    this.lastCell = null;
    this.pendingCell = null;
    this.strokeStarted = false;
    this.strokeErase = false;
    this.hoverCell = null;

    // Tool Modes: 'brush' | 'line' | 'rect' | 'picker' | 'eraser'
    this.toolMode = 'brush';

    this.initEvents();
  }

  cellFromEvent(ev) {
    const rect = this.canvas.getBoundingClientRect();
    const m = this.app.renderer.getMargin();
    const cellPx = this.app.cellPx;
    const grid = this.app.activeGrid;

    // Direct pixel coordinate mapping
    const clientX = ev.clientX;
    const clientY = ev.clientY;

    const c = Math.floor((clientX - rect.left - m) / cellPx);
    const r = Math.floor((clientY - rect.top - m) / cellPx);

    if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return null;
    return { c, r };
  }

  initEvents() {
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    this.canvas.addEventListener('pointerdown', ev => {
      this.app.hidePopover();
      const cell = this.cellFromEvent(ev);
      if (!cell) return;

      this.canvas.setPointerCapture(ev.pointerId);
      this.isPainting = true;
      this.strokeAnchor = cell;
      this.lastCell = cell;

      const isRightClick = ev.button === 2;
      this.strokeErase = isRightClick || this.toolMode === 'eraser' || this.app.activeToolId === 0;

      const grid = this.app.activeGrid;
      const currentVal = grid.cells[cell.r * grid.cols + cell.c];

      // Eyedropper tool mode
      if (this.toolMode === 'picker') {
        if (currentVal > 0) {
          this.app.setActiveTool(currentVal);
          this.toolMode = 'brush';
          this.app.updateToolModeUI();
        }
        this.isPainting = false;
        return;
      }

      // If clicking directly on an existing element, delay action to check for click vs drag
      if (!this.strokeErase && currentVal !== 0 && this.toolMode === 'brush') {
        this.pendingCell = cell;
        this.strokeStarted = false;
        return;
      }

      this.pendingCell = null;
      this.strokeStarted = true;
      this.app.history.snapshot(grid);

      const valToSet = this.strokeErase ? 0 : this.app.activeToolId;
      this.setCell(cell.c, cell.r, valToSet);
      this.app.redraw();
    });

    this.canvas.addEventListener('pointermove', ev => {
      const cell = this.cellFromEvent(ev);
      this.app.updateCursorPos(cell);

      if (!this.isPainting) {
        if ((cell && (!this.hoverCell || cell.c !== this.hoverCell.c || cell.r !== this.hoverCell.r)) || (!cell && this.hoverCell)) {
          this.hoverCell = cell;
          this.app.redraw();
        }
        return;
      }

      if (!cell) return;
      const grid = this.app.activeGrid;
      const valToSet = this.strokeErase ? 0 : this.app.activeToolId;

      if (!this.strokeStarted) {
        if (cell.c === this.strokeAnchor.c && cell.r === this.strokeAnchor.r) return;
        this.strokeStarted = true;
        this.pendingCell = null;
        this.app.history.snapshot(grid);
        this.setCell(this.strokeAnchor.c, this.strokeAnchor.r, valToSet);
      }

      if (this.toolMode === 'rect' && this.strokeAnchor) {
        // Rectangle fill mode: preview rectangle
        this.restoreTopSnapshot();
        const minC = Math.min(this.strokeAnchor.c, cell.c);
        const maxC = Math.max(this.strokeAnchor.c, cell.c);
        const minR = Math.min(this.strokeAnchor.r, cell.r);
        const maxR = Math.max(this.strokeAnchor.r, cell.r);
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            this.setCell(c, r, valToSet);
          }
        }
      } else if ((this.toolMode === 'line' || ev.shiftKey) && this.strokeAnchor) {
        // Straight line / rack run lock mode
        this.restoreTopSnapshot();
        const dc = Math.abs(cell.c - this.strokeAnchor.c);
        const dr = Math.abs(cell.r - this.strokeAnchor.r);
        const end = dc >= dr ? { c: cell.c, r: this.strokeAnchor.r } : { c: this.strokeAnchor.c, r: cell.r };
        this.paintLine(this.strokeAnchor, end, valToSet);
      } else if (this.lastCell && (cell.c !== this.lastCell.c || cell.r !== this.lastCell.r)) {
        // Continuous brush painting with Bresenham interpolation
        this.paintLine(this.lastCell, cell, valToSet);
      }

      this.lastCell = cell;
      this.app.redraw();
    });

    const finishStroke = () => {
      if (this.isPainting && !this.strokeStarted && this.pendingCell) {
        this.app.showPopover(this.pendingCell);
      }
      this.isPainting = false;
      this.strokeAnchor = null;
      this.lastCell = null;
      this.pendingCell = null;
      this.strokeStarted = false;
      this.app.onLayoutChanged();
    };

    this.canvas.addEventListener('pointerup', finishStroke);
    this.canvas.addEventListener('pointercancel', finishStroke);
    this.canvas.addEventListener('pointerleave', () => {
      if (!this.isPainting) {
        this.hoverCell = null;
        this.app.updateCursorPos(null);
        this.app.redraw();
      }
    });
  }

  setCell(c, r, val, rot = 0) {
    const grid = this.app.activeGrid;
    if (c >= 0 && c < grid.cols && r >= 0 && r < grid.rows) {
      const idx = r * grid.cols + c;
      grid.cells[idx] = val;
      grid.rots[idx] = rot;
    }
  }

  paintLine(a, b, val) {
    let x0 = a.c, y0 = a.r, x1 = b.c, y1 = b.r;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.setCell(x0, y0, val);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  restoreTopSnapshot() {
    const stack = this.app.history.undoStack;
    if (!stack.length) return;
    const top = stack[stack.length - 1];
    this.app.activeGrid.cells.set(top.cells);
    this.app.activeGrid.rots.set(top.rots);
  }
}
