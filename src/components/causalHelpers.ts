import type { CountryState, Decision } from '../sim/types';

const MAX_NODE_CHARS = 30;
const HINT_SPLIT_REGEX = /\s*(?:->|->>|=>|→)\s*/g;

const FALLBACK_TAG_CHAIN: Record<string, [string, string, string]> = {
  bonds: ['Rates shift', 'Bond pricing moves', 'Carry profile changes'],
  equities: ['Growth outlook shifts', 'Equity beta moves', 'P&L swings faster'],
  fx: ['FX reprices', 'Short/long leg reacts', 'Country stress reprices'],
  gold: ['Inflation regime shifts', 'Gold demand reprices', 'Hedge value changes'],
  risk: ['Leverage changes', 'PnL volatility moves', 'Risk appetite reprices'],
  stability: ['Funding conditions shift', 'Stability reprices', 'Sentiment follows'],
  policy: ['Political heat shifts', 'Narrative reprices', 'Reputation follows'],
};

function compactNode(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= MAX_NODE_CHARS) {
    return cleaned;
  }
  return `${cleaned.slice(0, MAX_NODE_CHARS - 1).trimEnd()}...`;
}

function splitHintToNodes(hint: string): string[] {
  const normalized = hint.replace(/\+/g, ' + ').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const parts = normalized
    .split(HINT_SPLIT_REGEX)
    .map((part) => compactNode(part))
    .filter((part) => part.length > 0);

  if (parts.length > 0) {
    return parts;
  }
  return [compactNode(normalized)];
}

function fallbackDecisionHint(decision: Decision): string {
  for (const tag of decision.tags) {
    const tagged = FALLBACK_TAG_CHAIN[tag];
    if (tagged) {
      return tagged.join(' -> ');
    }
  }

  const thirdNode =
    typeof decision.reputationDelta === 'number'
      ? decision.reputationDelta >= 0
        ? 'Reputation pressure eases'
        : 'Political pressure rises'
      : 'Risk/reward profile shifts';

  return `${decision.name} -> Portfolio positioning changes -> ${thirdNode}`;
}

export function buildDecisionPreviewLinks(decision: Decision | null | undefined): string[] {
  if (!decision) return [];

  const source = decision.causalHint?.trim() || fallbackDecisionHint(decision);
  const nodes = splitHintToNodes(source);

  if (nodes.length <= 1) {
    return [nodes[0] ?? compactNode(source)];
  }

  const links: string[] = [];
  for (let i = 0; i < nodes.length - 1 && links.length < 2; i += 1) {
    links.push(`${nodes[i]} -> ${nodes[i + 1]}`);
  }
  return links;
}

function summarizeHint(hint: string): string {
  const nodes = splitHintToNodes(hint);
  if (nodes.length >= 3) return `${nodes[0]} -> ${nodes[1]} -> ${nodes[2]}`;
  if (nodes.length === 2) return `${nodes[0]} -> ${nodes[1]}`;
  return nodes[0] ?? compactNode(hint);
}

export function buildResolvedChains(hints: string[], limit = 3): string[] {
  const uniqueHints = [...new Set(hints.map((hint) => hint.trim()).filter((hint) => hint.length > 0))];
  return uniqueHints.slice(0, limit).map((hint) => summarizeHint(hint));
}

function formatSigned(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}

function formatSignedPercent(value: number, decimals = 1): string {
  return `${formatSigned(value, decimals)}%`;
}

function formatSignedPoints(value: number, decimals = 1): string {
  return `${formatSigned(value, decimals)}pp`;
}

type CountryDeltaMetric =
  | 'interestRate'
  | 'inflation'
  | 'growth'
  | 'stability'
  | 'debtToGdp'
  | 'fxRate'
  | 'sentiment'
  | 'equityIndex';

interface MetricCandidate {
  metric: CountryDeltaMetric;
  label: string;
  deltaLabel: string;
  hint: string;
  magnitude: number;
}

interface RankedCountryDelta {
  countryId: string;
  countryLabel: string;
  metric: string;
  deltaLabel: string;
  hint: string;
  magnitude: number;
}

export interface CountryDeltaSummary {
  countryId: string;
  countryLabel: string;
  metric: string;
  deltaLabel: string;
  hint: string;
}

