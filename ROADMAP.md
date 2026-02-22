# Oligopoly — Product Roadmap

> You run the world's most powerful bank. Your trades move markets, topple currencies, and reshape economies. Every decision ripples outward — and eventually ripples back.

**Player's mental model (one sentence):**
*"You're steering a bank through a world of connected indicators — hover shows the network, the map shows where pressure is building, and every action shows its causal chain before you commit."*

---

## Design North Star: The Macro Influence Map

The game is a **network of causes and effects you can see**, not a set of disconnected cards.

| Concept | Definition |
|---------|-----------|
| **Nodes** | `(country, metric)` pairs — the only things a player must learn |
| **Edges** | Signed, weighted influences — domestic (within a country) and cross-country |
| **Arrow speed** | Per-turn contribution magnitude — fast arrows = what's driving right now |
| **Heatmap** | Metric filter on world map + deltas + top driver per country |
| **Country click** | Trend sparklines + top drivers + next risk chain |
| **Hover** | The game's signature interaction — Panel A: "What affects this?" (structural) / Panel B: "What moved it this turn?" (situational) |

Everything on the roadmap is sequenced to build toward this experience. Each phase adds layers to the map until the network *is* the game.

---

## Core Loop (all phases)

```
Choose Actions → Simulate Turn → Observe the Influence Map → Adjust Strategy
```

The influence map replaces static readouts. The player sees *why* every number moved, traces causality by hovering, and discovers the system through exploration. The feeling: *I see exactly what I did. Oh no.*

---

## Metrics (the only things the player must learn)

Each country has exactly 7 high-signal metrics:

| Metric | What it represents | Typical range |
|--------|--------------------|---------------|
| **Rates** | Central bank interest rate | 0–20% |
| **Inflation** | Price pressure | -2–30% |
| **Growth** | GDP growth | -10–15% |
| **Stability** | Institutional strength / fragility | 0–100 |
| **FX** | Currency strength vs USD baseline | varies |
| **Debt** | Debt-to-GDP ratio | 0–300% |
| **Sentiment** | Market/popular mood | -100 to +100 |

Plus two derived UI metrics already tracked: `equityIndex` (for portfolio PnL) and a country-level risk heuristic for map coloring.

---

## Phase 0 — "Solid Foundation" (current state → near-term fixes)

### What exists today

- 5 real-world countries (US, EU, China, Brazil, Japan) with 8 indicators each
- 10 trade decisions including Sell Bonds (targetable), Provide Liquidity, Lobby/PR
- Reputation meter (0–100) with game-over at 0 + Risk meter + Liquidity
- Win condition (survive 20 turns above $120B AUM target)
- Seeded RNG (Mulberry32), deterministic simulation, save/load
- Events with personalized attribution text referencing player actions
- Causal chain HUD (text-based: `Rates ↑ → FX ↑ → Exports ↓`)
- 3 scenarios (Calm Markets, Emerging Crisis, Rate Shock)
- Turn summary, event log, portfolio panel, KPI bar, risk meter
- Replay tooling (export/import/hash verification)
- Sanity test suite (seed determinism, NaN/Infinity checks, bound checks)
- Cash buckets: `cashTotal`, `cashAvailable`, `cashLocked`

### Remaining MVP gaps (close before moving forward)

| # | Gap | Why it matters | Status |
|---|-----|----------------|--------|
| 1 | **Implicit edges → explicit edge data** | `tickCountry` has hardcoded formulas. For the influence map to work, domestic edges must be declared as data objects: `{ from, to, direction, weight, formula }`. This is the single most important architectural prerequisite. | **Not started** |
| 2 | **Per-edge contribution tracking** | Each tick must compute and store how much each edge contributed this turn. Without this, "What moved it?" is impossible. | **Not started** |
| 3 | **Personalized event text polish** | Events reference player actions but need tighter integration with the attribution system — every "I caused that" moment should be unmissable. | **Partially done** |

### Phase 0 deliverables

