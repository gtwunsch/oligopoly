import { create } from 'zustand';
import type { GameState, Portfolio } from '../sim/types';
import {
  applyChoiceEvent,
  createNewGame,
  advanceTurn,
  decisions,
  hasChoiceEventDefinition,
  normalizeCashBuckets,
  pickChoiceEventForTurn,
  rebalanceCashBuckets,
} from '../sim';

const SAVE_KEY = 'macro-sim-save';
const SAVE_VERSION = 2;
const DEFAULT_REPUTATION = 70;
const DEFAULT_CAUSAL_HINTS: string[] = [];
const DEFAULT_LAST_TURN_ACTIONS: string[] = [];
const DEFAULT_ACTION_HISTORY: GameState['actionHistory'] = [];
const DEFAULT_ACTIVE_CHOICE_EVENT: GameState['activeChoiceEvent'] = null;
const DEFAULT_LAST_TURN_SUMMARY: GameState['lastTurnSummary'] = {
  turn: 0,
  deltas: {
    reputationDelta: 0,
    riskDelta: 0,
    aumDelta: 0,
    liquidityDelta: 0,
  },
  why: [],
};

function sanitizeActionHistory(
  actionHistory: Partial<GameState>['actionHistory'],
): GameState['actionHistory'] {
  if (!Array.isArray(actionHistory)) return DEFAULT_ACTION_HISTORY;
  return actionHistory
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const turn = (entry as { turn?: unknown }).turn;
      const actionId = (entry as { actionId?: unknown }).actionId;
      if (typeof turn !== 'number' || !Number.isFinite(turn) || typeof actionId !== 'string') {
        return null;
      }
      const target = (entry as { target?: unknown }).target;
      const magnitude = (entry as { magnitude?: unknown }).magnitude;
      const choice = (entry as { choice?: unknown }).choice;
      return {
        turn: Math.max(0, Math.floor(turn)),
        actionId,
        ...(choice === 'A' || choice === 'B' ? { choice } : {}),
        ...(typeof target === 'string' ? { target } : {}),
        ...(typeof magnitude === 'number' && Number.isFinite(magnitude) ? { magnitude } : {}),
      };
    })
    .filter((entry): entry is GameState['actionHistory'][number] => entry !== null);
}

function sanitizeActiveChoiceEvent(
  choiceEvent: Partial<GameState>['activeChoiceEvent'],
): GameState['activeChoiceEvent'] {
  if (!choiceEvent || typeof choiceEvent !== 'object') {
    return DEFAULT_ACTIVE_CHOICE_EVENT;
  }

  const id = (choiceEvent as { id?: unknown }).id;
  const headline = (choiceEvent as { headline?: unknown }).headline;
  const why = (choiceEvent as { why?: unknown }).why;
  const optionA = (choiceEvent as { optionA?: unknown }).optionA;
  const optionB = (choiceEvent as { optionB?: unknown }).optionB;

  if (
    typeof id !== 'string' ||
    !hasChoiceEventDefinition(id) ||
    typeof headline !== 'string' ||
    typeof why !== 'string' ||
    !optionA ||
    typeof optionA !== 'object' ||
    !optionB ||
    typeof optionB !== 'object'
  ) {
    return DEFAULT_ACTIVE_CHOICE_EVENT;
  }

  const optionALabel = (optionA as { label?: unknown }).label;
  const optionAImpact = (optionA as { impact?: unknown }).impact;
  const optionBLabel = (optionB as { label?: unknown }).label;
  const optionBImpact = (optionB as { impact?: unknown }).impact;

  if (
    typeof optionALabel !== 'string' ||
    typeof optionAImpact !== 'string' ||
    typeof optionBLabel !== 'string' ||
    typeof optionBImpact !== 'string'
  ) {
    return DEFAULT_ACTIVE_CHOICE_EVENT;
  }

  return {
    id,
    headline,
    why,
    optionA: {
      label: optionALabel,
      impact: optionAImpact,
    },
    optionB: {
      label: optionBLabel,
      impact: optionBImpact,
    },
  };
}

function sanitizeLastTurnSummary(
  summary: Partial<GameState>['lastTurnSummary'],
): GameState['lastTurnSummary'] {
  if (!summary || typeof summary !== 'object') return DEFAULT_LAST_TURN_SUMMARY;
  const turn = (summary as { turn?: unknown }).turn;
  const deltas = (summary as { deltas?: unknown }).deltas;
  const why = (summary as { why?: unknown }).why;

  return {
    turn: typeof turn === 'number' && Number.isFinite(turn) ? Math.max(0, Math.floor(turn)) : 0,
    deltas: {
      reputationDelta: typeof (deltas as { reputationDelta?: unknown })?.reputationDelta === 'number'
        ? (deltas as { reputationDelta: number }).reputationDelta
        : 0,
      riskDelta: typeof (deltas as { riskDelta?: unknown })?.riskDelta === 'number'
        ? (deltas as { riskDelta: number }).riskDelta
        : 0,
      aumDelta: typeof (deltas as { aumDelta?: unknown })?.aumDelta === 'number'
        ? (deltas as { aumDelta: number }).aumDelta
        : 0,
      liquidityDelta: typeof (deltas as { liquidityDelta?: unknown })?.liquidityDelta === 'number'
        ? (deltas as { liquidityDelta: number }).liquidityDelta
        : 0,
    },
    why: Array.isArray(why)
      ? why.filter((hint): hint is string => typeof hint === 'string').slice(0, 3)
      : [],
  };
}

