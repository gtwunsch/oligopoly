import { useState } from 'react';
import { DEFAULT_SCENARIO_ID } from '../sim';
import { useGameStore } from '../store/gameStore';
import { KPIBar } from './KPIBar';
import { CountryCard } from './CountryCard';
import { DecisionsPanel } from './DecisionsPanel';
import { PortfolioPanel } from './PortfolioPanel';
import { RiskMeter } from './RiskMeter';
import { EventLog } from './EventLog';
import { CausalChainHUD } from './CausalChainHUD';

export function Dashboard() {
  const { countries, pendingDecisions, turn, scenarioId } = useGameStore();
  const endTurn = useGameStore((s) => s.endTurn);
  const save = useGameStore((s) => s.save);
  const onboardingDismissed = useGameStore((s) => s.onboardingDismissed);
  const dismissOnboarding = useGameStore((s) => s.dismissOnboarding);
  const [previewDecisionId, setPreviewDecisionId] = useState<string | null>(null);

  const onboardingStep = !onboardingDismissed && scenarioId === DEFAULT_SCENARIO_ID && turn < 3
    ? turn + 1
    : null;
  const showTutorial = onboardingStep === null && turn < 2;
  const onboardingMessage = onboardingStep === 1
    ? 'Try Buy Sovereign Bonds. Hover decisions to preview causal links.'
    : onboardingStep === 2
      ? 'Cash has Total / Available / Locked. Check the tooltip.'
      : onboardingStep === 3
        ? 'Watch Reputation. Lobby / PR is your repair lever later.'
        : null;

  const handleEndTurn = () => {
    setPreviewDecisionId(null);
    endTurn();
  };

  return (
    <div className="dashboard">
      <KPIBar onboardingStep={onboardingStep} />

      {onboardingMessage && (
        <div className="tutorial-tip onboarding-tip">
          <span>{onboardingMessage}</span>
          <button className="tip-dismiss-btn" onClick={dismissOnboarding}>
            Hide tips
          </button>
        </div>
      )}

      {showTutorial && (
        <div className="tutorial-tip">
          💡 Pick decisions below, then hit <strong>End Turn</strong> to advance one quarter.
          Watch how your choices ripple through markets.
        </div>
      )}

      <CausalChainHUD previewDecisionId={previewDecisionId} onboardingStep={onboardingStep} />

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
        <DecisionsPanel
          previewDecisionId={previewDecisionId}
          onboardingStep={onboardingStep}
          onPreviewDecision={setPreviewDecisionId}
        />
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
          <button className="btn btn-primary btn-large" onClick={handleEndTurn}>
            End Turn ▶
          </button>
        </div>
      </div>
    </div>
  );
}
