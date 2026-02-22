import { SELL_BONDS_DECISION_ID } from './decisionIds';
import type { Decision, DecisionExecutionInput, GameState, PortfolioAllocation } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const DEFAULT_SELL_BONDS_TARGET = 'br';
const DEFAULT_SELL_BONDS_AMOUNT = 0.05;
const MIN_SELL_BONDS_AMOUNT = 0.01;
const MAX_SELL_BONDS_AMOUNT = 0.08;
const FRAGILE_STABILITY_THRESHOLD = 60;

const INTEREST_RATE_SHOCK_PER_WEIGHT = 4;
const MAX_INTEREST_RATE_SHOCK = 0.6;
const BASE_STABILITY_HIT = 1;
const STABILITY_HIT_PER_WEIGHT = 40;
const MAX_STABILITY_HIT = 7;
const BASE_SENTIMENT_HIT = 2;
const SENTIMENT_HIT_PER_WEIGHT = 55;
const MAX_SENTIMENT_HIT = 10;

export interface SellBondsExecutionContext {
  targetCountry: string;
  requestedAmount: number;
  soldAmount: number;
  interestRateShock: number;
  stabilityHit: number;
  sentimentHit: number;
  isFragile: boolean;
}

function addAllocation(
  state: GameState,
  countryId: string,
  asset: PortfolioAllocation['asset'],
  weight: number,
): Partial<GameState> {
  const p = { ...state.portfolio };
  const existing = p.allocations.find(
    (a) => a.countryId === countryId && a.asset === asset,
  );
  if (existing) {
    p.allocations = p.allocations.map((a) =>
      a === existing ? { ...a, weight: a.weight + weight } : a,
    );
  } else {
    p.allocations = [...p.allocations, { countryId, asset, weight }];
  }
  p.cash -= weight * p.aum;
  return { portfolio: p };
}

function reduceAllocation(
  state: GameState,
  countryId: string,
  asset: PortfolioAllocation['asset'],
  weight: number,
): { portfolio: GameState['portfolio']; soldWeight: number } {
  const p = {
    ...state.portfolio,
    allocations: state.portfolio.allocations.map((a) => ({ ...a })),
  };
  const existing = p.allocations.find((a) => a.countryId === countryId && a.asset === asset);
  if (!existing) {
    return { portfolio: p, soldWeight: 0 };
  }

  const soldWeight = Math.min(weight, existing.weight);
  existing.weight = Math.max(0, existing.weight - soldWeight);
  p.allocations = p.allocations.filter((a) => a.weight > 0.0001);
  p.cash += soldWeight * p.aum;
  return { portfolio: p, soldWeight };
}

function resolveTargetCountry(state: GameState, requestedTarget?: string): string {
  if (requestedTarget && state.countries.some((country) => country.id === requestedTarget)) {
    return requestedTarget;
  }
  if (state.countries.some((country) => country.id === DEFAULT_SELL_BONDS_TARGET)) {
    return DEFAULT_SELL_BONDS_TARGET;
  }
  return state.countries[0]?.id ?? DEFAULT_SELL_BONDS_TARGET;
}

function sanitizeSellAmount(amount?: number): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return DEFAULT_SELL_BONDS_AMOUNT;
  }
  return clamp(amount, MIN_SELL_BONDS_AMOUNT, MAX_SELL_BONDS_AMOUNT);
}

function getSovereignBondWeight(state: GameState, countryId: string): number {
  return state.portfolio.allocations.find(
    (allocation) => allocation.countryId === countryId && allocation.asset === 'sovereign_bonds',
  )?.weight ?? 0;
}

function computeSellBondsShocks(soldAmount: number, isFragile: boolean) {
  if (soldAmount <= 0) {
    return {
      interestRateShock: 0,
      stabilityHit: 0,
      sentimentHit: 0,
    };
  }

  const fragilityMultiplier = isFragile ? 1.35 : 1;
  return {
    interestRateShock: clamp(soldAmount * INTEREST_RATE_SHOCK_PER_WEIGHT, 0, MAX_INTEREST_RATE_SHOCK),
    stabilityHit: clamp(
      (BASE_STABILITY_HIT + soldAmount * STABILITY_HIT_PER_WEIGHT) * fragilityMultiplier,
      0,
      MAX_STABILITY_HIT,
    ),
    sentimentHit: clamp(
      (BASE_SENTIMENT_HIT + soldAmount * SENTIMENT_HIT_PER_WEIGHT) * fragilityMultiplier,
      0,
      MAX_SENTIMENT_HIT,
    ),
  };
}

export function resolveSellBondsExecution(
  state: GameState,
  input?: DecisionExecutionInput,
): SellBondsExecutionContext {
  const targetCountry = resolveTargetCountry(state, input?.targetCountry);
  const requestedAmount = sanitizeSellAmount(input?.amount);
  const currentBondWeight = getSovereignBondWeight(state, targetCountry);
  const soldAmount = Math.min(requestedAmount, currentBondWeight);
  const targetStability = state.countries.find((country) => country.id === targetCountry)?.stability ?? 100;
  const isFragile = targetStability < FRAGILE_STABILITY_THRESHOLD;
  const { interestRateShock, stabilityHit, sentimentHit } = computeSellBondsShocks(soldAmount, isFragile);

  return {
    targetCountry,
    requestedAmount,
    soldAmount,
    interestRateShock,
    stabilityHit,
    sentimentHit,
    isFragile,
  };
}

