/* ==========================================================================
   Smart Mother Hub Layout Synthesis Engine
   ========================================================================== */

export class LayoutGenerator {
  /**
   * Synthesizes an engineering-compliant Mother Hub cross-dock & sortation layout
   */
  static generateLayout(specs) {
    const cols = Math.max(24, Math.min(120, specs.cols || 46));
    const rows = Math.max(18, Math.min(100, specs.rows || 30));
    const cells = new Uint8Array(cols * rows);
    const rots = new Uint8Array(cols * rows);

    const set = (c, r, val, rot = 0) => {
      if (c >= 0 && c < cols && r >= 0 && r < rows) {
        const idx = r * cols + c;
        cells[idx] = val;
        rots[idx] = rot;
      }
    };

    const fillBlock = (c1, r1, w, h, val, rot = 0) => {
      for (let r = r1; r < r1 + h; r++) {
        for (let c = c1; c < c1 + w; c++) {
          set(c, r, val, rot);
        }
      }
    };

    // 1. BOUNDARY & STRUCTURAL PERIMETER WALLS
    for (let c = 0; c < cols; c++) {
      set(c, 0, 34); // Top wall
      set(c, rows - 1, 34); // Bottom wall
    }
    for (let r = 0; r < rows; r++) {
      set(0, r, 34); // Left wall
      set(cols - 1, r, 34); // Right wall
    }

    // 2. MAIN PERSONNEL ENTRY/EXIT & VEHICLE GATE GUARDHOUSE (Bottom-Right)
    const entryCol = Math.max(2, cols - 8);
    set(entryCol, rows - 1, 30, 0); // Personnel Entry
    set(entryCol + 4, rows - 1, 31, 0); // Personnel Exit

    // Emergency Fire Exits
    set(1, 0, 32, 2); // Top-left fire door
    set(cols - 2, 0, 32, 2); // Top-right fire door

    // 3. ADMIN & LIFE-SAFETY SUPPORT ROOMS (Right Perimeter Wall)
    let currentAdminRow = 1;

    // Security Gatehouse (Guards vehicle entry & staff gate)
    if (specs.hasSecurity !== false) {
      fillBlock(cols - 6, rows - 5, 5, 4, 20); // 5x4 Security Cabin
    }

    // First-Aid / Medical Room (Immediate access near entrance)
    if (specs.hasMedical !== false) {
      fillBlock(cols - 6, rows - 9, 5, 3, 21); // 5x3 Medical Room
    }

    // Hub Manager Office (Viewing window across floor)
    if (specs.hasManager !== false) {
      fillBlock(cols - 6, currentAdminRow, 5, 4, 23);
      currentAdminRow += 4;
    }

    // Shift Briefing & Conference Room
    if (specs.hasConf !== false) {
      fillBlock(cols - 6, currentAdminRow, 5, 4, 24);
      currentAdminRow += 4;
    }

    // Maintenance & Equipment Store
    if (specs.hasStore !== false) {
      fillBlock(cols - 6, currentAdminRow, 5, 3, 25);
      currentAdminRow += 3;
    }

    // High-Voltage UPS & Power Transformer Room (Top-Left Isolated Perimeter)
    if (specs.hasUPS !== false) {
      fillBlock(1, 1, 5, 4, 22); // 5x4 Electrical room
    }

    // 4. INBOUND CLIENT TRUCK DOCKS & UNLOADING APRON (Top Section / Left-to-Center)
    // Heavy linehaul trucks arriving from client warehouses with picked order boxes
    const inDockCount = Math.max(1, Math.min(6, specs.inboundDocks || 4));
    let inDockCol = 7;
    for (let i = 0; i < inDockCount; i++) {
      if (inDockCol + 4 < cols - 8) {
        fillBlock(inDockCol, 1, 3, 2, 10, 2); // Inbound Dock (ID 10)
        // Inbound Box Unload Staging Apron
        fillBlock(inDockCol, 3, 3, 2, 13, 0); // Staging (ID 13)
        inDockCol += 4;
      }
    }

    // Empty Trolley & Roll-Cage Holding Park (Immediately adjacent to inbound staging)
    fillBlock(1, 6, 5, 4, 15); // Trolley Park (ID 15)

    // 5. INBOUND DE-BAGGING & DWS SCAN STATIONS (Rows 6-7)
    // Boxes from trolleys are de-bagged, scanned, and weighed
    const deBagStartCol = 7;
    const deBagEndCol = Math.min(cols - 8, inDockCol - 1);
    for (let c = deBagStartCol; c < deBagEndCol; c += 3) {
      fillBlock(c, 6, 2, 2, 3, 0); // De-Bagging Bench (ID 3)
    }

    // 6. MAIN POWERED SORTER CONVEYOR SPINE (Rows 9-10)
    // Continuous transit line routing scanned parcels to sortation matrices
    const convRow = 9;
    const convStartCol = 7;
    const convEndCol = cols - 8;
    for (let c = convStartCol; c < convEndCol; c++) {
      set(c, convRow, 4, 0); // Conveyor moving right
    }

    // 7. CORE SORTATION & SEGREGATION ENGINES (Rows 12-19)
    // A. INTRA-CITY SORTING (Hub-Level Put-Walls / Area Bins for Last Mile Hubs)
    const hubSortStartRow = 12;
    const hubSortEndRow = Math.min(rows - 10, 18);
    const hubSortStartCol = 4;
    const hubSortEndCol = Math.floor((cols - 10) / 2) + 2;

    for (let r = hubSortStartRow; r <= hubSortEndRow; r += 3) {
      for (let c = hubSortStartCol; c < hubSortEndCol; c += 4) {
        fillBlock(c, r, 3, 2, 5, 0); // Intra-City Hub Put-Wall (ID 5)
      }
    }

    // B. INTER-CITY SORTING (City-Level Big Bins / Gaylords for Other Cities: DEL, BOM, HYD, etc.)
    const cityBinStartCol = hubSortEndCol + 2;
    const cityBinEndCol = cols - 8;

    for (let r = hubSortStartRow; r <= hubSortEndRow; r += 3) {
      for (let c = cityBinStartCol; c < cityBinEndCol; c += 4) {
        fillBlock(c, r, 3, 2, 12, 0); // Inter-City Big Bin / Gaylord (ID 12)
      }
    }

    // 8. BUFFER PALLET RACK RUNS (Rows 19-21)
    const bufferRackRow = hubSortEndRow + 3;
    if (bufferRackRow + 1 < rows - 6) {
      for (let c = 4; c < cols - 8; c++) {
        // Cross aisle breaks
        if (c % 10 === 0) continue;
        set(c, bufferRackRow, 1, 0); // Buffer Pallet Rack (ID 1)
        set(c, bufferRackRow + 1, 1, 0);
      }
    }

    // 9. OUTBOUND LINEHAUL STAGING LANES (Rows: rows - 6 to rows - 4)
    // Segregated Hub Cages & City Gaylords staged for truck departure
    const outStageRow = rows - 6;
    const outDockCount = Math.max(1, Math.min(6, specs.outboundDocks || 4));
    let outDockCol = 3;

    for (let i = 0; i < outDockCount; i++) {
      if (outDockCol + 4 < entryCol - 2) {
        // Outbound Staging Lane
        fillBlock(outDockCol, outStageRow, 3, 2, 14, 0); // Outbound Staging (ID 14)
        // Outbound Linehaul Dock (Connecting back to Hubs & Cities)
        fillBlock(outDockCol, rows - 3, 3, 2, 11, 0); // Outbound Dock (ID 11)
        outDockCol += 4;
      }
    }

    // 10. STRUCTURAL BUILDING LOAD COLUMNS (Pillars on grid)
    const colInterval = 8;
    const rowInterval = 6;
    for (let cr = rowInterval; cr < rows - 4; cr += rowInterval) {
      for (let cc = colInterval; cc < cols - 8; cc += colInterval) {
        if (cells[cr * cols + cc] === 0) {
          set(cc, cr, 33, 0); // Column (ID 33)
        }
      }
    }

    return {
      cols,
      rows,
      cells,
      rots
    };
  }
}
