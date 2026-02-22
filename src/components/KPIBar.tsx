import { useGameStore } from '../store/gameStore';

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

export function KPIBar() {
  const { year, quarter, turn, portfolio, score } = useGameStore();

  return (
    <header className="kpi-bar">
      <div className="kpi">
        <span className="kpi-label">Date</span>
        <span className="kpi-value">
          {year} Q{quarter}
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Turn</span>
        <span className="kpi-value">{turn}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">AUM</span>
        <span className="kpi-value">${fmt(portfolio.aum)}B</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Cash</span>
        <span className="kpi-value">${fmt(portfolio.cash)}B</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Leverage</span>
        <span className="kpi-value">{fmt(portfolio.leverage)}x</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Risk</span>
        <span className={`kpi-value ${portfolio.riskScore > 60 ? 'text-danger' : portfolio.riskScore > 35 ? 'text-warn' : 'text-safe'}`}>
          {portfolio.riskScore}
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Liquidity</span>
        <span className="kpi-value">{portfolio.liquidity}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Score</span>
        <span className="kpi-value">{score}</span>
      </div>
    </header>
  );
}
