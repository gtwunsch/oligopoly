# Oligopoly — Product Roadmap

> You run the world's most powerful bank. Your trades move markets, topple currencies, and reshape economies. Every decision ripples outward — and eventually ripples back.

---

## Core Loop (all phases)

```
Make Trades → Markets React → Event Fires → Reputation/Risk Update → Next Turn
```

The player is never just "clicking buttons." Every action has a visible chain of consequences displayed as causal arrows, Democracy 4-style. The feeling: *I did this. Oh no.*

---

## MVP — "The Trading Floor" (1–2 weeks)

### Goals

- Playable in browser, 15–20 turns, completable in one sitting (~20 min)
- Player immediately feels the weight of decisions (visible cause → effect chains)
- Loss states are dramatic and clear (bank run, sovereign default you caused, political scandal)
- Core interconnected system works: trades → country indicators → events → feedback
- Zero tutorial needed — UI teaches through tooltips and causal arrows
- Early-game guidance is invisible: 3-turn optional onboarding + one small optional quarter objective

### Features (priority order)

| # | Feature | Details |
|---|---------|---------|
| 1 | **5 countries** | Each with: GDP growth, interest rate, currency strength, debt/GDP, stability index. Distinct archetypes — see below. |
| 2 | **10 trade decisions** | Buy/Sell Sovereign Bonds, Buy Equities, Buy Gold, Short Currency, Interest Rate Swap (receive/pay fixed), Increase/Reduce Leverage, Provide Liquidity, Lobby/PR Spend. Each has a 1-line tradeoff summary and one playstyle tag (**Stabilizer / Predator / Allocator**) visible in the decisions panel filter. |
| 3 | **2 player meters** | **Reputation** (0–100): media/political heat. Drops when your trades visibly hurt countries. **Risk** (0–100): bank fragility. High leverage + concentrated bets push this up. Either hitting 0/100 = game over. |
| 4 | **Causal chain display** | Small HUD element: `Rates ↑ → FX ↑ → Exports ↓ → Growth ↓`. Updates live after each trade. This is the single most important UX element — it's what makes the game *feel* systemic. |
| 5 | **1 event per turn** | Drawn from a pool of ~20 scripted events. Headline + effect + "why this happened" tooltip. Events reference your past actions when relevant ("Your bond sell-off contributed to Rivara's credit downgrade"). Include a lightweight subset of scripted A/B choice events (no multi-turn chains in MVP). |
| 6 | **Turn summary screen** | After resolving: P&L this turn, portfolio value, country indicator deltas, any triggered events. One screen, scannable in 5 seconds. |
| 7 | **Win/loss conditions** | **Win:** survive 20 turns with portfolio value above target. **Lose:** Risk hits 100 (bank collapse), Reputation hits 0 (regulatory seizure), or a country you're exposed to defaults and wipes you. |
| 8 | **Basic portfolio view** | What you hold, current value, exposure by country. Table format is fine. |

### Country Archetypes (MVP)

| Country | Archetype | Personality |
|---------|-----------|-------------|
| **Columnis** | Stable reserve currency | Safe but low-yield. Shorting it is bold. Your biggest trading partner. |
| **Rivara** | Fragile emerging market | High yield, volatile. Vulnerable to your bond sells. Where crises start. |
| **Petralund** | Commodity exporter | Tied to oil/gas prices. Booms and busts. Great for equities... until it isn't. |
| **Kaelmont** | Export-driven manufacturer | Currency-sensitive. Your rate swaps hit here hard. Stable until trade shocks. |
| **Dharvia** | High-debt developed nation | Teetering. Buying their bonds props them up; selling accelerates doom. Most morally loaded. |

### Interconnection Model (MVP-scoped)

Keep it to a **directed graph with ~15 edges**. Each edge is a simple linear modifier.

