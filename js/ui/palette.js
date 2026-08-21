/* ==========================================================================
   Element Palette Sidebar & Category Filter UI
   ========================================================================== */

import { ELEMENTS, ERASER, ELEMENT_CATEGORIES } from '../config/elements.js';

export class PaletteController {
  constructor(app) {
    this.app = app;
    this.container = document.getElementById('palette-container');
    this.searchInput = document.getElementById('palette-search');
    this.categoryTabs = document.querySelectorAll('.cat-tab');
    this.activeCategory = 'ALL';
    this.searchQuery = '';

    this.initEvents();
    this.render();
  }

  initEvents() {
    this.searchInput?.addEventListener('input', e => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.render();
    });

    this.categoryTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.categoryTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeCategory = tab.dataset.category || 'ALL';
        this.render();
      });
    });
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const allItems = [...ELEMENTS, ERASER];
    const filtered = allItems.filter(el => {
      const matchCat = this.activeCategory === 'ALL' || el.category === this.activeCategory;
      const matchSearch = !this.searchQuery || 
        el.name.toLowerCase().includes(this.searchQuery) ||
        (el.shortName && el.shortName.toLowerCase().includes(this.searchQuery)) ||
        (el.description && el.description.toLowerCase().includes(this.searchQuery));
      return matchCat && matchSearch;
    });

    // Group by category if viewing ALL
    const categoriesToRender = this.activeCategory === 'ALL'
      ? Object.values(ELEMENT_CATEGORIES)
      : [this.activeCategory];

    categoriesToRender.forEach(cat => {
      const itemsInCat = filtered.filter(el => el.category === cat);
      if (!itemsInCat.length) return;

      const title = document.createElement('div');
      title.className = 'palette-section-title';
      title.textContent = cat;
      this.container.appendChild(title);

      itemsInCat.forEach(el => {
        const item = document.createElement('div');
        item.className = `tool-item ${this.app.activeToolId === el.id ? 'active' : ''}`;
        item.dataset.toolId = el.id;

        item.innerHTML = `
          <span class="tool-swatch" style="background:${el.color}; color:${el.textColor || '#0f172a'}">
            ${el.glyph ? (el.glyph.length > 2 ? el.glyph.slice(0, 2) : el.glyph) : '■'}
          </span>
          <span class="tool-name">${el.name}</span>
          <span class="tool-count" data-count-id="${el.id}"></span>
          <span class="tool-key">${el.key.toUpperCase()}</span>
        `;

        item.addEventListener('click', () => {
          this.app.setActiveTool(el.id);
          this.render();
        });

        this.container.appendChild(item);
      });
    });

    this.updateCounts();
  }

  updateCounts() {
    const grid = this.app.activeGrid;
    if (!grid || !grid.cells) return;

    const counts = {};
    for (let i = 0; i < grid.cells.length; i++) {
      const id = grid.cells[i];
      counts[id] = (counts[id] || 0) + 1;
    }

    this.container.querySelectorAll('.tool-count').forEach(el => {
      const id = parseInt(el.dataset.countId, 10);
      el.textContent = counts[id] ? `${counts[id]}` : '';
    });
  }
}
