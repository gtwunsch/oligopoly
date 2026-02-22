import type { GameState, CountryState, LogEntry, Portfolio } from './types';
import { createRng } from './rng';
import type { Rng } from './rng';
import { events } from './events';
import { initialCountries } from './countries';
import { decisions } from './decisions';

// ── Helpers ──

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── New game factory ──

export function createNewGame(seed?: number): GameState {
  const s = seed ?? Date.now();
  return {
    turn: 0,
    year: 2025,
    quarter: 1,
    countries: structuredClone(initialCountries),
    portfolio: {
      aum: 100,
      cash: 100,
      leverage: 1,
      allocations: [],
      pnlHistory: [0],
      riskScore: 0,
      liquidity: 100,
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

// ── Main tick ──

export function advanceTurn(state: GameState): GameState {
  const rng = createRng(state.seed + state.turn * 7919);
  const newLog: LogEntry[] = [];
  let next = structuredClone(state);

  // 1. Apply queued decisions
  for (const dId of next.pendingDecisions) {
    const dec = decisions.find((d) => d.id === dId);
    if (!dec) continue;
    const patch = dec.effect(next);
    Object.assign(next, patch);
    if (patch.portfolio) next.portfolio = { ...next.portfolio, ...patch.portfolio };
    if (patch.countries) next.countries = patch.countries;
    newLog.push({ turn: next.turn + 1, text: `Executed: ${dec.name}`, type: 'action' });
  }
  next.pendingDecisions = [];

  // 2. Tick countries
  const prevCountries = structuredClone(next.countries);
  next.countries = next.countries.map((c) => tickCountry(c, rng));

  // 3. Fire 1-2 random events
  const numEvents = rng.next() > 0.5 ? 2 : 1;
  const eligible = events.filter((e) => !e.trigger || e.trigger(next));
  for (let i = 0; i < numEvents && eligible.length > 0; i++) {
    const ev = rng.weightedPick(eligible);
    const patch = ev.effect(next);
    if (patch.countries) next.countries = patch.countries;
    if (patch.portfolio) next.portfolio = { ...next.portfolio, ...patch.portfolio };
    newLog.push({ turn: next.turn + 1, text: `${ev.name}: ${ev.description}`, type: 'event' });
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

  // 6. Advance clock
  next.turn += 1;
  next.quarter = ((next.quarter) % 4) + 1;
  if (next.quarter === 1) next.year += 1;
  next.seed = rng.getSeed();

  // 7. Score
  next.score = Math.round(
    (next.portfolio.aum - 100) * 10 +
    next.turn * 2 +
    (100 - next.portfolio.riskScore) * 0.5,
  );

  // 8. Game over check
  if (next.portfolio.aum < 20) {
    newLog.push({ turn: next.turn, text: 'AUM below $20B. The board has lost confidence.', type: 'info' });
    next.phase = 'gameover';
  }

  next.log = [...next.log, ...newLog];
  return next;
}