```
Player buys Rivara bonds → Rivara rates ↓ → Rivara currency ↑ → Rivara exports ↓
Player shorts Kaelmont FX → Kaelmont currency ↓ → Kaelmont exports ↑ → Kaelmont growth ↑ (delayed)
Player increases leverage → Risk ↑ → All returns amplified → Loss amplified too
```

Store as a flat adjacency list. No need for a graph library. Each edge: `{ from, to, weight, delay_turns }`. Weights are static in MVP.

### Tech Debt / Architecture

- **State machine for game turns.** Turns are discrete, not real-time. State = `{ turn, countries[], portfolio, meters, eventPool }`. Pure function: `nextState = resolve(currentState, playerActions)`. This makes the game trivially testable and replayable.
- **No backend in MVP.** Single-page app, all state in memory. Use a seeded RNG so playthroughs are reproducible for debugging.
- **Data-driven events.** Events are JSON objects with conditions and effects, not hardcoded logic. This pays off immediately in v1.
- **Don't optimize the interconnection graph.** 5 nodes × 5 indicators = 25 values. A brute-force tick is fine.

### Fun Checks

- [ ] **"One more turn" test:** Do playtesters want to restart after losing?
- [ ] **"I caused that" moment:** At least once per game, an event headline should make the player say "oh no, that was me."
- [ ] **Meaningful loss:** When Risk hits 100 or Reputation hits 0, the player understands *which decisions* led there (chain display helps).
- [ ] **No obvious dominant strategy:** If playtesters always do the same opening 5 trades, the decision space is too shallow.
- [ ] **15-second turns:** If a turn takes longer than 15 seconds on average, there's too much to process.

### Complexity Guardrails (what NOT to do yet)

- No multiplayer
- No persistent progression / meta-game
- No more than 5 countries
- No derivatives beyond basic interest rate swaps
- No dynamic event generation — scripted pool only
- No sound, no animations beyond simple transitions
- No mobile layout — desktop browser only
- No difficulty settings — tune one balanced experience

---

## v1 — "Global Influence" (1–2 months)

### Goals

- 40–60 turn games with real strategic arcs (early positioning → mid-game crises → endgame payoff)
- Player actions have **second-order effects** that surprise and delight ("I didn't expect *that* to happen")
- Replayability through varied event sequences and country starting conditions
- The game teaches real financial concepts without ever feeling educational

### Features (priority order)

| # | Feature | Details |
|---|---------|---------|
| 1 | **Dynamic event system** | Events now have preconditions based on world state, not just random draws. "Sovereign debt crisis" only fires if debt/GDP > threshold AND rates rising. Pool expands to ~50 events. Chain reactions: one event can trigger another next turn. |
| 2 | **8 countries** | Add 3 more archetypes: tax haven micro-state, post-conflict rebuilder, tech-boom economy. More edges in the graph = more emergent behavior. |
| 3 | **Expanded trade menu (15 decisions)** | Add: Credit Default Swaps (bet on/against country default), Currency Peg Attack (high-risk, high-reward against pegged currencies), Foreign Aid (spend capital, gain reputation, stabilize a country), Hire Analyst (reveals hidden country stats for 3 turns), Restructure Debt (offer a country better terms — costs you, stabilizes them). |
| 4 | **3 player meters** | Add **Capital** as an explicit resource. You can't do everything. Leverage amplifies capital but amplifies risk. Creates genuine resource-allocation tension. |
| 5 | **Country relationship web (visible)** | Democracy 4-style node graph on a dedicated screen. Countries are nodes, trade flows are edges. Player can see "if Rivara crashes, Kaelmont loses 20% of export revenue." Makes the systemic nature *tangible*. |
| 6 | **Headline ticker** | Scrolling news bar with flavor headlines that reference game state. "Columnis central bank signals rate hold" / "Petralund oil exports surge after Rivara sanctions." Adds atmosphere without mechanics. |
| 7 | **Scenario selector** | 3 starting scenarios with different world states: "Calm Markets" (tutorial-ish), "Emerging Crisis" (Rivara starts fragile), "Rate Shock" (global rates spiking). Seeds replayability. |
| 8 | **End-game scoring + debrief** | Beyond win/lose: score based on portfolio value, countries stabilized/destabilized, reputation maintained. Debrief screen shows a timeline of your key decisions and their downstream effects. |
| 9 | **Save/load** | Serialize game state to localStorage. One save slot is enough. |
| 10 | **Basic sound design** | Ambient trading floor hum, subtle event chimes, tension music when Risk > 75. Audio is 80% of atmosphere. |

