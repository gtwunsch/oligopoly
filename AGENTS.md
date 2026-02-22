# AGENTS.md — Bank World Simulator (Agent Operating Manual)

## 0) Prime Directive

Ship a playable game at all times.

- The build must run.
- The game must be interactive.
- Each change must preserve or improve: clarity, fun, and evolvability.

If a task risks breaking playability, implement a smaller version first.
Never merge speculative work into a playable branch.

---

## 1) Role, Theme & Design Pillars

**Game:** Macro investment simulator inspired by Democracy 4.
**Player fantasy:** CEO of the world's largest bank — every decision ripples across economies.
**Core loop:** Choose actions → simulate a turn → observe outcomes + headlines → adjust strategy.

### Design Pillars (ordered by priority)

1. **Consequence clarity** — Decisions visibly cause changes. The player always knows *why* something happened.
2. **Meaningful tradeoffs** — Every choice has a cost. No free lunches, no obvious best moves.
3. **Emergent depth** — Complexity arises from interactions between simple systems, not from piling on variables.
4. **Escalating stakes** — Tension builds across turns. Early mistakes compound; recoveries feel earned.

These pillars resolve design disputes. If a feature conflicts with a higher-priority pillar, the higher pillar wins.

---

## 2) Non-Negotiables (Do Not Break)

### Always playable
- No PR may leave the game in an unplayable state.
- If unsure, ship a minimal stub behind a feature flag.

### Deterministic simulation
- Simulation must be deterministic with a seeded RNG.
- Same seed + same actions ⇒ same outcomes. No exceptions.
- Event text variation (headlines/templates) must also be deterministic for the same seed + turn + event.

### Data-driven design
- Countries, actions, and events must be declarative data objects.
- No hardcoding logic into UI components.

### Sim engine isolation
- `src/sim/**` must have **zero React imports**.
- UI reads state and displays; sim computes state.

### Text discipline
- Keep player-facing text short and scannable.
- Use tooltips for detail. Avoid essays.
- Every number shown to the player must have a label and unit.

---

## 3) Architecture Boundaries

### Folder structure (canonical)

| Folder | Responsibility |
|---|---|
| `src/sim/` | Simulation engine, formulas, event resolution, seeding, tests |
| `src/data/` | Country / action / event definitions (JSON or TS objects) |
| `src/store/` | Zustand store, save/load, turn history |
| `src/ui/` | Components, screens, charts, tooltips |

### Allowed dependencies

| Layer | Allowed |
|---|---|
| **UI** | React, Zustand, Recharts |
| **Sim** | Plain TypeScript only (no framework imports) |

### Forbidden patterns
- Business rules inside React components.
- Components that mutate sim state directly.
- Complex math libraries (keep formulas auditable by hand).
- Randomness without seed control.
- New systems without a player-facing explanation.
- God objects: no single file > 300 LOC without a strong reason.

---

## 4) Product Quality Gates (Must Pass Before Merge)

Every change must satisfy **all four gates**:

### Gate A — Playability
- Start a new game.
- Make at least 1 decision.
- End turn and see outcomes.
- Continue for 5 turns without errors or freezes.

### Gate B — Explainability
For each new mechanic, surface a short causal hint (1–2 steps):

> `Rates ↑ → FX ↑ → Exports ↓`

If the chain can't be stated in ≤ 3 links, simplify the mechanic.

### Gate C — Fun & Choice
- Every decision must present a visible benefit **and** a visible cost or risk.
- No "always-best" action. If one is discovered, rebalance before merging.

### Gate D — Complexity Budget
Prefer depth via *interactions between existing systems*, not new variables.
Each feature adds **at most one** of:
- 1 new metric, **or**
- 1 new action category, **or**
- 1 new event family

Exceeding this requires explicit approval.

---

## 5) Turn Loop Standard (Canonical)

Each turn represents one quarter. Steps execute in strict order:

