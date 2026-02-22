import { create } from 'zustand';
import type { GameState } from '../sim/types';
import { createNewGame, advanceTurn, decisions } from '../sim';

const SAVE_KEY = 'macro-sim-save';

interface GameActions {
  newGame: () => void;
  queueDecision: (decisionId: string) => void;
  removeDecision: (decisionId: string) => void;
  endTurn: () => void;
  dismissSummary: () => void;
  save: () => void;
  load: () => boolean;
  reset: () => void;
}

type GameStore = GameState & GameActions;

export const useGameStore = create<GameStore>((set, get) => ({
  ...createNewGame(),
  phase: 'start',

  newGame: () => {
    const g = createNewGame();
    set(g);
  },

  queueDecision: (decisionId: string) => {
    const state = get();
    const dec = decisions.find((d) => d.id === decisionId);
    if (!dec) return;
    if (state.pendingDecisions.includes(decisionId)) return;
    if (dec.cost > state.portfolio.cash) return;
    set({
      pendingDecisions: [...state.pendingDecisions, decisionId],
      portfolio: {
        ...state.portfolio,
        cash: state.portfolio.cash - dec.cost,
      },
    });
  },

  removeDecision: (decisionId: string) => {
    const state = get();
    const dec = decisions.find((d) => d.id === decisionId);
    if (!dec) return;
    set({
      pendingDecisions: state.pendingDecisions.filter((id) => id !== decisionId),
      portfolio: {
        ...state.portfolio,
        cash: state.portfolio.cash + dec.cost,
      },
    });
  },

  endTurn: () => {
    const state = get();
    if (state.phase !== 'playing') return;
    const snapshot: GameState = {
      turn: state.turn,
      year: state.year,
      quarter: state.quarter,
      countries: state.countries,
      portfolio: state.portfolio,
      log: state.log,
      pendingDecisions: state.pendingDecisions,
      phase: state.phase,
      seed: state.seed,
      score: state.score,
    };
    const next = advanceTurn(snapshot);
    set({ ...next, phase: next.phase === 'gameover' ? 'gameover' : 'summary' });
  },

  dismissSummary: () => set({ phase: 'playing' }),

  save: () => {
    const s = get();
    const data: GameState = {
      turn: s.turn,
      year: s.year,
      quarter: s.quarter,
      countries: s.countries,
      portfolio: s.portfolio,
      log: s.log,
      pendingDecisions: s.pendingDecisions,
      phase: s.phase,
      seed: s.seed,
      score: s.score,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  },

  load: () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw) as GameState;
      set({ ...data, phase: 'playing' });
      return true;
    } catch {
      return false;
    }
  },

  reset: () => {
    localStorage.removeItem(SAVE_KEY);
    set({ ...createNewGame(), phase: 'start' });
  },
}));
