import type {
  ActionHistoryEntry,
  CountryState,
  Decision,
  GameEvent,
  GameState,
  LogEntry,
  Portfolio,
} from './types';
import { createRng } from './rng';
import type { Rng } from './rng';
import { events } from './events';
import { initialCountries } from './countries';
import { decisions } from './decisions';
import { applyScenarioCountries, DEFAULT_SCENARIO_ID, getScenarioById } from './scenarios';

// ── Helpers ──

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const roundTo2 = (v: number) => Math.round(v * 100) / 100;
const ACTION_HISTORY_TURN_WINDOW = 5;
const BR_FRAGILE_STABILITY = 60;
const BR_CRISIS_STABILITY = 50;
const RECENT_ACTION_ATTRIBUTION_PREFIX = 'Recent actions set the stage:';

function buildActionHistoryEntry(turn: number, decisionId: string): ActionHistoryEntry {
  switch (decisionId) {
    case 'buy_sovereign_bonds':
      return { turn, actionId: decisionId, target: 'br', magnitude: 0.05 };
    case 'sell_sovereign_bonds':
      return { turn, actionId: decisionId, target: 'br', magnitude: -0.05 };
    case 'short_currency':
      return { turn, actionId: decisionId, target: 'br', magnitude: 0.04 };
    case 'provide_liquidity':
      return { turn, actionId: decisionId, target: 'br', magnitude: 0.35 };
    case 'raise_leverage':
      return { turn, actionId: decisionId, magnitude: 0.5 };
    case 'reduce_leverage':
      return { turn, actionId: decisionId, magnitude: -0.5 };
    case 'enter_irs':
      return { turn, actionId: decisionId, target: 'us', magnitude: 0.04 };
    default:
      return { turn, actionId: decisionId };
  }
}

function computeActionReputationDelta(decision: Decision, stateBeforeDecision: GameState): number {
  const brStability = stateBeforeDecision.countries.find((country) => country.id === 'br')?.stability ?? 100;
  const isFragile = brStability < BR_FRAGILE_STABILITY;
  const isCrisis = brStability < BR_CRISIS_STABILITY;

  switch (decision.id) {
    case 'short_currency':
      return -2;
    case 'raise_leverage':
      return -1;
    case 'sell_sovereign_bonds':
      return isFragile ? -2 : 0;
    case 'provide_liquidity':
      return isCrisis ? 2 : 1;
    case 'reduce_leverage':
      return 1;
    case 'buy_sovereign_bonds':
      return isCrisis ? 1 : 0;
    default:
      return decision.reputationDelta ?? 0;
  }
}

// ── New game factory ──

export function createNewGame(seed?: number, scenarioId = DEFAULT_SCENARIO_ID): GameState {
  const s = seed ?? Date.now();
  const scenario = getScenarioById(scenarioId);
  return {
    turn: 0,
    year: 2025,
    quarter: 1,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    countries: applyScenarioCountries(structuredClone(initialCountries), scenario),
    eventWeightBias: { ...scenario.eventWeightBias },
    worldFlags: {},
    portfolio: {
      aum: 100,
      cash: 100,
      leverage: 1,
      allocations: [],
      pnlHistory: [0],
      riskScore: 0,
      liquidity: 100,
    },
    reputation: scenario.startingReputation ?? 70,
    winTargetAum: 120,
    maxTurns: 20,
    outcome: 'ongoing',
    lastTurnCausalHints: [],
    lastTurnActions: [],
    actionHistory: [],
    lastTurnSummary: {
      turn: 0,
      deltas: {
        reputationDelta: 0,
        riskDelta: 0,
        aumDelta: 0,
        liquidityDelta: 0,
      },
      why: [],
    },
    log: [{ turn: 0, text: 'Welcome, CEO. The board expects results.', type: 'info' }],
    pendingDecisions: [],
    phase: 'playing',
    seed: s,
    score: 0,
  };
}

