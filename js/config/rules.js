/* ==========================================================================
   Mother Hub Layout Engineering & Civil Adjacency Rules
   ========================================================================== */

export const CIVIL_RULES = {
  // Clearances & Corridors (in grid units / meters)
  MIN_MAIN_AISLE_WIDTH: 2,       // 2 cells (~2.4m - 3.0m) for heavy roll-cage trolley transit
  MIN_PICK_AISLE_WIDTH: 1,       // 1 cell (~1.0m - 1.2m) for sorters between put-walls
  MIN_DOCK_APRON_DEPTH: 2,       // 2 cells buffer behind docking doors for box staging
  MIN_FIRE_EXIT_CLEARANCE: 2,    // Clear direct path to emergency fire doors
  
  // Life Safety & Adjacency Constraints
  MAX_MEDICAL_ROOM_DISTANCE: 25, // Max distance in cells from floor center
  SECURITY_GATE_ADJACENCY: true, // Security cabin MUST touch or be within 2 cells of main Entry
  UPS_PERIMETER_LOCATION: true,  // Power/UPS must be against external perimeter wall
  
  // Linehaul Logistics Flow Direction
  RECOMMENDED_FLOWS: {
    CROSS_DOCK: "Cross-Dock Flow (Inbound Client Unload -> Trolley -> De-bagging -> Sorter -> Outbound Linehaul)",
    U_FLOW: "U-Shaped Cross-Dock (Inbound & Outbound on same front yard)",
    I_FLOW: "Through Flow (Opposing Inbound & Outbound Docks)"
  }
};

export const ADJACENCY_MATRIX = {
  // Positive score = should be close; Negative = must be separated
  10: { 13: 5, 15: 5, 20: 3 },         // Inbound Dock -> Inbound Staging (+5), Trolley Park (+5), Security (+3)
  11: { 14: 5, 12: 4, 5: 4 },          // Outbound Dock -> Outbound Staging (+5), Big Bins (+4), Hub Put-Walls (+4)
  3: { 4: 5, 13: 5, 15: 4 },           // De-Bagging -> Conveyor (+5), Inbound Staging (+5), Trolleys (+4)
  4: { 5: 5, 12: 5 },                  // Sorter Conveyor -> Hub Put-Walls (+5), City Big Bins (+5)
  5: { 14: 5, 4: 5 },                  // Hub Put-Walls -> Outbound Staging (+5), Conveyor (+5)
  12: { 14: 5, 4: 5 },                 // City Big Bins -> Outbound Staging (+5), Conveyor (+5)
  20: { 30: 5, 31: 5 },                // Security -> Entry (+5), Exit (+5)
  21: { 30: 4, 32: 3 },                // Medical -> Entry (+4), Fire Exit (+3)
  22: { 34: 4 }                        // UPS -> Perimeter Wall (+4)
};
