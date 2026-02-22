import { create } from 'zustand';
import type { GameState } from '../sim/types';
import { createNewGame, advanceTurn, decisions } from '../sim';

const SAVE_KEY = 'macro-sim-save';
const DEFAULT_REPUTATION = 70;
const DEFAULT_CAUSAL_HINTS: string[] = [];
const DEFAULT_LAST_TURN_ACTIONS: string[] = [];

interface GameActions {
  newGame: (scenarioId?: Parameters<typeof createNewGame>[1]) => void;
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

  newGame: (scenarioId) => {
    const g = createNewGame(undefined, scenarioId);
    set(g);
  },

  queueDecision: (decisionId: string) => {
    const state = get();
    const dec = decisions.find((d) => d.id === decisionId);
    if (!dec) return;
    if (state.pendingDecisions.includes(decisionId)) return;
    if (dec.unlockTurn !== undefined && state.turn < dec.unlockTurn) return;
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
      scenarioId: state.scenarioId,
      scenarioName: state.scenarioName,
      countries: state.countries,
      eventWeightBias: state.eventWeightBias,
      worldFlags: state.worldFlags,
      portfolio: state.portfolio,
      reputation: state.reputation,
      winTargetAum: state.winTargetAum,
      maxTurns: state.maxTurns,
      outcome: state.outcome,
      lastTurnCausalHints: state.lastTurnCausalHints,
      lastTurnActions: state.lastTurnActions,
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
      scenarioId: s.scenarioId,
      scenarioName: s.scenarioName,
      countries: s.countries,
      eventWeightBias: s.eventWeightBias,
      worldFlags: s.worldFlags,
      portfolio: s.portfolio,
      reputation: s.reputation,
      winTargetAum: s.winTargetAum,
      maxTurns: s.maxTurns,
      outcome: s.outcome,
      lastTurnCausalHints: s.lastTurnCausalHints,
      lastTurnActions: s.lastTurnActions,
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
      const data = JSON.parse(raw) as Partial<GameState>;
      set({
        ...createNewGame(),
        ...data,
        pendingDecisions: Array.isArray(data.pendingDecisions)
          ? data.pendingDecisions.filter(
            (id): id is string => typeof id === 'string' && decisions.some((decision) => decision.id === id),
          )
          : [],
        reputation: typeof data.reputation === 'number' ? data.reputation : DEFAULT_REPUTATION,
        winTargetAum: typeof data.winTargetAum === 'number' ? data.winTargetAum : 120,
        maxTurns: typeof data.maxTurns === 'number' ? data.maxTurns : 20,
        outcome: data.outcome === 'win' || data.outcome === 'loss' ? data.outcome : 'ongoing',
        scenarioId: typeof data.scenarioId === 'string' ? data.scenarioId : 'calm_markets',
        scenarioName: typeof data.scenarioName === 'string' ? data.scenarioName : 'Calm Markets',
        eventWeightBias: data.eventWeightBias && typeof data.eventWeightBias === 'object'
          ? Object.fromEntries(
            Object.entries(data.eventWeightBias)
              .filter(([, value]) => typeof value === 'number')
              .map(([key, value]) => [key, value as number]),
          )
          : {},
        worldFlags: data.worldFlags && typeof data.worldFlags === 'object'
          ? Object.fromEntries(
            Object.entries(data.worldFlags)
              .filter(([, value]) => typeof value === 'number' && value > 0)
              .map(([key, value]) => [key, Math.floor(value as number)]),
          )
          : {},
        lastTurnCausalHints: Array.isArray(data.lastTurnCausalHints)
          ? data.lastTurnCausalHints.filter((hint): hint is string => typeof hint === 'string')
          : DEFAULT_CAUSAL_HINTS,
        lastTurnActions: Array.isArray(data.lastTurnActions)
          ? data.lastTurnActions.filter((action): action is string => typeof action === 'string')
          : DEFAULT_LAST_TURN_ACTIONS,
        phase: 'playing',
      });
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