1. Extract domestic edges from `tickCountry` into a declarative `InfluenceEdge[]` data structure in `src/data/edges.ts`
2. Refactor `tickCountry` to iterate over declared edges instead of inline formulas
3. Compute and store `EdgeContribution[]` per turn (magnitude + direction per edge)
4. Surface contributions in the existing causal chain HUD (upgrade from static hints to live data)
5. Verify all existing sanity tests still pass after the refactor

**Definition of done:** The simulation produces identical results (determinism check), but edges are now data-driven and per-turn contributions are computed and available to the UI.

---

## Phase 1 — "The Domestic Map" (1–2 weeks)

### Goal

Every country's internal dynamics are visible as an interactive influence network. The player can hover any metric and immediately understand: what affects it, and what moved it this turn.

### Features (priority order)

| # | Feature | Details |
|---|---------|---------|
| 1 | **Domestic influence graph (per country)** | Declare ~6–8 edges per country representing the core reaction functions: `Inflation ↑ → Rates ↑` (Taylor rule), `Rates ↑ → Growth ↓` (tightening), `Growth ↓ → Sentiment ↓`, `Debt ↑ → Stability ↓`, `FX ↓ → Inflation ↑` (import pass-through), `Stability ↓ → Sentiment ↓`, `Growth ↑ → Debt ↓` (denominator effect). Store as typed data objects, not code. |
| 2 | **"What affects this?" panel (structural)** | Hover or click any metric node → Panel A appears showing all inbound edges with labels and "typical strength" indicators (small/medium/large). This is the always-true structural view. |
| 3 | **"What moved it this turn?" panel (situational)** | Panel B: ranked list of actual edge contributions this turn, sorted by magnitude. Each shows direction, value, and arrow-speed indicator. Player actions appear here too: `Your action: Buy Bonds (−0.1 on Rates)`. |
| 4 | **Animated arrows (Democracy 4 feel)** | Positive influences on the left, negative on the right (or blue/teal vs orange/purple — avoid red/green). Arrow speed = magnitude. Fast arrows = what's driving right now. Players learn: "fast arrows matter." |
| 5 | **Country view upgrade** | Clicking a country opens a focused view answering: **Where is it trending?** (sparklines + deltas for each metric), **Why is it trending?** (top 2–3 edge contributions per key metric), **What's at risk next?** (one short warning chain, ≤3 links). Requires storing metric history per country. |
| 6 | **Decision preview on influence map** | Before ending turn, queued decisions show their expected edges on the map as dashed/preview arrows. Player sees: "If I sell bonds in Brazil, it will push Rates ↑ and Stability ↓." This is the "before" complement to the "after" turn summary. |

### Architecture

- `src/data/edges.ts` — Declarative domestic edge definitions: `{ id, fromCountry, fromMetric, toCountry, toMetric, direction, weight, formula, label }`
- `src/sim/influence.ts` — Edge evaluation engine: takes edges + current state → `EdgeContribution[]`
- `CountryState` gains `history: { turn, rates, inflation, growth, stability, fx, debt, sentiment }[]` (ring buffer, last ~10 turns)
- `GameState` gains `lastTurnContributions: EdgeContribution[]` — the situational data
- `src/ui/InfluencePanel.tsx` — The hover panel (Panels A + B)
- `src/ui/CountryView.tsx` — Upgraded country drill-down

### Fun checks

- [ ] **Hover chain test:** A playtester hovers a metric, sees its drivers, hovers one of *those*, and says "oh, that's why."
- [ ] **Preview trust:** A playtester queues an action, sees the preview arrows, and adjusts their strategy before ending turn.
- [ ] **15-second turns:** Turns still average under 15 seconds — the map aids decision-making rather than adding analysis overhead.

### Complexity guardrails

- Domestic edges only — no cross-country effects yet
- Maximum ~8 edges per country (keep the graph readable)
- No new metrics — use only the existing 7
- Edge weights are static for now (dynamic weights come later)

---

## Phase 2 — "The World Map" (2–4 weeks)

### Goal

The game feels like running the world. A heatmap view shows pressure building across countries. Cross-country edges create contagion — the single most exciting emergent mechanic. The signature experience: hover any metric anywhere and trace causality across borders.

### Features (priority order)

