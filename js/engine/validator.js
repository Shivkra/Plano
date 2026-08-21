/* ==========================================================================
   Real-Time Mother Hub Layout Health & Compliance Auditor
   ========================================================================== */

import { CIVIL_RULES } from '../config/rules.js';

export class LayoutValidator {
  /**
   * Evaluates the layout against Mother Hub civil engineering and operational flow standards
   */
  static auditLayout(grid) {
    const { cols, rows, cells } = grid;
    const checks = [];

    // Find key element coordinates
    const positions = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = cells[r * cols + c];
        if (!id) continue;
        if (!positions[id]) positions[id] = [];
        positions[id].push({ c, r });
      }
    }

    // 1. Life Safety: Entry / Exit Check
    const hasEntry = !!positions[30]?.length;
    const hasExit = !!positions[31]?.length;
    if (hasEntry && hasExit) {
      checks.push({
        type: 'pass',
        title: 'Egress & Ingress Gates',
        detail: 'Both staff entry and exit security pathways are properly designated.'
      });
    } else {
      checks.push({
        type: 'warn',
        title: 'Missing Entry or Exit',
        detail: 'Facility is missing dedicated personnel turnstiles or security exit gates.'
      });
    }

    // 2. Fire Exit Path Clearance Check
    const fireExits = positions[32] || [];
    if (fireExits.length > 0) {
      let blocked = false;
      for (const fx of fireExits) {
        const neighbors = [
          { c: fx.c + 1, r: fx.r },
          { c: fx.c - 1, r: fx.r },
          { c: fx.c, r: fx.r + 1 },
          { c: fx.c, r: fx.r - 1 }
        ];
        let openAccess = false;
        for (const n of neighbors) {
          if (n.c >= 0 && n.c < cols && n.r >= 0 && n.r < rows) {
            const v = cells[n.r * cols + n.c];
            if (v === 0 || v === 35) openAccess = true; // Open floor or safety corridor
          }
        }
        if (!openAccess) blocked = true;
      }
      if (!blocked) {
        checks.push({
          type: 'pass',
          title: 'Fire Egress Clearance',
          detail: 'Emergency fire exit doors have unobstructed direct egress paths.'
        });
      } else {
        checks.push({
          type: 'danger',
          title: 'Fire Exit Blocked',
          detail: 'Fire exit door has storage or structures blocking immediate access!'
        });
      }
    }

    // 3. Security Gatehouse Adjacency to Gates
    const security = positions[20] || [];
    const entries = positions[30] || [];
    if (security.length && entries.length) {
      const minDistance = Math.min(
        ...security.flatMap(s => entries.map(e => Math.hypot(s.c - e.c, s.r - e.r)))
      );
      if (minDistance <= 10) {
        checks.push({
          type: 'pass',
          title: 'Gatehouse Access Control',
          detail: `Security cabin is within ${(minDistance * 1.0).toFixed(1)}m of main entrance.`
        });
      } else {
        checks.push({
          type: 'warn',
          title: 'Security Isolated from Gate',
          detail: 'Security cabin is far from pedestrian entry, risking unmonitored access.'
        });
      }
    }

    // 4. Inbound & Outbound Cross-Dock Separation
    const inDocks = positions[10] || [];
    const outDocks = positions[11] || [];
    if (inDocks.length && outDocks.length) {
      checks.push({
        type: 'pass',
        title: 'Cross-Dock Segregation',
        detail: `Balanced cross-dock flow with Inbound linehaul and Outbound distribution bays.`
      });
    }

    // 5. Dual-Stream Sortation Matrix (Hub Put-Walls + City Big Bins)
    const hubWalls = positions[5] || [];
    const cityBins = positions[12] || [];
    if (hubWalls.length && cityBins.length) {
      checks.push({
        type: 'pass',
        title: 'Dual-Stream Sortation Matrix',
        detail: `Both Intra-City Hub Put-Walls and Inter-City Big Bins are actively allocated.`
      });
    } else if (hubWalls.length || cityBins.length) {
      checks.push({
        type: 'warn',
        title: 'Partial Sortation Matrix',
        detail: `Only one segregation stream is active. Ensure both Hub Put-Walls and City Bins are mapped.`
      });
    }

    // 6. Trolley Park & Unload Buffer
    const inStaging = positions[13] || [];
    const trolleyPark = positions[15] || [];
    if (inStaging.length && trolleyPark.length) {
      checks.push({
        type: 'pass',
        title: 'Trolley Handling Staging',
        detail: `Inbound box unload buffer and empty roll-cage parking are properly provisioned.`
      });
    } else if (inDocks.length && !inStaging.length) {
      checks.push({
        type: 'danger',
        title: 'Inbound Dock Apron Missing',
        detail: `Truck docks lack an unloading buffer, risking severe box bottlenecking on the yard!`
      });
    }

    return checks;
  }
}