function buildMetricCandidates(previous: CountryState, current: CountryState): MetricCandidate[] {
  const rateDelta = current.interestRate - previous.interestRate;
  const inflationDelta = current.inflation - previous.inflation;
  const growthDelta = current.growth - previous.growth;
  const stabilityDelta = current.stability - previous.stability;
  const debtDelta = current.debtToGdp - previous.debtToGdp;
  const sentimentDelta = current.sentiment - previous.sentiment;
  const fxDeltaPct = ((current.fxRate - previous.fxRate) / Math.max(0.0001, Math.abs(previous.fxRate))) * 100;
  const equityDeltaPct =
    ((current.equityIndex - previous.equityIndex) / Math.max(0.0001, Math.abs(previous.equityIndex))) * 100;

  return [
    {
      metric: 'interestRate',
      label: 'Rate',
      deltaLabel: formatSignedPoints(rateDelta),
      hint: rateDelta >= 0 ? 'Rates up -> growth cools' : 'Rates down -> credit eases',
      magnitude: Math.abs(rateDelta) / 0.15,
    },
    {
      metric: 'inflation',
      label: 'Inflation',
      deltaLabel: formatSignedPoints(inflationDelta),
      hint: inflationDelta >= 0 ? 'Inflation up -> tightening risk rises' : 'Inflation down -> pressure eases',
      magnitude: Math.abs(inflationDelta) / 0.2,
    },
    {
      metric: 'growth',
      label: 'Growth',
      deltaLabel: formatSignedPoints(growthDelta),
      hint: growthDelta >= 0 ? 'Growth up -> sentiment lifts' : 'Growth down -> risk appetite fades',
      magnitude: Math.abs(growthDelta) / 0.25,
    },
    {
      metric: 'stability',
      label: 'Stability',
      deltaLabel: formatSigned(stabilityDelta, 1),
      hint: stabilityDelta >= 0 ? 'Stability up -> spreads tighten' : 'Stability down -> funding stress rises',
      magnitude: Math.abs(stabilityDelta) / 1.2,
    },
    {
      metric: 'debtToGdp',
      label: 'Debt/GDP',
      deltaLabel: formatSignedPoints(debtDelta),
      hint: debtDelta >= 0 ? 'Debt up -> refinancing risk rises' : 'Debt down -> fiscal stress cools',
      magnitude: Math.abs(debtDelta) / 0.5,
    },
    {
      metric: 'fxRate',
      label: 'FX',
      deltaLabel: formatSignedPercent(fxDeltaPct),
      hint: fxDeltaPct >= 0 ? 'FX firmer -> import pressure eases' : 'FX weaker -> inflation risk rises',
      magnitude: Math.abs(fxDeltaPct) / 1,
    },
    {
      metric: 'sentiment',
      label: 'Sentiment',
      deltaLabel: formatSigned(sentimentDelta, 0),
      hint: sentimentDelta >= 0 ? 'Sentiment up -> equities bid' : 'Sentiment down -> de-risking builds',
      magnitude: Math.abs(sentimentDelta) / 3,
    },
    {
      metric: 'equityIndex',
      label: 'Equity',
      deltaLabel: formatSignedPercent(equityDeltaPct),
      hint: equityDeltaPct >= 0 ? 'Equities up -> risk budget expands' : 'Equities down -> drawdown pressure rises',
      magnitude: Math.abs(equityDeltaPct) / 1.2,
    },
  ].filter((candidate) => Number.isFinite(candidate.magnitude));
}

function selectTopMetric(previous: CountryState, current: CountryState): MetricCandidate | null {
  const ranked = buildMetricCandidates(previous, current).sort((a, b) => b.magnitude - a.magnitude);
  return ranked[0] ?? null;
}

export function getTopCountryDeltas(
  previousCountries: CountryState[] | null | undefined,
  currentCountries: CountryState[],
  limit = 3,
): CountryDeltaSummary[] {
  if (!previousCountries || previousCountries.length === 0 || limit <= 0) {
    return [];
  }

  const previousById = new Map(previousCountries.map((country) => [country.id, country]));
  const ranked: RankedCountryDelta[] = [];

  for (const current of currentCountries) {
    const previous = previousById.get(current.id);
    if (!previous) continue;

    const topMetric = selectTopMetric(previous, current);
    if (!topMetric) continue;

    ranked.push({
      countryId: current.id,
      countryLabel: `${current.flag} ${current.name}`,
      metric: topMetric.label,
      deltaLabel: topMetric.deltaLabel,
      hint: topMetric.hint,
      magnitude: topMetric.magnitude,
    });
  }

  return ranked
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, limit)
    .map((item) => ({
      countryId: item.countryId,
      countryLabel: item.countryLabel,
      metric: item.metric,
      deltaLabel: item.deltaLabel,
      hint: item.hint,
    }));
}
