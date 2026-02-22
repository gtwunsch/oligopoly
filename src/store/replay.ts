import { advanceTurn, createNewGame, decisions, scenarios } from '../sim';
import type { GameState } from '../sim/types';

const REPLAY_VERSION = 1 as const;
const DECISION_IDS = new Set(decisions.map((decision) => decision.id));
const SCENARIO_IDS = new Set(scenarios.map((scenario) => scenario.id));
type ReplayScenarioId = NonNullable<Parameters<typeof createNewGame>[1]>;

export interface ReplayTurnInput {
  actions: string[];
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
    cash: number;
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

export function sanitizeReplayTurns(turns: unknown): string[][] {
  if (!Array.isArray(turns)) return [];
  return turns.map((turn) => sanitizeActions(turn));
}

export function buildReplayPayload(seed: number, scenarioId: string, turnHistory: string[][]): ReplayPayload {
  return {
    version: REPLAY_VERSION,
    seed,
    scenarioId: sanitizeScenarioId(scenarioId),
    turns: turnHistory.map((actions) => ({ actions: [...actions] })),
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
    turns: turns.map((turn) => ({
      actions: isRecord(turn) ? sanitizeActions(turn.actions) : [],
    })),
  };
}

export function runReplay(payload: ReplayPayload): GameState {
  let state = createNewGame(payload.seed, payload.scenarioId);

  for (const turnInput of payload.turns) {
    if (state.phase !== 'playing') {
      break;
    }
    state = advanceTurn({
      ...state,
      pendingDecisions: [...turnInput.actions],
    });
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
      cash: round(state.portfolio.cash),
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
