import { useGameStore } from '../store/gameStore';
import { computeCashLockDrivers } from '../sim';

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

export function KPIBar() {
  const { year, quarter, turn, scenarioName, portfolio, reputation, winTargetAum, maxTurns, score } = useGameStore();
  const turnsLeft = Math.max(0, maxTurns - turn);
  const cashLock = computeCashLockDrivers(portfolio);
  const cashTooltip = [
    'Why locked:',
    'Locked = liquidity reserve + leverage margin + concentration buffer.',
    `Reserve: $${fmt(cashLock.liquidityReserve)}B`,
    `Leverage margin: $${fmt(cashLock.leverageMargin)}B`,
    `Concentration buffer: $${fmt(cashLock.concentrationBuffer)}B`,
    'Lower leverage releases locked cash gradually over turns.',
  ].join('\n');

  return (
    <header className="kpi-bar">
      <div className="kpi">
        <span className="kpi-label">Date</span>
        <span className="kpi-value">
          {year} Q{quarter}
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Scenario</span>
        <span className="kpi-value">{scenarioName}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Turn</span>
        <span className="kpi-value">
          {turn}/{maxTurns}
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">AUM</span>
        <span className="kpi-value">${fmt(portfolio.aum)}B</span>
      </div>
      <div className="kpi kpi-cash" title={cashTooltip}>
        <span className="kpi-label">
          Cash
          <span className="kpi-help" aria-label="Why cash is locked" title={cashTooltip}>
            ?
          </span>
        </span>
        <span className="kpi-subvalue">Total ${fmt(portfolio.cashTotal)}B</span>
        <span className="kpi-subvalue text-safe">Available ${fmt(portfolio.cashAvailable)}B</span>
        <span className="kpi-subvalue text-warn">Locked ${fmt(portfolio.cashLocked)}B</span>
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
        <span className="kpi-label">Reputation</span>
        <span className={`kpi-value ${reputation < 35 ? 'text-danger' : reputation < 60 ? 'text-warn' : 'text-safe'}`}>
          {reputation}
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Liquidity</span>
        <span className="kpi-value">{portfolio.liquidity}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Goal</span>
        <span className={`kpi-value ${portfolio.aum >= winTargetAum ? 'text-safe' : ''}`}>
          ${fmt(winTargetAum)}B
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Turns Left</span>
        <span className="kpi-value">{turnsLeft}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Score</span>
        <span className="kpi-value">{score}</span>
      </div>
    </header>
  );
}
