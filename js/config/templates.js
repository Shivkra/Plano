/* ==========================================================================
   Blitz Facility Types & Network Archetypes
   ========================================================================== */

export const WAREHOUSE_PRESETS = [
  {
    id: "mother-hub",
    name: "Mother Hub (Central Sorting & Distribution)",
    subtitle: "15,000 – 40,000 sq ft · Primary Linehaul Cross-Dock & Automated Sortation",
    icon: "🏭",
    locked: false,
    badge: "ACTIVE FOCUS",
    badgeClass: "badge-emerald",
    dimensions: { cols: 46, rows: 30, unit: "metric", cellMeters: 1.0 },
    stats: { throughput: "40,000+ parcels/day", docks: "8 Docks (Cross-Dock)", skus: "Primary Linehaul Hub" },
    defaults: {
      inboundDocks: 4,
      outboundDocks: 4,
      separateDocks: true,
      flowType: "I_FLOW",
      conveyor: true,
      hasSecurity: true,
      hasMedical: true,
      hasUPS: true,
      hasManager: true,
      hasConf: true,
      hasStore: true,
      orderVolume: "ultra"
    }
  },
  {
    id: "last-mile-store",
    name: "Last Mile Store (Mini Hub / Feeder Hub)",
    subtitle: "5,000 – 10,000 sq ft · Secondary Route Dispatch & Van / 3W Handoff",
    icon: "🚚",
    locked: true,
    badge: "🔒 LOCKED",
    badgeClass: "badge-rose",
    dimensions: { cols: 30, rows: 22, unit: "metric", cellMeters: 1.0 },
    stats: { throughput: "6,000 orders/day", docks: "3 Feeder Bays", skus: "8,000 SKUs" },
    defaults: {
      inboundDocks: 1,
      outboundDocks: 2,
      separateDocks: true,
      flowType: "U_FLOW",
      conveyor: true,
      hasSecurity: true,
      hasMedical: true,
      hasUPS: true,
      hasManager: true,
      hasConf: false,
      hasStore: true,
      orderVolume: "high"
    }
  },
  {
    id: "dark-store",
    name: "Dark Store (Quick Commerce Pod)",
    subtitle: "2,500 – 4,500 sq ft · Micro-Fulfillment Pod [Locked]",
    icon: "⚡",
    locked: true,
    badge: "🔒 LOCKED",
    badgeClass: "badge-rose",
    dimensions: { cols: 24, rows: 18, unit: "metric", cellMeters: 1.0 },
    stats: { throughput: "2,000 orders/day", docks: "1 Feeder Bay", skus: "3,500 Fast SKUs" },
    defaults: {
      inboundDocks: 1,
      outboundDocks: 1,
      separateDocks: false,
      flowType: "U_FLOW",
      conveyor: false,
      hasSecurity: true,
      hasMedical: true,
      hasUPS: true,
      hasManager: true,
      hasConf: false,
      hasStore: true,
      orderVolume: "medium"
    }
  }
];
