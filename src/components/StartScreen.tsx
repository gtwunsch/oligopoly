import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { DEFAULT_SCENARIO_ID, scenarios } from '../sim';

export function StartScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const load = useGameStore((s) => s.load);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(DEFAULT_SCENARIO_ID);

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
        <div className="scenario-grid">
          {scenarios.map((scenario) => {
            const selected = selectedScenarioId === scenario.id;
            return (
              <button
                key={scenario.id}
                type="button"
                className={`scenario-btn ${selected ? 'selected' : ''}`}
                onClick={() => setSelectedScenarioId(scenario.id)}
              >
                <span className="scenario-name">{scenario.name}</span>
                <span className="scenario-desc">{scenario.description}</span>
              </button>
            );
          })}
        </div>
        <div className="start-buttons">
          <button className="btn btn-primary" onClick={() => newGame(selectedScenarioId)}>
            Start Scenario
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
