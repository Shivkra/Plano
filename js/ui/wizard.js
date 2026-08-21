/* ==========================================================================
   Guided Setup Wizard UI Controller — Mother Hub Focus
   ========================================================================== */

import { WAREHOUSE_PRESETS } from '../config/templates.js';
import { LayoutGenerator } from '../engine/generator.js';

export class WizardController {
  constructor(app) {
    this.app = app;
    this.currentStep = 1;
    this.totalSteps = 5;
    this.selectedPreset = 'mother-hub';

    this.specs = {
      name: "Blitz Mother Hub — MH-BLR-01",
      cols: 46,
      rows: 30,
      unit: "metric",
      inboundDocks: 4,
      outboundDocks: 4,
      separateDocks: true,
      hasSecurity: true,
      hasMedical: true,
      hasUPS: true,
      hasManager: true,
      hasConf: true,
      hasStore: true,
      conveyor: true,
      orderVolume: "ultra"
    };

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.modal = document.getElementById('wizard-modal');
    this.stepPanes = document.querySelectorAll('.wizard-step-pane');
    this.stepItems = document.querySelectorAll('.step-item');
    this.btnPrev = document.getElementById('wizard-prev-btn');
    this.btnNext = document.getElementById('wizard-next-btn');
    this.btnSkip = document.getElementById('wizard-skip-btn');
    this.btnPresets = document.querySelectorAll('.preset-card');

    this.renderPresets();
  }