1. **Apply player actions** — deduct costs, enforce constraints, allocate resources.
2. **Resolve triggered events** — evaluate conditions, pick events via weighted seeded roll, apply effects.
3. **Update country metrics** — run formulas, clamp deltas, propagate second-order effects.
4. **Update portfolio & bank risk** — recalculate positions, exposure, liquidity.
5. **Generate turn summary** — headline + key deltas + 1 causal hint per major change.

No step may depend on a later step's output within the same turn.

---

## 6) Simulation Design Rules

### Variables
Use few, high-signal variables per country:

`rates · inflation · growth · stability · fx · debt · sentiment`

Add a new variable only when it creates a genuinely new player decision.

### Update style
- Prefer linear or piecewise-linear formulas with clear thresholds.
- Cap per-turn deltas (e.g., ±5 pp) to prevent chaos and preserve readability.
- Avoid hidden state unless it surfaces within 1–2 turns.

### Feedback loops
Every feedback loop must be intentional and labeled:

- **Reinforcing loops** (growth → investment → growth) must have a natural brake to prevent runaway.
- **Balancing loops** (debt → austerity → stability) should be visible so the player can anticipate convergence.

If a loop isn't visible to the player through the UI, it doesn't belong in the sim.

### Risk model (simple but meaningful)
Maintain two global meters:

| Meter | Drives |
|---|---|
| **Bank Risk** | Fragility, leverage, liquidity pressure |
| **Reputation** | Political heat, media backlash, regulatory threat |

Actions and events should push/pull these meters. Crossing thresholds triggers escalating consequences, not instant game-overs.

#### Current core state contract (for all agents)
- `GameState.reputation` is a 0–100 meter and must always be clamped; loss condition triggers at `reputation <= 0`.
- `advanceTurn` must keep reputation effects deterministic: aggressive actions (e.g. FX short, leverage up, bond selling in fragile EM) should pull down; stabilizing actions (e.g. provide liquidity, reduce leverage, buy bonds in crisis) should lift or offset penalties.
- `GameState.actionHistory` stores recent actions as `{ turn, actionId, target?, magnitude? }` with a short rolling window (currently 5 turns) for event attribution and future UX copy.
- `GameState.lastTurnSummary` exposes a minimal UI-ready shape: `{ turn, deltas: { reputationDelta, riskDelta, aumDelta, liquidityDelta }, why }`.

### Cash buckets (capital usability)
- Track cash with three fields: `cashTotal`, `cashAvailable`, and `cashLocked`.
- `cashLocked` should come from simple, visible drivers: base liquidity reserve + leverage margin + concentration buffer.
- `Leverage up` increases locked cash; concentrated books increase locked cash.
- `Reduce leverage` must release locked cash **gradually across turns** (not all at once).
- UI should show the three cash numbers and a short tooltip explaining why cash is locked.

### Balance philosophy
- Aim for *interesting* balance, not perfect balance. Asymmetry is fine if the tradeoff is clear.
- Tune iteratively using the dev panel and seed replay, not by theorycrafting alone.
- Log every balance change with a short rationale in the commit message.

---

## 7) Content Rules (Countries / Actions / Events)

### Countries
- Each country has a distinct economic personality (stable reserve, fragile EM, commodity exporter, tech hub, etc.).
- Personalities are expressed through starting values **and** unique event pools — not special-case code.
- MVP: 3–6 countries. Expand only when existing ones feel well-tuned.

### Actions
Actions must be declarative objects:

```
id · name · shortDesc · cost · tags · requirements · apply(state, ctx)
```

Each action defines:
- A **visible benefit** (what the player gains).
- A **visible downside** (risk, reputation cost, or opportunity cost).
- A **cooldown or limit** if needed (prevent degenerate spam).

### Events
Events must include:

| Field | Rule |
|---|---|
| `headlineTemplates` | 2–4 short variants (≤ 10 words each), selected deterministically |
| `why` | 1 sentence explaining the cause |
| `effects` | Explicit deltas on named metrics |
| `triggers` | Simple boolean conditions on current state |

No lore dumps. No flavor text longer than one sentence.

