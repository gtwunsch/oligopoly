import { useGameStore } from '../store/gameStore';
import { decisions } from '../sim';

interface DecisionsPanelProps {
  previewDecisionId: string | null;
  onboardingStep: number | null;
  onPreviewDecision: (decisionId: string | null) => void;
}

export function DecisionsPanel({ previewDecisionId, onboardingStep, onPreviewDecision }: DecisionsPanelProps) {
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
          const cantAfford = !queued && d.cost > portfolio.cashAvailable;
          const baseTitle = locked
            ? `${d.description} Unlocks at turn ${d.unlockTurn}.`
            : d.description;
          const onboardingTitle = onboardingStep === 1 && d.id === 'buy_sovereign_bonds'
            ? `${baseTitle}\nStarter move: queue it, then watch the causal preview.`
            : onboardingStep === 3 && d.id === 'lobby_pr_spend'
              ? `${baseTitle}\nUse later when Reputation drops.`
              : baseTitle;
          const isStepOneSuggestion = onboardingStep === 1 && d.id === 'buy_sovereign_bonds';
          const isStepThreeSuggestion = onboardingStep === 3 && d.id === 'lobby_pr_spend';
          const isPreviewing = previewDecisionId === d.id;

          return (
            <button
              key={d.id}
              className={`decision-btn ${queued ? 'queued' : ''} ${locked ? 'locked' : ''} ${isPreviewing ? 'previewing' : ''} ${isStepOneSuggestion || isStepThreeSuggestion ? 'decision-highlight' : ''}`}
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
              title={onboardingTitle}
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
