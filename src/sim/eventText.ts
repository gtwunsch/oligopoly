import type { Decision, GameEvent, GameState } from './types';

const actionLeadByDecisionId: Record<string, string> = {
  buy_sovereign_bonds: 'After your bond build-up',
  sell_sovereign_bonds: 'After your bond sell-off',
  buy_equities: 'After your equity build-up',
  short_currency: 'After your FX short expansion',
  buy_gold: 'After your gold hedge increase',
  raise_leverage: 'After your leverage increase',
  reduce_leverage: 'After your deleveraging move',
  enter_irs: 'After your rates hedge increase',
  provide_liquidity: 'After your liquidity support',
  lobby_pr_spend: 'After your outreach campaign',
};

function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pickTemplate(templates: string[] | undefined, fallback: string, key: string): string {
  if (!templates || templates.length === 0) {
    return fallback;
  }
  const idx = fnv1aHash(key) % templates.length;
  return templates[idx] ?? fallback;
}

function getMostRecentAction(
  state: GameState,
  executedDecisions: Decision[],
  decisionCatalog: Decision[],
): Decision | null {
  if (executedDecisions.length > 0) {
    return executedDecisions[executedDecisions.length - 1];
  }

  for (let i = state.lastTurnActions.length - 1; i >= 0; i--) {
    const actionId = state.lastTurnActions[i];
    const matched = decisionCatalog.find((decision) => decision.id === actionId);
    if (matched) {
      return matched;
    }
  }
  return null;
}

export function buildEventHeadline(event: GameEvent, state: GameState): string {
  const key = `${state.seed}:${state.turn}:${event.id}:headline`;
  return pickTemplate(event.headlineTemplates, event.name, key);
}

export function buildEventWhy(
  event: GameEvent,
  state: GameState,
  executedDecisions: Decision[],
  decisionCatalog: Decision[],
  includeActionLead = true,
): string {
  if (!event.useLastActionLead || !includeActionLead) {
    return event.why;
  }

  const recentAction = getMostRecentAction(state, executedDecisions, decisionCatalog);
  if (!recentAction) {
    return event.why;
  }

  const lead = actionLeadByDecisionId[recentAction.id] ?? 'After your recent positioning move';
  return `${lead}: ${event.why}`;
}
