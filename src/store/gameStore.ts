import { create } from 'zustand';
import type { GameState, Portfolio } from '../sim/types';
import {
  createNewGame,
  advanceTurn,
  decisions,
  normalizeCashBuckets,
  rebalanceCashBuckets,
} from '../sim';
import {
  buildReplayPayload,
  parseReplayPayload,
  sanitizeReplayTurns,
  verifyReplayDeterminism,
} from './replay';

const SAVE_KEY = 'macro-sim-save';
const SAVE_VERSION = 2;
const DEFAULT_REPUTATION = 70;
const DEFAULT_CAUSAL_HINTS: string[] = [];
const DEFAULT_LAST_TURN_ACTIONS: string[] = [];
const DEFAULT_ACTION_HISTORY: GameState['actionHistory'] = [];
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
const DEFAULT_SCENARIO_ID = 'calm_markets';
const DEFAULT_SCENARIO_NAME = 'Calm Markets';
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
      return {
        turn: Math.max(0, Math.floor(turn)),
        actionId,
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

type LegacyPortfolio = Partial<Portfolio> & { cash?: number };
interface PersistedGameState extends GameState {
  saveVersion: number;
  replayBaseSeed?: number;
  replayTurns?: string[][];
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
  queueDecision: (decisionId: string) => void;
  removeDecision: (decisionId: string) => void;
  endTurn: () => void;
  dismissSummary: () => void;
  save: () => void;
  load: () => boolean;
  reset: () => void;
  getReplayExport: () => ReplayExportData;
  importReplay: (rawPayload: string) => ReplayImportResult;
  getBugReportSnippet: () => string;
}

interface ReplayState {
  replayBaseSeed: number;
  replayTurns: string[][];
}

type GameStore = GameState & ReplayState & GameActions;

export const useGameStore = create<GameStore>((set, get) => {
  const initialGame = createNewGame();
  return {
    ...initialGame,
    phase: 'start',
    replayBaseSeed: initialGame.seed,
    replayTurns: [],

    newGame: (scenarioId) => {
      const g = createNewGame(undefined, scenarioId);
      set({ ...g, replayBaseSeed: g.seed, replayTurns: [] });
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
        lastTurnSummary: state.lastTurnSummary,
        log: state.log,
        pendingDecisions: state.pendingDecisions,
        phase: state.phase,
        seed: state.seed,
        score: state.score,
      };
      const next = advanceTurn(snapshot);
      set({
        ...next,
        phase: next.phase === 'gameover' ? 'gameover' : 'summary',
        replayBaseSeed: state.replayBaseSeed,
        replayTurns: [...state.replayTurns, executedTurnActions],
      });
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
        lastTurnSummary: s.lastTurnSummary,
        log: s.log,
        pendingDecisions: s.pendingDecisions,
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
          pendingDecisions: Array.isArray(data.pendingDecisions)
            ? data.pendingDecisions.filter(
              (id): id is string => typeof id === 'string' && decisions.some((decision) => decision.id === id),
            )
            : [],
          reputation: typeof data.reputation === 'number' ? data.reputation : DEFAULT_REPUTATION,
          winTargetAum: typeof data.winTargetAum === 'number' ? data.winTargetAum : 120,
          maxTurns: typeof data.maxTurns === 'number' ? data.maxTurns : 20,
          outcome: data.outcome === 'win' || data.outcome === 'loss' ? data.outcome : 'ongoing',
          scenarioId: typeof data.scenarioId === 'string' ? data.scenarioId : DEFAULT_SCENARIO_ID,
          scenarioName: typeof data.scenarioName === 'string' ? data.scenarioName : DEFAULT_SCENARIO_NAME,
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
      const freshGame = createNewGame();
      set({ ...freshGame, phase: 'start', replayBaseSeed: freshGame.seed, replayTurns: [] });
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
        set({
          ...replayState,
          phase: replayState.phase === 'gameover' ? 'gameover' : 'playing',
          pendingDecisions: [],
          replayBaseSeed: payload.seed,
          replayTurns: payload.turns.map((turn) => [...turn.actions]),
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
          : state.replayTurns[state.replayTurns.length - 1] ?? [];
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