  renderPresets() {
    const presetGrid = document.querySelector('.preset-grid');
    if (!presetGrid) return;

    presetGrid.innerHTML = WAREHOUSE_PRESETS.map(p => `
      <div class="preset-card ${p.id === this.selectedPreset ? 'selected' : ''} ${p.locked ? 'preset-locked' : ''}" data-preset-id="${p.id}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div class="preset-icon" style="margin-bottom:0;">${p.icon}</div>
          <span class="badge ${p.badgeClass || 'badge-indigo'}">${p.badge}</span>
        </div>
        <div class="preset-title">${p.name}</div>
        <div class="preset-desc">${p.subtitle}</div>
        <div class="preset-meta">
          <span class="badge badge-indigo">${p.dimensions.cols}×${p.dimensions.rows} Grid (~${p.dimensions.cols * p.dimensions.rows * 10} sq ft)</span>
          <span class="badge badge-emerald">${p.stats.throughput}</span>
          ${p.locked ? `<span style="font-size:10px; color:#fda4af; width:100%; margin-top:4px;">🔒 Locked: Currently prioritizing Mother Hub rollout</span>` : ''}
        </div>
      </div>
    `).join('');

    presetGrid.querySelectorAll('.preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const pid = card.dataset.presetId;
        const preset = WAREHOUSE_PRESETS.find(p => p.id === pid);
        if (preset && preset.locked) {
          card.classList.add('shake');
          setTimeout(() => card.classList.remove('shake'), 400);
          return;
        }
        this.selectPreset(pid);
      });
    });
  }

  selectPreset(presetId) {
    this.selectedPreset = presetId;
    document.querySelectorAll('.preset-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.presetId === presetId);
    });

    const preset = WAREHOUSE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    // Populate inputs with preset defaults
    this.specs.cols = preset.dimensions.cols;
    this.specs.rows = preset.dimensions.rows;
    Object.assign(this.specs, preset.defaults);

    const inputName = document.getElementById('wz-site-name');
    if (inputName && (!inputName.value || inputName.value.includes('Hub') || inputName.value.includes('Store'))) {
      inputName.value = "Blitz Mother Hub — MH-BLR-01";
      this.specs.name = inputName.value;
    }

    const lenFt = preset.dimensions.lengthFt || Math.round(preset.dimensions.cols * 3.28084);
    const widFt = preset.dimensions.widthFt || Math.round(preset.dimensions.rows * 3.28084);

    const inputLen = document.getElementById('wz-length-ft');
    const inputWid = document.getElementById('wz-width-ft');
    if (inputLen) inputLen.value = lenFt;
    if (inputWid) inputWid.value = widFt;

    if (this.updateDimsFromFeet) {
      this.updateDimsFromFeet();
    }

    const inDocks = document.getElementById('wz-in-docks');
    const outDocks = document.getElementById('wz-out-docks');
    if (inDocks) inDocks.value = this.specs.inboundDocks;
    if (outDocks) outDocks.value = this.specs.outboundDocks;
  }

  bindEvents() {
    this.btnNext?.addEventListener('click', () => {
      if (this.currentStep < this.totalSteps) {
        this.goToStep(this.currentStep + 1);
      } else {
        this.finishWizard();
      }
    });

    this.btnPrev?.addEventListener('click', () => {
      if (this.currentStep > 1) {
        this.goToStep(this.currentStep - 1);
      }
    });

    this.btnSkip?.addEventListener('click', () => {
      this.finishWizard();
    });

    this.stepItems.forEach(item => {
      item.addEventListener('click', () => {
        const step = parseInt(item.dataset.step, 10);
        if (step) this.goToStep(step);
      });
    });

    this.updateDimsFromFeet = () => {
      const lenFt = parseFloat(document.getElementById('wz-length-ft')?.value) || 150;
      const widFt = parseFloat(document.getElementById('wz-width-ft')?.value) || 100;
      const totalSqFt = Math.round(lenFt * widFt);
      const totalSqM = Math.round(totalSqFt * 0.092903);

      // 1 grid cell = ~3.33 ft (1 meter)
      const cols = Math.max(16, Math.min(120, Math.round(lenFt / 3.28084)));
      const rows = Math.max(14, Math.min(100, Math.round(widFt / 3.28084)));

      this.specs.cols = cols;
      this.specs.rows = rows;
      this.specs.lengthFt = lenFt;
      this.specs.widthFt = widFt;
      this.specs.totalSqFt = totalSqFt;

      const sqFtBadge = document.getElementById('wz-sqft-badge');
      if (sqFtBadge) {
        sqFtBadge.textContent = `📐 ${totalSqFt.toLocaleString()} sq ft (~${totalSqM.toLocaleString()} m²)`;
      }

      const gridResBadge = document.getElementById('wz-grid-res-badge');
      if (gridResBadge) {
        gridResBadge.textContent = `Grid: ${cols} cols × ${rows} rows (1 cell ≈ 3.3 ft)`;
      }
    };

    document.getElementById('wz-length-ft')?.addEventListener('input', this.updateDimsFromFeet);
    document.getElementById('wz-width-ft')?.addEventListener('input', this.updateDimsFromFeet);

    // Initial calculation
    this.updateDimsFromFeet();

    // Form inputs sync
    document.getElementById('wz-site-name')?.addEventListener('input', e => {
      this.specs.name = e.target.value.trim() || 'Blitz Mother Hub — MH-BLR-01';
    });
    document.getElementById('wz-in-docks')?.addEventListener('input', e => {
      this.specs.inboundDocks = parseInt(e.target.value, 10) || 4;
    });
    document.getElementById('wz-out-docks')?.addEventListener('input', e => {
      this.specs.outboundDocks = parseInt(e.target.value, 10) || 4;
    });

    // Support room checkboxes
    ['hasSecurity', 'hasMedical', 'hasUPS', 'hasManager', 'hasConf', 'hasStore', 'conveyor'].forEach(key => {
      const el = document.getElementById(`wz-${key}`);
      if (el) {
        el.addEventListener('change', e => {
          this.specs[key] = e.target.checked;
        });
      }
    });
  }

  goToStep(step) {
    this.currentStep = step;

    this.stepPanes.forEach((pane, idx) => {
      pane.classList.toggle('active', idx + 1 === step);
    });

    this.stepItems.forEach((item, idx) => {
      const s = idx + 1;
      item.classList.toggle('active', s === step);
      item.classList.toggle('completed', s < step);
    });

    if (this.btnPrev) {
      this.btnPrev.style.visibility = step === 1 ? 'hidden' : 'visible';
    }

    if (this.btnNext) {
      this.btnNext.textContent = step === this.totalSteps ? '✨ Generate Mother Hub Layout' : 'Next Step →';
      if (step === this.totalSteps) {
        this.btnNext.classList.add('btn-primary');
      }
    }
  }

  finishWizard() {
    try {
      if (this.updateDimsFromFeet) {
        this.updateDimsFromFeet();
      }
      const layout = LayoutGenerator.generateLayout(this.specs);
      this.app.loadSynthesizedLayout(this.specs.name, layout);
      this.hide();
    } catch (e) {
      console.error('Error generating layout:', e);
      this.hide();
    }
  }

  show() {
    if (this.modal) {
      this.modal.classList.remove('hidden');
      this.modal.style.display = 'flex';
    }
    this.goToStep(1);
  }

  hide() {
    if (this.modal) {
      this.modal.classList.add('hidden');
      this.modal.style.display = 'none';
    }
  }
}
