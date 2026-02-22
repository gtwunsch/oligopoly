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
    headlineTemplates: [
      'Fed Delivers Another Hike',
      'US Rates Move Higher',
      'Fed Tightens Policy Again',
    ],
    description: 'The Federal Reserve raises rates by 25bp.',
    why: 'US inflation stayed above target, so policymakers tightened financial conditions.',
    weight: 3,
    reputationDelta: -1,
    causalHint: 'US inflation up -> Fed hikes rates -> global risk appetite softens',
    attributionRules: [
      {
        decisionId: 'raise_leverage',
        text: 'Your leverage increase left the book more exposed to tighter policy.',
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
    headlineTemplates: [
      'Fed Signals Relief With Cut',
      'US Policy Rate Trimmed',
      'Fed Eases as Inflation Cools',
    ],
    description: 'The Federal Reserve cuts rates by 25bp.',
    why: 'Cooling inflation and softer demand gave room for a modest easing step.',
    weight: 2,
    reputationDelta: 1,
    causalHint: 'US inflation cools -> Fed cuts rates -> sentiment improves',
    attributionRules: [
      {
        decisionId: 'provide_liquidity',
        text: 'After your liquidity support, markets were calmer heading into the cut.',
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
    headlineTemplates: [
      'Beijing Unveils Fresh Stimulus',
      'China Adds Fiscal Support',
      'China Moves to Stabilize Growth',
    ],
    description: 'Beijing announces fiscal stimulus. Growth outlook improves.',
    why: 'Weak activity data pushed authorities to backstop demand and confidence.',
    weight: 2,
    reputationDelta: 1,
    causalHint: 'Policy stimulus -> growth expectations rise -> sentiment improves',
    attributionRules: [
      {
        decisionId: 'short_currency',
        text: 'After your FX short expansion, support measures became more urgent.',
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
    headlineTemplates: [
      'EM FX Rout Deepens',
      'Currency Stress Hits Emerging Markets',
      'Contagion Fears Return in EM',
    ],
    description: 'Emerging market currencies plunge. Contagion fears rise.',
    why: 'Funding stress and thin liquidity triggered broad selling across fragile FX markets.',
    weight: 1,
    reputationDelta: -4,
    causalHint: 'Stability down -> currency selloff deepens -> contagion fears rise',
    useLastActionLead: true,
    attributionRules: [
      {
        decisionId: 'sell_sovereign_bonds',
        text: 'After your bond sell-off, Brazil funding stress intensified.',
      },
      {
        decisionId: 'short_currency',
        text: 'After your FX short expansion, market depth dried up faster.',
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
    headlineTemplates: [
      'Oil Prices Jump on Supply Risk',
      'Energy Shock Lifts Inflation Risk',
      'Crude Spike Ripples Through Markets',
    ],
    description: 'Geopolitical tensions push oil prices up. Inflation risk.',
    why: 'A supply disruption repriced energy costs and lifted near-term inflation expectations.',
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
    headlineTemplates: [
      'Tech Stocks Lead Global Rally',
      'AI Optimism Drives Equity Surge',
      'Growth Shares Outperform Broadly',
    ],
    description: 'AI optimism fuels a tech-led equity rally.',
    why: 'Stronger earnings guidance and lower rate fears boosted demand for growth stocks.',
    weight: 2,
    reputationDelta: 1,
    causalHint: 'Risk appetite up -> equities rally -> portfolio beta pays',
    attributionRules: [
      {
        decisionId: 'buy_equities',
        text: 'After your equity build-up, your book was positioned for this move.',
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
    headlineTemplates: [
      'Eurozone Activity Slips Again',
      'Recession Risk Builds in Europe',
      'Euro Area Growth Warning Intensifies',
    ],
    description: 'PMI data signals contraction in the Eurozone.',
    why: 'Weak PMIs and tighter credit pointed to slower demand across the bloc.',
    weight: 1,
    reputationDelta: -2,
    causalHint: 'Growth warning -> sentiment falls -> equities reprice lower',
    useLastActionLead: true,
    attributionRules: [
      {
        decisionId: 'raise_leverage',
        text: 'Your leverage increase made this slowdown harder to absorb.',
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
    headlineTemplates: [
      'BoJ Ends Yield Curve Control',
      'Japan Policy Surprise Jolts Rates',
      'Yen Jumps After BoJ Shift',
    ],
    description: 'BoJ surprises markets by ending YCC. Yen surges.',
    why: 'Persistent domestic inflation increased pressure for policy normalization.',
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
    headlineTemplates: [
      'EM Funding Spreads Widen',
      'Brazil Faces Renewed Funding Stress',
      'Early Warning: EM Pressure Rising',
    ],
    description: 'Funding spreads widen in Brazil and confidence slips.',
    why: 'Lower confidence raised refinancing costs and cut risk tolerance for Brazil assets.',
    weight: 1.5,
    reputationDelta: -1,
    causalHint: 'Stability slips -> funding stress builds -> crisis odds rise',
    useLastActionLead: true,
    attributionRules: [
      {
        decisionId: 'sell_sovereign_bonds',
        text: 'After your bond sell-off, spreads widened faster.',
      },
      {
        decisionId: 'short_currency',
        text: 'After your FX short expansion, market nerves escalated.',
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
    headlineTemplates: [
      'Capital Outflows Accelerate in Brazil',
      'Investors Pull Back From EM Risk',
      'Flight to Safety Hits Brazil Assets',
    ],
    description: 'Investors pull capital out of Brazil as panic grows.',
    why: 'Ongoing uncertainty pushed investors toward liquid safe-haven positions.',
    weight: 1.2,
    reputationDelta: -2,
    causalHint: 'Pressure persists -> outflows accelerate -> FX and stability weaken',
    useLastActionLead: true,
    attributionRules: [
      {
        decisionId: 'sell_sovereign_bonds',
        text: 'Your bond sell-off reinforced the outflow impulse.',
      },
      {
        decisionId: 'short_currency',
        text: 'Your FX short expansion amplified local defensive positioning.',
      },
      {
        decisionId: 'provide_liquidity',
        text: 'Your liquidity support slowed the speed of exits at the margin.',
      },
    ],
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
    headlineTemplates: [
      'IMF Backstop Calms EM Volatility',
      'Emergency Financing Package Announced',
      'Policy Support Slows Outflow Cycle',
    ],
    description: 'Emergency financing package slows the EM selloff.',
    why: 'Coordinated external funding reduced immediate rollover risk and restored confidence.',
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
        text: 'Your outreach campaign helped unlock policy support.',
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
    headlineTemplates: [
      'Supervisors Issue Risk Warning',
      'Regulators Flag Elevated Risk Profile',
      'Oversight Tightens on Your Bank',
    ],
    description: 'Supervisors flag your risk profile and demand restraint.',
    why: 'High portfolio risk metrics triggered closer supervisory scrutiny.',
    weight: 1.0,
    reputationDelta: -2,
    causalHint: 'Risk runs hot -> oversight tightens -> policy pressure rises',
    useLastActionLead: true,
    attributionRules: [
      {
        decisionId: 'raise_leverage',
        text: 'Your leverage increase pushed risk metrics into supervisory focus.',
      },
      {
        decisionId: 'reduce_leverage',
        text: 'Your deleveraging move helped, but risk metrics stayed in the warning zone.',
      },
    ],
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
    headlineTemplates: [
      'Regulators Order Forced De-Risking',
      'Formal Crackdown Hits Leverage',
      'Supervisory Action Escalates',
    ],
    description: 'Regulators force de-risking after persistent market pressure.',
    why: 'Repeated warnings and weak credibility forced a direct intervention.',
    weight: 0.9,
    reputationDelta: -3,
    causalHint: 'Warnings ignored -> crackdown hits -> leverage is forced lower',
    useLastActionLead: true,
    attributionRules: [
      {
        decisionId: 'raise_leverage',
        text: 'Your leverage increase made a forced unwind more likely.',
      },
      {
        decisionId: 'lobby_pr_spend',
        text: 'Your outreach campaign was not enough to offset supervisory pressure.',
      },
    ],
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
    headlineTemplates: [
      'Risk Appetite Improves Globally',
      'Investors Rotate Back Into Risk',
      'Broad Risk-On Session Lifts Equities',
    ],
    description: 'Global investors rotate into risk assets.',
    why: 'Macro data stabilized and volatility eased, supporting stronger equity demand.',
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
    headlineTemplates: [
      'Risk-Off Move Hits Equities',
      'Flight to Safety Returns',
      'Defensive Positioning Spreads',
    ],
    description: 'Investors flee to bonds and gold. Equities dip.',
    why: 'Volatility rose after growth concerns, prompting a broad cut in risk exposure.',
    weight: 2,
    reputationDelta: -1,
    causalHint: 'Fear rises -> risk assets sold -> equity indices weaken',
    useLastActionLead: true,
    attributionRules: [
      {
        decisionId: 'raise_leverage',
        text: 'Your leverage increase amplified downside during the selloff.',
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