type LegacyPortfolio = Partial<Portfolio> & { cash?: number };
type PersistedGameState = GameState & { saveVersion: number };
type LoadedSave = Partial<GameState> & { saveVersion?: number; portfolio?: LegacyPortfolio };

function migratePortfolio(rawPortfolio: LegacyPortfolio | undefined, fallback: Portfolio): Portfolio {
  if (!rawPortfolio || typeof rawPortfolio !== 'object') {
    return fallback;
  }

  const { cash: legacyCash, ...portfolioPatch } = rawPortfolio;
  const cashTotal = typeof rawPortfolio.cashTotal === 'number'
    ? rawPortfolio.cashTotal
    : typeof legacyCash === 'number'
      ? legacyCash
      : fallback.cashTotal;
  const cashLocked = typeof rawPortfolio.cashLocked === 'number' ? rawPortfolio.cashLocked : 0;
  const cashAvailable = typeof rawPortfolio.cashAvailable === 'number'
    ? rawPortfolio.cashAvailable
    : cashTotal - cashLocked;

  const merged: Portfolio = {
    ...fallback,
    ...portfolioPatch,
    cashTotal,
    cashLocked,
    cashAvailable,
  };

  return rebalanceCashBuckets(normalizeCashBuckets(merged));
}

interface GameActions {
  newGame: (scenarioId?: Parameters<typeof createNewGame>[1]) => void;
  queueDecision: (decisionId: string) => void;
  removeDecision: (decisionId: string) => void;
  endTurn: () => void;
  resolveChoiceEvent: (choice: 'A' | 'B') => void;
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
    if (dec.cost > state.portfolio.cashAvailable) return;
    const nextPortfolio = normalizeCashBuckets({
      ...state.portfolio,
      cashTotal: state.portfolio.cashTotal - dec.cost,
    });
    set({
      pendingDecisions: [...state.pendingDecisions, decisionId],
      portfolio: nextPortfolio,
    });
  },

  removeDecision: (decisionId: string) => {
    const state = get();
    const dec = decisions.find((d) => d.id === decisionId);
    if (!dec) return;
    const nextPortfolio = normalizeCashBuckets({
      ...state.portfolio,
      cashTotal: state.portfolio.cashTotal + dec.cost,
    });
    set({
      pendingDecisions: state.pendingDecisions.filter((id) => id !== decisionId),
      portfolio: nextPortfolio,
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
      actionHistory: state.actionHistory,
      activeChoiceEvent: state.activeChoiceEvent,
      lastTurnSummary: state.lastTurnSummary,
      log: state.log,
      pendingDecisions: state.pendingDecisions,
      phase: state.phase,
      seed: state.seed,
      score: state.score,
    };

    const choiceEvent = pickChoiceEventForTurn(snapshot);
    if (choiceEvent) {
      set({
        ...snapshot,
        activeChoiceEvent: choiceEvent,
        phase: 'choice',
      });
      return;
    }

    const next = advanceTurn(snapshot);
    set({ ...next, phase: next.phase === 'gameover' ? 'gameover' : 'summary' });
  },

  resolveChoiceEvent: (choice) => {
    const state = get();
    if (state.phase !== 'choice' || !state.activeChoiceEvent) return;

    const withChoiceApplied = applyChoiceEvent(state, state.activeChoiceEvent.id, choice);
    const snapshot: GameState = {
      turn: withChoiceApplied.turn,
      year: withChoiceApplied.year,
      quarter: withChoiceApplied.quarter,
      scenarioId: withChoiceApplied.scenarioId,
      scenarioName: withChoiceApplied.scenarioName,
      countries: withChoiceApplied.countries,
      eventWeightBias: withChoiceApplied.eventWeightBias,
      worldFlags: withChoiceApplied.worldFlags,
      portfolio: withChoiceApplied.portfolio,
      reputation: withChoiceApplied.reputation,
      winTargetAum: withChoiceApplied.winTargetAum,
      maxTurns: withChoiceApplied.maxTurns,
      outcome: withChoiceApplied.outcome,
      lastTurnCausalHints: withChoiceApplied.lastTurnCausalHints,
      lastTurnActions: withChoiceApplied.lastTurnActions,
      actionHistory: withChoiceApplied.actionHistory,
      activeChoiceEvent: null,
      lastTurnSummary: withChoiceApplied.lastTurnSummary,
      log: withChoiceApplied.log,
      pendingDecisions: withChoiceApplied.pendingDecisions,
      phase: 'playing',
      seed: withChoiceApplied.seed,
      score: withChoiceApplied.score,
    };

    const next = advanceTurn(snapshot);
    set({ ...next, phase: next.phase === 'gameover' ? 'gameover' : 'summary' });
  },

  dismissSummary: () => set({ phase: 'playing' }),

  save: () => {
    const s = get();
    const data: PersistedGameState = {
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
      actionHistory: s.actionHistory,
      activeChoiceEvent: s.activeChoiceEvent,
      lastTurnSummary: s.lastTurnSummary,
      log: s.log,
      pendingDecisions: s.pendingDecisions,
      phase: s.phase,
      seed: s.seed,
      score: s.score,
      saveVersion: SAVE_VERSION,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  },

  load: () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw) as LoadedSave;
      const base = createNewGame();
      const activeChoiceEvent = sanitizeActiveChoiceEvent(data.activeChoiceEvent);
      set({
        ...base,
        ...data,
        portfolio: migratePortfolio(data.portfolio, base.portfolio),
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
        actionHistory: sanitizeActionHistory(data.actionHistory),
        activeChoiceEvent,
        lastTurnSummary: sanitizeLastTurnSummary(data.lastTurnSummary),
        phase: activeChoiceEvent ? 'choice' : 'playing',
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
