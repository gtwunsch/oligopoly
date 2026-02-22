import {
  applyChoiceEvent,
  advanceTurn,
  createNewGame,
  decisions,
  pickChoiceEventForTurn,
  scenarios,
} from '../sim';
import type { GameState } from '../sim/types';

const REPLAY_VERSION = 1 as const;
const DECISION_IDS = new Set(decisions.map((decision) => decision.id));
const SCENARIO_IDS = new Set(scenarios.map((scenario) => scenario.id));
type ReplayScenarioId = NonNullable<Parameters<typeof createNewGame>[1]>;

export interface ReplayTurnInput {
  actions: string[];
  choice?: 'A' | 'B';
}

export interface ReplayPayload {
  version: typeof REPLAY_VERSION;
  seed: number;
  scenarioId?: ReplayScenarioId;
  turns: ReplayTurnInput[];
}

export interface ReplayStateSummary {
  turn: number;
  year: number;
  quarter: number;
  scenarioId: string;
  outcome: GameState['outcome'];
  phase: GameState['phase'];
  score: number;
  seed: number;
  reputation: number;
  portfolio: {
    aum: number;
    cashTotal: number;
    cashAvailable: number;
    leverage: number;
    riskScore: number;
    liquidity: number;
  };
}

export interface ReplayVerification {
  deterministic: boolean;
  hash: string;
  state: GameState;
  summary: ReplayStateSummary;
}

const round = (value: number, digits = 4) => Number(value.toFixed(digits));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeActions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique: string[] = [];
  for (const actionId of value) {
    if (typeof actionId !== 'string') continue;
    if (!DECISION_IDS.has(actionId)) continue;
    if (unique.includes(actionId)) continue;
    unique.push(actionId);
  }
  return unique;
}

function sanitizeScenarioId(value: unknown): ReplayScenarioId | undefined {
  if (typeof value !== 'string') return undefined;
  return SCENARIO_IDS.has(value as ReplayScenarioId) ? (value as ReplayScenarioId) : undefined;
}

function sanitizeReplayTurn(turn: unknown): ReplayTurnInput {
  if (Array.isArray(turn)) {
    return { actions: sanitizeActions(turn) };
  }
  if (!isRecord(turn)) {
    return { actions: [] };
  }
  const choice = turn.choice === 'A' || turn.choice === 'B' ? turn.choice : undefined;
  return {
    actions: sanitizeActions(turn.actions),
    ...(choice ? { choice } : {}),
  };
}

export function sanitizeReplayTurns(turns: unknown): ReplayTurnInput[] {
  if (!Array.isArray(turns)) return [];
  return turns.map((turn) => sanitizeReplayTurn(turn));
}

export function buildReplayPayload(seed: number, scenarioId: string, turnHistory: ReplayTurnInput[]): ReplayPayload {
  return {
    version: REPLAY_VERSION,
    seed,
    scenarioId: sanitizeScenarioId(scenarioId),
    turns: turnHistory.map((turn) => ({
      actions: [...turn.actions],
      ...(turn.choice ? { choice: turn.choice } : {}),
    })),
  };
}

export function parseReplayPayload(rawPayload: string): ReplayPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new Error('Invalid JSON. Paste a valid replay payload.');
  }

  if (!isRecord(parsed)) {
    throw new Error('Replay payload must be a JSON object.');
  }

  const seed = parsed.seed;
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new Error('Replay payload is missing a numeric "seed".');
  }

  const turns = parsed.turns;
  if (!Array.isArray(turns)) {
    throw new Error('Replay payload is missing "turns".');
  }

  const version = parsed.version;
  if (version !== undefined && version !== REPLAY_VERSION) {
    throw new Error(`Unsupported replay version: ${String(version)}.`);
  }

  return {
    version: REPLAY_VERSION,
    seed,
    scenarioId: sanitizeScenarioId(parsed.scenarioId),
    turns: turns.map((turn) => sanitizeReplayTurn(turn)),
  };
}

export function runReplay(payload: ReplayPayload): GameState {
  let state = createNewGame(payload.seed, payload.scenarioId);

  for (const turnInput of payload.turns) {
    if (state.phase !== 'playing') {
      break;
    }
    const snapshot: GameState = {
      ...state,
      activeChoiceEvent: null,
      phase: 'playing',
      pendingDecisions: [...turnInput.actions],
    };
    const choiceEvent = pickChoiceEventForTurn(snapshot);
    if (choiceEvent) {
      const choice = turnInput.choice ?? 'A';
      const withChoice = applyChoiceEvent(
        {
          ...snapshot,
          activeChoiceEvent: choiceEvent,
          phase: 'choice',
        },
        choiceEvent.id,
        choice,
      );
      state = advanceTurn({
        ...withChoice,
        activeChoiceEvent: null,
        phase: 'playing',
      });
      continue;
    }
    state = advanceTurn(snapshot);
  }

  return state;
}

export function summarizeReplayState(state: GameState): ReplayStateSummary {
  return {
    turn: state.turn,
    year: state.year,
    quarter: state.quarter,
    scenarioId: state.scenarioId,
    outcome: state.outcome,
    phase: state.phase,
    score: state.score,
    seed: state.seed,
    reputation: round(state.reputation),
    portfolio: {
      aum: round(state.portfolio.aum),
      cashTotal: round(state.portfolio.cashTotal),
      cashAvailable: round(state.portfolio.cashAvailable),
      leverage: round(state.portfolio.leverage),
      riskScore: state.portfolio.riskScore,
      liquidity: state.portfolio.liquidity,
    },
  };
}

export function hashReplaySummary(summary: ReplayStateSummary): string {
  const text = JSON.stringify(summary);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function verifyReplayDeterminism(payload: ReplayPayload): ReplayVerification {
  const stateA = runReplay(payload);
  const stateB = runReplay(payload);
  const summaryA = summarizeReplayState(stateA);
  const summaryB = summarizeReplayState(stateB);
  const hashA = hashReplaySummary(summaryA);
  const hashB = hashReplaySummary(summaryB);

  return {
    deterministic: hashA === hashB,
    hash: hashA,
    state: stateA,
    summary: summaryA,
  };
}
