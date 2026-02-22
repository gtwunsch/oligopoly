import { create } from 'zustand';
import type { GameState } from '../sim/types';
import { createNewGame, advanceTurn, decisions } from '../sim';
import {
  buildReplayPayload,
  parseReplayPayload,
  sanitizeReplayTurns,
  verifyReplayDeterminism,
} from './replay';

const SAVE_KEY = 'macro-sim-save';
const DEFAULT_REPUTATION = 70;
const DEFAULT_CAUSAL_HINTS: string[] = [];
const DEFAULT_LAST_TURN_ACTIONS: string[] = [];
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

interface PersistedGameData extends GameState {
  replayBaseSeed?: number;
  replayTurns?: string[][];
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
    const data: PersistedGameData = {
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
      replayBaseSeed: s.replayBaseSeed,
      replayTurns: s.replayTurns,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  },

  load: () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw) as Partial<PersistedGameData>;
      const fallbackGame = createNewGame();
      const replayTurns = sanitizeReplayTurns(data.replayTurns);
      const replayBaseSeed = typeof data.replayBaseSeed === 'number' && Number.isFinite(data.replayBaseSeed)
        ? data.replayBaseSeed
        : typeof data.seed === 'number' && Number.isFinite(data.seed)
          ? data.seed
          : fallbackGame.seed;
      set({
        ...fallbackGame,
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
      `cash: ${state.portfolio.cash.toFixed(2)}B`,
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
