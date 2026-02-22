import { useGameStore } from '../store/gameStore';

export function EventLog() {
  const log = useGameStore((s) => s.log);
  const recent = log.slice(-12).reverse();

  return (
    <div className="event-log">
      <h3>Event Log</h3>
      <div className="log-list">
        {recent.map((entry, i) => (
          <div key={i} className={`log-entry log-${entry.type}`}>
            <span className="log-turn">T{entry.turn}</span>
            <span className="log-text">{entry.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
