import type { Decision, GameState, PortfolioAllocation } from './types';

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

export const decisions: Decision[] = [
  {
    id: 'buy_us_bonds',
    name: 'Buy US Treasuries',
    description: 'Safe haven, yields tied to Fed rate.',
    cost: 2,
    tags: ['bonds', 'us'],
    reputationDelta: 1,
    effect: (s) => addAllocation(s, 'us', 'sovereign_bonds', 0.05),
  },
  {
    id: 'buy_eu_bonds',
    name: 'Buy EU Sovereign Bonds',
    description: 'Eurozone government debt exposure.',
    cost: 2,
    tags: ['bonds', 'eu'],
    reputationDelta: 1,
    effect: (s) => addAllocation(s, 'eu', 'sovereign_bonds', 0.05),
  },
  {
    id: 'buy_em_equities',
    name: 'Buy EM Equities',
    description: 'High risk/reward emerging market stocks.',
    cost: 3,
    tags: ['equities', 'emerging'],
    reputationDelta: -1,
    effect: (s) => addAllocation(s, 'br', 'equities', 0.05),
  },
  {
    id: 'buy_asia_equities',
    name: 'Buy Asia-Pacific Equities',
    description: 'Diversified Asia equity basket.',
    cost: 3,
    tags: ['equities', 'asia'],
    reputationDelta: -1,
    effect: (s) => {
      const s1 = addAllocation(s, 'cn', 'equities', 0.025);
      const merged = { ...s, ...s1, portfolio: { ...s.portfolio, ...s1.portfolio } };
      return addAllocation(merged, 'jp', 'equities', 0.025);
    },
  },
  {
    id: 'short_cny',
    name: 'Short CNY',
    description: 'Bet against the yuan. Profits if CNY weakens.',
    cost: 1,
    tags: ['fx', 'china'],
    reputationDelta: -2,
    effect: (s) => addAllocation(s, 'cn', 'fx_short', 0.04),
  },
  {
    id: 'buy_gold',
    name: 'Buy Gold',
    description: 'Inflation hedge, uncorrelated to equities.',
    cost: 2,
    tags: ['gold', 'hedge'],
    effect: (s) => addAllocation(s, 'us', 'gold', 0.05),
  },
  {
    id: 'raise_leverage',
    name: 'Raise Leverage',
    description: 'Increase leverage by 0.5x. More return, more risk.',
    cost: 0,
    tags: ['risk'],
    reputationDelta: -1,
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
    description: 'Decrease leverage by 0.5x. Safer but lower return.',
    cost: 0,
    tags: ['risk'],
    reputationDelta: 1,
    effect: (s) => ({
      portfolio: {
        ...s.portfolio,
        leverage: Math.max(1, s.portfolio.leverage - 0.5),
      },
    }),
  },
  {
    id: 'enter_irs',
    name: 'Enter Rate Swap (US)',
    description: 'Receive fixed / pay floating. Profits if rates drop.',
    cost: 1,
    tags: ['derivatives', 'us'],
    reputationDelta: -1,
    effect: (s) => addAllocation(s, 'us', 'irs', 0.04),
  },
  {
    id: 'sell_all',
    name: 'Liquidate All',
    description: 'Move everything to cash. Reset allocations.',
    cost: 0,
    tags: ['cash'],
    reputationDelta: 1,
    effect: (s) => ({
      portfolio: {
        ...s.portfolio,
        allocations: [],
        cash: s.portfolio.aum,
      },
    }),
  },
];
