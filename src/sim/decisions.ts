import type { Decision, GameState, PortfolioAllocation } from './types';
import { normalizeCashBuckets } from './cash';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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
  p.cashTotal -= weight * p.aum;
  return { portfolio: normalizeCashBuckets(p) };
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
  p.cashTotal += soldWeight * p.aum;
  return { portfolio: normalizeCashBuckets(p), soldWeight };
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
    id: 'sell_sovereign_bonds',
    name: 'Sell Sovereign Bonds',
    description: 'Benefit: raise cash fast. Cost: can destabilize fragile markets.',
    cost: 0,
    tags: ['bonds', 'de-risk'],
    unlockTurn: 4,
    reputationDelta: -2,
    causalHint: 'Bond selling -> local rates up -> fragile country stability down',
    effect: (s) => {
      const { portfolio, soldWeight } = reduceAllocation(s, 'br', 'sovereign_bonds', 0.05);
      if (soldWeight <= 0) {
        return { portfolio };
      }
      return {
        portfolio,
        countries: s.countries.map((c) =>
          c.id === 'br'
            ? {
                ...c,
                interestRate: clamp(c.interestRate + 0.2, 0, 20),
                stability: clamp(c.stability - 3, 0, 100),
                sentiment: clamp(c.sentiment - 5, -100, 100),
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
