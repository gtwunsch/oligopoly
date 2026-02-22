import { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { decisions } from '../sim';

interface DecisionsPanelProps {
  previewDecisionId: string | null;
  onboardingStep: number | null;
  onPreviewDecision: (decisionId: string | null) => void;
}

type Playstyle = 'stabilizer' | 'predator' | 'allocator';
type PlaystyleFilter = 'all' | Playstyle;

const PLAYSTYLE_META: Record<Playstyle, { tag: string; label: string; shortLabel: string; icon: string }> = {
  stabilizer: { tag: 'style_stabilizer', label: 'Stabilizer', shortLabel: 'STB', icon: 'S' },
  predator: { tag: 'style_predator', label: 'Predator', shortLabel: 'PRD', icon: 'P' },
  allocator: { tag: 'style_allocator', label: 'Allocator', shortLabel: 'ALC', icon: 'A' },
};

const FILTER_OPTIONS: { id: PlaystyleFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'stabilizer', label: 'Stabilizer' },
  { id: 'predator', label: 'Predator' },
  { id: 'allocator', label: 'Allocator' },
];

function getDecisionPlaystyle(tags: string[]): Playstyle {
  if (tags.includes(PLAYSTYLE_META.stabilizer.tag)) return 'stabilizer';
  if (tags.includes(PLAYSTYLE_META.predator.tag)) return 'predator';
  return 'allocator';
}

export function DecisionsPanel({ previewDecisionId, onboardingStep, onPreviewDecision }: DecisionsPanelProps) {
  const { pendingDecisions, portfolio, turn } = useGameStore();
  const queueDecision = useGameStore((s) => s.queueDecision);
  const removeDecision = useGameStore((s) => s.removeDecision);
  const [playstyleFilter, setPlaystyleFilter] = useState<PlaystyleFilter>('all');

  const visibleDecisions = useMemo(
    () => decisions.filter((decision) => (
      playstyleFilter === 'all' || getDecisionPlaystyle(decision.tags) === playstyleFilter
    )),
    [playstyleFilter],
  );

  return (
    <div className="decisions-panel" onMouseLeave={() => onPreviewDecision(null)}>
      <h3>Decisions</h3>
      <div className="decision-filters" role="tablist" aria-label="Filter decisions by playstyle">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`decision-filter-btn ${playstyleFilter === option.id ? 'active' : ''}`}
            onClick={() => setPlaystyleFilter(option.id)}
            aria-pressed={playstyleFilter === option.id}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="decisions-grid">
        {visibleDecisions.map((d) => {
          const playstyle = getDecisionPlaystyle(d.tags);
          const styleMeta = PLAYSTYLE_META[playstyle];
          const queued = pendingDecisions.includes(d.id);
          const locked = d.unlockTurn !== undefined && turn < d.unlockTurn;
          const cantAfford = !queued && d.cost > portfolio.cashAvailable;
          const descriptionWithStyle = `${styleMeta.label}: ${d.description}`;
          const baseTitle = locked
            ? `${descriptionWithStyle} Unlocks at turn ${d.unlockTurn}.`
            : descriptionWithStyle;
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
              <span className={`decision-style decision-style-${playstyle}`}>
                <span className="decision-style-icon">{styleMeta.icon}</span>
                {styleMeta.shortLabel}
              </span>
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
