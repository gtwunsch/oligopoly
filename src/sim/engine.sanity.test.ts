import { describe, expect, it } from 'vitest';
import { advanceTurn, createNewGame, createRng, decisions } from './index';
import type { GameState } from './types';

const round = (value: number, digits = 4) => Number(value.toFixed(digits));

function summarizeState(state: GameState) {
  return {
    turn: state.turn,
    year: state.year,
    quarter: state.quarter,
    seed: state.seed,
    reputation: round(state.reputation, 4),
    outcome: state.outcome,
    score: state.score,
    portfolio: {
      aum: round(state.portfolio.aum, 4),
      cashTotal: round(state.portfolio.cashTotal, 4),
      cashAvailable: round(state.portfolio.cashAvailable, 4),
      cashLocked: round(state.portfolio.cashLocked, 4),
      leverage: round(state.portfolio.leverage, 4),
      riskScore: state.portfolio.riskScore,
      liquidity: state.portfolio.liquidity,
      allocations: state.portfolio.allocations
        .map((allocation) => ({
          countryId: allocation.countryId,
          asset: allocation.asset,
          weight: round(allocation.weight, 4),
        }))
        .sort((a, b) => `${a.countryId}:${a.asset}`.localeCompare(`${b.countryId}:${b.asset}`)),
    },
    countries: state.countries
      .map((country) => ({
        id: country.id,
        interestRate: round(country.interestRate, 4),
        inflation: round(country.inflation, 4),
        growth: round(country.growth, 4),
        stability: round(country.stability, 4),
        debtToGdp: round(country.debtToGdp, 4),
        fxRate: round(country.fxRate, 6),
        sentiment: round(country.sentiment, 4),
        equityIndex: round(country.equityIndex, 4),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function runScriptedTurns(seed: number, actionsByTurn: string[][]): ReturnType<typeof summarizeState> {
  let state: GameState = {
    ...createNewGame(seed),
    maxTurns: 999,
  };

  for (let turn = 0; turn < actionsByTurn.length; turn += 1) {
    const queuedActions = actionsByTurn[turn] ?? [];
    state = advanceTurn({
      ...state,
      pendingDecisions: [...queuedActions],
      maxTurns: 999,
    });
  }

  return summarizeState(state);
}

function pickSimpleActions(state: GameState, rng: ReturnType<typeof createRng>): string[] {
  const eligible = decisions.filter((decision) => (decision.unlockTurn ?? 0) <= state.turn);
  if (eligible.length === 0) return [];

  const actionCount = rng.next() < 0.3 ? 0 : rng.next() < 0.8 ? 1 : 2;
  const picked = new Set<string>();

  for (let i = 0; i < actionCount; i += 1) {
    const index = Math.floor(rng.next() * eligible.length);
    picked.add(eligible[index].id);
  }

  return [...picked];
}

function assertAllNumbersFinite(value: unknown, path = 'state'): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), `${path} should be finite`).toBe(true);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertAllNumbersFinite(entry, `${path}[${index}]`);
    });
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertAllNumbersFinite(entry, `${path}.${key}`);
    }
  }
}

function assertMeterRanges(state: GameState): void {
  expect(state.reputation).toBeGreaterThanOrEqual(0);
  expect(state.reputation).toBeLessThanOrEqual(100);
  expect(state.portfolio.riskScore).toBeGreaterThanOrEqual(0);
  expect(state.portfolio.riskScore).toBeLessThanOrEqual(100);
  expect(state.portfolio.liquidity).toBeGreaterThanOrEqual(0);
  expect(state.portfolio.liquidity).toBeLessThanOrEqual(100);
}

describe('sim sanity checks', () => {
  it('same seed + same action sequence yields same summary snapshot', () => {
    const actionsByTurn = [
      ['buy_sovereign_bonds'],
      ['buy_equities'],
      ['buy_gold'],
      ['raise_leverage'],
      ['short_currency'],
      ['provide_liquidity'],
      ['reduce_leverage'],
      ['SELL_BONDS'],
      ['enter_irs'],
      ['lobby_pr_spend'],
      ['buy_equities'],
      ['buy_gold'],
    ];

    const firstRun = runScriptedTurns(20260222, actionsByTurn);
    const secondRun = runScriptedTurns(20260222, actionsByTurn);

    expect(firstRun).toEqual(secondRun);
    expect(firstRun).toMatchSnapshot();
  });

  it('runs 30 turns without NaN/Infinity and keeps meters in range', () => {
    const actionRng = createRng(9091);
    let state: GameState = {
      ...createNewGame(777),
      maxTurns: 999,
    };

    for (let turn = 0; turn < 30; turn += 1) {
      state = advanceTurn({
        ...state,
        pendingDecisions: pickSimpleActions(state, actionRng),
        maxTurns: 999,
      });

      assertAllNumbersFinite(state);
      assertMeterRanges(state);
    }
  });

  it('keeps 5-turn openings style-distinct without obvious dominant line', () => {
    const stabilizer = runScriptedTurns(20260301, [
      ['buy_sovereign_bonds'],
      ['reduce_leverage'],
      ['buy_sovereign_bonds'],
      ['reduce_leverage'],
      ['buy_sovereign_bonds'],
    ]);
    const predator = runScriptedTurns(20260301, [
      ['raise_leverage'],
      ['raise_leverage'],
      ['raise_leverage'],
      ['raise_leverage'],
      ['short_currency'],
    ]);
    const allocator = runScriptedTurns(20260301, [
      ['buy_equities'],
      ['buy_gold'],
      ['buy_equities'],
      ['buy_gold'],
      ['buy_equities'],
    ]);

    const aumSpread = Math.max(
      stabilizer.portfolio.aum,
      predator.portfolio.aum,
      allocator.portfolio.aum,
    ) - Math.min(
      stabilizer.portfolio.aum,
      predator.portfolio.aum,
      allocator.portfolio.aum,
    );

    expect(aumSpread).toBeLessThan(8);
    expect(predator.portfolio.riskScore).toBeGreaterThanOrEqual(stabilizer.portfolio.riskScore);
    expect(predator.reputation).toBeLessThanOrEqual(stabilizer.reputation);
    expect(allocator.portfolio.riskScore).toBeLessThanOrEqual(predator.portfolio.riskScore);
  });
});
