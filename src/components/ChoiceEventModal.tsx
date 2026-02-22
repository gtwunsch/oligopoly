import { useGameStore } from '../store/gameStore';

export function ChoiceEventModal() {
  const activeChoiceEvent = useGameStore((state) => state.activeChoiceEvent);
  const resolveChoiceEvent = useGameStore((state) => state.resolveChoiceEvent);

  if (!activeChoiceEvent) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card choice-event-card">
        <h2>{activeChoiceEvent.headline}</h2>
        <p className="choice-event-why">{activeChoiceEvent.why}</p>
        <div className="choice-options">
          <button
            className="choice-option-btn"
            type="button"
            onClick={() => resolveChoiceEvent('A')}
          >
            <span className="choice-option-tag">Option A</span>
            <span className="choice-option-label">{activeChoiceEvent.optionA.label}</span>
            <span className="choice-option-impact">{activeChoiceEvent.optionA.impact}</span>
          </button>
          <button
            className="choice-option-btn"
            type="button"
            onClick={() => resolveChoiceEvent('B')}
          >
            <span className="choice-option-tag">Option B</span>
            <span className="choice-option-label">{activeChoiceEvent.optionB.label}</span>
            <span className="choice-option-impact">{activeChoiceEvent.optionB.impact}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
