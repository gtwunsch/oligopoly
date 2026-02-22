import { useGameStore } from '../store/gameStore';

export function CausalChainHUD() {
  const turn = useGameStore((s) => s.turn);
  const hints = useGameStore((s) => s.lastTurnCausalHints);

  if (turn === 0 || hints.length === 0) {
    return null;
  }

  return (
    <section className="causal-hud" aria-label="Last turn causal links">
      <h3>Why things changed</h3>
      <ul className="causal-list">
        {hints.map((hint) => (
          <li key={hint} className="causal-item">
            <span className="causal-icon">⟡</span>
            {hint}
          </li>
        ))}
      </ul>
    </section>
  );
}