### Interconnection Model (v1-scoped)

Upgrade from linear modifiers to **piecewise curves** — effects are stronger at extremes. A country at 90% debt/GDP reacts much more violently to rate hikes than one at 40%.

Add **cross-country edges**: Rivara's default impacts Kaelmont's banks (they hold Rivara's debt). This creates contagion — the single most exciting emergent mechanic.

Target: ~40 edges across 8 countries. Still computable in <1ms per tick.

### Tech Debt / Architecture

- **Extract simulation engine.** The `resolve()` function is getting complex. Split into: `applyTrades()`, `tickIndicators()`, `evaluateEvents()`, `updateMeters()`. Each is a pure function, independently testable.
- **Event DSL.** Events should be authorable in a simple JSON/YAML format with conditions like `{ "country.debtGdp": { "gt": 0.85 }, "player.holds": "bonds:rivara" }`. This unblocks non-engineers writing events.
- **Replay system.** Record all player inputs per turn. Replay = run the same seed + inputs through `resolve()`. Essential for bug reports and balancing.
- **TypeScript is already in use** (good). Tighten the types: replace `Partial<GameState>` returns in event/decision effects with a narrower `StatePatch` type that only allows `countries` and `portfolio` fields. This prevents accidental overwrites of `turn`, `seed`, etc.

### Fun Checks

- [ ] **Contagion moment:** At least once per game, a crisis in one country should visibly spread to another. Player should see it coming 1–2 turns before it hits.
- [ ] **Moral tension:** Player should face at least one decision where profit and stability are in direct conflict, and the "right" answer isn't obvious.
- [ ] **Strategic diversity:** Across 5 playthroughs, playtesters should pursue meaningfully different strategies.
- [ ] **"Tell a friend" moment:** Something happens in-game that's interesting enough to describe to someone else.
- [ ] **Debrief engagement:** Players should spend >30 seconds on the end-game debrief screen, not skip it.

### Complexity Guardrails

- No real-time elements — stay turn-based
- No procedural country generation — hand-authored only
- No multiplayer (yet)
- No more than 15 trade types — decision paralysis is the enemy
- No branching storylines — events are systemic, not narrative
- No micro-transactions or monetization design
- No AI opponents / competing banks

---

## v2 — "Too Big to Fail" (3–6 months)

### Goals

- The game becomes a **systems sandbox** — players discover emergent strategies the designers didn't anticipate
- Competing banks (AI) create adversarial dynamics and market-moving counter-trades
- Campaign mode gives long-term goals and narrative arc across multiple "eras"
- Community can create and share custom scenarios
- The game is polished enough to charge money for

### Features (priority order)

| # | Feature | Details |
|---|---------|---------|
| 1 | **AI rival banks (2–3)** | Each with a distinct strategy archetype: aggressive short-seller, conservative bond holder, emerging-market specialist. They make trades that move markets. You can see their public positions but not their full portfolio. Creates adversarial dynamics without PvP complexity. |
| 2 | **Campaign mode (5 eras)** | Sequential scenarios with escalating complexity: "Post-War Reconstruction" → "Emerging Markets Boom" → "Deregulation Era" → "Financial Crisis" → "New World Order." Each era is 30 turns. Portfolio carries over, but world state resets. |
| 3 | **12 countries + regional blocs** | Countries now belong to trade blocs. Bloc-level policies (trade agreements, sanctions) create macro-level dynamics. Add: African Union rising economy, Southeast Asian tiger, Middle Eastern sovereign fund state, South American populist state. |
| 4 | **Advanced instruments (20 total)** | Add: Collateralized Debt Obligations (bundle and sell risk), Quantitative Easing Frontrun (anticipate central bank moves), Dark Pool trades (hidden from rivals, costs more), Activist Short (public short + media campaign), Bailout Negotiation (when a country is failing, negotiate terms). |
| 5 | **Reputation factions** | Reputation splits into 3 audiences: **Public** (media/protests), **Regulators** (investigations/fines), **Governments** (access to sovereign deals). You can't please everyone. Managing these tradeoffs is the late-game strategic layer. |
| 6 | **Scenario editor + sharing** | JSON-based scenario format. Players can set starting country states, event pools, win conditions. Share via export/import. Workshop-style browser if we have a backend. |
| 7 | **Contagion visualization** | When a crisis spreads, an animated ripple propagates across the country relationship graph. The single most satisfying visual in the game. |
| 8 | **Persistent statistics** | Track across all playthroughs: countries destabilized, total profit, biggest single-turn loss, crises caused, crises averted. Unlockable titles: "Market Maker," "Vulture," "Stabilizer." |
| 9 | **Difficulty + modifiers** | Easy/Normal/Hard + toggleable modifiers: "Glass-Steagall" (can't mix commercial/investment), "Transparency Act" (all trades public), "Infinite Leverage" (chaos mode). |
| 10 | **Full audio + visual polish** | Professional UI overhaul, animated transitions, particle effects on major events, dynamic soundtrack that responds to game tension. This is the "juice" pass. |
| 11 | **Mobile-responsive layout** | Tablet-first responsive design. Phone is stretch goal — the information density may not compress well. |

### Interconnection Model (v2-scoped)

Full **agent-based simulation**. Countries have simple AI that reacts to conditions: central banks adjust rates, governments enact austerity or stimulus, populations protest. These reactions feed back into the model.

AI banks are agents in the same system. Their trades affect the same indicators yours do. Market prices emerge from aggregate behavior, not static formulas.

Target: ~80 edges, 12 countries, 3 AI banks. May need to batch-compute between turns if >50ms. Still fine for turn-based.

### Tech Debt / Architecture

- **Backend required.** Campaign save states, scenario sharing, and persistent stats need server-side storage. Keep it minimal: auth + blob storage for game states + scenario index. Consider Firebase or Supabase to avoid building infra.
- **Simulation engine as a standalone module.** Extract into its own package with a clean API. This enables: headless testing, AI training runs, balance automation, and future modding.
- **Balance automation.** Run 10,000 simulated games with random-strategy bots. Flag scenarios where one strategy dominates, or where win rates are <20% or >80%. This replaces manual playtesting for gross imbalances.
- **Performance budget.** Set a hard limit: turn resolution <100ms, UI re-render <16ms. Profile early if AI agents push past this.
- **Accessibility pass.** Color-blind safe palette, screen reader labels for key elements, keyboard navigation for all trade actions.

### Fun Checks

- [ ] **Rival bank rivalry:** Players should develop an opinion about each AI bank ("I hate Meridian Capital, they always front-run me").
- [ ] **Emergent stories:** Playtesters should describe their game in narrative terms ("I stabilized Rivara but it bankrupted me, then Dharvia collapsed and I profited from the CDOs I'd positioned two eras ago").
- [ ] **Campaign pull-through:** >60% of players who start Era 1 should reach Era 3.
- [ ] **Scenario sharing:** At least 3 genuinely fun community scenarios within the first month of editor release.
- [ ] **"One more era":** After finishing a campaign, players want to restart with a different strategy.

### Complexity Guardrails

- No real-time multiplayer — async/competitive leaderboards are the ceiling
- No procedural narrative — emergent stories come from systems, not generated text
- No blockchain/NFT integration
- No simulation of individual trades/order books — we model outcomes, not mechanisms
- No political editorializing in event text — present tradeoffs neutrally
- No more than 20 trade types — if we want more variety, add modifiers to existing trades instead

---

## Boilerplate Audit & Next Steps Mapping

> This section evaluates the boilerplate (PR #1, branch `cursor/global-investment-simulator-5ce5`) against the roadmap and maps the suggested "next improvements" to the correct phase.

### What the boilerplate covers

The boilerplate is a functional React + TypeScript + Vite SPA using Zustand for state. It delivers:

- **5 real-world countries** (US, EU, China, Brazil, Japan) with 8 indicators each
- **10 trade decisions** (buy bonds × 2, buy equities × 2, short CNY, buy gold, leverage up/down, rate swap, liquidate all)
- **Simulation engine** (`advanceTurn` pure function) with per-country `tickCountry` macro model, PnL calculation, and risk/liquidity scoring
- **10 events** with conditional triggers and weighted random selection
- **Seeded RNG** (Mulberry32) for reproducible playthroughs
- **UI components**: KPI bar, country cards, decisions panel, portfolio charts (recharts), risk meter, event log, turn summary modal, start screen
- **Save/load** to localStorage (roadmap had this in v1, fine to keep)
- **Basic score** system

This is a solid MVP skeleton. The core turn loop works. However, several roadmap-critical MVP features are missing.

### MVP gaps to close before moving to "next improvements"

These are features the roadmap marks as essential to MVP that the boilerplate does not implement. **These should be addressed first**, before any of the suggested next improvements.

| Gap | Roadmap ref | Priority | Why it matters |
|-----|-------------|----------|----------------|
| **Reputation meter** | MVP #3 | **P0** | The roadmap defines 2 player meters: Reputation + Risk. The boilerplate only has Risk + Liquidity. Without Reputation, there's no political/media feedback loop, and the "Lobby/PR" decision has no purpose. Reputation hitting 0 is a game-over condition. |
| **Causal chain display** | MVP #4 | **P0** | The single most important UX element per the roadmap. Without visible `Rates ↑ → FX ↑ → Exports ↓` chains, the interconnected system feels like a black box. This is what separates the game from a spreadsheet. |
| **Lobby/PR + Provide Liquidity decisions** | MVP #2 | **P1** | The roadmap specifies these as 2 of the 10 core decisions. The boilerplate replaces them with a second bond buy and a "liquidate all" button. Lobby/PR interacts with Reputation; Provide Liquidity interacts with country stability. Both are needed for meaningful tradeoffs. |
| **Personalized event text** | MVP #5 | **P1** | Events should reference player actions: "Your bond sell-off contributed to Brazil's credit downgrade." Current events are generic wire-service headlines. This is how the game creates "I caused that" moments. |
| **Win condition** | MVP #7 | **P1** | Only a loss condition exists (AUM < $20B). The roadmap specifies: survive 20 turns with portfolio above target. Without a win state, there's no goal to play toward. |
| **Sell Sovereign Bonds decision** | MVP #2 | **Closed (P1 core)** | Implemented as targetable `SELL_BONDS` with `targetCountry` + `amount`, capped per-turn impact on rates/stability, reputation downside, and action-history attribution. |

### Design note: real vs. fictional countries

The boilerplate uses real countries (US, Eurozone, China, Brazil, Japan). The roadmap specifies fictional ones (Columnis, Rivara, Petralund, Kaelmont, Dharvia). **Recommendation: keep real countries.** They provide instant recognition, make events feel grounded, and reduce onboarding friction. The fictional names were a hedge against political sensitivity, but neutral event writing solves that better than renaming.

---

### Mapping: suggested "next improvements" → roadmap phases

Each suggested improvement is evaluated for: which phase it belongs in, its priority within that phase, dependencies, and any caveats.

#### 1. More countries and regional cross-country dynamics

| Attribute | Value |
|-----------|-------|
| **Phase** | Countries → **v1** (feature #2). Cross-country dynamics → **v1** (interconnection model + feature #5). |
| **Priority in phase** | High. More countries are the easiest way to add replayability. Cross-country edges create contagion — the most exciting emergent mechanic. |
| **Dependencies** | The interconnection model needs upgrading first. Currently `tickCountry` runs each country independently with zero cross-country edges. Before adding countries, add a `crossCountryEffects()` step to `advanceTurn` that propagates shocks (e.g., Brazil crisis → China export hit). |
| **Caveat** | Don't add countries without cross-country edges. 8 independent countries isn't more interesting than 5 — it's just more cards to scan. The edges are the point. |
| **Scope** | v1: add 3 countries (India, Nigeria, Saudi Arabia or similar archetypes), ~25 cross-country edges. v2: expand to 12 + trade blocs. |

#### 2. Policy decisions (lobby central banks, capital controls)

| Attribute | Value |
|-----------|-------|
| **Phase** | Lobby/PR → **MVP** (it's a gap — see above). Capital controls, central bank lobbying → **v1** (feature #3, expanded trade menu). |
| **Priority in phase** | Lobby/PR is P1 for MVP. Capital controls are mid-priority for v1. |
| **Dependencies** | Lobby/PR requires the Reputation meter (also an MVP gap). Capital controls require cross-country dynamics to be meaningful. |
| **Caveat** | "Lobby central bank" is essentially "pay money to influence a country's rate decision." This is powerful and fun, but it needs to feel like a real tradeoff — expensive, reputation-damaging if discovered, and only partially effective. Don't make it a guaranteed rate override. |
| **Scope** | MVP: add Lobby/PR decision (costs capital, reduces reputation penalties). v1: add Capital Controls (restrict FX flows for a country — stabilizes their currency but hurts their growth and your trade access). |

#### 3. Multi-turn event chains and crises

| Attribute | Value |
|-----------|-------|
| **Phase** | **v1** (feature #1 — dynamic event system). |
| **Priority in phase** | **Highest in v1.** This is the #1 feature. Chain reactions are what make the game feel like a living system instead of a random-event generator. |
| **Dependencies** | Requires the event DSL upgrade (v1 tech debt). Current events are JS functions with inline logic — they need to become data-driven with preconditions so chains can be authored declaratively. |
| **Caveat** | Start with 2–3 hand-authored chains, not a general chain engine. Example: "EM Currency Pressure" (turn N) → "Capital Flight" (turn N+1, if stability drops) → "IMF Intervention" (turn N+2, if debt > threshold). Prove the concept before building the system. |
| **Scope** | v1: ~5 scripted multi-turn chains, event pool grows to ~50. v2: chains can interact with each other, creating compound crises. |

#### 4. Achievements and scoring leaderboard

| Attribute | Value |
|-----------|-------|
| **Phase** | Basic scoring → **already exists** in boilerplate. Achievements → **v2** (feature #8, persistent statistics). Leaderboard → **v2** (requires backend). |
| **Priority in phase** | **Low for v1, medium for v2.** Achievements without persistence feel hollow. A leaderboard without enough players is an empty room. |
| **Dependencies** | Persistent stats require either localStorage (limited) or a backend (v2). Achievements need enough game variety that they're not all unlocked in 3 playthroughs. |
| **Caveat** | **Do not build this before v2.** It's a retention mechanic, not an engagement mechanic. If the core loop isn't fun, achievements won't save it. The boilerplate's simple score is sufficient through v1. Consider adding 3–5 "soft achievements" (displayed on the debrief screen, not persisted) in late v1 as a low-cost experiment. |
| **Scope** | Late v1: 5 debrief-only achievements ("Survived 20 turns without leverage", "Caused a sovereign default"). v2: full persistent achievement system + leaderboard. |

#### 5. Sound effects and turn animations

| Attribute | Value |
|-----------|-------|
| **Phase** | Basic sound → **v1** (feature #10). Full polish → **v2** (feature #10). |
| **Priority in phase** | **Lowest in v1.** Listed as #10 for a reason. Audio is atmosphere, not mechanics. |
| **Dependencies** | None technically. But doing this before the core loop is tight is wasted effort — you'll redesign the UX and throw away animation work. |
| **Caveat** | **Do not touch this until v1 features #1–#8 are done.** One exception: a single "event chime" sound when a crisis fires is cheap and high-impact. Budget 1 day max in late v1. |
| **Scope** | v1: 3–4 sound effects (event chime, turn advance, crisis alarm, game over). v2: ambient soundtrack, dynamic tension music, polished transitions. |

#### 6. Detailed country drill-down view

| Attribute | Value |
|-----------|-------|
| **Phase** | **v1** (not explicitly listed but fits between features #5 and #6). |
| **Priority in phase** | **Medium.** The current country cards show 8 stats in a compact grid — functional but dense. A drill-down with historical charts (rate/growth/stability over time) would deepen understanding. |
| **Dependencies** | Requires storing country indicator history (currently only `fxPrevious` is tracked). Add a `history: { turn, rate, growth, ... }[]` array to `CountryState`. |
| **Caveat** | Keep the drill-down to one screen: 3–4 sparkline charts + current stats + player exposure to that country. Don't build a full economic dashboard — the game is about decisions, not analysis. |
| **Scope** | v1: click a country card → modal with 4 sparkline charts (rate, growth, stability, equity index) + your portfolio exposure to that country. v2: add trade flow visualization to/from other countries. |

#### 7. Sector-level equity investing

| Attribute | Value |
|-----------|-------|
| **Phase** | **v2 at earliest. Possibly never.** |
| **Priority in phase** | **Low.** |
| **Dependencies** | Requires a sector model per country (tech, energy, finance, etc.), each with its own indicators. This multiplies the state space significantly. |
| **Caveat** | **This is a complexity trap.** The roadmap explicitly warns: "if we want more variety, add modifiers to existing trades instead of new trade types." Sectors add a layer of analysis that doesn't deepen the core "your trades affect countries" loop — it widens it into stock-picking, which is a different game. If sector exposure matters, model it as a modifier on the existing equity trade ("Buy Equities — Tech-Heavy" vs. "Buy Equities — Diversified") rather than a separate system. |
| **Scope** | v2 stretch goal: 2–3 sector modifiers on the existing equity trade. Not a standalone system. |

#### 8. Trade relationships between countries

| Attribute | Value |
|-----------|-------|
| **Phase** | **v1** (feature #5 — country relationship web). |
| **Priority in phase** | **High.** This is the visible manifestation of cross-country dynamics (#1 above). Without it, contagion is invisible. |
| **Dependencies** | Cross-country edges in the simulation model (see #1). The visualization is a separate UI concern. |
| **Caveat** | The visualization and the mechanics are **two separate tasks**. Build the mechanics first (cross-country edges in the sim), then build the node-graph visualization. Don't couple them. |
| **Scope** | v1: implement cross-country edges in `advanceTurn` + a dedicated "World Map" screen showing countries as nodes with trade-flow edges and contagion risk indicators. v2: animated contagion ripple visualization. |

#### 9. Difficulty levels and historical scenarios

| Attribute | Value |
|-----------|-------|
| **Phase** | Scenarios → **v1** (feature #7). Difficulty levels → **v2** (feature #9). |
| **Priority in phase** | Scenarios are medium in v1. Difficulty is medium in v2. |
| **Dependencies** | Scenarios require the game to be parameterizable — different starting country states and event pools per scenario. The current `createNewGame()` hardcodes `initialCountries`, so it needs a `scenarioConfig` parameter. Difficulty needs enough playtesting data to know what "hard" means. |
| **Caveat** | **Historical scenarios are v2, not v1.** "Asian Financial Crisis 1997" or "2008 GFC" require careful calibration of starting conditions, event sequences, and win/loss thresholds. Get the fictional/generalized scenarios working in v1 first. The v1 scenarios should be archetypal situations ("Calm Markets", "Emerging Crisis", "Rate Shock"), not historical recreations. |
| **Scope** | v1: 3 preset scenarios with different starting conditions. v2: 3 historical scenarios + Easy/Normal/Hard + gameplay modifiers ("Glass-Steagall", "Infinite Leverage", etc.). |

---

### Recommended implementation order

Given the current boilerplate state, here's the sequenced backlog combining MVP gap fixes and the suggested next improvements:

**Immediate (finish MVP — week 1–2):**

1. Add Reputation meter + game-over at 0
2. Add causal chain HUD display
3. Replace "Liquidate All" with Sell Bonds; add Lobby/PR and Provide Liquidity decisions
4. Add personalized event text referencing player actions
5. Add win condition (survive N turns above AUM target)

**Next (v1 — month 1–2):**

6. Cross-country edges in simulation engine (trade relationships between countries — item #8)
7. Multi-turn event chains and crises (item #3)
8. 3 more countries with cross-country dynamics (item #1)
9. Policy decisions: capital controls, central bank lobbying (item #2)
10. Country drill-down view with history charts (item #6)
11. Scenario selector with 3 presets (first half of item #9)
12. End-game debrief with decision timeline
13. Country relationship web visualization (item #8 UI layer)
14. Sound effects — minimal set (item #5)

**Later (v2 — month 3–6):**

15. Difficulty levels + historical scenarios (second half of item #9)
16. Achievements + persistent statistics (item #4)
17. Scoring leaderboard (item #4)
18. Sector-level equity modifiers (item #7, if at all)

---

## Technical Stack (actual, from boilerplate)

| Layer | MVP (current) | v1 | v2 |
|-------|---------------|----|----|
| **Runtime** | Browser (Vite SPA) | Same | Browser + optional Electron |
| **Language** | TypeScript | TypeScript | TypeScript |
| **Framework** | React 19 + Recharts | Same | Same + canvas for relationship graph |
| **State** | Zustand + seeded RNG (Mulberry32) | Same + event DSL | Same |
| **Persistence** | localStorage (already implemented) | Same | + Firebase/Supabase backend |
| **Data** | Hardcoded TS objects | JSON/YAML event DSL | + scenario editor |
| **Testing** | None yet — add unit tests on `advanceTurn()` | + replay-based integration | + automated balance sims |

---

## Key Risk Register

| Risk | Mitigation |
|------|------------|
| Interconnected systems feel opaque / random | Causal chain display is P0 from day one. If players can't trace cause→effect, the game fails. |
| Decision paralysis from too many trade options | MVP caps at 10. Each trade has a 1-line tradeoff visible before confirming. |
| Balancing 5+ countries is exponentially hard | Data-driven indicators + automated sim runs in v2. Manual tuning is fine for MVP. |
| "Spreadsheet game" feel — no emotional engagement | Events with personalized headlines ("YOUR bond sell-off...") + dramatic loss states + audio in v1. |
| Scope creep into realistic financial simulation | We model *consequences*, not mechanisms. No order books, no tick-by-tick pricing, no real market data. |

---

## Success Metrics by Phase

| Metric | MVP | v1 | v2 |
|--------|-----|----|----|
| Avg session length | >15 min | >30 min | >45 min |
| Restart rate after loss | >40% | >50% | >60% |
| Unique strategies observed | 2–3 | 5+ | 10+ |
| "I caused that" moments per game | 1+ | 3+ | 5+ |
| Player-reported "fun" (1-5 scale) | 3.5+ | 4.0+ | 4.5+ |
