import { decisions } from '../sim';
import { useGameStore } from '../store/gameStore';
import { buildDecisionPreviewLinks, buildResolvedChains } from './causalHelpers';

interface CausalChainHUDProps {
  previewDecisionId: string | null;
}

export function CausalChainHUD({ previewDecisionId }: CausalChainHUDProps) {
  const turn = useGameStore((s) => s.turn);
  const hints = useGameStore((s) => s.lastTurnCausalHints);

  const previewDecision = decisions.find((decision) => decision.id === previewDecisionId) ?? null;
  const previewLinks = buildDecisionPreviewLinks(previewDecision);
  const resolvedChains = turn > 0 ? buildResolvedChains(hints, 3) : [];

  return (
    <aside className="causal-hud" aria-label="Causal chain HUD">
      <div className="causal-header">
        <h3>Causal HUD</h3>
        <span className="causal-caption">5s why</span>
      </div>

      <section className="causal-section" aria-label="Preview causal chain">
        <p className="causal-section-title">Preview</p>
        {previewLinks.length > 0 ? (
          <ul className="causal-list">
            {previewLinks.map((link, index) => (
              <li key={`${previewDecisionId ?? 'preview'}-${index}`} className="causal-item" title={link}>
                {link}
              </li>
            ))}
          </ul>
        ) : (
          <p className="causal-empty">Select a decision.</p>
        )}
      </section>

      <section className="causal-section" aria-label="Resolved causal chains">
        <p className="causal-section-title">Resolved</p>
        {resolvedChains.length > 0 ? (
          <ul className="causal-list">
            {resolvedChains.map((chain, index) => (
              <li key={`${turn}-${index}-${chain}`} className="causal-item" title={chain}>
                {chain}
              </li>
            ))}
          </ul>
        ) : (
          <p className="causal-empty">End turn to resolve.</p>
        )}
      </section>
    </aside>
  );
}
