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
    tags: ['bonds', 'income', 'style_stabilizer'],
    unlockTurn: 0,
    reputationDelta: 2,
    causalHint: 'Rates down -> bond prices up -> carry plus mark-to-market gains',
    effect: (s) => addAllocation(s, 'br', 'sovereign_bonds', 0.05),
  },
  {
    id: 'sell_sovereign_bonds',
    name: 'Sell Sovereign Bonds',
    description: 'Benefit: raise cash fast. Cost: can destabilize fragile markets.',
    cost: 0,
    tags: ['bonds', 'de-risk', 'style_predator'],
    unlockTurn: 4,
    reputationDelta: -3,
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
                interestRate: clamp(c.interestRate + 0.25, 0, 20),
                stability: clamp(c.stability - 4, 0, 100),
                sentiment: clamp(c.sentiment - 6, -100, 100),
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
    tags: ['equities', 'growth', 'style_allocator'],
    unlockTurn: 0,
    reputationDelta: 0,
    causalHint: 'Growth and sentiment up -> equities up -> portfolio beta increases',
    effect: (s) => {
      const s1 = addAllocation(s, 'cn', 'equities', 0.02);
      const merged = { ...s, ...s1, portfolio: { ...s.portfolio, ...s1.portfolio } };
      const s2 = addAllocation(merged, 'br', 'equities', 0.02);
      const merged2 = { ...merged, ...s2, portfolio: { ...merged.portfolio, ...s2.portfolio } };
      return addAllocation(merged2, 'eu', 'equities', 0.01);
    },
  },
  {
    id: 'short_currency',
    name: 'Short Currency',
    description: 'Benefit: profit on depreciation. Cost: reputation hit from pressure.',
    cost: 1,
    tags: ['fx', 'macro', 'style_predator'],
    unlockTurn: 4,
    reputationDelta: -3,
    causalHint: 'Currency weakens -> short position gains -> local stress risk rises',
    effect: (s) => addAllocation(s, 'br', 'fx_short', 0.05),
  },
  {
    id: 'buy_gold',
    name: 'Buy Gold',
    description: 'Benefit: inflation hedge. Cost: weaker returns in risk-on markets.',
    cost: 2,
    tags: ['gold', 'hedge', 'style_allocator'],
    unlockTurn: 0,
    causalHint: 'Inflation up -> gold demand up -> portfolio hedge improves',
    effect: (s) => {
      const s1 = addAllocation(s, 'us', 'gold', 0.03);
      const merged = { ...s, ...s1, portfolio: { ...s.portfolio, ...s1.portfolio } };
      return addAllocation(merged, 'jp', 'gold', 0.02);
    },
  },
  {
    id: 'raise_leverage',
    name: 'Raise Leverage',
    description: 'Benefit: amplify upside. Cost: amplify losses and fragility.',
    cost: 0,
    tags: ['risk', 'style_predator'],
    unlockTurn: 0,
    reputationDelta: -2,
    causalHint: 'Leverage up -> gains and losses amplify -> bank risk rises',
    effect: (s) => ({
      portfolio: {
        ...s.portfolio,
        leverage: Math.min(5, s.portfolio.leverage + 0.75),
      },
    }),
  },
  {
    id: 'reduce_leverage',
    name: 'Reduce Leverage',
    description: 'Benefit: reduce blow-up risk. Cost: lower upside this turn.',
    cost: 0,
    tags: ['risk', 'style_stabilizer'],
    unlockTurn: 0,
    reputationDelta: 2,
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
    tags: ['derivatives', 'rates', 'style_allocator'],
    unlockTurn: 8,
    reputationDelta: 0,
    causalHint: 'Rates fall -> swap mark-to-market rises -> derivative P&L improves',
    effect: (s) => {
      const s1 = addAllocation(s, 'us', 'irs', 0.02);
      const merged = { ...s, ...s1, portfolio: { ...s.portfolio, ...s1.portfolio } };
      return addAllocation(merged, 'eu', 'irs', 0.02);
    },
  },
  {
    id: 'provide_liquidity',
    name: 'Provide Liquidity',
    description: 'Benefit: stabilizes stressed market. Cost: ties up capital now.',
    cost: 2,
    tags: ['stability', 'intervention', 'style_stabilizer'],
    unlockTurn: 6,
    reputationDelta: 3,
    causalHint: 'Liquidity support -> rates ease -> stability and sentiment improve',
    effect: (s) => ({
      countries: s.countries.map((c) =>
        c.id === 'br'
          ? {
              ...c,
              interestRate: clamp(c.interestRate - 0.4, 0, 20),
              stability: clamp(c.stability + 5, 0, 100),
              sentiment: clamp(c.sentiment + 7, -100, 100),
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
    tags: ['policy', 'reputation', 'style_stabilizer'],
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
