import { useGameStore } from '../store/gameStore';

export function TurnSummary() {
  const { log, turn, portfolio, reputation, phase } = useGameStore();
  const dismissSummary = useGameStore((s) => s.dismissSummary);
  const reset = useGameStore((s) => s.reset);

  const turnLog = log.filter((e) => e.turn === turn);
  const lastPnl = portfolio.pnlHistory[portfolio.pnlHistory.length - 1] ?? 0;

  const isGameOver = phase === 'gameover';

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>{isGameOver ? 'Game Over' : `Quarter Summary – Turn ${turn}`}</h2>
        <div className="summary-pnl">
          <span>P&L this quarter:</span>
          <span className={lastPnl >= 0 ? 'text-safe' : 'text-danger'}>
            {lastPnl >= 0 ? '+' : ''}${lastPnl.toFixed(2)}B
          </span>
        </div>
        <div className="summary-aum">
          <span>Total AUM:</span>
          <span>${portfolio.aum.toFixed(1)}B</span>
        </div>
        <div className="summary-aum">
          <span>Reputation:</span>
          <span className={reputation < 35 ? 'text-danger' : reputation < 60 ? 'text-warn' : 'text-safe'}>
            {reputation}/100
          </span>
        </div>
        <div className="summary-events">
          {turnLog.map((e, i) => (
            <div key={i} className={`log-entry log-${e.type}`}>
              {e.text}
            </div>
          ))}
        </div>
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
