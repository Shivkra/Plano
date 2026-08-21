/* ==========================================================================
   Mother Hub Warehouse Element Catalog & Specifications
   ========================================================================== */

export const ELEMENT_CATEGORIES = {
  LOGISTICS: 'Docking & Linehaul',
  SORTATION: 'Sortation & Segregation',
  STAGING: 'Trolley & Pallet Staging',
  STORAGE: 'Buffer Storage',
  ADMIN_SAFETY: 'Admin & Safety Rooms',
  STRUCTURAL: 'Civil & Structural'
};

export const ELEMENTS = [
  // --- DOCKING & LINEHAUL LOGISTICS ---
  {
    id: 10,
    key: "1",
    name: "Inbound Linehaul Dock (Client Pickup)",
    shortName: "Inbound Dock",
    glyph: "IN",
    category: ELEMENT_CATEGORIES.LOGISTICS,
    color: "#0284c7",
    textColor: "#ffffff",
    description: "Unloading bay for trucks/vans arriving with picked boxes from client warehouses",
    rotatable: true,
    footprint: { w: 3, h: 2 },
    unitAreaSqM: 6.0
  },
  {
    id: 11,
    key: "2",
    name: "Outbound Linehaul Dock (Hub & City)",
    shortName: "Outbound Dock",
    glyph: "OUT",
    category: ELEMENT_CATEGORIES.LOGISTICS,
    color: "#e11d48",
    textColor: "#ffffff",
    description: "Loading bay for linehaul trucks connecting to Last Mile Hubs & Other Cities",
    rotatable: true,
    footprint: { w: 3, h: 2 },
    unitAreaSqM: 6.0
  },

  // --- STAGING & TROLLEYS ---
  {
    id: 13,
    key: "3",
    name: "Inbound Trolley & Box Staging",
    shortName: "In Staging",
    glyph: "IS",
    category: ELEMENT_CATEGORIES.STAGING,
    color: "#0369a1",
    textColor: "#ffffff",
    description: "Floor buffer for unloading client boxes directly into handling trolleys",
    rotatable: false,
    unitAreaSqM: 1.0
  },
  {
    id: 14,
    key: "4",
    name: "Outbound Linehaul Staging Lanes",
    shortName: "Out Staging",
    glyph: "OS",
    category: ELEMENT_CATEGORIES.STAGING,
    color: "#be123c",
    textColor: "#ffffff",
    description: "Marshalling lane for sorted cages and pallets waiting for truck departure",
    rotatable: false,
    unitAreaSqM: 1.0
  },
  {
    id: 15,
    key: "t",
    name: "Empty Trolley & Roll-Cage Park",
    shortName: "Trolley Park",
    glyph: "TP",
    category: ELEMENT_CATEGORIES.STAGING,
    color: "#475569",
    textColor: "#f8fafc",
    description: "Designated holding area for empty warehouse movement trolleys",
    rotatable: false,
    unitAreaSqM: 2.0
  },

  // --- SORTATION & SEGREGATION (THE CORE MOTHER HUB ENGINE) ---
  {
    id: 4,
    key: "5",
    name: "Powered Sorter Conveyor Spine",
    shortName: "Conveyor",
    glyph: "»»",
    category: ELEMENT_CATEGORIES.SORTATION,
    color: "#f59e0b",
    textColor: "#0f172a",
    description: "Continuous powered roller conveyor line routing boxes from inbound scan to sorting",
    rotatable: true,
    unitAreaSqM: 1.0
  },
  {
    id: 3,
    key: "6",
    name: "Inbound De-Bagging & DWS Scan Table",
    shortName: "De-Bag / DWS",
    glyph: "DWS",
    category: ELEMENT_CATEGORIES.SORTATION,
    color: "#10b981",
    textColor: "#ffffff",
    description: "De-bagging bench equipped with barcode scanner, dimension & weight check",
    rotatable: true,
    unitAreaSqM: 2.0
  },
  {
    id: 5,
    key: "7",
    name: "Intra-City Hub Put-Wall (Area Bins)",
    shortName: "Hub Sort Put-Wall",
    glyph: "HB",
    category: ELEMENT_CATEGORIES.SORTATION,
    color: "#8b5cf6",
    textColor: "#ffffff",
    description: "Put-wall sorting matrix segregating parcels by Last Mile Store / Darkstore hub areas",
    rotatable: true,
    unitAreaSqM: 2.0
  },
  {
    id: 12,
    key: "8",
    name: "Inter-City Big Bin / Gaylord Area",
    shortName: "City Big Bin",
    glyph: "CB",
    category: ELEMENT_CATEGORIES.SORTATION,
    color: "#d946ef",
    textColor: "#ffffff",
    description: "Heavy bulk Gaylord bins / pallet cages consolidating parcels for other cities (e.g. DEL, BOM, HYD)",
    rotatable: true,
    unitAreaSqM: 3.0
  },

  // --- BUFFER STORAGE & PALLET RACKS ---
  {
    id: 1,
    key: "9",
    name: "High-Bay Pallet Racks (Buffer Stock)",
    shortName: "Pallet Rack",
    glyph: "R",
    category: ELEMENT_CATEGORIES.STORAGE,
    color: "#3b82f6",
    textColor: "#ffffff",
    description: "Heavy-duty multi-tier pallet racking for temporary holding & overflow buffer",
    rotatable: false,
    unitAreaSqM: 1.5
  },

  // --- ADMIN & LIFE SAFETY ROOMS ---
  {
    id: 20,
    key: "s",
    name: "Security Cabin / Vehicle Check-in",
    shortName: "Security",
    glyph: "SEC",
    category: ELEMENT_CATEGORIES.ADMIN_SAFETY,
    color: "#d97706",
    textColor: "#ffffff",
    description: "Gatehouse security for driver verification, vehicle weigh-in & access control",
    rotatable: false,
    unitAreaSqM: 8.0
  },
  {
    id: 21,
    key: "m",
    name: "Medical / First-Aid Room",
    shortName: "Medical",
    glyph: "+",
    category: ELEMENT_CATEGORIES.ADMIN_SAFETY,
    color: "#db2777",
    textColor: "#ffffff",
    description: "Emergency triage, eyewash station & first-aid recovery room",
    rotatable: false,
    unitAreaSqM: 8.0
  },
  {
    id: 22,
    key: "u",
    name: "UPS & Electrical / Transformer Room",
    shortName: "UPS/Power",
    glyph: "⚡",
    category: ELEMENT_CATEGORIES.ADMIN_SAFETY,
    color: "#dc2626",
    textColor: "#ffffff",
    description: "Industrial power board, inverter bank, battery backup & conveyor motor controls",
    rotatable: false,
    unitAreaSqM: 12.0
  },
  {
    id: 23,
    key: "o",
    name: "Mother Hub Manager Cabin",
    shortName: "Hub Manager",
    glyph: "MGR",
    category: ELEMENT_CATEGORIES.ADMIN_SAFETY,
    color: "#4f46e5",
    textColor: "#ffffff",
    description: "Operations lead office with direct sightlines over cross-dock & sorter lanes",
    rotatable: false,
    unitAreaSqM: 12.0
  },
  {
    id: 24,
    key: "c",
    name: "Shift Briefing & Conference Room",
    shortName: "Briefing Room",
    glyph: "CF",
    category: ELEMENT_CATEGORIES.ADMIN_SAFETY,
    color: "#65a30d",
    textColor: "#ffffff",
    description: "Team briefing, shift change handovers, sorter training & driver room",
    rotatable: false,
    unitAreaSqM: 16.0
  },
  {
    id: 25,
    key: "r",
    name: "Maintenance & Equipment Store",
    shortName: "Maint Store",
    glyph: "ST",
    category: ELEMENT_CATEGORIES.ADMIN_SAFETY,
    color: "#57534e",
    textColor: "#ffffff",
    description: "Spare conveyor belts, barcode scanner chargers, trolley wheels & tools",
    rotatable: false,
    unitAreaSqM: 10.0
  },

  // --- STRUCTURAL & CIVIL ---
  {
    id: 30,
    key: "e",
    name: "Main Personnel Entry Gate",
    shortName: "Entry",
    glyph: "▶",
    category: ELEMENT_CATEGORIES.STRUCTURAL,
    color: "#16a34a",
    textColor: "#ffffff",
    description: "Turnstile biometric entrance for hub sorters & warehouse staff",
    rotatable: true,
    unitAreaSqM: 2.0
  },
  {
    id: 31,
    key: "x",
    name: "Main Personnel Exit Gate",
    shortName: "Exit",
    glyph: "◀",
    category: ELEMENT_CATEGORIES.STRUCTURAL,
    color: "#ea580c",
    textColor: "#ffffff",
    description: "Designated staff exit with mandatory security screening checkpoint",
    rotatable: true,
    unitAreaSqM: 2.0
  },
  {
    id: 32,
    key: "f",
    name: "Emergency Fire Exit Door",
    shortName: "Fire Exit",
    glyph: "🚨",
    category: ELEMENT_CATEGORIES.STRUCTURAL,
    color: "#dc2626",
    textColor: "#ffffff",
    description: "Push-bar egress fire door (must remain unobstructed 24/7)",
    rotatable: true,
    unitAreaSqM: 1.0
  },
  {
    id: 33,
    key: "p",
    name: "Structural Column / Pillar",
    shortName: "Column",
    glyph: "■",
    category: ELEMENT_CATEGORIES.STRUCTURAL,
    color: "#334155",
    textColor: "#f8fafc",
    description: "Reinforced building load column (structural grid)",
    rotatable: false,
    unitAreaSqM: 1.0
  },
  {
    id: 34,
    key: "w",
    name: "Perimeter Wall / Partition",
    shortName: "Wall",
    glyph: "///",
    category: ELEMENT_CATEGORIES.STRUCTURAL,
    color: "#1e293b",
    textColor: "#94a3b8",
    description: "External building envelope / concrete perimeter wall",
    rotatable: false,
    unitAreaSqM: 1.0
  },
  {
    id: 35,
    key: "h",
    name: "Safety Yellow Trolley Corridor",
    shortName: "Trolley Aisle",
    glyph: "⚠️",
    category: ELEMENT_CATEGORIES.STRUCTURAL,
    color: "#ca8a04",
    textColor: "#0f172a",
    description: "Demarcated 2.4m heavy trolley transit corridor (no floor stacking allowed)",
    rotatable: false,
    unitAreaSqM: 1.0
  }
];

export const ERASER = {
  id: 0,
  key: "0",
  name: "Eraser / Clear Floor",
  shortName: "Eraser",
  glyph: "⌫",
  category: "Tools",
  color: "#101726",
  textColor: "#94a3b8",
  description: "Erase elements back to open transit floor"
};

export const ELEMENTS_BY_ID = Object.fromEntries(ELEMENTS.map(el => [el.id, el]));
ELEMENTS_BY_ID[0] = ERASER;