// ── Country macro update (influence graph) ──
// rates -> FX -> inflation -> stability -> sentiment -> equities

function tickCountry(c: CountryState, rng: Rng): CountryState {
  const n = { ...c };
  n.fxPrevious = c.fxRate;

  // rates drift toward inflation + 1% (Taylor-lite)
  const rateTarget = c.inflation + 1;
  n.interestRate = clamp(
    c.interestRate + (rateTarget - c.interestRate) * 0.05 + rng.normal(0, 0.1),
    0, 20,
  );

  // FX influenced by rate differentials & sentiment
  const rateDelta = n.interestRate - 3.5; // vs "global neutral"
  n.fxRate = clamp(
    c.fxRate * (1 + rateDelta * 0.002 + c.sentiment * 0.0002 + rng.normal(0, 0.01)),
    c.fxRate * 0.85, c.fxRate * 1.15,
  );

  // inflation mean-reverts, pushed by growth
  n.inflation = clamp(
    c.inflation + (2.0 - c.inflation) * 0.03 + c.growth * 0.02 + rng.normal(0, 0.15),
    -2, 30,
  );

  // growth drifts, hurt by high rates
  n.growth = clamp(
    c.growth + (2.0 - c.growth) * 0.04 - (c.interestRate - 3) * 0.03 + rng.normal(0, 0.2),
    -10, 15,
  );

  // stability: eroded by debt, low growth, high inflation
  const stabilityPressure =
    (c.debtToGdp > 100 ? -0.3 : 0.1) +
    (c.growth < 0 ? -1 : 0.2) +
    (c.inflation > 6 ? -0.5 : 0);
  n.stability = clamp(c.stability + stabilityPressure + rng.normal(0, 0.5), 0, 100);

  // debt drifts with growth & rate
  n.debtToGdp = clamp(
    c.debtToGdp + (c.interestRate - c.growth) * 0.1 + rng.normal(0, 0.3),
    0, 300,
  );

  // sentiment: mean-reverts, boosted by stability & growth
  n.sentiment = clamp(
    c.sentiment + (0 - c.sentiment) * 0.05
    + (n.stability - 60) * 0.05
    + n.growth * 0.3
    + rng.normal(0, 2),
    -100, 100,
  );

  // equities: driven by sentiment, growth, inversely by rates
  const eqReturn =
    n.sentiment * 0.001 +
    n.growth * 0.005 -
    n.interestRate * 0.001 +
    rng.normal(0, 0.015);
  n.equityIndex = Math.max(1, c.equityIndex * (1 + eqReturn));

  return n;
}

// ── Portfolio PnL ──

function computePortfolioPnl(
  portfolio: Portfolio,
  prevCountries: CountryState[],
  newCountries: CountryState[],
): number {
  let pnl = 0;
  for (const alloc of portfolio.allocations) {
    const prev = prevCountries.find((c) => c.id === alloc.countryId)!;
    const curr = newCountries.find((c) => c.id === alloc.countryId)!;
    const notional = alloc.weight * portfolio.aum * portfolio.leverage;

    switch (alloc.asset) {
      case 'sovereign_bonds': {
        // bonds gain when rates fall
        const rateDelta = prev.interestRate - curr.interestRate;
        pnl += notional * rateDelta * 0.04; // duration ~4y
        // carry
        pnl += notional * (curr.interestRate / 100) * 0.25;
        break;
      }
      case 'equities': {
        const ret = (curr.equityIndex - prev.equityIndex) / prev.equityIndex;
        pnl += notional * ret;
        break;
      }
      case 'gold': {
        // gold up when inflation up or sentiment down
        const goldReturn =
          (curr.inflation - prev.inflation) * 0.01 +
          (prev.sentiment - curr.sentiment) * 0.0005;
        pnl += notional * goldReturn;
        break;
      }
      case 'fx_short': {
        const fxMove = (prev.fxRate - curr.fxRate) / prev.fxRate;
        pnl += notional * fxMove;
        break;
      }
      case 'irs': {
        const rateDelta = prev.interestRate - curr.interestRate;
        pnl += notional * rateDelta * 0.08;
        break;
      }
      case 'cash':
        break;
    }
  }
  return pnl;
}