| # | Feature | Details |
|---|---------|---------|
| 1 | **Cross-country edges** | A small set of obvious, teachable spillover channels: **US Rates ↑ → EM Rates ↑** (global funding costs), **Global Stability ↓ → EM FX ↓** (risk-off), **China Growth ↑ → Exporter Growth ↑** (trade channel), **FX ↓ → Inflation ↑** (import pass-through, already domestic but strengthen for open economies). Start with ~8–12 cross-country edges total. |
| 2 | **Heatmap world map** | Default game view becomes a stylized map (not geographically accurate — schematic/hex/node layout is fine). Filter bar: `Rates / Inflation / Growth / Stability / FX / Debt / Sentiment`. Countries colored by current value + subtle overlay arrow for delta direction. Legend always visible with units. |
| 3 | **Map interactions** | Hover country → mini tooltip: value + delta + 1 top driver. Click country → opens Country View (Phase 1 feature #5). Optional: compare mode — pin 2 countries, see deltas side-by-side. |
| 4 | **Cross-border arrows on map** | When a cross-country edge fires with significant magnitude, show an animated arrow between countries on the map. "US rates are pulling up Brazil's borrowing costs" becomes visible as a pulsing arrow US → Brazil. |
| 5 | **Contagion chains** | When stability drops below a threshold in one country, amplify cross-country edge weights. A crisis in Brazil now visibly pushes China exports down and EU sentiment negative. The player sees the chain forming 1–2 turns before it hits. |
| 6 | **Multi-turn event chains** | Events gain preconditions based on world state, not just random draws. "EM Currency Pressure" (turn N) → "Capital Flight" (turn N+1, if stability drops) → "IMF Intervention" (turn N+2, if debt > threshold). Start with 3 hand-authored chains. Event pool grows to ~30. |
| 7 | **3 more countries** | Add India (tech-services hub), Nigeria (commodity exporter / frontier), Saudi Arabia (oil sovereign fund) or similar archetypes. Each with distinct edge weights reflecting their economic personality: India is sensitive to US tech sentiment, Nigeria to commodity prices, Saudi to oil/energy dynamics. **Do not add countries without cross-country edges.** 8 independent countries is not more interesting than 5 — the edges are the point. |
| 8 | **Expanded trade menu (12–13 decisions)** | Add 2–3 new decisions that interact with the influence map: **Capital Controls** (restrict FX flows — stabilizes currency, hurts growth and your access), **Central Bank Lobbying** (expensive, reputation-damaging if discovered, partially effective rate influence), **Foreign Aid** (spend capital, gain reputation, stabilize a country). Each must have a visible benefit and a visible cost. |

### Architecture

- `src/data/edges.ts` grows to include cross-country edges with the same schema
- `src/sim/influence.ts` now processes both domestic and cross-country edges in a single pass
- Add a `crossCountryEffects()` step to `advanceTurn` between "tick countries" and "compute PnL" — or fold into the unified edge evaluation
- Contagion multiplier: edge weights scale with source instability (piecewise linear, not exponential — keep it auditable)
- `src/ui/WorldMap.tsx` — The heatmap view (schematic, not geographic)
- `src/ui/MapTooltip.tsx` — Hover tooltips on the map

### Interconnection model (Phase 2 scoped)

Target: ~60 edges across 8 countries (domestic + cross-country). Still computable in <1ms per tick. Each edge has: `{ from, to, direction, weight, delayTurns?, thresholdCondition?, label }`. Weights are piecewise-linear at extremes — a country at 90% debt reacts more violently to rate hikes than one at 40%.

### Fun checks

- [ ] **Contagion moment:** At least once per game, a crisis in one country visibly spreads to another. The player sees it coming 1–2 turns before via the map arrows.
- [ ] **Map scan:** A playtester uses the heatmap filter bar to scan for trouble, finds it, and takes preventive action. The map replaced reading 5 separate country cards.
- [ ] **Cross-border "oh no":** A US rate hike visibly hurts Brazil through the influence arrows. The player didn't expect the second-order effect.
- [ ] **Moral tension:** Player faces at least one decision where profit and stability are in direct conflict.

### Complexity guardrails

- Maximum 12 cross-country edges (keep the global graph scannable)
- No dynamic edge creation — all edges are predeclared in data
- Edge weights scale with state but don't spawn new edges
- Event chains are scripted, not emergent (max 3 chains, each ≤ 3 events)
- No new metrics — still the same 7

---

## Phase 3 — "Global Influence" (1–2 months)

### Goal

The game has strategic depth across 40–60 turn sessions with real arcs (early positioning → mid-game crises → endgame payoff). The influence map is the primary decision-making interface. Second-order effects surprise and delight. Replayability through varied event chains and starting conditions.

### Features (priority order)

| # | Feature | Details |
|---|---------|---------|
| 1 | **Dynamic event system** | Events with rich preconditions on world state + edge contribution data. "Sovereign debt crisis" fires only if `debt > 85%` AND `rates rising for 2 turns` AND `stability < 50`. Chain reactions: one event can trigger another next turn. Pool expands to ~50 events, including ~8 multi-turn chains. |
| 2 | **Headline ticker** | Scrolling news bar with flavor headlines referencing game state and recent edge contributions: "US rate hike sends shockwaves through EM borrowing costs" / "Brazil stability hits 5-year low amid capital flight." Adds atmosphere, reinforces the influence map narrative. |
| 3 | **Scenario selector (expanded)** | 5 starting scenarios with different world states and edge weight profiles: "Calm Markets" (existing), "Emerging Crisis" (existing), "Rate Shock" (existing), "Commodity Supercycle" (exporters boom, importers squeezed), "Contagion" (one country starts near crisis, edges are amplified). |
| 4 | **End-game debrief with influence replay** | Beyond win/lose: score based on portfolio value, countries stabilized/destabilized, reputation maintained. Debrief screen shows a **timeline of your key decisions overlaid on the influence map** — replay the turn-by-turn impact of your choices. "Here's when you broke Brazil." |
| 5 | **Country relationship web (full visualization)** | A dedicated screen showing all countries as nodes with trade-flow edges, contagion risk indicators, and current edge activity. The whole global network at a glance — the Democracy 4 "policy web" equivalent. |
| 6 | **Projection overlay** | "If you do nothing" projection clearly labeled on the country view. Uses current edge contributions to extrapolate 2–3 turns forward. Low-confidence, obviously marked as speculative — but valuable for new players learning the system. |
| 7 | **Save/load polish** | Serialize game state to localStorage. Replay-based saves (seed + action history). Version number + migration function. Test round-trip: save → load → continue for 3 turns → verify no drift. (Partially exists — polish and verify.) |
| 8 | **Basic sound design** | Ambient trading floor hum, subtle event chime, crisis alarm when contagion triggers, tension sound when risk > 75, game-over stinger. Audio is atmosphere. Budget 1–2 days max. Do not touch until features #1–#6 are done. |

### Architecture

- Event DSL: events become data-driven with conditions like `{ "country.debt": { "gt": 0.85 }, "edge.us_rates_to_br_rates.magnitude": { "gt": 0.3 } }`. This unblocks non-engineers writing events.
- `StatePatch` type replaces `Partial<GameState>` for event/decision effects — only allows `countries` and `portfolio` fields, preventing accidental overwrites of `turn`, `seed`, etc.
- Replay system records all player inputs per turn. Replay = run the same seed + inputs through `advanceTurn`. Essential for debrief screen and bug reports.
- Projection engine: read-only simulation fork that runs 2–3 turns with no player actions, returns metric trajectories.

### Fun checks

- [ ] **"One more turn" test:** Playtesters want to restart after losing.
- [ ] **"I caused that" moments:** At least 3 per game — an event headline makes the player say "oh no, that was me."
- [ ] **Strategic diversity:** Across 5 playthroughs, playtesters pursue meaningfully different strategies.
- [ ] **Debrief engagement:** Players spend >30 seconds on the end-game debrief screen, not skip it.
- [ ] **Influence map literacy:** By turn 5, a new player can hover a metric and correctly explain why it moved.

### Complexity guardrails

- No real-time elements — stay turn-based
- No procedural country generation — hand-authored only
- No more than 15 trade types
- No branching storylines — events are systemic, not narrative
- No AI opponents yet

---

## Phase 4 — "Too Big to Fail" (3–6 months)

### Goal

The game becomes a systems sandbox — players discover emergent strategies the designers didn't anticipate. AI rival banks create adversarial dynamics. The influence map is alive with competing pressures. The game is polished enough to charge money for.

### Features (priority order)

| # | Feature | Details |
|---|---------|---------|
| 1 | **AI rival banks (2–3)** | Each with a distinct strategy archetype: aggressive short-seller, conservative bond holder, EM specialist. Their trades are visible on the influence map as external edge contributions — the player sees rival pressure as arrows pushing metrics. They make the world feel alive without PvP complexity. |
| 2 | **Campaign mode (5 eras)** | Sequential scenarios with escalating complexity: "Post-War Reconstruction" → "Emerging Markets Boom" → "Deregulation Era" → "Financial Crisis" → "New World Order." Each era is 30 turns. Portfolio carries over, world state resets. Influence map complexity increases era-over-era. |
| 3 | **12 countries + regional blocs** | Countries belong to trade blocs with bloc-level edge modifiers (trade agreements amplify growth spillovers, sanctions cut edges). More nodes on the map = more visible systemic behavior. |
| 4 | **Advanced instruments (18–20 total)** | CDOs (bundle and sell risk), QE Frontrun (anticipate central bank moves), Dark Pool (hidden from rivals, costs more), Activist Short (public short + media campaign), Bailout Negotiation. Each creates new edge contributions visible on the map. |
| 5 | **Reputation factions** | Reputation splits into 3 audiences: **Public** (media/protests), **Regulators** (investigations/fines), **Governments** (sovereign deal access). Each appears as a separate influence target on the map. Managing these tradeoffs is the late-game strategic layer. |
| 6 | **Contagion visualization (animated)** | When a crisis spreads, an animated ripple propagates across the world map following the cross-country edges. The single most satisfying visual in the game. |
| 7 | **Scenario editor + sharing** | JSON-based format for starting states, edge weight profiles, event pools, win conditions. Share via export/import. |
| 8 | **Persistent statistics + achievements** | Track across playthroughs: countries destabilized, total profit, biggest single-turn loss, crises caused/averted. Unlockable titles. |
| 9 | **Difficulty levels + historical scenarios** | Easy/Normal/Hard + modifiers: "Glass-Steagall" (restrict trade types), "Transparency Act" (all trades public), "Infinite Leverage" (chaos mode). Historical scenarios: "Asian Crisis '97", "2008 GFC". |
| 10 | **Full audio + visual polish** | Professional UI overhaul, animated transitions, particle effects on major events, dynamic soundtrack responding to influence map tension. |
| 11 | **Mobile-responsive layout** | Tablet-first. Phone is a stretch goal — the influence map's information density may not compress well. |

### Interconnection model (Phase 4 scoped)

Full agent-based simulation layer on top of the influence graph. Countries have simple AI that reacts to conditions: central banks adjust rates (modifying edge weights), governments enact austerity or stimulus. AI banks are agents in the same system — their trades appear as edge contributions. Market prices emerge from aggregate behavior, not static formulas.

Target: ~100 edges, 12 countries, 3 AI banks. May need batch computation between turns if >50ms.

### Fun checks

- [ ] **Rival bank rivalry:** Players develop opinions about each AI bank ("Meridian Capital always front-runs me").
- [ ] **Emergent stories:** Playtesters describe games in narrative terms — "I stabilized Brazil but it bankrupted me, then Japan collapsed and I profited from swaps I'd positioned two eras ago."
- [ ] **Campaign pull-through:** >60% of players who start Era 1 reach Era 3.
- [ ] **Contagion ripple satisfaction:** The animated crisis spread across the map is something players want to show to friends.
- [ ] **Scenario sharing:** At least 3 fun community scenarios within the first month.

---

## Implementation Sequence (prioritized backlog)

### Immediate — Phase 0: Foundation (days, not weeks)

1. Extract domestic edges from `tickCountry` into declarative `InfluenceEdge[]` data structure
2. Refactor `tickCountry` to evaluate declared edges (same math, data-driven)
3. Compute and store `EdgeContribution[]` per turn
4. Verify determinism — sanity tests must still pass identically

### Near-term — Phase 1: Domestic Map (1–2 weeks)

5. "What affects this?" structural panel (hover any metric)
6. "What moved it this turn?" situational panel (ranked contributions)
7. Animated arrows with speed = magnitude (Democracy 4 feel)
8. Country view upgrade: sparklines + drivers + risk chain
9. Decision preview arrows on the influence map
10. Store metric history per country (ring buffer, ~10 turns)

### Mid-term — Phase 2: World Map (2–4 weeks)

11. Cross-country edge definitions (~8–12 edges)
12. Unified edge evaluation (domestic + cross-country in one pass)
13. Heatmap world map with metric filter bar
14. Map hover tooltips + click-to-country-view
15. Cross-border animated arrows on map
16. Contagion amplification (edge weights scale with instability)
17. Multi-turn event chains (3 scripted chains)
18. 3 more countries with cross-country edges
19. 2–3 new decisions (Capital Controls, Central Bank Lobby, Foreign Aid)

### Later — Phase 3: Strategic Depth (1–2 months)

20. Dynamic event system with rich preconditions (~50 events)
21. Headline ticker referencing influence map state
22. Expanded scenario selector (5 scenarios)
23. End-game debrief with influence timeline replay
24. Country relationship web (full network view)
25. Projection overlay ("if you do nothing")
26. Sound effects — minimal set (budget 1–2 days)

### Future — Phase 4: Full Vision (3–6 months)

27. AI rival banks (2–3 agents visible on influence map)
28. Campaign mode (5 eras)
29. 12 countries + trade blocs
30. Advanced instruments (18–20 decisions)
31. Reputation factions (Public / Regulators / Governments)
32. Animated contagion ripple visualization
33. Scenario editor + sharing
34. Persistent statistics + achievements
35. Difficulty levels + historical scenarios
36. Full audio + visual polish
37. Mobile-responsive layout

---

## Edge Catalog (reference for implementation)

### Domestic edges (per country, ~6–8 each)

These are the core reaction functions inside each country:

| Edge | Direction | Mechanic | Label |
|------|-----------|----------|-------|
| Inflation → Rates | + | Central bank tightens when inflation rises | Taylor rule |
| Rates → Growth | − | Higher rates slow the economy | Tightening drag |
| Growth → Sentiment | + | Growth lifts market mood | Growth optimism |
| Debt → Stability | − | High debt erodes institutional strength | Debt fragility |
| FX ↓ → Inflation | + | Weaker currency raises import prices | FX pass-through |
| Stability → Sentiment | + | Stability supports confidence | Institutional trust |
| Growth → Debt | − | Growth shrinks debt-to-GDP denominator | Growth dividend |
| Rates → FX | + | Higher rates attract capital, strengthen currency | Rate differential |

Each country can have different *weights* on these edges (expressing its economic personality) without needing different edge *types*. Brazil's FX pass-through is stronger than the US's. Japan's rate-to-growth sensitivity is lower.

### Cross-country edges (Phase 2, ~8–12 total)

| Edge | Channel | Mechanic |
|------|---------|----------|
| US Rates → EM Rates | Global funding costs | When the US tightens, EM borrowing costs rise |
| US Rates → EM FX | Dollar strength | Higher US rates strengthen USD, weaken EM currencies |
| China Growth → Exporter Growth | Trade/commodities | China's demand drives commodity/export economies |
| Global Stability → EM FX | Risk-on/risk-off | When stability drops globally, capital flees EM |
| Global Stability → EM Sentiment | Flight to safety | Instability triggers fear in vulnerable markets |
| US Sentiment → EU Sentiment | Confidence contagion | US market mood spills into European markets |
| Oil/Commodity shock → Exporter Growth | Terms of trade | Commodity price swings hit exporters directly |
| EM Crisis → Global Stability | Contagion | EM instability creates systemic risk globally |

"Global" edges use an aggregated metric (e.g., average stability weighted by GDP) as the source.

---

## Technical Stack (actual + planned)

| Layer | Current (Phase 0) | Phase 1–2 | Phase 3–4 |
|-------|-------------------|-----------|-----------|
| **Runtime** | Browser (Vite SPA) | Same | Browser + optional Electron |
| **Language** | TypeScript | TypeScript | TypeScript |
| **Framework** | React 19 + Recharts | + Canvas/SVG for influence map | + WebGL for contagion viz |
| **State** | Zustand + seeded RNG | + edge contribution tracking | + event DSL + AI agents |
| **Persistence** | localStorage | Same | + Firebase/Supabase backend |
| **Data** | TS objects (countries, decisions, events) | + declarative edge definitions | + scenario editor + event DSL |
| **Testing** | Vitest (sanity + replay determinism) | + edge evaluation unit tests | + automated balance sims (10k games) |

---

## Key Risk Register

| Risk | Mitigation |
|------|------------|
| **Influence map feels overwhelming** | Start with domestic-only edges (Phase 1). Add cross-country gradually. The hover panel shows one node's connections at a time — never the whole graph at once. |
| **Edge refactor breaks determinism** | Phase 0 is a pure refactor with identical output. Sanity tests catch any drift before anything else ships. |
| **Cross-country edges make balance impossible** | Keep the first version to ~8 obvious spillovers. Each must be teachable in one sentence. Expand only when clarity holds. |
| **Decision paralysis from the map** | The map is for *understanding*, not *commanding*. Decisions remain in the decisions panel. The map just shows consequences. Quick scan (heatmap) + deep dive (hover) serve different player speeds. |
| **"Spreadsheet game" feel** | Animated arrows, heatmap colors, and the hover interaction make the system feel alive. Events with personalized headlines create emotional beats. Sound in Phase 3 adds atmosphere. |
| **Scope creep into realistic financial simulation** | We model *consequences*, not mechanisms. No order books, no tick-by-tick pricing. Edges are simplified reaction functions, not econometric models. |
| **Performance with many edges** | 60 edges × 8 countries is trivially fast (<1ms). Profile before worrying. Budget exists: turn resolution <100ms, UI re-render <16ms. |

---

## Country Design Philosophy

Each country feels different through data, never through special-case code:

| Differentiator | How it works |
|----------------|-------------|
| **Starting metric profile** | Stable reserve (US) vs fragile EM (Brazil) vs commodity exporter (Saudi) vs tech hub (India) |
| **Domestic edge weights** | Brazil's FX pass-through is 2× the US's. Japan's rate sensitivity is lower. |
| **Cross-country edge exposure** | EM countries have stronger inbound edges from US rates. Exporters have stronger inbound edges from China growth. |
| **Event pool** | Crisis-prone countries have more tail-risk events. Stable countries have more "slow burn" events. |

No special-case UI logic. Personality emerges from the edge graph and event weights.

---

## Success Metrics by Phase

| Metric | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|--------|---------|---------|---------|---------|
| Avg session length | >15 min | >20 min | >30 min | >45 min |
| Restart rate after loss | >40% | >45% | >55% | >65% |
| Unique strategies observed | 2–3 | 4–5 | 6+ | 10+ |
| "I caused that" moments/game | 1+ | 2+ | 3+ | 5+ |
| Influence map hover rate | — | >3 hovers/turn | >5 hovers/turn | Natural habit |
| Map scan before end turn | — | >30% of turns | >60% of turns | Default behavior |
| Cross-border causality awareness | — | Can name 1 spillover | Can name 3 | Fluent |

---

## Design Principles (quick reference)

1. **Consequence clarity** — Hover answers "why?" in 2 seconds.
2. **Meaningful tradeoffs** — Every arrow has a cost. No free lunches.
3. **Emergent depth** — Complexity from edge interactions, not new variables.
4. **Escalating stakes** — Edge weights amplify under stress. Early mistakes compound.
5. **Visible causality > hidden simulation** — If the player can't see an edge, it doesn't belong in the sim.
