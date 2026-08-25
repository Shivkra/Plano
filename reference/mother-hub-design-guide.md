# Mother Hub / Cross-Dock Sortation Center — Design Reference

Reference material for Blitz's Planogram layout generator. Companion to
[`mother-hub-layouts.json`](mother-hub-layouts.json), which carries the same
content in machine-parseable form, keyed to match `ZONE_DEFS` / `PAINT_DEFS`
/ `defaultGenParams()` in `darkstore-layout-planner.html` directly.

**What this is not:** a storage warehouse, a fulfillment center (pick/pack
from held inventory), a cold-chain facility, or a quick-commerce dark store.
A Mother Hub holds nothing — every box that arrives leaves the same day,
sorted and re-bagged for its next leg.

## 1. What a Mother Hub actually is

"Mother Hub" is real operating terminology, not a coined name — Ekart uses
it for its primary regional sorting and consolidation tier, the layer
between store/seller pickup and last-mile delivery hubs. Delhivery's
equivalent tier is its "processing centres and sortation facilities," sitting
below trunk-route gateway facilities and above last-mile delivery centres.
The functional role is identical across operators and matches the brief
exactly:

1. **Receive** packed orders from client dark stores/sellers.
2. **Segregate** each shipment: last-mile-hub-bound, or bound for another
   city.
3. **Sort** — by conveyor belt in higher-volume locations, by manual labour
   in others.
4. **Bag** sorted shipments by destination.
5. **Dispatch** to the destination hub/city.

That's a cross-dock, full stop. Every design decision below follows from
one constraint a storage warehouse never has: **nothing is meant to touch
the floor for longer than a wave's dwell time.**

## 2. The five throughput tiers

Full numeric detail lives in the JSON; this is the reasoning behind each
tier boundary.

| Tier | Name | Volume/day | Sortation | Flow | Footprint |
|---|---|---|---|---|---|
| 1 | Micro Manual Hub | 500–3,000 | Manual | U or I | 8k–15k sqft |
| 2 | Small Conveyor-Assisted | 3,000–15,000 | Semiauto | I | 15k–40k sqft |
| 3 | Medium Hybrid | 15,000–40,000 | Semiauto | I | 40k–80k sqft |
| 4 | Large Automated | 40,000–100,000 | Automated | I | 80k–180k sqft |
| 5 | Mega Regional | 100,000–300,000+ | Automated | I | 180k–400k+ sqft |

**Why these particular breakpoints, not round numbers:** they track real
sortation-method throughput ceilings, not arbitrary volume bands.

- **Manual sort has a hard ceiling.** Adding headcount past a point doesn't
  raise throughput — you run out of walkable pigeonhole/bin faces a person
  can physically reach. Realistic manual throughput sits around
  600–1,200 units/hour per sort line. That ceiling is what forces Tier 1
  to stay small; past roughly 3,000 parcels/day in a typical operating
  window, a purely manual hub needs either an unrealistic headcount or a
  belt.
- **A single conveyor with manual divert** (modular/roller belt) realistically
  runs 2,000–5,000 units/hour — the Tier 2/3 band.
- **Automated sorters** — tilt-tray tops out around 10,800 units/hour,
  cross-belt up to 25,000 units/hour supporting 100+ destinations — are what
  make Tier 4/5 volumes possible at all. Below that volume, automation is
  capital you don't need yet; above it, nothing else clears the floor fast
  enough.

Tier 5 is included for completeness, but flagged honestly: at that scale,
real mother hubs typically stop being a single I-flow rectangle and become
multi-wing buildings with several sortation cores feeding one lane bank.
The current generator models one block — correct through Tier 4, an
understatement at Tier 5. Most hubs the app will actually generate sit in
Tiers 1–4.

## 3. Zone-by-zone breakdown

In flow order, front to back:

**Inbound dock & yard.** Vehicles from dark stores/sellers arrive here.
Fewer, larger consolidated pickups than the outbound side in most mother-hub
feeder patterns — so inbound typically needs *fewer* doors than outbound,
not an even split.

**Induction / receiving buffer.** The scan point immediately behind the
inbound dock, before anything enters sortation. Every real mother hub has
this step — it's where a shipment stops being "whatever arrived" and starts
being a tracked unit. It should be treated as universal, not optional.

**Sortation core.** The actual segregation step the brief describes: is this
box last-mile-hub-bound, or bound for another city? This is either a
conveyor line (manual divert or automated chute) or a manual sort
station/pigeonhole wall, and it's the single zone whose footprint and
equipment should scale hardest with volume — see the throughput ceilings
above.

**Bagging / packing.** Sorted shipments get consolidated into destination
bags immediately after sortation, before they ever reach outbound staging.
Sits between the sortation core and the lane bank.

**Outbound staging lanes.** The heart of the whole building. One lane per
destination hub/city, holding boxes only for the dwell time until that
route's vehicle loads. Lane count, width, and depth are the decisions that
matter most — get these wrong and nothing else in the layout can compensate.

**Outbound dock & yard.** Dispatch to destination. Because outbound is
destination-fragmented — often close to one vehicle per route — this side
generally needs *more* doors than inbound, the opposite of a naive 50/50
split.

**Exception / missort handling** and **RTO / returns.** Small footprint,
universally present — every real sort hub has a pile of shipments that
didn't scan clean or need to reverse.

**MHE charging.** Relevant the moment handling equipment moves past pure
manual carry.

**Support rooms.** Security, first-aid, ops office, briefing room, spares
store, power room, restrooms — non-operational, packed along one wall, never
in the path of product flow.