// ── Risk score (simple) ──

function computeRisk(portfolio: Portfolio, countries: CountryState[]): number {
  const allocWeight = portfolio.allocations.reduce((s, a) => s + a.weight, 0);
  const riskyWeight = portfolio.allocations
    .filter((a) => ['equities', 'fx_short', 'irs'].includes(a.asset))
    .reduce((s, a) => s + a.weight, 0);

  const avgStability =
    countries.reduce((s, c) => s + c.stability, 0) / countries.length;

  const risk =
    allocWeight * 30 +
    riskyWeight * 25 +
    (portfolio.leverage - 1) * 15 -
    (avgStability - 50) * 0.3;

  return clamp(Math.round(risk), 0, 100);
}

function computeLiquidity(portfolio: Portfolio): number {
  const cashRatio = portfolio.cash / Math.max(1, portfolio.aum);
  return clamp(Math.round(cashRatio * 100 + (1 / portfolio.leverage) * 20), 0, 100);
}

function decayWorldFlags(flags: Record<string, number>): Record<string, number> {
  const nextFlags: Record<string, number> = {};
  for (const [key, value] of Object.entries(flags)) {
    const nextValue = Math.max(0, Math.floor(value) - 1);
    if (nextValue > 0) nextFlags[key] = nextValue;
  }
  return nextFlags;
}

function mergeWorldFlags(
  currentFlags: Record<string, number>,
  patchFlags: Record<string, number>,
): Record<string, number> {
  const merged = { ...currentFlags };
  for (const [key, value] of Object.entries(patchFlags)) {
    const normalized = Math.floor(value);
    if (normalized > 0) {
      merged[key] = normalized;
    } else {
      delete merged[key];
    }
  }
  return merged;
}

function buildAttributionText(
  event: GameEvent,
  executedDecisions: Decision[],
  actionHistory: ActionHistoryEntry[],
): string | null {
  if (!event.attributionRules || (executedDecisions.length === 0 && actionHistory.length === 0)) {
    return null;
  }

  const executedDecisionTags = new Set(executedDecisions.flatMap((decision) => decision.tags));
  const actionHistoryDecisionTags = new Set(
    actionHistory
      .map((entry) => decisions.find((decision) => decision.id === entry.actionId))
      .filter((decision): decision is Decision => decision !== undefined)
      .flatMap((decision) => decision.tags),
  );

  for (const rule of event.attributionRules) {
    if (rule.decisionId && executedDecisions.some((decision) => decision.id === rule.decisionId)) {
      return rule.text;
    }
    if (rule.decisionTag) {
      const tag = rule.decisionTag;
      if (executedDecisionTags.has(tag)) {
        return rule.text;
      }
    }
    if (rule.decisionId && actionHistory.some((entry) => entry.actionId === rule.decisionId)) {
      return `${RECENT_ACTION_ATTRIBUTION_PREFIX} ${rule.text}`;
    }
    if (rule.decisionTag && actionHistoryDecisionTags.has(rule.decisionTag)) {
      return `${RECENT_ACTION_ATTRIBUTION_PREFIX} ${rule.text}`;
    }
  }
  return null;
}

// ── Main tick ──

