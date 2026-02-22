import { create } from 'zustand';
import type { DecisionExecutionInput, GameState, Portfolio } from '../sim/types';
import {
  applyChoiceEvent,
  createNewGame,
  advanceTurn,
  decisions,
  DEFAULT_SCENARIO_ID,
  normalizeDecisionId,
  hasChoiceEventDefinition,
  normalizeCashBuckets,
  pickChoiceEventForTurn,
  rebalanceCashBuckets,
} from '../sim';
import {
  buildReplayPayload,
  parseReplayPayload,
  type ReplayTurnInput,
  sanitizeReplayTurns,
  verifyReplayDeterminism,
} from './replay';

const SAVE_KEY = 'macro-sim-save';
const SAVE_VERSION = 2;
const DEFAULT_REPUTATION = 70;
const DEFAULT_CAUSAL_HINTS: string[] = [];
const DEFAULT_LAST_TURN_ACTIONS: string[] = [];
const DEFAULT_ACTION_HISTORY: GameState['actionHistory'] = [];
const DEFAULT_PENDING_DECISION_PARAMS: GameState['pendingDecisionParams'] = {};
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
const OBJECTIVE_WINDOW_TURNS = 3;
const STABILITY_OBJECTIVE_TARGET = 55;
const VALID_DECISION_IDS = new Set(decisions.map((decision) => decision.id));

interface ReplayExportData {
  json: string;
  hash: string;
  deterministic: boolean;
  turnCount: number;
}

interface ReplayImportResult {
  ok: boolean;
  message: string;
  hash?: string;
}

type QuarterObjectiveId = 'risk_under_60' | 'stabilize_country' | 'avoid_raise_leverage';

interface QuarterObjective {
  id: QuarterObjectiveId;
  text: string;
  rewardLabel: string;
  reward: {
    reputation?: number;
    cashTotal?: number;
  };
  startTurn: number;
  endTurn: number;
  progress: number;
  targetProgress: number;
  countryId?: string;
}

interface UiState {
  quarterObjective: QuarterObjective | null;
  objectivesDismissed: boolean;
  onboardingDismissed: boolean;
}

interface ReplayState {
  replayBaseSeed: number;
  replayTurns: ReplayTurnInput[];
}

interface ObjectiveEvaluationResult {
  objective: QuarterObjective;
  resolved: boolean;
  completed: boolean;
}

const OBJECTIVE_ROTATION: QuarterObjectiveId[] = ['risk_under_60', 'stabilize_country', 'avoid_raise_leverage'];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function createQuarterObjective(state: Pick<GameState, 'turn' | 'countries'>): QuarterObjective {
  const objectiveId = OBJECTIVE_ROTATION[Math.floor(state.turn / OBJECTIVE_WINDOW_TURNS) % OBJECTIVE_ROTATION.length];
  const startTurn = state.turn;
  const endTurn = state.turn + OBJECTIVE_WINDOW_TURNS;

  if (objectiveId === 'risk_under_60') {
    return {
      id: objectiveId,
      text: `Keep Risk < 60 for ${OBJECTIVE_WINDOW_TURNS} turns`,
      rewardLabel: '+2 Reputation',
      reward: { reputation: 2 },
      startTurn,
      endTurn,
      progress: 0,
      targetProgress: OBJECTIVE_WINDOW_TURNS,
    };
  }

  if (objectiveId === 'stabilize_country') {
    const weakestCountry = state.countries.length > 0
      ? state.countries.reduce((lowest, country) => (country.stability < lowest.stability ? country : lowest))
      : null;
    const countryLabel = weakestCountry ? weakestCountry.name : 'a market';
    return {
      id: objectiveId,
      text: `Stabilize ${countryLabel}: stability > ${STABILITY_OBJECTIVE_TARGET}`,
      rewardLabel: '+$1B Cash',
      reward: { cashTotal: 1 },
      startTurn,
      endTurn,
      progress: 0,
      targetProgress: 1,
      countryId: weakestCountry?.id,
    };
  }

  return {
    id: objectiveId,
    text: `Avoid Raise Leverage for ${OBJECTIVE_WINDOW_TURNS} turns`,
    rewardLabel: '+1 Reputation',
    reward: { reputation: 1 },
    startTurn,
    endTurn,
    progress: 0,
    targetProgress: OBJECTIVE_WINDOW_TURNS,
  };
}

