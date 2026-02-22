import { useGameStore } from '../store/gameStore';
import { decisions } from '../sim';

export function DecisionsPanel() {
  const { pendingDecisions, portfolio, turn } = useGameStore();
  const queueDecision = useGameStore((s) => s.queueDecision);
  const removeDecision = useGameStore((s) => s.removeDecision);

  return (
    <div className="decisions-panel">
      <h3>Decisions</h3>
      <div className="decisions-grid">
        {decisions.map((d) => {
          const queued = pendingDecisions.includes(d.id);
          const locked = d.unlockTurn !== undefined && turn < d.unlockTurn;
          const cantAfford = !queued && d.cost > portfolio.cash;

          return (
            <button
              key={d.id}
              className={`decision-btn ${queued ? 'queued' : ''} ${locked ? 'locked' : ''}`}
              disabled={locked || cantAfford}
              onClick={() => (queued ? removeDecision(d.id) : queueDecision(d.id))}
              title={d.description}
            >
              <span className="decision-name">{d.name}</span>
              {d.cost > 0 && <span className="decision-cost">${d.cost}B</span>}
              {queued && <span className="decision-check">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
