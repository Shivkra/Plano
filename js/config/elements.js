/* ==========================================================================
   Plano AI — Complete Warehouse Element Catalog & Engineering Specs
   ========================================================================== */

export const ELEMENT_CATEGORIES = {
  DOCKS_STAGING: 'Docks & Staging',
  STORAGE: 'Storage Racking',
  OPERATIONS: 'Operations & Packing',
  INFRASTRUCTURE: 'Safety & Infrastructure'
};

export const ELEMENTS = [
  // --- DOCKS & STAGING ---
  {
    id: 4,
    key: "1",
    name: "Inbound Linehaul Dock",
    shortName: "Inbound Dock",
    glyph: "IN-DOCK",
    category: ELEMENT_CATEGORIES.DOCKS_STAGING,
    color: "#0284c7",
    textColor: "#ffffff",
    description: "Hydraulic dock leveller for receiving container trucks & trailers",
    palletCapacityMultiplier: 0,
    bomItem: "Hydraulic Inbound Dock Leveller",
    bomUnit: "Bays",
    bomSpec: "25,000 lbs dynamic capacity with inflatable shelter dock seal"
  },
  {
    id: 5,
    key: "2",
    name: "Outbound Dispatch Dock",
    shortName: "Outbound Dock",
    glyph: "OUT-DOCK",
    category: ELEMENT_CATEGORIES.DOCKS_STAGING,
    color: "#e11d48",
    textColor: "#ffffff",
    description: "Rapid dispatch dock doors for linehaul routes & last-mile delivery fleet",
    palletCapacityMultiplier: 0,
    bomItem: "High-Speed Outbound Dock Door",
    bomUnit: "Bays",
    bomSpec: "Insulated sectional overhead door with vehicle restraint hook"
  },
  {
    id: 6,
    key: "3",
    name: "Inbound Staging Zone",
    shortName: "In Staging",
    glyph: "IN-STAGE",
    category: ELEMENT_CATEGORIES.DOCKS_STAGING,
    color: "#0369a1",
    textColor: "#ffffff",
    description: "Floor buffer zone for barcode scanning, pallet breakdown and putaway sorting",
    palletCapacityMultiplier: 1,
    bomItem: "Inbound Floor Staging Lane",
    bomUnit: "Positions",
    bomSpec: "Epoxy coated floor marshalling lane with yellow demarcation"
  },
  {
    id: 7,
    key: "4",
    name: "Outbound Staging Zone",
    shortName: "Out Staging",
    glyph: "OUT-STAGE",
    category: ELEMENT_CATEGORIES.DOCKS_STAGING,
    color: "#be123c",
    textColor: "#ffffff",
    description: "Marshalling area for consolidated cages and shrink-wrapped outgoing pallets",
    palletCapacityMultiplier: 1,
    bomItem: "Outbound Marshalling Staging",
    bomUnit: "Positions",
    bomSpec: "High-visibility linehaul departure lanes"
  },

  // --- STORAGE RACKING ---
  {
    id: 1,
    key: "5",
    name: "Selective Pallet Rack",
    shortName: "Selective Rack",
    glyph: "SEL-RACK",
    category: ELEMENT_CATEGORIES.STORAGE,
    color: "#059669",
    textColor: "#ffffff",
    description: "Single-deep heavy beam racking offering 100% direct pallet accessibility",
    palletCapacityMultiplier: 4,
    bomItem: "Heavy Beam Selective Pallet Rack (5-Tier)",
    bomUnit: "Racks",
    bomSpec: "1,000 kg per pallet position, 9.5m upright height, seismic rated"
  },
  {
    id: 2,
    key: "6",
    name: "Double-Deep Pallet Rack",
    shortName: "Double-Deep",
    glyph: "DBL-DEEP",
    category: ELEMENT_CATEGORIES.STORAGE,
    color: "#047857",
    textColor: "#ffffff",
    description: "High-density 2-pallet deep storage serviced by pantograph reach trucks",
    palletCapacityMultiplier: 8,
    bomItem: "Double-Deep Heavy Storage System",
    bomUnit: "Racks",
    bomSpec: "Increased 30% storage density over standard selective racking"
  },
  {
    id: 3,
    key: "7",
    name: "Cantilever Rack (Long Goods)",
    shortName: "Cantilever",
    glyph: "CANTILEVER",
    category: ELEMENT_CATEGORIES.STORAGE,
    color: "#0d9488",
    textColor: "#ffffff",
    description: "Arm-supported racking for oversized profiles, rolls, pipes, and timber",
    palletCapacityMultiplier: 2,
    bomItem: "Heavy-Duty Cantilever Arm Racks",
    bomUnit: "Bays",
    bomSpec: "1,200mm load arms with end stops for non-palletized cargo"
  },
  {
    id: 13,
    key: "8",
    name: "Mezzanine Floor Platform",
    shortName: "Mezzanine",
    glyph: "MEZZANINE",
    category: ELEMENT_CATEGORIES.STORAGE,
    color: "#4f46e5",
    textColor: "#ffffff",
    description: "Structural steel raised mezzanine for high-density small bin storage",
    palletCapacityMultiplier: 6,
    bomItem: "Heavy Structural Steel Mezzanine",
    bomUnit: "Modules",
    bomSpec: "500 kg/m² uniform distributed load with safety toe-plates"
  },

  // --- OPERATIONS & PACKING ---
  {
    id: 8,
    key: "9",
    name: "Packing & QA Station",
    shortName: "Packing Bench",
    glyph: "PACK-QA",
    category: ELEMENT_CATEGORIES.OPERATIONS,
    color: "#d97706",
    textColor: "#ffffff",
    description: "Ergonomic carton packing, weighing, barcode labelling & invoice print bench",
    palletCapacityMultiplier: 0,
    bomItem: "Ergonomic Multi-Tier Packing Bench",
    bomUnit: "Stations",
    bomSpec: "ESD-safe top, integrated scale, barcode gun mount & overhead LED"
  },
  {
    id: 9,
    key: "0",
    name: "Fast-Pick Face (Velocity ABC)",
    shortName: "Fast-Pick",
    glyph: "FAST-PICK",
    category: ELEMENT_CATEGORIES.OPERATIONS,
    color: "#f59e0b",
    textColor: "#0f172a",
    description: "Gravity flow roller carton live storage for top 10% highest velocity SKU items",
    palletCapacityMultiplier: 3,
    bomItem: "Carton Live Gravity Flow Racks",
    bomUnit: "Tracks",
    bomSpec: "First-In-First-Out roller tracks with divider guides"
  },

  // --- INFRASTRUCTURE & SAFETY ---
  {
    id: 10,
    key: "a",
    name: "Forklift Main Aisle",
    shortName: "Forklift Lane",
    glyph: "LANE",
    category: ELEMENT_CATEGORIES.INFRASTRUCTURE,
    color: "#334155",
    textColor: "#f8fafc",
    description: "Primary traffic artery with collision-free bi-directional clearance",
    palletCapacityMultiplier: 0,
    bomItem: "Heavy Traffic Forklift Arterial Lane",
    bomUnit: "Linear Meters",
    bomSpec: "Polyurethane safety striped thoroughfare (3.2m - 3.8m width)"
  },
  {
    id: 11,
    key: "b",
    name: "Battery Charging & MHE Bay",
    shortName: "Charging Bay",
    glyph: "CHARGING",
    category: ELEMENT_CATEGORIES.INFRASTRUCTURE,
    color: "#7c3aed",
    textColor: "#ffffff",
    description: "Ventilated battery charging area with eye-wash safety station",
    palletCapacityMultiplier: 0,
    bomItem: "Industrial Fast Battery Charging Station",
    bomUnit: "Bays",
    bomSpec: "480V 3-Phase fast charger with acid spill containment basin"
  },
  {
    id: 12,
    key: "c",
    name: "Cold Room / Chilled Storage",
    shortName: "Cold Room",
    glyph: "COLD-ZONE",
    category: ELEMENT_CATEGORIES.INFRASTRUCTURE,
    color: "#06b6d4",
    textColor: "#ffffff",
    description: "Insulated controlled temperature chamber (2°C to 8°C)",
    palletCapacityMultiplier: 4,
    bomItem: "Insulated Cold Storage Enclosure",
    bomUnit: "Panels",
    bomSpec: "100mm PIR insulated panels with high-speed thermal roll-up door"
  },
  {
    id: 14,
    key: "d",
    name: "Operations Office / Security",
    shortName: "Office / Cabin",
    glyph: "OFFICE",
    category: ELEMENT_CATEGORIES.INFRASTRUCTURE,
    color: "#475569",
    textColor: "#ffffff",
    description: "Shift supervisor cabin, documentation room & driver registration desk",
    palletCapacityMultiplier: 0,
    bomItem: "Modular In-Plant Warehouse Office",
    bomUnit: "Rooms",
    bomSpec: "Acoustic insulated steel sandwich panels with double glass windows"
  },
  {
    id: 15,
    key: "e",
    name: "Fire Exit & Safety Zone",
    shortName: "Fire Exit",
    glyph: "FIRE-EXIT",
    category: ELEMENT_CATEGORIES.INFRASTRUCTURE,
    color: "#ef4444",
    textColor: "#ffffff",
    description: "OSHA & NFPA compliant unobstructed emergency egress door & clear path",
    palletCapacityMultiplier: 0,
    bomItem: "Emergency Fire Exit Door Assembly",
    bomUnit: "Doors",
    bomSpec: "2-hour fire rated steel door with panic push bar and photoluminescent signs"
  }
];

export const ELEMENTS_BY_ID = {};
ELEMENTS.forEach(el => {
  ELEMENTS_BY_ID[el.id] = el;
});
