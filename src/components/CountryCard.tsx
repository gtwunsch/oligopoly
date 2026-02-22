import type { CountryState } from '../sim/types';
import { useGameStore } from '../store/gameStore';

const INDICATOR_TOOLTIPS: Record<string, string> = {
  Rate: 'Interest Rate — Central bank policy rate. Higher rates attract capital but hurt growth.',
  Infl: 'Inflation — Price growth rate. High inflation erodes stability and triggers rate hikes.',
  GDP: 'GDP Growth — Economic output growth. Drives equity returns and stability.',
  Stab: 'Stability — Political & economic resilience (0-100). Below 50 = crisis risk.',
  Debt: 'Debt/GDP — Government debt burden. Above 100% = rising fragility.',
  FX: 'FX Change — Currency movement vs USD this turn. Affects your FX positions.',
  Sent: 'Market Sentiment — Investor mood (-100 to +100). Drives equity and FX trends.',
  Eq: 'Equity Index — Stock market level (base 100). Driven by growth and sentiment.',
};

function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

function deltaStr(curr: number, prev: number | undefined, unit = ''): string {
  if (prev === undefined) return '';
  const d = curr - prev;
  if (Math.abs(d) < 0.01) return '';
  const sign = d > 0 ? '+' : '';
  return `${sign}${d.toFixed(1)}${unit}`;
}

export function CountryCard({ country }: { country: CountryState }) {
  const c = country;
  const previousCountries = useGameStore((s) => s.previousCountries);
  const prev = previousCountries.find((p) => p.id === c.id);

  const fxChange = ((c.fxRate - c.fxPrevious) / c.fxPrevious) * 100;

  const healthScore =
    (c.stability > 60 ? 1 : c.stability > 40 ? 0 : -1) +
    (c.growth > 1.5 ? 1 : c.growth > 0 ? 0 : -1) +
    (c.inflation < 4 ? 1 : c.inflation < 7 ? 0 : -1);
  const healthClass = healthScore >= 2 ? 'health-good' : healthScore <= -1 ? 'health-bad' : 'health-mid';

  return (
    <div className={`country-card ${healthClass}`}>
      <div className="country-header">
        <span className="country-flag">{c.flag}</span>
        <span className="country-name">{c.name}</span>
        <span className={`country-health-dot ${healthClass}`} title={
          healthScore >= 2 ? 'Economy: Healthy' : healthScore <= -1 ? 'Economy: Stressed' : 'Economy: Mixed'
        } />
      </div>
      <div className="country-stats">
        <Stat
          label="Rate"
          value={fmtPct(c.interestRate)}
          delta={deltaStr(c.interestRate, prev?.interestRate, 'pp')}
          warn={c.interestRate > 8}
          tooltip={INDICATOR_TOOLTIPS.Rate}
        />
        <Stat
          label="Infl"
          value={fmtPct(c.inflation)}
          delta={deltaStr(c.inflation, prev?.inflation, 'pp')}
          warn={c.inflation > 5}
          tooltip={INDICATOR_TOOLTIPS.Infl}
        />
        <Stat
          label="GDP"
          value={fmtPct(c.growth)}
          delta={deltaStr(c.growth, prev?.growth, 'pp')}
          warn={c.growth < 0}
          good={c.growth > 3}
          tooltip={INDICATOR_TOOLTIPS.GDP}
        />
        <Stat
          label="Stab"
          value={c.stability.toFixed(0)}
          delta={deltaStr(c.stability, prev?.stability)}
          warn={c.stability < 50}
          good={c.stability > 75}
          tooltip={INDICATOR_TOOLTIPS.Stab}
        />
        <Stat
          label="Debt"
          value={fmtPct(c.debtToGdp)}
          delta={deltaStr(c.debtToGdp, prev?.debtToGdp, 'pp')}
          warn={c.debtToGdp > 120}
          tooltip={INDICATOR_TOOLTIPS.Debt}
        />
        <Stat
          label="FX"
          value={`${fxChange >= 0 ? '+' : ''}${fxChange.toFixed(1)}%`}
          warn={Math.abs(fxChange) > 3}
          tooltip={INDICATOR_TOOLTIPS.FX}
        />
        <Stat
          label="Sent"
          value={c.sentiment.toFixed(0)}
          delta={deltaStr(c.sentiment, prev?.sentiment)}
          warn={c.sentiment < -20}
          good={c.sentiment > 30}
          tooltip={INDICATOR_TOOLTIPS.Sent}
        />
        <Stat
          label="Eq"
          value={c.equityIndex.toFixed(1)}
          delta={deltaStr(c.equityIndex, prev?.equityIndex)}
          warn={c.equityIndex < 85}
          good={c.equityIndex > 110}
          tooltip={INDICATOR_TOOLTIPS.Eq}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  delta,
  warn,
  good,
  tooltip,
}: {
  label: string;
  value: string;
  delta?: string;
  warn?: boolean;
  good?: boolean;
  tooltip?: string;
}) {
  const deltaClass = delta
    ? delta.startsWith('+') ? 'delta-up' : delta.startsWith('-') ? 'delta-down' : ''
    : '';

  return (
    <div
      className={`stat ${warn ? 'stat-warn' : good ? 'stat-good' : ''}`}
      title={tooltip ?? label}
    >
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {delta && <span className={`stat-delta ${deltaClass}`}>{delta}</span>}
    </div>
  );
}
