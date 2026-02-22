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

### Features (priority order)

| # | Feature | Details |
|---|---------|---------|
| 1 | **5 countries** | Each with: GDP growth, interest rate, currency strength, debt/GDP, stability index. Distinct archetypes — see below. |
| 2 | **10 trade decisions** | Buy/Sell Sovereign Bonds, Buy Equities, Buy Gold, Short Currency, Interest Rate Swap (receive/pay fixed), Increase/Reduce Leverage, Provide Liquidity, Lobby/PR Spend. Each has a 1-line tradeoff summary visible before confirming. |
| 3 | **2 player meters** | **Reputation** (0–100): media/political heat. Drops when your trades visibly hurt countries. **Risk** (0–100): bank fragility. High leverage + concentrated bets push this up. Either hitting 0/100 = game over. |
| 4 | **Causal chain display** | Small HUD element: `Rates ↑ → FX ↑ → Exports ↓ → Growth ↓`. Updates live after each trade. This is the single most important UX element — it's what makes the game *feel* systemic. |
| 5 | **1 event per turn** | Drawn from a pool of ~20 scripted events. Headline + effect + "why this happened" tooltip. Events reference your past actions when relevant ("Your bond sell-off contributed to Rivara's credit downgrade"). |
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
- **Consider TypeScript** if not already using it. The state shape is getting complex enough that types prevent real bugs.

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

## Technical Stack Recommendation

| Layer | MVP | v1 | v2 |
|-------|-----|----|----|
| **Runtime** | Browser (SPA) | Browser (SPA) | Browser + optional Electron |
| **Language** | TypeScript | TypeScript | TypeScript |
| **Framework** | Vanilla DOM or lightweight (Preact/Svelte) | Same | Same + canvas for viz |
| **State** | In-memory, seeded RNG | + localStorage save | + backend persistence |
| **Data** | Static JSON | JSON + event DSL | + scenario editor |
| **Backend** | None | None | Firebase/Supabase (minimal) |
| **Testing** | Unit tests on `resolve()` | + replay-based integration | + automated balance sims |

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
