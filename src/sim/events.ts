import type { GameEvent, GameState, CountryState } from './types';

function updateCountry(
  state: GameState,
  countryId: string,
  patch: Partial<CountryState>,
): Partial<GameState> {
  return {
    countries: state.countries.map((c) =>
      c.id === countryId ? { ...c, ...patch } : c,
    ),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const events: GameEvent[] = [
  {
    id: 'fed_hike',
    name: 'Fed Rate Hike',
    description: 'The Federal Reserve raises rates by 25bp.',
    weight: 3,
    reputationDelta: -1,
    causalHint: 'US inflation up -> Fed hikes rates -> global risk appetite softens',
    attributionRules: [
      {
        decisionTag: 'risk',
        text: 'Your leverage choices magnified sensitivity to tighter policy.',
      },
    ],
    trigger: (s) => s.countries.find((c) => c.id === 'us')!.inflation > 3,
    effect: (s) => {
      const us = s.countries.find((c) => c.id === 'us')!;
      return updateCountry(s, 'us', {
        interestRate: us.interestRate + 0.25,
        sentiment: us.sentiment - 5,
      });
    },
  },
  {
    id: 'fed_cut',
    name: 'Fed Rate Cut',
    description: 'The Federal Reserve cuts rates by 25bp.',
    weight: 2,
    reputationDelta: 1,
    causalHint: 'US inflation cools -> Fed cuts rates -> sentiment improves',
    attributionRules: [
      {
        decisionId: 'provide_liquidity',
        text: 'Your liquidity support helped calm markets before the cut.',
      },
    ],
    trigger: (s) => s.countries.find((c) => c.id === 'us')!.inflation < 2,
    effect: (s) => {
      const us = s.countries.find((c) => c.id === 'us')!;
      return updateCountry(s, 'us', {
        interestRate: Math.max(0, us.interestRate - 0.25),
        sentiment: us.sentiment + 8,
      });
    },
  },
  {
    id: 'china_stimulus',
    name: 'China Stimulus Package',
    description: 'Beijing announces fiscal stimulus. Growth outlook improves.',
    weight: 2,
    reputationDelta: 1,
    causalHint: 'Policy stimulus -> growth expectations rise -> sentiment improves',
    attributionRules: [
      {
        decisionId: 'short_currency',
        text: 'Your FX pressure contributed to urgency around support measures.',
      },
    ],
    effect: (s) => {
      const cn = s.countries.find((c) => c.id === 'cn')!;
      return updateCountry(s, 'cn', {
        growth: cn.growth + 0.5,
        sentiment: cn.sentiment + 15,
        debtToGdp: cn.debtToGdp + 3,
      });
    },
  },
  {
    id: 'em_crisis',
    name: 'EM Currency Crisis',
    description: 'Emerging market currencies plunge. Contagion fears rise.',
    weight: 1,
    reputationDelta: -4,
    causalHint: 'Stability down -> currency selloff deepens -> contagion fears rise',
    attributionRules: [
      {
        decisionId: 'sell_sovereign_bonds',
        text: 'Your sovereign bond selling amplified Brazil funding stress.',
      },
      {
        decisionId: 'short_currency',
        text: 'Your currency short added pressure to already fragile FX markets.',
      },
      {
        decisionId: 'provide_liquidity',
        text: 'Your liquidity support softened the first wave of panic.',
      },
    ],
    trigger: (s) => s.countries.find((c) => c.id === 'br')!.stability < 50,
    effect: (s) => {
      const br = s.countries.find((c) => c.id === 'br')!;
      return updateCountry(s, 'br', {
        fxRate: br.fxRate * 0.88,
        stability: br.stability - 10,
        sentiment: br.sentiment - 20,
      });
    },
  },
  {
    id: 'oil_spike',
    name: 'Oil Price Spike',
    description: 'Geopolitical tensions push oil prices up. Inflation risk.',
    weight: 2,
    reputationDelta: -2,
    causalHint: 'Oil shock -> inflation pressure rises -> policy risk increases',
    effect: (s) => ({
      countries: s.countries.map((c) => ({
        ...c,
        inflation: c.inflation + 0.4,
        sentiment: c.sentiment - 3,
      })),
    }),
  },
  {
    id: 'tech_rally',
    name: 'Global Tech Rally',
    description: 'AI optimism fuels a tech-led equity rally.',
    weight: 2,
    reputationDelta: 1,
    causalHint: 'Risk appetite up -> equities rally -> portfolio beta pays',
    attributionRules: [
      {
        decisionId: 'buy_equities',
        text: 'Your equity positioning was aligned with this move.',
      },
    ],
    effect: (s) => ({
      countries: s.countries.map((c) => ({
        ...c,
        equityIndex: c.equityIndex * 1.04,
        sentiment: c.sentiment + 6,
      })),
    }),
  },
  {
    id: 'eu_recession',
    name: 'Eurozone Recession Warning',
    description: 'PMI data signals contraction in the Eurozone.',
    weight: 1,
    reputationDelta: -2,
    causalHint: 'Growth warning -> sentiment falls -> equities reprice lower',
    attributionRules: [
      {
        decisionId: 'raise_leverage',
        text: 'Your higher leverage made this slowdown harder to absorb.',
      },
    ],
    trigger: (s) => s.countries.find((c) => c.id === 'eu')!.growth < 1,
    effect: (s) => {
      const eu = s.countries.find((c) => c.id === 'eu')!;
      return updateCountry(s, 'eu', {
        growth: eu.growth - 0.3,
        sentiment: eu.sentiment - 12,
        equityIndex: eu.equityIndex * 0.97,
      });
    },
  },
  {
    id: 'japan_ycc_end',
    name: 'Japan Ends Yield Curve Control',
    description: 'BoJ surprises markets by ending YCC. Yen surges.',
    weight: 1,
    reputationDelta: -1,
    causalHint: 'Policy surprise -> rates jump -> FX volatility rises',
    trigger: (s) => s.countries.find((c) => c.id === 'jp')!.inflation > 2.5,
    effect: (s) => {
      const jp = s.countries.find((c) => c.id === 'jp')!;
      return updateCountry(s, 'jp', {
        interestRate: jp.interestRate + 0.5,
        fxRate: jp.fxRate * 1.06,
        sentiment: jp.sentiment - 8,
      });
    },
  },
  {
    id: 'em_pressure_warning',
    name: 'EM Funding Pressure',
    description: 'Funding spreads widen in Brazil and confidence slips.',
    weight: 1.5,
    reputationDelta: -1,
    causalHint: 'Stability slips -> funding stress builds -> crisis odds rise',
    attributionRules: [
      {
        decisionId: 'sell_sovereign_bonds',
        text: 'Your bond selling helped accelerate that pressure.',
      },
      {
        decisionId: 'short_currency',
        text: 'Your FX short added to market nerves.',
      },
    ],
    trigger: (s) =>
      s.countries.find((c) => c.id === 'br')!.stability < 58 &&
      (s.worldFlags.em_pressure ?? 0) === 0,
    effect: (s) => {
      const br = s.countries.find((c) => c.id === 'br')!;
      return {
        countries: s.countries.map((c) =>
          c.id === 'br'
            ? {
                ...c,
                stability: clamp(br.stability - 2, 0, 100),
                sentiment: clamp(br.sentiment - 6, -100, 100),
              }
            : c,
        ),
        worldFlags: {
          em_pressure: 3,
        },
      };
    },
  },
  {
    id: 'capital_flight_wave',
    name: 'Capital Flight Wave',
    description: 'Investors pull capital out of Brazil as panic grows.',
    weight: 1.2,
    reputationDelta: -2,
    causalHint: 'Pressure persists -> outflows accelerate -> FX and stability weaken',
    trigger: (s) => (s.worldFlags.em_pressure ?? 0) > 0,
    effect: (s) => {
      const br = s.countries.find((c) => c.id === 'br')!;
      return {
        countries: s.countries.map((c) =>
          c.id === 'br'
            ? {
                ...c,
                fxRate: br.fxRate * 0.94,
                stability: clamp(br.stability - 5, 0, 100),
                sentiment: clamp(br.sentiment - 8, -100, 100),
              }
            : c,
        ),
        worldFlags: {
          em_capital_flight: 3,
        },
      };
    },
  },
  {
    id: 'imf_backstop',
    name: 'Emergency IMF Backstop',
    description: 'Emergency financing package slows the EM selloff.',
    weight: 1.1,
    reputationDelta: 2,
    causalHint: 'Emergency support -> rates ease -> confidence partially recovers',
    attributionRules: [
      {
        decisionId: 'provide_liquidity',
        text: 'Your liquidity support improved the odds of stabilization.',
      },
      {
        decisionId: 'lobby_pr_spend',
        text: 'Your political outreach helped unlock policy support.',
      },
    ],
    trigger: (s) =>
      (s.worldFlags.em_capital_flight ?? 0) > 0 &&
      s.countries.find((c) => c.id === 'br')!.stability < 55,
    effect: (s) => {
      const br = s.countries.find((c) => c.id === 'br')!;
      return {
        countries: s.countries.map((c) =>
          c.id === 'br'
            ? {
                ...c,
                interestRate: clamp(br.interestRate - 0.4, 0, 20),
                stability: clamp(br.stability + 6, 0, 100),
                sentiment: clamp(br.sentiment + 7, -100, 100),
              }
            : c,
        ),
        worldFlags: {
          em_pressure: 0,
          em_capital_flight: 0,
        },
      };
    },
  },
  {
    id: 'regulatory_warning',
    name: 'Regulatory Warning',
    description: 'Supervisors flag your risk profile and demand restraint.',
    weight: 1.0,
    reputationDelta: -2,
    causalHint: 'Risk runs hot -> oversight tightens -> policy pressure rises',
    trigger: (s) =>
      s.portfolio.riskScore > 72 &&
      (s.worldFlags.reg_watch ?? 0) === 0,
    effect: () => ({
      worldFlags: {
        reg_watch: 3,
      },
    }),
  },
  {
    id: 'regulatory_crackdown',
    name: 'Regulatory Crackdown',
    description: 'Regulators force de-risking after persistent market pressure.',
    weight: 0.9,
    reputationDelta: -3,
    causalHint: 'Warnings ignored -> crackdown hits -> leverage is forced lower',
    trigger: (s) =>
      (s.worldFlags.reg_watch ?? 0) > 0 &&
      s.reputation < 45,
    effect: (s) => ({
      portfolio: {
        ...s.portfolio,
        leverage: Math.max(1, s.portfolio.leverage - 0.5),
      },
      worldFlags: {
        reg_watch: 0,
      },
    }),
  },
  {
    id: 'risk_on',
    name: 'Risk-On Sentiment Wave',
    description: 'Global investors rotate into risk assets.',
    weight: 3,
    reputationDelta: 1,
    causalHint: 'Sentiment improves -> investors buy risk -> equities grind higher',
    attributionRules: [
      {
        decisionId: 'buy_equities',
        text: 'Your recent equity build-up benefited from the rotation.',
      },
    ],
    effect: (s) => ({
      countries: s.countries.map((c) => ({
        ...c,
        sentiment: c.sentiment + 5,
        equityIndex: c.equityIndex * 1.015,
      })),
    }),
  },
  {
    id: 'risk_off',
    name: 'Risk-Off Flight to Safety',
    description: 'Investors flee to bonds and gold. Equities dip.',
    weight: 2,
    reputationDelta: -1,
    causalHint: 'Fear rises -> risk assets sold -> equity indices weaken',
    attributionRules: [
      {
        decisionId: 'raise_leverage',
        text: 'Your leveraged book amplified downside during the selloff.',
      },
      {
        decisionId: 'buy_gold',
        text: 'Your gold hedge helped cushion part of the shock.',
      },
    ],
    effect: (s) => ({
      countries: s.countries.map((c) => ({
        ...c,
        sentiment: c.sentiment - 7,
        equityIndex: c.equityIndex * 0.98,
      })),
    }),
  },
];
