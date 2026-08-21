/* ==========================================================================
   Mother Hub Space Utilization & Operations Metrics Calculator
   ========================================================================== */

import { ELEMENTS_BY_ID, ELEMENT_CATEGORIES } from '../config/elements.js';

export class LayoutMetrics {
  /**
   * Computes comprehensive space utilization and operational capacity metrics for Mother Hub
   */
  static calculate(grid, unit = 'metric') {
    const { cols, rows, cells } = grid;
    const totalCells = cols * rows;
    
    const cellSqM = 1.0;
    const cellSqFt = 10.7639;
    const isMetric = unit === 'metric';
    const areaMultiplier = isMetric ? cellSqM : cellSqFt;
    const areaUnitStr = isMetric ? 'm²' : 'sq ft';

    const totalFloorArea = totalCells * areaMultiplier;

    const categoryBreakdown = {
      [ELEMENT_CATEGORIES.SORTATION]: { count: 0, area: 0, label: 'Sortation & Segregation' },
      [ELEMENT_CATEGORIES.LOGISTICS]: { count: 0, area: 0, label: 'Linehaul Docking Bays' },
      [ELEMENT_CATEGORIES.STAGING]: { count: 0, area: 0, label: 'Trolley & Pallet Staging' },
      [ELEMENT_CATEGORIES.STORAGE]: { count: 0, area: 0, label: 'Buffer Pallet Storage' },
      [ELEMENT_CATEGORIES.ADMIN_SAFETY]: { count: 0, area: 0, label: 'Admin & Life Safety' },
      [ELEMENT_CATEGORIES.STRUCTURAL]: { count: 0, area: 0, label: 'Civil & Structural' },
      'Circulation': { count: 0, area: 0, label: 'Trolley Transit Aisles' }
    };

    let occupiedCells = 0;
    let inDockCount = 0;
    let outDockCount = 0;
    let hubSortWallCount = 0;
    let cityBigBinCount = 0;
    let deBagStationCount = 0;
    let conveyorLength = 0;
    let rackCount = 0;

    for (let i = 0; i < totalCells; i++) {
      const id = cells[i];
      if (id === 0) {
        categoryBreakdown['Circulation'].count++;
      } else {
        occupiedCells++;
        const el = ELEMENTS_BY_ID[id];
        if (el) {
          const cat = el.category;
          if (categoryBreakdown[cat]) {
            categoryBreakdown[cat].count++;
          }

          if (id === 10) inDockCount++;
          if (id === 11) outDockCount++;
          if (id === 5) hubSortWallCount++;
          if (id === 12) cityBigBinCount++;
          if (id === 3) deBagStationCount++;
          if (id === 4) conveyorLength++;
          if (id === 1) rackCount++;
        }
      }
    }

    // Compute areas and percentages
    Object.keys(categoryBreakdown).forEach(cat => {
      const item = categoryBreakdown[cat];
      item.area = item.count * areaMultiplier;
      item.percentage = totalCells > 0 ? (item.count / totalCells) * 100 : 0;
    });

    const totalDocks = Math.round((inDockCount + outDockCount) / 6); // Each dock bay is ~6 cells
    const activeHubPutWalls = Math.round(hubSortWallCount / 6);
    const activeCityBigBins = Math.round(cityBigBinCount / 6);
    const activeDeBagTables = Math.round(deBagStationCount / 4);

    // Mother Hub daily parcel throughput capacity calculation
    const throughputPerDay = Math.round(
      (activeDeBagTables * 8000) + 
      (conveyorLength * 600) + 
      (activeHubPutWalls * 6000) + 
      (activeCityBigBins * 5000)
    );

    return {
      totalCells,
      occupiedCells,
      occupancyPercentage: (occupiedCells / totalCells) * 100,
      totalFloorArea,
      areaUnitStr,
      categoryBreakdown,
      inDockCount: Math.round(inDockCount / 6),
      outDockCount: Math.round(outDockCount / 6),
      totalDocks: Math.max(2, totalDocks),
      hubSortWallCount: Math.max(1, activeHubPutWalls),
      cityBigBinCount: Math.max(1, activeCityBigBins),
      deBagStationCount: Math.max(1, activeDeBagTables),
      conveyorLength,
      rackCount,
      estimatedThroughput: Math.max(25000, throughputPerDay)
    };
  }
}
