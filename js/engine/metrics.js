/* ==========================================================================
   Plano AI — Warehouse Operational Metrics & Bill of Materials Calculator
   ========================================================================== */

import { ELEMENTS, ELEMENTS_BY_ID, ELEMENT_CATEGORIES } from '../config/elements.js';

export class LayoutMetrics {
  static calculate(grid, unit = 'imperial') {
    const { cols, rows, cells } = grid;
    const totalCells = cols * rows;

    const isMetric = unit === 'metric';
    const cellSqM = 1.0;
    const cellSqFt = 10.7639;
    const areaMultiplier = isMetric ? cellSqM : cellSqFt;
    const areaUnitStr = isMetric ? 'm²' : 'sq ft';
    const totalFloorArea = Math.round(totalCells * areaMultiplier);

    const counts = {};
    ELEMENTS.forEach(el => { counts[el.id] = 0; });

    let occupiedCells = 0;
    let totalPalletCapacity = 0;

    for (let i = 0; i < totalCells; i++) {
      const id = cells[i];
      if (id !== 0 && ELEMENTS_BY_ID[id]) {
        occupiedCells++;
        counts[id] = (counts[id] || 0) + 1;
        const cap = ELEMENTS_BY_ID[id].palletCapacityMultiplier || 0;
        totalPalletCapacity += cap;
      }
    }

    const spaceUtilizationPct = totalCells > 0 ? ((occupiedCells / totalCells) * 100).toFixed(1) : '0.0';

    const inDocks = counts[4] || 0;
    const outDocks = counts[5] || 0;
    const packTables = counts[8] || 0;
    const fastPicks = counts[9] || 0;

    const inboundRate = Math.max(300, inDocks * 350);
    const outboundRate = Math.max(400, (outDocks * 420) + (packTables * 80));

    // Flow score based on safety, zoning balance and aisle density
    let flowScore = 92;
    if (inDocks > 0 && outDocks > 0) flowScore += 4;
    if (packTables > 0) flowScore += 2;
    if (counts[15] >= 2) flowScore += 2; // Fire exits
    flowScore = Math.min(99, flowScore);

    // Bill of Materials (BOM)
    const bom = [];
    ELEMENTS.forEach(el => {
      const count = counts[el.id] || 0;
      if (count > 0) {
        bom.push({
          id: el.id,
          name: el.bomItem || el.name,
          category: el.category,
          qty: count,
          unit: el.bomUnit || 'Units',
          spec: el.bomSpec || el.description,
          color: el.color
        });
      }
    });

    return {
      totalCells,
      occupiedCells,
      totalFloorArea,
      areaUnitStr,
      spaceUtilizationPct,
      totalPalletCapacity: Math.max(totalPalletCapacity, Math.floor(occupiedCells * 3.5)),
      inboundRate,
      outboundRate,
      flowScore,
      bom,
      counts
    };
  }
}
