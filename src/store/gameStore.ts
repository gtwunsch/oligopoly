import { create } from 'zustand';
import type { DecisionExecutionInput, GameState } from '../sim/types';
import { createNewGame, advanceTurn, decisions, normalizeDecisionId } from '../sim';

const SAVE_KEY = 'macro-sim-save';
const DEFAULT_REPUTATION = 70;
const DEFAULT_CAUSAL_HINTS: string[] = [];
const DEFAULT_LAST_TURN_ACTIONS: string[] = [];
const DEFAULT_ACTION_HISTORY: GameState['actionHistory'] = [];
const DEFAULT_PENDING_DECISION_PARAMS: GameState['pendingDecisionParams'] = {};
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

function sanitizeDecisionInput(input?: DecisionExecutionInput): DecisionExecutionInput | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const targetCountry = typeof input.targetCountry === 'string' ? input.targetCountry : undefined;
  const amount = typeof input.amount === 'number' && Number.isFinite(input.amount)
    ? Math.max(0.001, input.amount)
    : undefined;
  if (targetCountry === undefined && amount === undefined) {
    return undefined;
  }
  return {
    ...(targetCountry !== undefined ? { targetCountry } : {}),
    ...(amount !== undefined ? { amount } : {}),
  };
}

function sanitizePendingDecisions(
  pendingDecisions: Partial<GameState>['pendingDecisions'],
): GameState['pendingDecisions'] {
  if (!Array.isArray(pendingDecisions)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const decisionId of pendingDecisions) {
    if (typeof decisionId !== 'string') continue;
    const normalizedId = normalizeDecisionId(decisionId);
    if (seen.has(normalizedId)) continue;
    if (!decisions.some((decision) => decision.id === normalizedId)) continue;
    seen.add(normalizedId);
    result.push(normalizedId);
  }
  return result;
}

function sanitizePendingDecisionParams(
  pendingDecisionParams: Partial<GameState>['pendingDecisionParams'],
  queuedDecisionIds: string[],
): GameState['pendingDecisionParams'] {
  if (!pendingDecisionParams || typeof pendingDecisionParams !== 'object') {
    return DEFAULT_PENDING_DECISION_PARAMS;
  }

  const queuedIds = new Set(queuedDecisionIds);
  const sanitized: GameState['pendingDecisionParams'] = {};
  for (const [decisionId, input] of Object.entries(pendingDecisionParams)) {
    const normalizedDecisionId = normalizeDecisionId(decisionId);
    if (!queuedIds.has(normalizedDecisionId)) continue;
    const normalizedInput = sanitizeDecisionInput(input);
    if (!normalizedInput) continue;
    sanitized[normalizedDecisionId] = normalizedInput;
  }
  return sanitized;
}

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
      const normalizedActionId = normalizeDecisionId(actionId);
      const target = (entry as { target?: unknown }).target;
      const magnitude = (entry as { magnitude?: unknown }).magnitude;
      return {
        turn: Math.max(0, Math.floor(turn)),
        actionId: normalizedActionId,
        ...(typeof target === 'string' ? { target } : {}),
        ...(typeof magnitude === 'number' && Number.isFinite(magnitude) ? { magnitude } : {}),
      };
    })
    .filter((entry): entry is GameState['actionHistory'][number] => entry !== null);
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

interface GameActions {
  newGame: (scenarioId?: Parameters<typeof createNewGame>[1]) => void;
  queueDecision: (decisionId: string, input?: DecisionExecutionInput) => void;
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

  queueDecision: (decisionId: string, input?: DecisionExecutionInput) => {
    const state = get();
    const normalizedDecisionId = normalizeDecisionId(decisionId);
    const dec = decisions.find((d) => d.id === normalizedDecisionId);
    if (!dec) return;
    if (state.pendingDecisions.includes(normalizedDecisionId)) return;
    if (dec.unlockTurn !== undefined && state.turn < dec.unlockTurn) return;
    if (dec.cost > state.portfolio.cash) return;

    const sanitizedInput = sanitizeDecisionInput(input);
    set({
      pendingDecisions: [...state.pendingDecisions, normalizedDecisionId],
      pendingDecisionParams: sanitizedInput
        ? { ...state.pendingDecisionParams, [normalizedDecisionId]: sanitizedInput }
        : state.pendingDecisionParams,
      portfolio: {
        ...state.portfolio,
        cash: state.portfolio.cash - dec.cost,
      },
    });
  },

  removeDecision: (decisionId: string) => {
    const state = get();
    const normalizedDecisionId = normalizeDecisionId(decisionId);
    const dec = decisions.find((d) => d.id === normalizedDecisionId);
    if (!dec) return;
    set({
      pendingDecisions: state.pendingDecisions.filter((id) => id !== normalizedDecisionId),
      pendingDecisionParams: Object.fromEntries(
        Object.entries(state.pendingDecisionParams).filter(([id]) => id !== normalizedDecisionId),
      ),
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
      actionHistory: state.actionHistory,
      lastTurnSummary: state.lastTurnSummary,
      log: state.log,
      pendingDecisions: state.pendingDecisions,
      pendingDecisionParams: state.pendingDecisionParams,
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
      actionHistory: s.actionHistory,
      lastTurnSummary: s.lastTurnSummary,
      log: s.log,
      pendingDecisions: s.pendingDecisions,
      pendingDecisionParams: s.pendingDecisionParams,
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
      const pendingDecisions = sanitizePendingDecisions(data.pendingDecisions);
      set({
        ...createNewGame(),
        ...data,
        pendingDecisions,
        pendingDecisionParams: sanitizePendingDecisionParams(data.pendingDecisionParams, pendingDecisions),
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
        lastTurnSummary: sanitizeLastTurnSummary(data.lastTurnSummary),
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
