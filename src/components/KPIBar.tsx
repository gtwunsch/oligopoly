import { useGameStore } from '../store/gameStore';

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

export function KPIBar() {
  const { year, quarter, turn, scenarioName, portfolio, reputation, winTargetAum, maxTurns, score } = useGameStore();
  const progressPct = Math.min(100, Math.max(0, (portfolio.aum / winTargetAum) * 100));
  const onTrack = portfolio.aum >= winTargetAum;

  return (
    <header className="kpi-bar">
      <div className="kpi-left">
        <div className="kpi">
          <span className="kpi-label">Scenario</span>
          <span className="kpi-value kpi-small">{scenarioName}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Date</span>
          <span className="kpi-value">
            {year} Q{quarter}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Turn</span>
          <span className="kpi-value">
            {turn}/{maxTurns}
          </span>
        </div>
      </div>

      <div className="kpi-center">
        <div className="kpi">
          <span className="kpi-label">AUM</span>
          <span className="kpi-value">${fmt(portfolio.aum)}B</span>
        </div>
        <div className="kpi">
          <span className="kpi-label" title="Cash available for decisions this turn">Cash</span>
          <span className="kpi-value">${fmt(portfolio.cash)}B</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Leverage</span>
          <span className="kpi-value">{fmt(portfolio.leverage)}x</span>
        </div>
        <div className="kpi progress-kpi">
          <span className="kpi-label">
            Goal: ${fmt(winTargetAum)}B
            {onTrack && <span className="goal-on-track"> ✓</span>}
          </span>
          <div className="progress-track">
            <div
              className={`progress-fill ${onTrack ? 'progress-met' : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="kpi-right">
        <div className="kpi">
          <span className="kpi-label">Risk</span>
          <span className={`kpi-value ${portfolio.riskScore > 60 ? 'text-danger' : portfolio.riskScore > 35 ? 'text-warn' : 'text-safe'}`}>
            {portfolio.riskScore}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Reputation</span>
          <span className={`kpi-value ${reputation < 35 ? 'text-danger' : reputation < 60 ? 'text-warn' : 'text-safe'}`}>
            {reputation}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Score</span>
          <span className="kpi-value">{score}</span>
        </div>
      </div>
    </header>
  );
}
