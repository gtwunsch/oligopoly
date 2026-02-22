import { useGameStore } from '../store/gameStore';
import { KPIBar } from './KPIBar';
import { CountryCard } from './CountryCard';
import { DecisionsPanel } from './DecisionsPanel';
import { PortfolioPanel } from './PortfolioPanel';
import { RiskMeter } from './RiskMeter';
import { EventLog } from './EventLog';

export function Dashboard() {
  const { countries, pendingDecisions, turn } = useGameStore();
  const endTurn = useGameStore((s) => s.endTurn);
  const save = useGameStore((s) => s.save);

  const showTutorial = turn < 2;

  return (
    <div className="dashboard">
      <KPIBar />

      {showTutorial && (
        <div className="tutorial-tip">
          💡 Pick decisions below, then hit <strong>End Turn</strong> to advance one quarter.
          Watch how your choices ripple through markets.
        </div>
      )}

      <div className="dashboard-grid">
        <section className="panel countries-section">
          <h3>World Markets</h3>
          <div className="countries-grid">
            {countries.map((c) => (
              <CountryCard key={c.id} country={c} />
            ))}
          </div>
        </section>

        <section className="panel sidebar">
          <PortfolioPanel />
          <RiskMeter />
        </section>
      </div>

      <div className="bottom-panels">
        <DecisionsPanel />
        <EventLog />
      </div>

      <div className="action-bar">
        <span className="queued-count">
          {pendingDecisions.length} decision{pendingDecisions.length !== 1 ? 's' : ''} queued
        </span>
        <div className="action-buttons">
          <button className="btn btn-secondary" onClick={save} title="Save to browser">
            Save
          </button>
          <button className="btn btn-primary btn-large" onClick={endTurn}>
            End Turn ▶
          </button>
        </div>
      </div>
    </div>
  );
}
