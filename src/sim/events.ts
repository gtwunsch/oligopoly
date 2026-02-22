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

export const events: GameEvent[] = [
  {
    id: 'fed_hike',
    name: 'Fed Rate Hike',
    description: 'The Federal Reserve raises rates by 25bp.',
    weight: 3,
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
    id: 'risk_on',
    name: 'Risk-On Sentiment Wave',
    description: 'Global investors rotate into risk assets.',
    weight: 3,
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
    effect: (s) => ({
      countries: s.countries.map((c) => ({
        ...c,
        sentiment: c.sentiment - 7,
        equityIndex: c.equityIndex * 0.98,
      })),
    }),
  },
];