function evaluateQuarterObjective(state: GameState, objective: QuarterObjective): ObjectiveEvaluationResult {
  let progress = objective.progress;

  if (objective.id === 'risk_under_60' && state.portfolio.riskScore < 60) {
    progress += 1;
  }

  if (objective.id === 'stabilize_country') {
    const targetCountry = objective.countryId
      ? state.countries.find((country) => country.id === objective.countryId)
      : undefined;
    const success = targetCountry
      ? targetCountry.stability > STABILITY_OBJECTIVE_TARGET
      : state.countries.some((country) => country.stability > STABILITY_OBJECTIVE_TARGET);
    if (success) {
      progress = objective.targetProgress;
    }
  }

  if (objective.id === 'avoid_raise_leverage' && !state.lastTurnActions.includes('raise_leverage')) {
    progress += 1;
  }

  const updatedObjective: QuarterObjective = {
    ...objective,
    progress: Math.min(objective.targetProgress, progress),
  };
  const resolved = state.turn >= updatedObjective.endTurn;
  const completed = resolved && updatedObjective.progress >= updatedObjective.targetProgress;

  return {
    objective: updatedObjective,
    resolved,
    completed,
  };
}

function applyObjectiveReward(state: GameState, objective: QuarterObjective): GameState {
  let next = state;
  const reputationReward = objective.reward.reputation ?? 0;
  const cashReward = objective.reward.cashTotal ?? 0;

  if (reputationReward !== 0) {
    next = {
      ...next,
      reputation: clamp(next.reputation + reputationReward, 0, 100),
    };
  }

  if (cashReward !== 0) {
    next = {
      ...next,
      portfolio: normalizeCashBuckets({
        ...next.portfolio,
        cashTotal: next.portfolio.cashTotal + cashReward,
      }),
    };
  }

  return next;
}

function objectiveResolutionText(objective: QuarterObjective, completed: boolean): string {
  if (completed) {
    return `Objective complete: ${objective.text}. Reward ${objective.rewardLabel}.`;
  }
  return `Objective missed: ${objective.text}.`;
}

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
      const choice = (entry as { choice?: unknown }).choice;
      return {
        turn: Math.max(0, Math.floor(turn)),
        actionId: normalizedActionId,
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
interface PersistedGameState extends GameState {
  saveVersion: number;
  replayBaseSeed?: number;
  replayTurns?: ReplayTurnInput[];
}
type LoadedSave = Partial<GameState> & {
  saveVersion?: number;
  portfolio?: LegacyPortfolio;
  replayBaseSeed?: number;
  replayTurns?: unknown;
};

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
  queueDecision: (decisionId: string, input?: DecisionExecutionInput) => void;
  removeDecision: (decisionId: string) => void;
  endTurn: () => void;
  resolveChoiceEvent: (choice: 'A' | 'B') => void;
  dismissSummary: () => void;
  dismissObjective: () => void;
  dismissOnboarding: () => void;
  save: () => void;
  load: () => boolean;
  reset: () => void;
  getReplayExport: () => ReplayExportData;
  importReplay: (rawPayload: string) => ReplayImportResult;
  getBugReportSnippet: () => string;
}

type GameStore = GameState & UiState & ReplayState & GameActions;

