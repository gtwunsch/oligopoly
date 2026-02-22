export const SELL_BONDS_DECISION_ID = 'SELL_BONDS';
export const LEGACY_SELL_BONDS_DECISION_ID = 'sell_sovereign_bonds';

export function normalizeDecisionId(decisionId: string): string {
  if (decisionId === LEGACY_SELL_BONDS_DECISION_ID) {
    return SELL_BONDS_DECISION_ID;
  }
  return decisionId;
}
