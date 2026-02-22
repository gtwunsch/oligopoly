import { useGameStore } from '../store/gameStore';
import { decisions } from '../sim';

interface DecisionsPanelProps {
  previewDecisionId: string | null;
  onPreviewDecision: (decisionId: string | null) => void;
}

export function DecisionsPanel({ previewDecisionId, onPreviewDecision }: DecisionsPanelProps) {
  const { pendingDecisions, portfolio, turn } = useGameStore();
  const queueDecision = useGameStore((s) => s.queueDecision);
  const removeDecision = useGameStore((s) => s.removeDecision);

  return (
    <div className="decisions-panel" onMouseLeave={() => onPreviewDecision(null)}>
      <h3>Decisions</h3>
      <div className="decisions-grid">
        {decisions.map((d) => {
          const queued = pendingDecisions.includes(d.id);
          const locked = d.unlockTurn !== undefined && turn < d.unlockTurn;
          const cantAfford = !queued && d.cost > portfolio.cash;
          const title = locked
            ? `${d.description} Unlocks at turn ${d.unlockTurn}.`
            : d.description;

          return (
            <button
              key={d.id}
              className={`decision-btn ${queued ? 'queued' : ''} ${locked ? 'locked' : ''} ${previewDecisionId === d.id ? 'previewing' : ''}`}
              disabled={locked || cantAfford}
              onClick={() => {
                onPreviewDecision(d.id);
                if (queued) {
                  removeDecision(d.id);
                  return;
                }
                queueDecision(d.id);
              }}
              onMouseEnter={() => onPreviewDecision(d.id)}
              onFocus={() => onPreviewDecision(d.id)}
              title={title}
            >
              <span className="decision-name">{d.name}</span>
              {locked && <span className="decision-lock">T{d.unlockTurn}</span>}
              {d.cost > 0 && <span className="decision-cost">${d.cost}B</span>}
              {queued && <span className="decision-check">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
