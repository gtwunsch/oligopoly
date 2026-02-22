import { useEffect, useRef, useState } from 'react';
import { useGameStore } from './store/gameStore';
import { StartScreen } from './components/StartScreen';
import { Dashboard } from './components/Dashboard';
import { TurnSummary } from './components/TurnSummary';
import type { CountryState } from './sim/types';

interface TurnBaselineSnapshot {
  turn: number;
  countries: CountryState[];
  riskScore: number;
  reputation: number | null;
}

function cloneCountries(countries: CountryState[]): CountryState[] {
  return countries.map((country) => ({ ...country }));
}

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const turn = useGameStore((s) => s.turn);
  const countries = useGameStore((s) => s.countries);
  const riskScore = useGameStore((s) => s.portfolio.riskScore);
  const reputation = useGameStore((s) =>
    typeof s.reputation === 'number' && Number.isFinite(s.reputation) ? s.reputation : null,
  );
  const [turnBaseline, setTurnBaseline] = useState<TurnBaselineSnapshot | null>(null);
  const previousSnapshotRef = useRef<TurnBaselineSnapshot>({
    turn,
    countries: cloneCountries(countries),
    riskScore,
    reputation,
  });

  useEffect(() => {
    if (turn !== previousSnapshotRef.current.turn) {
      setTurnBaseline({
        turn,
        countries: previousSnapshotRef.current.countries,
        riskScore: previousSnapshotRef.current.riskScore,
        reputation: previousSnapshotRef.current.reputation,
      });
    }

    previousSnapshotRef.current = {
      turn,
      countries: cloneCountries(countries),
      riskScore,
      reputation,
    };
  }, [turn, countries, riskScore, reputation]);

  if (phase === 'start') return <StartScreen />;

  return (
    <>
      <Dashboard />
      {(phase === 'summary' || phase === 'gameover') && <TurnSummary baseline={turnBaseline} />}
    </>
  );
}
