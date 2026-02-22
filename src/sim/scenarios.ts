import type { CountryState } from './types';

export interface ScenarioConfig {
  id: 'calm_markets' | 'emerging_crisis' | 'rate_shock';
  name: string;
  description: string;
  countryPatches: Record<string, Partial<CountryState>>;
  eventWeightBias: Record<string, number>;
  startingReputation?: number;
}

export const DEFAULT_SCENARIO_ID: ScenarioConfig['id'] = 'calm_markets';

export const scenarios: ScenarioConfig[] = [
  {
    id: 'calm_markets',
    name: 'Calm Markets',
    description: 'Stable baseline with moderate growth and lower immediate crisis risk.',
    countryPatches: {
      us: { inflation: 2.6, stability: 85, sentiment: 48 },
      eu: { inflation: 2.2, stability: 78, sentiment: 25 },
      br: { stability: 60, sentiment: 10 },
    },
    eventWeightBias: {
      em_crisis: 0.7,
      risk_off: 0.7,
      risk_on: 1.2,
      tech_rally: 1.2,
    },
    startingReputation: 72,
  },
  {
    id: 'emerging_crisis',
    name: 'Emerging Crisis',
    description: 'Brazil starts fragile with elevated contagion and downside tail risk.',
    countryPatches: {
      br: {
        interestRate: 12.8,
        inflation: 6.4,
        growth: 0.8,
        stability: 42,
        sentiment: -24,
      },
      us: { sentiment: 35 },
      eu: { sentiment: 8 },
    },
    eventWeightBias: {
      em_crisis: 2.0,
      risk_off: 1.5,
      risk_on: 0.6,
    },
    startingReputation: 66,
  },
  {
    id: 'rate_shock',
    name: 'Rate Shock',
    description: 'Global inflation pressure keeps rates elevated and growth under strain.',
    countryPatches: {
      us: { interestRate: 6.0, inflation: 4.2, growth: 1.4 },
      eu: { interestRate: 4.8, inflation: 3.8, growth: 0.4 },
      cn: { inflation: 1.5, growth: 4.1 },
      br: { interestRate: 13.0, inflation: 5.8, growth: 1.2 },
      jp: { inflation: 3.5, interestRate: 0.6 },
    },
    eventWeightBias: {
      fed_hike: 1.8,
      oil_spike: 1.4,
      fed_cut: 0.4,
      risk_off: 1.2,
    },
    startingReputation: 68,
  },
];

export function getScenarioById(id: string | undefined): ScenarioConfig {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}

export function applyScenarioCountries(
  baseCountries: CountryState[],
  scenario: ScenarioConfig,
): CountryState[] {
  return baseCountries.map((country) => ({
    ...country,
    ...(scenario.countryPatches[country.id] ?? {}),
  }));
}
