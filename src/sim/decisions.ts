import type { Decision, GameState, PortfolioAllocation } from './types';

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

function resolveTarget(explicit?: string): string {
  return explicit ?? 'br';
}

export const decisions: Decision[] = [
  {
    id: 'buy_sovereign_bonds',
    name: 'Buy Sovereign Bonds',
    shortDesc: 'Steady carry income, lower upside than equities',
    description: 'Allocate 5% of AUM to sovereign bonds in the target country. Earns carry from rates but loses value if rates rise.',
    cost: 5,
    tags: ['bonds', 'income'],
    category: 'invest',
    requiresTarget: true,
    unlockTurn: 0,
    reputationDelta: 1,
    causalHint: 'Bond buying → local rates ease → currency strengthens',
    effect: (s, target) => addAllocation(s, resolveTarget(target), 'sovereign_bonds', 0.05),
  },
  {
    id: 'sell_sovereign_bonds',
    name: 'Sell Sovereign Bonds',
    shortDesc: 'Raise cash fast, but can destabilize fragile markets',
    description: 'Sell 5% of your bond holdings in the target country. Returns cash but pushes local rates up and hurts stability.',
    cost: 0,
    tags: ['bonds', 'de-risk'],
    category: 'divest',
    requiresTarget: true,
    unlockTurn: 4,
    reputationDelta: -2,
    causalHint: 'Bond selling → local rates up → stability down',
    effect: (s, target) => {
      const cid = resolveTarget(target);
      const { portfolio, soldWeight } = reduceAllocation(s, cid, 'sovereign_bonds', 0.05);
      if (soldWeight <= 0) return { portfolio };
      return {
        portfolio,
        countries: s.countries.map((c) =>
          c.id === cid
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
    shortDesc: 'Higher growth upside, higher drawdown risk',
    description: 'Allocate 5% of AUM to equities in the target country. Benefits from growth and sentiment, but vulnerable to downturns.',
    cost: 5,
    tags: ['equities', 'growth'],
    category: 'invest',
    requiresTarget: true,
    unlockTurn: 0,
    reputationDelta: -1,
    causalHint: 'Equity buying → market sentiment lifts → portfolio beta increases',
    effect: (s, target) => addAllocation(s, resolveTarget(target), 'equities', 0.05),
  },
  {
    id: 'short_currency',
    name: 'Short Currency',
    shortDesc: 'Profit on depreciation, but draws political heat',
    description: 'Bet against the target country\'s currency. Profits when FX weakens, but damages your reputation with that government.',
    cost: 4,
    tags: ['fx', 'macro'],
    category: 'invest',
    requiresTarget: true,
    unlockTurn: 4,
    reputationDelta: -2,
    causalHint: 'FX short → currency pressure builds → local stress rises',
    effect: (s, target) => addAllocation(s, resolveTarget(target), 'fx_short', 0.04),
  },
  {
    id: 'buy_gold',
    name: 'Buy Gold',
    shortDesc: 'Inflation hedge, weaker in risk-on markets',
    description: 'Allocate 5% of AUM to gold. Rises with inflation and fear, falls when markets are calm. No country exposure.',
    cost: 5,
    tags: ['gold', 'hedge'],
    category: 'invest',
    unlockTurn: 0,
    causalHint: 'Gold hedge → inflation protected → dampens portfolio volatility',
    effect: (s) => addAllocation(s, 'us', 'gold', 0.05),
  },
  {
    id: 'raise_leverage',
    name: 'Raise Leverage',
    shortDesc: 'Amplify gains AND losses',
    description: 'Increase leverage by 0.5x. All positions grow proportionally — great in bull markets, devastating in downturns.',
    cost: 0,
    tags: ['risk'],
    category: 'risk',
    unlockTurn: 0,
    reputationDelta: -1,
    causalHint: 'Leverage up → all P&L amplified → bank risk rises',
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
    shortDesc: 'Reduce blow-up risk, lower returns',
    description: 'Decrease leverage by 0.5x. Reduces both upside and downside. Lowers bank risk score.',
    cost: 0,
    tags: ['risk'],
    category: 'risk',
    unlockTurn: 0,
    reputationDelta: 1,
    causalHint: 'Leverage down → volatility dampens → risk score improves',
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
    shortDesc: 'Hedge rate moves, adds derivative complexity',
    description: 'Enter a receive-fixed swap on the target country. Profits when rates fall, loses when rates rise. Adds derivative exposure.',
    cost: 4,
    tags: ['derivatives', 'rates'],
    category: 'invest',
    requiresTarget: true,
    unlockTurn: 8,
    reputationDelta: -1,
    causalHint: 'IRS position → rate sensitivity shifts → derivative P&L exposed',
    effect: (s, target) => addAllocation(s, resolveTarget(target), 'irs', 0.04),
  },
  {
    id: 'provide_liquidity',
    name: 'Provide Liquidity',
    shortDesc: 'Stabilize a stressed market, ties up capital',
    description: 'Inject capital into the target country\'s market. Eases rates, boosts stability and sentiment. Expensive but earns reputation.',
    cost: 3,
    tags: ['stability', 'intervention'],
    category: 'political',
    requiresTarget: true,
    unlockTurn: 6,
    reputationDelta: 2,
    causalHint: 'Liquidity support → rates ease → stability and sentiment improve',
    effect: (s, target) => {
      const cid = resolveTarget(target);
      return {
        countries: s.countries.map((c) =>
          c.id === cid
            ? {
                ...c,
                interestRate: clamp(c.interestRate - 0.35, 0, 20),
                stability: clamp(c.stability + 4, 0, 100),
                sentiment: clamp(c.sentiment + 6, -100, 100),
              }
            : c,
        ),
      };
    },
  },
  {
    id: 'lobby_pr_spend',
    name: 'Lobby / PR Spend',
    shortDesc: 'Rebuild reputation, expensive',
    description: 'Launch a PR campaign and political lobbying effort. Recovers reputation but costs capital and slightly dampens global sentiment.',
    cost: 3,
    tags: ['policy', 'reputation'],
    category: 'political',
    unlockTurn: 8,
    reputationDelta: 6,
    causalHint: 'PR campaign → political heat cools → reputation improves',
    effect: (s) => ({
      countries: s.countries.map((c) => ({
        ...c,
        sentiment: clamp(c.sentiment - 1, -100, 100),
      })),
    }),
  },
];