export const useGameStore = create<GameStore>((set, get) => {
  const initialGame = createNewGame();
  return {
    ...initialGame,
    phase: 'start',
    quarterObjective: null,
    objectivesDismissed: false,
    onboardingDismissed: false,
    replayBaseSeed: initialGame.seed,
    replayTurns: [],

    newGame: (scenarioId) => {
      const g = createNewGame(undefined, scenarioId);
      set({
        ...g,
        quarterObjective: createQuarterObjective(g),
        objectivesDismissed: false,
        onboardingDismissed: false,
        replayBaseSeed: g.seed,
        replayTurns: [],
      });
    },

  queueDecision: (decisionId: string, input?: DecisionExecutionInput) => {
    const state = get();
    const normalizedDecisionId = normalizeDecisionId(decisionId);
    const dec = decisions.find((d) => d.id === normalizedDecisionId);
    if (!dec) return;
    if (state.pendingDecisions.includes(normalizedDecisionId)) return;
    if (dec.unlockTurn !== undefined && state.turn < dec.unlockTurn) return;
    if (dec.cost > state.portfolio.cashAvailable) return;
    const sanitizedInput = sanitizeDecisionInput(input);
    const nextPortfolio = normalizeCashBuckets({
      ...state.portfolio,
      cashTotal: state.portfolio.cashTotal - dec.cost,
    });
    set({
      pendingDecisions: [...state.pendingDecisions, normalizedDecisionId],
      pendingDecisionParams: sanitizedInput
        ? { ...state.pendingDecisionParams, [normalizedDecisionId]: sanitizedInput }
        : state.pendingDecisionParams,
      portfolio: nextPortfolio,
    });
  },

  removeDecision: (decisionId: string) => {
    const state = get();
    const normalizedDecisionId = normalizeDecisionId(decisionId);
    const dec = decisions.find((d) => d.id === normalizedDecisionId);
    if (!dec) return;
    const nextPortfolio = normalizeCashBuckets({
      ...state.portfolio,
      cashTotal: state.portfolio.cashTotal + dec.cost,
    });
    set({
      pendingDecisions: state.pendingDecisions.filter((id) => id !== normalizedDecisionId),
      pendingDecisionParams: Object.fromEntries(
        Object.entries(state.pendingDecisionParams).filter(([id]) => id !== normalizedDecisionId),
      ),
      portfolio: nextPortfolio,
    });
  },

  endTurn: () => {
    const state = get();
    if (state.phase !== 'playing') return;
    const executedTurnActions = state.pendingDecisions.filter((decisionId) => VALID_DECISION_IDS.has(decisionId));
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
      pendingDecisionParams: state.pendingDecisionParams,
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
        quarterObjective: state.quarterObjective,
        objectivesDismissed: state.objectivesDismissed,
        onboardingDismissed: state.onboardingDismissed,
        replayBaseSeed: state.replayBaseSeed,
        replayTurns: state.replayTurns,
      });
      return;
    }

    let next = advanceTurn(snapshot);
    let nextObjective = state.objectivesDismissed ? null : state.quarterObjective;
    const objectiveLogEntries: GameState['log'] = [];

    if (!state.objectivesDismissed) {
      if (nextObjective) {
        const evaluation = evaluateQuarterObjective(next, nextObjective);
        nextObjective = evaluation.objective;

        if (evaluation.resolved) {
          if (evaluation.completed) {
            next = applyObjectiveReward(next, nextObjective);
          }
          objectiveLogEntries.push({
            turn: next.turn,
            text: objectiveResolutionText(nextObjective, evaluation.completed),
            type: 'info',
          });
          nextObjective = next.phase === 'gameover'
            ? null
            : createQuarterObjective({
              turn: next.turn,
              countries: next.countries,
            });
        }
      } else if (next.phase !== 'gameover') {
        nextObjective = createQuarterObjective({
          turn: next.turn,
          countries: next.countries,
        });
      }
    }

    if (objectiveLogEntries.length > 0) {
      next = {
        ...next,
        log: [...next.log, ...objectiveLogEntries],
      };
    }

    set({
      ...next,
      phase: next.phase === 'gameover' ? 'gameover' : 'summary',
      quarterObjective: next.phase === 'gameover' ? null : nextObjective,
      objectivesDismissed: state.objectivesDismissed,
      onboardingDismissed: state.onboardingDismissed,
      replayBaseSeed: state.replayBaseSeed,
      replayTurns: [...state.replayTurns, { actions: executedTurnActions }],
    });
  },

  resolveChoiceEvent: (choice) => {
    const state = get();
    if (state.phase !== 'choice' || !state.activeChoiceEvent) return;
    const executedTurnActions = state.pendingDecisions.filter((decisionId) => VALID_DECISION_IDS.has(decisionId));

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
      pendingDecisionParams: withChoiceApplied.pendingDecisionParams,
      phase: 'playing',
      seed: withChoiceApplied.seed,
      score: withChoiceApplied.score,
    };

    let next = advanceTurn(snapshot);
    let nextObjective = state.objectivesDismissed ? null : state.quarterObjective;
    const objectiveLogEntries: GameState['log'] = [];

    if (!state.objectivesDismissed) {
      if (nextObjective) {
        const evaluation = evaluateQuarterObjective(next, nextObjective);
        nextObjective = evaluation.objective;

        if (evaluation.resolved) {
          if (evaluation.completed) {
            next = applyObjectiveReward(next, nextObjective);
          }
          objectiveLogEntries.push({
            turn: next.turn,
            text: objectiveResolutionText(nextObjective, evaluation.completed),
            type: 'info',
          });
          nextObjective = next.phase === 'gameover'
            ? null
            : createQuarterObjective({
              turn: next.turn,
              countries: next.countries,
            });
        }
      } else if (next.phase !== 'gameover') {
        nextObjective = createQuarterObjective({
          turn: next.turn,
          countries: next.countries,
        });
      }
    }

    if (objectiveLogEntries.length > 0) {
      next = {
        ...next,
        log: [...next.log, ...objectiveLogEntries],
      };
    }

    set({
      ...next,
      phase: next.phase === 'gameover' ? 'gameover' : 'summary',
      quarterObjective: next.phase === 'gameover' ? null : nextObjective,
      objectivesDismissed: state.objectivesDismissed,
      onboardingDismissed: state.onboardingDismissed,
      replayBaseSeed: state.replayBaseSeed,
      replayTurns: [...state.replayTurns, { actions: executedTurnActions, choice }],
    });
  },

  dismissSummary: () => set({ phase: 'playing' }),

  dismissObjective: () => set({ objectivesDismissed: true, quarterObjective: null }),

  dismissOnboarding: () => set({ onboardingDismissed: true }),

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
      pendingDecisionParams: s.pendingDecisionParams,
      phase: s.phase,
      seed: s.seed,
      score: s.score,
      saveVersion: SAVE_VERSION,
      replayBaseSeed: s.replayBaseSeed,
      replayTurns: s.replayTurns,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  },

  load: () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw) as LoadedSave;
      const base = createNewGame();
      const pendingDecisions = sanitizePendingDecisions(data.pendingDecisions);
      const activeChoiceEvent = sanitizeActiveChoiceEvent(data.activeChoiceEvent);
      const replayTurns = sanitizeReplayTurns(data.replayTurns);
      const replayBaseSeed = typeof data.replayBaseSeed === 'number' && Number.isFinite(data.replayBaseSeed)
        ? data.replayBaseSeed
        : typeof data.seed === 'number' && Number.isFinite(data.seed)
          ? data.seed
          : base.seed;
      set({
        ...base,
        ...data,
        portfolio: migratePortfolio(data.portfolio, base.portfolio),
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
        activeChoiceEvent,
        lastTurnSummary: sanitizeLastTurnSummary(data.lastTurnSummary),
        phase: activeChoiceEvent ? 'choice' : 'playing',
        quarterObjective: createQuarterObjective({
          turn: typeof data.turn === 'number' && Number.isFinite(data.turn)
            ? Math.max(0, Math.floor(data.turn))
            : base.turn,
          countries: Array.isArray(data.countries) && data.countries.length > 0
            ? data.countries as GameState['countries']
            : base.countries,
        }),
        objectivesDismissed: false,
        onboardingDismissed: false,
        replayBaseSeed,
        replayTurns,
      });
      return true;
    } catch {
      return false;
    }
  },

  reset: () => {
    localStorage.removeItem(SAVE_KEY);
    const freshGame = createNewGame(undefined, DEFAULT_SCENARIO_ID);
    set({
      ...freshGame,
      phase: 'start',
      quarterObjective: null,
      objectivesDismissed: false,
      onboardingDismissed: false,
      replayBaseSeed: freshGame.seed,
      replayTurns: [],
    });
  },

  getReplayExport: () => {
    const state = get();
    const payload = buildReplayPayload(state.replayBaseSeed, state.scenarioId, state.replayTurns);
    const verification = verifyReplayDeterminism(payload);
    return {
      json: JSON.stringify(payload, null, 2),
      hash: verification.hash,
      deterministic: verification.deterministic,
      turnCount: payload.turns.length,
    };
  },

  importReplay: (rawPayload: string) => {
    try {
      const payload = parseReplayPayload(rawPayload);
      const verification = verifyReplayDeterminism(payload);
      if (!verification.deterministic) {
        return {
          ok: false,
          message: 'Replay determinism check failed. Payload may be inconsistent.',
        };
      }

      const replayState = verification.state;
      const importedObjective = replayState.phase === 'gameover'
        ? null
        : createQuarterObjective({
          turn: replayState.turn,
          countries: replayState.countries,
        });

      set({
        ...replayState,
        phase: replayState.phase === 'gameover' ? 'gameover' : 'playing',
        pendingDecisions: [],
        activeChoiceEvent: null,
        quarterObjective: importedObjective,
        objectivesDismissed: false,
        onboardingDismissed: true,
        replayBaseSeed: payload.seed,
        replayTurns: payload.turns.map((turn) => ({
          actions: [...turn.actions],
          ...(turn.choice ? { choice: turn.choice } : {}),
        })),
      });

      return {
        ok: true,
        message: `Replay imported (turn ${replayState.turn}, hash ${verification.hash}).`,
        hash: verification.hash,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unable to import replay payload.',
      };
    }
  },

  getBugReportSnippet: () => {
    const state = get();
    const payload = buildReplayPayload(state.replayBaseSeed, state.scenarioId, state.replayTurns);
    const verification = verifyReplayDeterminism(payload);
    const mostRecentActions =
      state.lastTurnActions.length > 0
        ? state.lastTurnActions
        : state.replayTurns[state.replayTurns.length - 1]?.actions ?? [];
    const lastEventEntry = [...state.log].reverse().find((entry) => entry.type === 'event');
    const lastEventHeadline = lastEventEntry ? lastEventEntry.text.split(':')[0] : undefined;

    const lines = [
      'Bug Report Snippet',
      `seed: ${state.replayBaseSeed}`,
      `scenario: ${state.scenarioId}`,
      `turn: ${state.turn}`,
      `last_actions: ${mostRecentActions.length > 0 ? mostRecentActions.join(', ') : 'none'}`,
      `risk: ${state.portfolio.riskScore}`,
      `reputation: ${state.reputation}`,
      `cash_available: ${state.portfolio.cashAvailable.toFixed(2)}B`,
      `replay_turns: ${state.replayTurns.length}`,
      `replay_hash: ${verification.hash}`,
    ];
    if (lastEventHeadline) {
      lines.push(`last_event: ${lastEventHeadline}`);
    }
    return lines.join('\n');
  },
  };
});
