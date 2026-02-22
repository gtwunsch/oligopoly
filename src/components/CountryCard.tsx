import type { CountryState } from '../sim/types';

function delta(curr: number, prev: number): string {
  const d = curr - prev;
  if (Math.abs(d) < 0.001) return '';
  return d > 0 ? ' ▲' : ' ▼';
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

export function CountryCard({ country }: { country: CountryState }) {
  const c = country;
  const fxChange = ((c.fxRate - c.fxPrevious) / c.fxPrevious) * 100;

  return (
    <div className="country-card">
      <div className="country-header">
        <span className="country-flag">{c.flag}</span>
        <span className="country-name">{c.name}</span>
      </div>
      <div className="country-stats">
        <Stat label="Rate" value={fmtPct(c.interestRate)} />
        <Stat label="Infl" value={fmtPct(c.inflation)} warn={c.inflation > 5} />
        <Stat label="GDP" value={fmtPct(c.growth)} warn={c.growth < 0} />
        <Stat label="Stab" value={c.stability.toFixed(0)} warn={c.stability < 50} />
        <Stat label="Debt" value={fmtPct(c.debtToGdp)} warn={c.debtToGdp > 120} />
        <Stat
          label="FX"
          value={`${fxChange >= 0 ? '+' : ''}${fxChange.toFixed(1)}%`}
          warn={Math.abs(fxChange) > 3}
        />
        <Stat label="Sent" value={c.sentiment.toFixed(0)} warn={c.sentiment < -20} />
        <Stat
          label="Eq"
          value={c.equityIndex.toFixed(1)}
          suffix={delta(c.equityIndex, 100)}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
  suffix,
}: {
  label: string;
  value: string;
  warn?: boolean;
  suffix?: string;
}) {
  return (
    <div className={`stat ${warn ? 'stat-warn' : ''}`} title={label}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {suffix && <span className="stat-delta">{suffix}</span>}
      </span>
    </div>
  );
}
