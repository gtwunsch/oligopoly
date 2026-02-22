import { useGameStore } from '../store/gameStore';

export function TurnSummary() {
  const {
    log,
    turn,
    portfolio,
    reputation,
    winTargetAum,
    maxTurns,
    outcome,
    lastTurnCausalHints,
    phase,
  } = useGameStore();
  const dismissSummary = useGameStore((s) => s.dismissSummary);
  const reset = useGameStore((s) => s.reset);

  const turnLog = log.filter((e) => e.turn === turn);
  const lastPnl = portfolio.pnlHistory[portfolio.pnlHistory.length - 1] ?? 0;

  const isGameOver = phase === 'gameover';
  const title = isGameOver
    ? outcome === 'win'
      ? 'Victory'
      : 'Game Over'
    : `Quarter Summary - Turn ${turn}`;
  const objectiveText = `Objective: reach $${winTargetAum.toFixed(0)}B by turn ${maxTurns}.`;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>{title}</h2>
        <p className={`summary-objective ${isGameOver && outcome === 'win' ? 'text-safe' : ''}`}>
          {objectiveText}
        </p>
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
          {lastTurnCausalHints.length > 0 && (
            <div className="summary-causal">
              <h3>Causal links</h3>
              <ul>
                {lastTurnCausalHints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            </div>
          )}
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
