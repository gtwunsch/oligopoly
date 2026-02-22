import type { CountryState } from '../sim/types';
import { useGameStore } from '../store/gameStore';
import { buildResolvedChains, getTopCountryDeltas } from './causalHelpers';

type SummaryTone = 'neutral' | 'safe' | 'danger' | 'muted';

interface TurnSummaryBaseline {
  turn: number;
  countries: CountryState[];
  riskScore: number;
  reputation: number | null;
}

interface TurnSummaryProps {
  baseline: TurnSummaryBaseline | null;
}

function formatSigned(value: number, decimals = 0): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}

function formatBillions(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}$${value.toFixed(2)}B`;
}

function toneClassName(tone: SummaryTone): string {
  if (tone === 'safe') return 'text-safe';
  if (tone === 'danger') return 'text-danger';
  if (tone === 'muted') return 'summary-muted';
  return '';
}

function SummaryMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: SummaryTone;
}) {
  return (
    <div className="summary-metric">
      <span className="summary-metric-label">{label}</span>
      <span className={`summary-metric-value ${toneClassName(tone)}`}>{value}</span>
    </div>
  );
}

export function TurnSummary({ baseline }: TurnSummaryProps) {
  const { log, turn, countries, portfolio, reputation, winTargetAum, maxTurns, outcome, lastTurnCausalHints, phase } =
    useGameStore();
  const dismissSummary = useGameStore((s) => s.dismissSummary);
  const reset = useGameStore((s) => s.reset);

  const turnLog = log.filter((entry) => entry.turn === turn).slice(0, 5);
  const lastPnl = portfolio.pnlHistory[portfolio.pnlHistory.length - 1] ?? 0;
  const resolvedChains = buildResolvedChains(lastTurnCausalHints, 3);

  const isGameOver = phase === 'gameover';
  const title = isGameOver ? (outcome === 'win' ? 'Victory' : 'Game Over') : `Quarter Summary - Turn ${turn}`;
  const objectiveText = `Objective: reach $${winTargetAum.toFixed(0)}B by turn ${maxTurns}.`;

  const hasReputation = typeof reputation === 'number' && Number.isFinite(reputation);
  const matchedBaseline = baseline && baseline.turn === turn ? baseline : null;
  const riskDelta = matchedBaseline ? portfolio.riskScore - matchedBaseline.riskScore : null;
  const reputationDelta =
    matchedBaseline && hasReputation && typeof matchedBaseline.reputation === 'number'
      ? reputation - matchedBaseline.reputation
      : null;
  const countryDeltas = getTopCountryDeltas(matchedBaseline?.countries, countries, 3);

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-summary-card">
        <h2>{title}</h2>
        <p className={`summary-objective ${isGameOver && outcome === 'win' ? 'text-safe' : ''}`}>{objectiveText}</p>

        <section className="summary-metrics-grid" aria-label="Turn headline metrics">
          <SummaryMetric label="P&L" value={formatBillions(lastPnl)} tone={lastPnl >= 0 ? 'safe' : 'danger'} />
          <SummaryMetric label="Portfolio Value" value={`$${portfolio.aum.toFixed(1)}B`} />
          <SummaryMetric
            label="Risk Delta"
            value={riskDelta === null ? '—' : formatSigned(riskDelta, 0)}
            tone={riskDelta === null ? 'muted' : riskDelta > 0 ? 'danger' : riskDelta < 0 ? 'safe' : 'neutral'}
          />
          <SummaryMetric
            label="Reputation Delta"
            value={reputationDelta === null ? '—' : formatSigned(reputationDelta, 0)}
            tone={
              reputationDelta === null
                ? 'muted'
                : reputationDelta > 0
                  ? 'safe'
                  : reputationDelta < 0
                    ? 'danger'
                    : 'neutral'
            }
          />
        </section>

        <section className="summary-country-deltas" aria-label="Top country deltas">
          <h3>Top Country Deltas</h3>
          {countryDeltas.length > 0 ? (
            <ul className="summary-delta-list">
              {countryDeltas.map((delta) => (
                <li key={`${delta.countryId}-${delta.metric}`} className="summary-delta-item">
                  <div className="summary-delta-head">
                    <span className="summary-delta-country">{delta.countryLabel}</span>
                    <span className="summary-delta-metric">
                      {delta.metric} {delta.deltaLabel}
                    </span>
                  </div>
                  <p className="summary-delta-hint" title={delta.hint}>
                    {delta.hint}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="summary-empty">— Country delta snapshot unavailable.</p>
          )}
        </section>

        {resolvedChains.length > 0 && (
          <section className="summary-causal-compact">
            <h3>Resolved Chains</h3>
            <ul className="summary-causal-list">
              {resolvedChains.map((chain, index) => (
                <li key={`${turn}-${index}-${chain}`} title={chain}>
                  {chain}
                </li>
              ))}
            </ul>
          </section>
        )}

        {turnLog.length > 0 && (
          <section className="summary-events">
            <h3>Turn Notes</h3>
            {turnLog.map((entry, index) => (
              <div key={index} className={`log-entry log-${entry.type}`}>
                {entry.text}
              </div>
            ))}
          </section>
        )}

        {isGameOver ? (
          <button className="btn btn-primary" onClick={reset}>
            Return to Menu
          </button>
        ) : (
          <button className="btn btn-primary" onClick={dismissSummary}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