Event personalization rules (lightweight only):
- Prefer simple templates over procedural text systems (no new DSL).
- If referencing player agency, use only recent action context (e.g., last queued/executed action or last turn actions).
- Keep tone neutral and concise; avoid editorial framing.
- Choice events must be scripted A/B options with clearly opposite tradeoffs (no procedural generation).
- Choice-event triggering/picking must stay deterministic (seed + turn driven) and use a bounded chance window when eligible.
- Persist choice actions in history as `EVENT_CHOICE:<id>` with `choice: 'A' | 'B'`.

---

## 8) Save/Load & Compatibility

- Save format must carry a version number.
- Never break existing saves without a migration function.
- Keep saves compact — store only seed + action history where possible (replay-based saves).
- Test round-trip: save → load → continue for 3 turns → verify no drift.

---

## 9) Testing & Instrumentation

### Minimum sim tests (`src/sim/`)

| Test | What it catches |
|---|---|
| Seed determinism | Run same seed twice, assert identical state |
| No NaN / no Infinity | Simulate N turns with default play, assert all values finite |
| Bound sanity | Risk and metrics stay within defined min/max with default play |
| Event trigger coverage | Each event can fire under at least one constructed state |

### Current sanity baseline (QA/Automation)
- Implemented in `src/sim/engine.sanity.test.ts`.
- Includes:
  - Same seed + same action script => identical summarized state (snapshot baseline).
  - 30-turn simulation with simple seeded random actions => no `NaN`/`Infinity`.
  - Global meters remain in range (`reputation`, `riskScore`, `liquidity`).
- Run with `npm test`.

### Dev panel (dev-only, hidden in production)
- Current seed
- Last-turn deltas for all metrics
- Top 3 causal links this turn
- Toggle "show formulas" overlay
- Seed override input for replay

### Performance budget
- Turn resolution: < 100 ms for 6 countries.
- UI re-render after turn: < 16 ms (one frame at 60 fps).
- If either is exceeded, profile before adding features.

---

## 10) Agent Workflow (How to Work)

### Output format per task

1. **What changed** — 1–3 bullets.
2. **Why it helps** — map to a design pillar (clarity / tradeoffs / depth / stakes).
3. **Files changed** — list with one-line description each.
4. **How to verify** — concrete click-path the human can follow.
5. **Risks / follow-ups** — what could go wrong, what's next.

### Incremental shipping
- Prefer small PRs that keep the game playable at every commit.
- Large features land as disabled stubs first, then get enabled in a follow-up.

### No surprise refactors
- Refactors require a stated reason tied to a design pillar.
- Refactors must be small and isolated. Never bundle with feature work.
- Do not reorganize folders without approval.

### Feature flags
- Use simple boolean flags in a single `src/data/flags.ts` file.
- Flags default to `false` (off). Enable explicitly when the feature is verified.

---

## 11) Priorities When Conflicts Arise

Resolve disputes in this order:

1. **Playability** — the game must run and be interactive.
2. **Clarity** — the player must understand what happened and why.
3. **Fun choices** — decisions must present real tradeoffs.
4. **Evolvability** — code boundaries must stay clean.
5. **Visual polish** — aesthetics matter, but never at the cost of the above.

When two people disagree, the higher-priority principle wins. No exceptions.

---

## 12) Owner Controls (Managing Agents Without Reading Code)

Agents must always provide:

- **Demo script:** "Click X → choose Y → end turn → observe Z."
- **Fun check:** One sentence on what changed in the player's experience.
- **Rollback plan:** "Revert files A/B" or "disable flag C."

**Rule:** If the agent cannot explain the player impact in 2–3 sentences, the change is not ready to merge.

---

## 13) Accessibility Baseline

- Charts must use a colorblind-safe palette (avoid red/green as sole differentiator).
- All interactive elements must be reachable via keyboard.
- Tooltips must be accessible (hoverable and focusable).
- Text contrast must meet WCAG AA (4.5:1 for body text).

These are floor requirements, not stretch goals.
