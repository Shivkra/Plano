/* ==========================================================================
   Canvas Undo / Redo History Stack
   ========================================================================== */

export class HistoryManager {
  constructor(maxDepth = 60) {
    this.maxDepth = maxDepth;
    this.undoStack = [];
    this.redoStack = [];
  }

  snapshot(grid) {
    const state = {
      cols: grid.cols,
      rows: grid.rows,
      cells: new Uint8Array(grid.cells),
      rots: new Uint8Array(grid.rots)
    };
    this.undoStack.push(state);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0; // Clear redo on new action
  }

  undo(grid) {
    if (!this.undoStack.length) return null;
    const currentState = {
      cols: grid.cols,
      rows: grid.rows,
      cells: new Uint8Array(grid.cells),
      rots: new Uint8Array(grid.rots)
    };
    this.redoStack.push(currentState);
    const prevState = this.undoStack.pop();
    this.applyState(grid, prevState);
    return grid;
  }

  redo(grid) {
    if (!this.redoStack.length) return null;
    const currentState = {
      cols: grid.cols,
      rows: grid.rows,
      cells: new Uint8Array(grid.cells),
      rots: new Uint8Array(grid.rots)
    };
    this.undoStack.push(currentState);
    const nextState = this.redoStack.pop();
    this.applyState(grid, nextState);
    return grid;
  }

  applyState(grid, state) {
    grid.cols = state.cols;
    grid.rows = state.rows;
    grid.cells = new Uint8Array(state.cells);
    grid.rots = new Uint8Array(state.rots);
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