## 4. Key design principles

**Through-flow (I-flow) beyond small scale.** Cross-dock facilities are
built as long, narrow, straight-through buildings specifically so goods move
in one direction with minimal travel distance — inbound docks on one wall,
outbound on the opposite. Same-wall (U-flow) is acceptable only at genuinely
low door counts (Tier 1) or when the building physically doesn't offer a
second wall. Past that, same-wall traffic means arriving and departing
vehicles conflict in the yard, which no amount of internal layout skill can
fix.

**Door density is the headline number that separates a cross-dock from a
storage building.** Industry rule of thumb: roughly one dock door per
2,500–3,000 sqft, three to four times the density of a storage warehouse of
the same footprint (which might run one door per 8,000–12,000+ sqft). A
100,000 sqft cross-dock plausibly has 100+ doors; a storage building that
size might have 30–40. If a generated mother-hub layout has storage-warehouse
door density, that's a strong signal something's wrong even before checking
anything else.

**Door spacing.** 12 ft center-to-center is the accepted floor; 14–16 ft is
preferred once door count climbs high enough that adjacent-door MHE traffic
starts to interfere with itself — worth treating as an upgrade at Tier 4–5
rather than a fixed constant everywhere.

**Staging depth follows dwell, not daily volume.** The number of boxes
physically on the floor at any moment is throughput divided by the operating
window, multiplied by dwell time — not a share of the day's total volume.
Sizing lanes off daily volume instead of peak concurrency is a common and
serious design mistake; it either wastes enormous floor space or
undersizes staging badly, depending on which naive assumption you make.

**Golden-zone lane placement.** In a well-run hub, the highest-volume
destination lanes sit closest to the outbound dock, minimizing average
travel distance across the whole operation; low-volume, long-tail
destinations can sit further out or share a lane. This is a refinement, not
yet load-bearing at the volumes most mother hubs run.

**One-way flow, no crossed paths.** Sortation → bagging → staging → dispatch
should read as one direction on the plan. A cart path that has to double
back through a zone it already passed is a sign the block order is wrong,
not that the building is just "busy."

## 5. Where the current generator already gets this right, and where it doesn't

Checked directly against `darkstore-layout-planner.html` /
`server.js` this session:

**Already correct:**
- I-flow vs. U-flow has real geometric consequence, not just a label.
- Door spacing constant (12 ft) matches the accepted industry minimum.
- Equipment-driven aisle width matches real MHE clearance standards
  (hand-cart 4 ft, trolley 6 ft, roll-cage 8 ft, forklift 12 ft).
- Staging depth is peak-concurrency-driven (throughput × dwell), not
  daily-volume-driven — the correct formula, not the common mistake above.
- Outbound-heavier door splits are available and reasoned against actual
  destination count.
- Sort → stage → load ordering is enforced in the geometry itself.

**Fixed this session, now correct:**
- `sortationMethod` previously had zero effect on the drawing — manual,
  semiauto, and automated produced identical output. Now each draws its
  real physical footprint (no belt / single spine / double spine).
- Blueprint photo upload used to bypass the generator and paint the AI
  vision model's raw guessed geometry directly — a materially different
  (and unvetted) design path from the guided questions. Now both paths
  converge on the same deterministic generator.

**Gaps still open**, in rough priority order:
1. No door-count scaling by floor area against the 2,500–3,000 sqft/door
   cross-dock benchmark — today's door count comes only from the frontage
   cap in the doors decision, not from overall footprint.
2. No distinction between inbound (linehaul, deeper apron) and outbound
   (last-mile van, shallower apron) truck-court depth — both dock bands
   share one depth value.
3. No volume-weighted lane placement (golden-zone principle).
4. `inboundStage` and `exception` zones are opt-in when they're near-universal
   in a real mother hub — worth defaulting on rather than requiring the
   manager to know to ask for them.
5. 14 ft door spacing isn't exposed as an option at Tier 4–5 scale.

None of these are wrong in the sense of producing an invalid layout — they're
places where the generator is currently more conservative/generic than a
mother-hub-specific tool could be.

---

Sources: [Cross Docking Explained (SupplyChainMath)](https://supplychainmath.com/en/cross-docking.html) · [Cross-Docking Facilities Guide (WareCRE)](https://warecre.com/cre-insights/logistics-distribution/the-ultimate-guide-to-cross-docking-facilities-when-to-use-them-and-how-to-find-them/) · [Cross-docking Implementation Guide (Racklify)](https://racklify.com/encyclopedia/cross-docking-implementation-guide-facility-layout-processes-and-technology/) · [Choosing Conveyor and Sorter Systems for Parcel Hubs (Interroll)](https://info.interroll.com/blog/choosing-conveyor-and-sorter-systems-for-parcel-hubs-2026) · [Types of Sortation Systems (Element Logic)](https://www.elementlogic.net/us/blogs/types-of-sortation-systems/) · [Warehouse Loading Dock Design (SteelCo)](https://www.steelcobuildings.com/warehouse-loading-dock-design-layout-door-spacing-and-truck-court-planning/) · [McGuire Dock Planning Guide (PDF)](https://www.wbmcguire.com/files/2021-07/McGuire%20Dock%20Planning%20Guide.pdf) · [Delhivery's Asset Mix Strategy](https://www.markhub24.com/post/delhivery-s-asset-mix-strategy-in-logistics) · [Delhivery 2026 Services & Revenue Engines](https://pestel-analysis.com/blogs/how-it-works/delhivery)
