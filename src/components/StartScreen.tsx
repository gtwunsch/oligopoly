import { useGameStore } from '../store/gameStore';

export function StartScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const load = useGameStore((s) => s.load);

  const hasSave = !!localStorage.getItem('macro-sim-save');

  return (
    <div className="start-screen">
      <div className="start-card">
        <h1>Global Macro</h1>
        <p className="subtitle">Investment Simulator</p>
        <p className="flavor">
          You are the CEO of the world's largest bank.<br />
          Navigate markets, manage risk, and grow your portfolio.
        </p>
        <div className="start-buttons">
          <button className="btn btn-primary" onClick={newGame}>
            New Game
          </button>
          {hasSave && (
            <button className="btn btn-secondary" onClick={() => load()}>
              Continue
            </button>
          )}
        </div>
        <p className="hint">Each turn = 1 quarter. Reach $120B AUM by turn 20.</p>
      </div>
    </div>
  );
}