export const decisions: Decision[] = [
  {
    id: 'buy_sovereign_bonds',
    name: 'Buy Sovereign Bonds',
    description: 'Benefit: steady carry. Cost: lower upside than equities.',
    cost: 2,
    tags: ['bonds', 'income'],
    unlockTurn: 0,
    reputationDelta: 1,
    causalHint: 'Rates down -> bond prices up -> carry plus mark-to-market gains',
    effect: (s) => addAllocation(s, 'br', 'sovereign_bonds', 0.05),
  },
  {
    id: SELL_BONDS_DECISION_ID,
    name: 'Sell Sovereign Bonds',
    description: 'Benefit: raise cash fast. Cost: destabilizes the target market and hits reputation.',
    cost: 0,
    tags: ['bonds', 'de-risk'],
    unlockTurn: 4,
    causalHint: 'Bond selloff -> local rates up -> stability down -> political heat rises',
    effect: (s, input) => {
      const execution = resolveSellBondsExecution(s, input);
      const { portfolio, soldWeight } = reduceAllocation(
        s,
        execution.targetCountry,
        'sovereign_bonds',
        execution.requestedAmount,
      );
      if (soldWeight <= 0) {
        return { portfolio };
      }

      const { interestRateShock, stabilityHit, sentimentHit } = computeSellBondsShocks(
        soldWeight,
        execution.isFragile,
      );
      return {
        portfolio,
        countries: s.countries.map((c) =>
          c.id === execution.targetCountry
            ? {
                ...c,
                interestRate: clamp(c.interestRate + interestRateShock, 0, 20),
                stability: clamp(c.stability - stabilityHit, 0, 100),
                sentiment: clamp(c.sentiment - sentimentHit, -100, 100),
              }
            : c,
        ),
      };
    },
  },
  {
    id: 'buy_equities',
    name: 'Buy Equities',
    description: 'Benefit: higher growth upside. Cost: higher drawdown risk.',
    cost: 3,
    tags: ['equities', 'growth'],
    unlockTurn: 0,
    reputationDelta: -1,
    causalHint: 'Growth and sentiment up -> equities up -> portfolio beta increases',
    effect: (s) => {
      const s1 = addAllocation(s, 'cn', 'equities', 0.025);
      const merged = { ...s, ...s1, portfolio: { ...s.portfolio, ...s1.portfolio } };
      return addAllocation(merged, 'br', 'equities', 0.025);
    },
  },
  {
    id: 'short_currency',
    name: 'Short Currency',
    description: 'Benefit: profit on depreciation. Cost: reputation hit from pressure.',
    cost: 1,
    tags: ['fx', 'macro'],
    unlockTurn: 4,
    reputationDelta: -2,
    causalHint: 'Currency weakens -> short position gains -> local stress risk rises',
    effect: (s) => addAllocation(s, 'br', 'fx_short', 0.04),
  },
  {
    id: 'buy_gold',
    name: 'Buy Gold',
    description: 'Benefit: inflation hedge. Cost: weaker returns in risk-on markets.',
    cost: 2,
    tags: ['gold', 'hedge'],
    unlockTurn: 0,
    causalHint: 'Inflation up -> gold demand up -> portfolio hedge improves',
    effect: (s) => addAllocation(s, 'us', 'gold', 0.05),
  },
  {
    id: 'raise_leverage',
    name: 'Raise Leverage',
    description: 'Benefit: amplify upside. Cost: amplify losses and fragility.',
    cost: 0,
    tags: ['risk'],
    unlockTurn: 0,
    reputationDelta: -1,
    causalHint: 'Leverage up -> gains and losses amplify -> bank risk rises',
    effect: (s) => ({
      portfolio: {
        ...s.portfolio,
        leverage: Math.min(5, s.portfolio.leverage + 0.5),
      },
    }),
  },
  {
    id: 'reduce_leverage',
    name: 'Reduce Leverage',
    description: 'Benefit: reduce blow-up risk. Cost: lower upside this turn.',
    cost: 0,
    tags: ['risk'],
    unlockTurn: 0,
    reputationDelta: 1,
    causalHint: 'Leverage down -> volatility dampens -> downside risk falls',
    effect: (s) => ({
      portfolio: {
        ...s.portfolio,
        leverage: Math.max(1, s.portfolio.leverage - 0.5),
      },
    }),
  },
  {
    id: 'enter_irs',
    name: 'Interest Rate Swap',
    description: 'Benefit: hedge rate moves. Cost: derivative complexity and basis risk.',
    cost: 1,
    tags: ['derivatives', 'rates'],
    unlockTurn: 8,
    reputationDelta: -1,
    causalHint: 'Rates fall -> swap mark-to-market rises -> derivative P&L improves',
    effect: (s) => addAllocation(s, 'us', 'irs', 0.04),
  },
  {
    id: 'provide_liquidity',
    name: 'Provide Liquidity',
    description: 'Benefit: stabilizes stressed market. Cost: ties up capital now.',
    cost: 2,
    tags: ['stability', 'intervention'],
    unlockTurn: 6,
    reputationDelta: 2,
    causalHint: 'Liquidity support -> rates ease -> stability and sentiment improve',
    effect: (s) => ({
      countries: s.countries.map((c) =>
        c.id === 'br'
          ? {
              ...c,
              interestRate: clamp(c.interestRate - 0.35, 0, 20),
              stability: clamp(c.stability + 4, 0, 100),
              sentiment: clamp(c.sentiment + 6, -100, 100),
            }
          : c,
      ),
    }),
  },
  {
    id: 'lobby_pr_spend',
    name: 'Lobby / PR Spend',
    description: 'Benefit: rebuild reputation. Cost: expensive and slightly dampens sentiment.',
    cost: 2,
    tags: ['policy', 'reputation'],
    unlockTurn: 8,
    reputationDelta: 6,
    causalHint: 'PR campaign -> political heat cools -> reputation improves',
    effect: (s) => ({
      countries: s.countries.map((c) => ({
        ...c,
        sentiment: clamp(c.sentiment - 1, -100, 100),
      })),
    }),
  },
];
