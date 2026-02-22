import { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { decisions } from '../sim';

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

export function DecisionsPanel() {
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
    <div className="decisions-panel">
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
          const title = locked
            ? `${descriptionWithStyle} Unlocks at turn ${d.unlockTurn}.`
            : descriptionWithStyle;

          return (
            <button
              key={d.id}
              className={`decision-btn ${queued ? 'queued' : ''} ${locked ? 'locked' : ''}`}
              disabled={locked || cantAfford}
              onClick={() => (queued ? removeDecision(d.id) : queueDecision(d.id))}
              title={title}
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
