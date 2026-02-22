import { useGameStore } from './store/gameStore';
import { StartScreen } from './components/StartScreen';
import { Dashboard } from './components/Dashboard';
import { TurnSummary } from './components/TurnSummary';
import { ChoiceEventModal } from './components/ChoiceEventModal';

export default function App() {
  const phase = useGameStore((s) => s.phase);

  if (phase === 'start') return <StartScreen />;

  return (
    <>
      <Dashboard />
      {phase === 'choice' && <ChoiceEventModal />}
      {(phase === 'summary' || phase === 'gameover') && <TurnSummary />}
    </>
  );
}