export function advanceTurn(state: GameState): GameState {
  const previousReputation = state.reputation;
  const previousRisk = state.portfolio.riskScore;
  const previousAum = state.portfolio.aum;
  const previousLiquidity = state.portfolio.liquidity;

  const rng = createRng(state.seed + state.turn * 7919);
  const newLog: LogEntry[] = [];
  const turnCausalHints: string[] = [];
  const executedDecisions: Decision[] = [];
  const turnActionHistory: ActionHistoryEntry[] = [];
  const next = structuredClone(state);
  next.outcome = 'ongoing';
  next.worldFlags = decayWorldFlags(next.worldFlags);

  // 1. Apply queued decisions
  for (const dId of next.pendingDecisions) {
    const dec = decisions.find((d) => d.id === dId);
    if (!dec) continue;
    const decisionReputationDelta = computeActionReputationDelta(dec, next);

    const patch = dec.effect(next);
    Object.assign(next, patch);
    if (patch.portfolio) next.portfolio = { ...next.portfolio, ...patch.portfolio };
    if (patch.countries) next.countries = patch.countries;
    if (typeof patch.reputation === 'number') {
      next.reputation = clamp(patch.reputation, 0, 100);
    }
    if (patch.worldFlags) {
      next.worldFlags = mergeWorldFlags(next.worldFlags, patch.worldFlags);
    }
    if (decisionReputationDelta !== 0) {
      next.reputation = clamp(next.reputation + decisionReputationDelta, 0, 100);
    }
    if (dec.causalHint) {
      turnCausalHints.push(dec.causalHint);
    }
    executedDecisions.push(dec);
    turnActionHistory.push(buildActionHistoryEntry(next.turn + 1, dec.id));
    newLog.push({ turn: next.turn + 1, text: `Executed: ${dec.name}`, type: 'action' });
  }
  next.pendingDecisions = [];

  // 2. Tick countries
  const prevCountries = structuredClone(next.countries);
  next.countries = next.countries.map((c) => tickCountry(c, rng));

  // 3. Fire 1-2 random events
  const numEvents = rng.next() > 0.5 ? 2 : 1;
  const eligible = events
    .filter((e) => !e.trigger || e.trigger(next))
    .map((event) => ({
      ...event,
      weight: event.weight * (next.eventWeightBias[event.id] ?? 1),
    }))
    .filter((event) => event.weight > 0);
  const recentActionHistory = [...next.actionHistory, ...turnActionHistory];
  for (let i = 0; i < numEvents && eligible.length > 0; i++) {
    const ev = rng.weightedPick(eligible);
    const pickedIndex = eligible.findIndex((candidate) => candidate.id === ev.id);
    if (pickedIndex >= 0) eligible.splice(pickedIndex, 1);
    const patch = ev.effect(next);
    if (patch.countries) next.countries = patch.countries;
    if (patch.portfolio) next.portfolio = { ...next.portfolio, ...patch.portfolio };
    if (typeof patch.reputation === 'number') {
      next.reputation = clamp(patch.reputation, 0, 100);
    }
    if (patch.worldFlags) {
      next.worldFlags = mergeWorldFlags(next.worldFlags, patch.worldFlags);
    }
    if (ev.reputationDelta) {
      next.reputation = clamp(next.reputation + ev.reputationDelta, 0, 100);
    }
    if (ev.causalHint) {
      turnCausalHints.push(ev.causalHint);
    }
    const attribution = buildAttributionText(ev, executedDecisions, recentActionHistory);
    const description = attribution ? `${ev.description} ${attribution}` : ev.description;
    newLog.push({ turn: next.turn + 1, text: `${ev.name}: ${description}`, type: 'event' });
  }

  // 4. PnL
  const pnl = computePortfolioPnl(next.portfolio, prevCountries, next.countries);
  next.portfolio.aum += pnl;
  next.portfolio.cash = Math.max(0, next.portfolio.cash + pnl * 0.2);
  next.portfolio.pnlHistory = [...next.portfolio.pnlHistory, pnl];

  const pnlSign = pnl >= 0 ? '+' : '';
  newLog.push({
    turn: next.turn + 1,
    text: `Quarter P&L: ${pnlSign}$${pnl.toFixed(2)}B`,
    type: 'market',
  });

  // 5. Risk & liquidity
  next.portfolio.riskScore = computeRisk(next.portfolio, next.countries);
  next.portfolio.liquidity = computeLiquidity(next.portfolio);

  // 5b. Reputation drifts based on portfolio risk and world stability.
  const avgStability = next.countries.reduce((s, c) => s + c.stability, 0) / next.countries.length;
  let reputationDelta = 0;
  if (next.portfolio.riskScore > 70) reputationDelta -= 2;
  if (avgStability < 55) reputationDelta -= 1;
  if (next.portfolio.riskScore < 35 && avgStability > 75) reputationDelta += 1;
  if (reputationDelta !== 0) {
    next.reputation = clamp(next.reputation + reputationDelta, 0, 100);
    turnCausalHints.push(
      reputationDelta > 0
        ? 'Risk down + stability up -> media pressure eases -> reputation recovers'
        : 'Risk up or instability -> scrutiny rises -> reputation falls',
    );
    const repSign = reputationDelta > 0 ? '+' : '';
    newLog.push({
      turn: next.turn + 1,
      text: `Reputation ${repSign}${reputationDelta} (${next.reputation}/100)`,
      type: 'market',
    });
  }

  // 6. Advance clock
  next.turn += 1;
  next.quarter = ((next.quarter) % 4) + 1;
  if (next.quarter === 1) next.year += 1;
  next.seed = rng.getSeed();

  // 7. Score
  next.score = Math.round(
    (next.portfolio.aum - 100) * 10 +
    next.turn * 2 +
    (100 - next.portfolio.riskScore) * 0.5 +
    next.reputation * 0.25,
  );

  // 8. Game over check
  if (next.reputation <= 0) {
    newLog.push({ turn: next.turn, text: 'Reputation collapsed. Regulators have seized the bank.', type: 'info' });
    next.phase = 'gameover';
    next.outcome = 'loss';
  } else if (next.portfolio.riskScore >= 100) {
    newLog.push({ turn: next.turn, text: 'Risk hit 100. Your bank has collapsed under stress.', type: 'info' });
    next.phase = 'gameover';
    next.outcome = 'loss';
  } else if (next.portfolio.aum < 20) {
    newLog.push({ turn: next.turn, text: 'AUM below $20B. The board has lost confidence.', type: 'info' });
    next.phase = 'gameover';
    next.outcome = 'loss';
  } else if (next.turn >= next.maxTurns) {
    if (next.portfolio.aum >= next.winTargetAum) {
      newLog.push({
        turn: next.turn,
        text: `You reached Turn ${next.maxTurns} above the $${next.winTargetAum}B target. The board renews your mandate.`,
        type: 'info',
      });
      next.outcome = 'win';
    } else {
      newLog.push({
        turn: next.turn,
        text: `You survived ${next.maxTurns} turns but missed the $${next.winTargetAum}B target.`,
        type: 'info',
      });
      next.outcome = 'loss';
    }
    next.phase = 'gameover';
  }

  const minTurn = Math.max(1, next.turn - (ACTION_HISTORY_TURN_WINDOW - 1));
  next.actionHistory = [...next.actionHistory, ...turnActionHistory]
    .filter((entry) => entry.turn >= minTurn && entry.turn <= next.turn);

  const dedupedCausalHints = [...new Set(turnCausalHints)].slice(0, 3);
  next.lastTurnCausalHints = dedupedCausalHints;
  next.lastTurnActions = executedDecisions.map((decision) => decision.id);
  next.lastTurnSummary = {
    turn: next.turn,
    deltas: {
      reputationDelta: roundTo2(next.reputation - previousReputation),
      riskDelta: roundTo2(next.portfolio.riskScore - previousRisk),
      aumDelta: roundTo2(next.portfolio.aum - previousAum),
      liquidityDelta: roundTo2(next.portfolio.liquidity - previousLiquidity),
    },
    why: dedupedCausalHints,
  };
  next.log = [...next.log, ...newLog];
  return next;
}
