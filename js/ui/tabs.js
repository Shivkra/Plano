/* ==========================================================================
   Multi-Grid Floor Tabs Controller
   ========================================================================== */

export class TabController {
  constructor(app) {
    this.app = app;
    this.tabList = document.getElementById('tab-list');
    this.btnAdd = document.getElementById('tab-add-btn');

    this.initEvents();
  }

  initEvents() {
    this.btnAdd?.addEventListener('click', () => {
      const name = prompt('New Floor/Zone Tab Name:', `Floor ${this.app.grids.length + 1}`);
      if (!name) return;

      const cols = this.app.activeGrid ? this.app.activeGrid.cols : 30;
      const rows = this.app.activeGrid ? this.app.activeGrid.rows : 20;

      this.app.addGrid(name, cols, rows);
    });
  }

  render() {
    if (!this.tabList) return;
    this.tabList.innerHTML = '';

    this.app.grids.forEach((grid, idx) => {
      const tab = document.createElement('div');
      tab.className = `grid-tab ${idx === this.app.activeGridIndex ? 'active' : ''}`;
      tab.title = 'Double-click to rename floor';

      const titleSpan = document.createElement('span');
      titleSpan.textContent = grid.name;
      tab.appendChild(titleSpan);

      if (this.app.grids.length > 1) {
        const closeBtn = document.createElement('span');
        closeBtn.className = 'tab-close';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Delete floor';

        closeBtn.addEventListener('click', ev => {
          ev.stopPropagation();
          if (confirm(`Delete "${grid.name}" and all elements on it?`)) {
            this.app.deleteGrid(idx);
          }
        });
        tab.appendChild(closeBtn);
      }

      tab.addEventListener('click', () => {
        if (idx !== this.app.activeGridIndex) {
          this.app.switchGrid(idx);
        }
      });

      tab.addEventListener('dblclick', () => {
        const newName = prompt('Rename floor tab:', grid.name);
        if (newName && newName.trim()) {
          grid.name = newName.trim();
          this.render();
        }
      });

      this.tabList.appendChild(tab);
    });
  }
}
