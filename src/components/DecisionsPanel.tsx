import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { decisions } from '../sim';
import type { Decision } from '../sim/types';

const CATEGORY_LABELS: Record<Decision['category'], string> = {
  invest: 'Invest',
  divest: 'Sell / De-risk',
  risk: 'Risk Management',
  political: 'Political',
};

const CATEGORY_ORDER: Decision['category'][] = ['invest', 'divest', 'risk', 'political'];

export function DecisionsPanel() {
  const { pendingDecisions, portfolio, turn, countries } = useGameStore();
  const queueDecision = useGameStore((s) => s.queueDecision);
  const removeDecision = useGameStore((s) => s.removeDecision);
  const [expandedDecision, setExpandedDecision] = useState<string | null>(null);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: decisions.filter((d) => d.category === cat),
  })).filter((g) => g.items.length > 0);

  function isQueued(decId: string, countryId?: string) {
    return pendingDecisions.some(
      (p) => p.decisionId === decId && p.targetCountryId === countryId,
    );
  }

  function handleDecisionClick(d: Decision) {
    const locked = d.unlockTurn !== undefined && turn < d.unlockTurn;
    if (locked) return;

    if (d.requiresTarget) {
      setExpandedDecision(expandedDecision === d.id ? null : d.id);
    } else {
      if (isQueued(d.id)) {
        removeDecision(d.id);
      } else {
        if (d.cost > portfolio.cash) return;
        queueDecision(d.id);
      }
    }
  }

  function handleCountrySelect(decId: string, countryId: string) {
    if (isQueued(decId, countryId)) {
      removeDecision(decId, countryId);
    } else {
      const dec = decisions.find((d) => d.id === decId);
      if (dec && dec.cost <= portfolio.cash) {
        queueDecision(decId, countryId);
      }
    }
  }

  const queuedCountForDecision = (decId: string) =>
    pendingDecisions.filter((p) => p.decisionId === decId).length;

  return (
    <div className="decisions-panel">
      <h3>Decisions</h3>
      {grouped.map((group) => (
        <div key={group.category} className="decision-group">
          <div className="decision-group-label">{group.label}</div>
          <div className="decisions-grid">
            {group.items.map((d) => {
              const locked = d.unlockTurn !== undefined && turn < d.unlockTurn;
              const queuedCount = queuedCountForDecision(d.id);
              const anyQueued = queuedCount > 0;
              const expanded = expandedDecision === d.id;
              const cantAfford = d.cost > portfolio.cash && !anyQueued;

              return (
                <div key={d.id} className="decision-wrapper">
                  <button
                    className={`decision-btn ${anyQueued ? 'queued' : ''} ${locked ? 'locked' : ''} ${expanded ? 'expanded' : ''}`}
                    disabled={locked || (cantAfford && !anyQueued)}
                    onClick={() => handleDecisionClick(d)}
                    title={d.description}
                  >
                    <div className="decision-main">
                      <span className="decision-name">{d.name}</span>
                      <span className="decision-short-desc">{d.shortDesc}</span>
                    </div>
                    <div className="decision-meta">
                      {locked && <span className="decision-lock">T{d.unlockTurn}</span>}
                      {d.cost > 0 && <span className="decision-cost">${d.cost}B</span>}
                      {d.requiresTarget && !locked && (
                        <span className="decision-target-hint">
                          {expanded ? '▾' : '▸'} {queuedCount > 0 ? `${queuedCount}×` : 'pick'}
                        </span>
                      )}
                      {!d.requiresTarget && anyQueued && <span className="decision-check">✓</span>}
                    </div>
                  </button>
                  {expanded && d.requiresTarget && (
                    <div className="country-picker">
                      {countries.map((c) => {
                        const picked = isQueued(d.id, c.id);
                        const tooExpensive = !picked && d.cost > portfolio.cash;
                        return (
                          <button
                            key={c.id}
                            className={`country-pick-btn ${picked ? 'picked' : ''}`}
                            disabled={tooExpensive}
                            onClick={() => handleCountrySelect(d.id, c.id)}
                            title={`${d.name} → ${c.name}`}
                          >
                            <span className="cp-flag">{c.flag}</span>
                            <span className="cp-name">{c.name}</span>
                            <span className="cp-hint">
                              {d.id.includes('bond') && `Rate ${c.interestRate.toFixed(1)}%`}
                              {d.id.includes('equit') && `Eq ${c.equityIndex.toFixed(0)}`}
                              {d.id.includes('short') && `Stab ${c.stability.toFixed(0)}`}
                              {d.id === 'enter_irs' && `Rate ${c.interestRate.toFixed(1)}%`}
                              {d.id === 'provide_liquidity' && `Stab ${c.stability.toFixed(0)}`}
                            </span>
                            {picked && <span className="cp-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
