import { decisions } from '../sim';
import { useGameStore } from '../store/gameStore';

interface CausalChainHUDProps {
  previewDecisionId: string | null;
  onboardingStep: number | null;
}

function buildPreviewLinks(previewDecisionId: string | null): string[] {
  if (!previewDecisionId) return [];
  const decision = decisions.find((item) => item.id === previewDecisionId);
  const source = decision?.causalHint;
  if (!source) return [];

  const nodes = source
    .split(/\s*(?:->|→)\s*/g)
    .map((node) => node.trim())
    .filter((node) => node.length > 0);

  if (nodes.length < 2) return [source];

  const links: string[] = [];
  for (let i = 0; i < nodes.length - 1 && links.length < 2; i += 1) {
    links.push(`${nodes[i]} -> ${nodes[i + 1]}`);
  }
  return links;
}

export function CausalChainHUD({ previewDecisionId, onboardingStep }: CausalChainHUDProps) {
  const turn = useGameStore((s) => s.turn);
  const hints = useGameStore((s) => s.lastTurnCausalHints);
  const objective = useGameStore((s) => s.quarterObjective);
  const dismissObjective = useGameStore((s) => s.dismissObjective);
  const previewLinks = buildPreviewLinks(previewDecisionId);
  const resolvedHints = hints.slice(0, 3);

  if (!objective && previewLinks.length === 0 && resolvedHints.length === 0 && onboardingStep !== 1) {
    return null;
  }

  return (
    <section className="causal-hud" aria-label="Causal and objective HUD">
      {objective && (
        <div className="objective-widget">
          <div className="objective-header">
            <p className="objective-label">Objective of the Quarter</p>
            <button
              type="button"
              className="objective-dismiss"
              onClick={dismissObjective}
              title="Dismiss optional objectives"
            >
              Dismiss
            </button>
          </div>
          <p className="objective-text" title={objective.text}>{objective.text}</p>
          <p className="objective-meta">
            T{Math.max(0, objective.endTurn - turn)} left · {objective.progress}/{objective.targetProgress} · {objective.rewardLabel}
          </p>
        </div>
      )}

      {(previewLinks.length > 0 || onboardingStep === 1) && (
        <div className="causal-preview-block">
          <h3>Decision preview</h3>
          {previewLinks.length > 0 ? (
            <ul className="causal-list">
              {previewLinks.map((link) => (
                <li key={link} className="causal-item">{link}</li>
              ))}
            </ul>
          ) : (
            <p className="causal-empty">Hover a decision to preview chain.</p>
          )}
        </div>
      )}

      {turn > 0 && resolvedHints.length > 0 && (
        <>
          <h3>Why things changed last turn</h3>
          <ul className="causal-list">
            {resolvedHints.map((hint) => (
              <li key={hint} className="causal-item">
                {hint}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
