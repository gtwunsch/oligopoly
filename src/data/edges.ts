import type { CountryMetric, InfluenceEdge } from '../sim/types';

type CountryId = 'us' | 'eu' | 'cn' | 'br' | 'jp';

interface DomesticEdgeTemplate {
  id: string;
  fromMetric: CountryMetric;
  toMetric: CountryMetric;
  direction: InfluenceEdge['direction'];
  weight: number;
  formula: string;
  label: string;
}

const COUNTRY_IDS: readonly CountryId[] = ['us', 'eu', 'cn', 'br', 'jp'];

const DOMESTIC_EDGE_TEMPLATES: readonly DomesticEdgeTemplate[] = [
  {
    id: 'inflation_to_rates',
    fromMetric: 'inflation',
    toMetric: 'interestRate',
    direction: 'positive',
    weight: 0.05,
    formula: 'rate_target_gap',
    label: 'Taylor-lite tightening',
  },
  {
    id: 'rates_to_fx',
    fromMetric: 'interestRate',
    toMetric: 'fxRate',
    direction: 'positive',
    weight: 0.002,
    formula: 'rate_differential',
    label: 'Rate differential',
  },
  {
    id: 'sentiment_to_fx',
    fromMetric: 'sentiment',
    toMetric: 'fxRate',
    direction: 'positive',
    weight: 0.0002,
    formula: 'risk_appetite_fx',
    label: 'Confidence flow',
  },
  {
    id: 'growth_to_inflation',
    fromMetric: 'growth',
    toMetric: 'inflation',
    direction: 'positive',
    weight: 0.02,
    formula: 'demand_pressure',
    label: 'Demand pressure',
  },
  {
    id: 'rates_to_growth',
    fromMetric: 'interestRate',
    toMetric: 'growth',
    direction: 'negative',
    weight: 0.03,
    formula: 'tightening_drag',
    label: 'Tightening drag',
  },
  {
    id: 'debt_to_stability',
    fromMetric: 'debtToGdp',
    toMetric: 'stability',
    direction: 'negative',
    weight: 0.3,
    formula: 'debt_fragility_threshold',
    label: 'Debt fragility',
  },
  {
    id: 'growth_to_stability',
    fromMetric: 'growth',
    toMetric: 'stability',
    direction: 'positive',
    weight: 0.2,
    formula: 'growth_resilience_threshold',
    label: 'Growth resilience',
  },
  {
    id: 'inflation_to_stability',
    fromMetric: 'inflation',
    toMetric: 'stability',
    direction: 'negative',
    weight: 0.5,
    formula: 'inflation_stress_threshold',
    label: 'Inflation stress',
  },
  {
    id: 'rates_to_debt',
    fromMetric: 'interestRate',
    toMetric: 'debtToGdp',
    direction: 'positive',
    weight: 0.1,
    formula: 'interest_burden',
    label: 'Interest burden',
  },
  {
    id: 'growth_to_debt',
    fromMetric: 'growth',
    toMetric: 'debtToGdp',
    direction: 'negative',
    weight: 0.1,
    formula: 'denominator_effect',
    label: 'Growth dividend',
  },
  {
    id: 'stability_to_sentiment',
    fromMetric: 'stability',
    toMetric: 'sentiment',
    direction: 'positive',
    weight: 0.05,
    formula: 'institutional_confidence',
    label: 'Institutional trust',
  },
  {
    id: 'growth_to_sentiment',
    fromMetric: 'growth',
    toMetric: 'sentiment',
    direction: 'positive',
    weight: 0.3,
    formula: 'growth_optimism',
    label: 'Growth optimism',
  },
  {
    id: 'sentiment_to_equities',
    fromMetric: 'sentiment',
    toMetric: 'equityIndex',
    direction: 'positive',
    weight: 0.001,
    formula: 'equity_risk_appetite',
    label: 'Risk appetite',
  },
  {
    id: 'growth_to_equities',
    fromMetric: 'growth',
    toMetric: 'equityIndex',
    direction: 'positive',
    weight: 0.005,
    formula: 'earnings_expectations',
    label: 'Earnings outlook',
  },
  {
    id: 'rates_to_equities',
    fromMetric: 'interestRate',
    toMetric: 'equityIndex',
    direction: 'negative',
    weight: 0.001,
    formula: 'discount_rate_drag',
    label: 'Discount-rate drag',
  },
] as const;

function buildDomesticEdge(countryId: CountryId, template: DomesticEdgeTemplate): InfluenceEdge {
  return {
    id: `${countryId}_${template.id}`,
    fromCountry: countryId,
    fromMetric: template.fromMetric,
    toCountry: countryId,
    toMetric: template.toMetric,
    direction: template.direction,
    weight: template.weight,
    formula: template.formula,
    label: template.label,
  };
}

export const domesticInfluenceEdges: readonly InfluenceEdge[] = COUNTRY_IDS.flatMap((countryId) =>
  DOMESTIC_EDGE_TEMPLATES.map((template) => buildDomesticEdge(countryId, template)),
);

export function getDomesticInfluenceEdges(countryId: string): readonly InfluenceEdge[] {
  return domesticInfluenceEdges.filter(
    (edge) => edge.fromCountry === countryId && edge.toCountry === countryId,
  );
}
