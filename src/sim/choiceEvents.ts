import { normalizeCashBuckets, rebalanceCashBuckets } from './cash';
import { createRng } from './rng';
import type { ActiveChoiceEvent, GameState } from './types';

type ChoiceOptionId = 'A' | 'B';

interface ChoiceEventOptionDefinition {
  label: string;
  impact: string;
  effect: (state: GameState) => Partial<GameState>;
}

interface ChoiceEventDefinition {
  id: string;
  headline: string;
  why: string;
  weight: number;
  trigger: (state: GameState) => boolean;
  optionA: ChoiceEventOptionDefinition;
  optionB: ChoiceEventOptionDefinition;
}

const CHOICE_EVENT_CHANCE = 0.4;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function mergeWorldFlags(
  currentFlags: Record<string, number>,
  patchFlags: Record<string, number>,
): Record<string, number> {
  const merged = { ...currentFlags };
  for (const [key, value] of Object.entries(patchFlags)) {
    const normalized = Math.floor(value);
    if (normalized > 0) {
      merged[key] = normalized;
    } else {
      delete merged[key];
    }
  }
  return merged;
}

function applyStatePatch(state: GameState, patch: Partial<GameState>): GameState {
  const next = structuredClone(state);

  if (patch.countries) {
    next.countries = patch.countries;
  }
  if (patch.portfolio) {
    next.portfolio = rebalanceCashBuckets(
      normalizeCashBuckets({
        ...next.portfolio,
        ...patch.portfolio,
      }),
    );
  }
  if (typeof patch.reputation === 'number') {
    next.reputation = clamp(patch.reputation, 0, 100);
  }
  if (patch.worldFlags) {
    next.worldFlags = mergeWorldFlags(next.worldFlags, patch.worldFlags);
  }
  return next;
}

function toActiveChoiceEvent(choiceEvent: ChoiceEventDefinition): ActiveChoiceEvent {
  return {
    id: choiceEvent.id,
    headline: choiceEvent.headline,
    why: choiceEvent.why,
    optionA: {
      label: choiceEvent.optionA.label,
      impact: choiceEvent.optionA.impact,
    },
    optionB: {
      label: choiceEvent.optionB.label,
      impact: choiceEvent.optionB.impact,
    },
  };
}

export const choiceEvents: ChoiceEventDefinition[] = [
  {
    id: 'emergency_liquidity_window',
    headline: 'Brazil Banks Ask for Backstop',
    why: 'Short-term funding stress is climbing as refinancing costs stay elevated.',
    weight: 1.2,
    trigger: (state) => {
      const br = state.countries.find((country) => country.id === 'br');
      return Boolean(br && br.stability < 62 && br.interestRate > 9.5);
    },
    optionA: {
      label: 'Open emergency repo window',
      impact: 'Cash falls now; funding pressure eases and reputation improves.',
      effect: (state) => {
        const br = state.countries.find((country) => country.id === 'br')!;
        return {
          portfolio: {
            ...state.portfolio,
            cashTotal: state.portfolio.cashTotal - 3,
          },
          countries: state.countries.map((country) =>
            country.id === 'br'
              ? {
                  ...country,
                  interestRate: clamp(br.interestRate - 0.45, 0, 20),
                  stability: clamp(br.stability + 5, 0, 100),
                  sentiment: clamp(br.sentiment + 4, -100, 100),
                }
              : country,
          ),
          reputation: state.reputation + 2,
        };
      },
    },
    optionB: {
      label: 'Protect balance sheet liquidity',
      impact: 'Cash is preserved, but stress in Brazil worsens and reputation drops.',
      effect: (state) => {
        const br = state.countries.find((country) => country.id === 'br')!;
        return {
          portfolio: {
            ...state.portfolio,
            cashTotal: state.portfolio.cashTotal + 1,
          },
          countries: state.countries.map((country) =>
            country.id === 'br'
              ? {
                  ...country,
                  interestRate: clamp(br.interestRate + 0.35, 0, 20),
                  stability: clamp(br.stability - 4, 0, 100),
                  sentiment: clamp(br.sentiment - 4, -100, 100),
                }
              : country,
          ),
          reputation: state.reputation - 2,
        };
      },
    },
  },
  {
    id: 'collateral_haircut_call',
    headline: 'Prime Brokers Raise Haircuts',
    why: 'Higher volatility is forcing counterparties to demand stronger collateral buffers.',
    weight: 1.0,
    trigger: (state) => state.portfolio.leverage > 1.5,
    optionA: {
      label: 'Accept new collateral terms',
      impact: 'Risk pressure falls and credibility rises, but more cash is tied up.',
      effect: (state) => ({
        portfolio: {
          ...state.portfolio,
          leverage: clamp(state.portfolio.leverage - 0.2, 1, 5),
          cashLocked: state.portfolio.cashLocked + 2.5,
        },
        reputation: state.reputation + 1,
      }),
    },
    optionB: {
      label: 'Resist and keep positions open',
      impact: 'Near-term flexibility improves, but risk optics and reputation worsen.',
      effect: (state) => ({
        portfolio: {
          ...state.portfolio,
          leverage: clamp(state.portfolio.leverage + 0.2, 1, 5),
          cashLocked: Math.max(0, state.portfolio.cashLocked - 1.5),
        },
        reputation: state.reputation - 2,
      }),
    },
  },
  {
    id: 'disclosure_request',
    headline: 'Supervisors Request Position Disclosure',
    why: 'Risk concentration is high enough to trigger a transparency review.',
    weight: 0.9,
    trigger: (state) => state.reputation < 62 || state.portfolio.riskScore > 60,
    optionA: {
      label: 'Publish full exposure book',
      impact: 'Reputation improves and leverage eases, but market confidence cools slightly.',
      effect: (state) => ({
        portfolio: {
          ...state.portfolio,
          leverage: clamp(state.portfolio.leverage - 0.2, 1, 5),
        },
        countries: state.countries.map((country) => ({
          ...country,
          sentiment: clamp(country.sentiment - 1, -100, 100),
        })),
        reputation: state.reputation + 3,
      }),
    },
    optionB: {
      label: 'Release limited detail only',
      impact: 'Near-term market mood holds, but oversight trust declines.',
      effect: (state) => ({
        portfolio: {
          ...state.portfolio,
          leverage: clamp(state.portfolio.leverage + 0.15, 1, 5),
        },
        countries: state.countries.map((country) => ({
          ...country,
          sentiment: clamp(country.sentiment + 1, -100, 100),
        })),
        reputation: state.reputation - 3,
      }),
    },
  },
  {
    id: 'corporate_rollover_cliff',
    headline: 'Large Corporate Rollovers Due',
    why: 'A cluster of maturities is hitting while growth momentum is soft.',
    weight: 1.1,
    trigger: (state) => {
      const eu = state.countries.find((country) => country.id === 'eu');
      const cn = state.countries.find((country) => country.id === 'cn');
      return Boolean((eu && eu.growth < 1.2) || (cn && cn.growth < 4.2));
    },
    optionA: {
      label: 'Extend rollover credit lines',
      impact: 'Stability improves, but cash falls and risk appetite rises.',
      effect: (state) => ({
        portfolio: {
          ...state.portfolio,
          cashTotal: state.portfolio.cashTotal - 2.2,
          leverage: clamp(state.portfolio.leverage + 0.1, 1, 5),
        },
        countries: state.countries.map((country) =>
          country.id === 'eu' || country.id === 'cn'
            ? {
                ...country,
                growth: clamp(country.growth + 0.15, -10, 15),
                sentiment: clamp(country.sentiment + 3, -100, 100),
              }
            : country,
        ),
        reputation: state.reputation + 1,
      }),
    },
    optionB: {
      label: 'Tighten rollover standards',
      impact: 'Cash improves and leverage eases, but growth and sentiment weaken.',
      effect: (state) => ({
        portfolio: {
          ...state.portfolio,
          cashTotal: state.portfolio.cashTotal + 1.5,
          leverage: clamp(state.portfolio.leverage - 0.1, 1, 5),
        },
        countries: state.countries.map((country) =>
          country.id === 'eu' || country.id === 'cn'
            ? {
                ...country,
                growth: clamp(country.growth - 0.2, -10, 15),
                sentiment: clamp(country.sentiment - 4, -100, 100),
              }
            : country,
        ),
        reputation: state.reputation - 1,
      }),
    },
  },
  {
    id: 'fx_stabilization_desk',
    headline: 'Brazil FX Desk Requests Intervention',
    why: 'Spot liquidity is thinning and intraday volatility is accelerating.',
    weight: 1.0,
    trigger: (state) => {
      const br = state.countries.find((country) => country.id === 'br');
      return Boolean(br && br.fxRate < 0.205 && br.stability < 62);
    },
    optionA: {
      label: 'Defend currency with swap lines',
      impact: 'Currency and stability improve, but cash usage rises.',
      effect: (state) => {
        const br = state.countries.find((country) => country.id === 'br')!;
        return {
          portfolio: {
            ...state.portfolio,
            cashTotal: state.portfolio.cashTotal - 1.8,
          },
          countries: state.countries.map((country) =>
            country.id === 'br'
              ? {
                  ...country,
                  fxRate: br.fxRate * 1.04,
                  interestRate: clamp(br.interestRate - 0.2, 0, 20),
                  stability: clamp(br.stability + 2, 0, 100),
                }
              : country,
          ),
          reputation: state.reputation + 1,
        };
      },
    },
    optionB: {
      label: 'Let price discovery continue',
      impact: 'Cash is preserved, but FX stress and stability worsen.',
      effect: (state) => {
        const br = state.countries.find((country) => country.id === 'br')!;
        return {
          portfolio: {
            ...state.portfolio,
            cashTotal: state.portfolio.cashTotal + 0.7,
          },
          countries: state.countries.map((country) =>
            country.id === 'br'
              ? {
                  ...country,
                  fxRate: br.fxRate * 0.96,
                  interestRate: clamp(br.interestRate + 0.2, 0, 20),
                  stability: clamp(br.stability - 2, 0, 100),
                }
              : country,
          ),
          reputation: state.reputation - 1,
        };
      },
    },
  },
  {
    id: 'sovereign_auction_gap',
    headline: 'Brazil Auction Book Looks Thin',
    why: 'Primary dealers are demanding extra yield before committing balance sheet.',
    weight: 1.1,
    trigger: (state) => {
      const br = state.countries.find((country) => country.id === 'br');
      return Boolean(br && br.interestRate > 10.5);
    },
    optionA: {
      label: 'Underwrite the auction',
      impact: 'Rates and stress ease, but cash is consumed and debt rises.',
      effect: (state) => {
        const br = state.countries.find((country) => country.id === 'br')!;
        return {
          portfolio: {
            ...state.portfolio,
            cashTotal: state.portfolio.cashTotal - 2.4,
          },
          countries: state.countries.map((country) =>
            country.id === 'br'
              ? {
                  ...country,
                  interestRate: clamp(br.interestRate - 0.3, 0, 20),
                  stability: clamp(br.stability + 3, 0, 100),
                  debtToGdp: clamp(br.debtToGdp + 1, 0, 300),
                }
              : country,
          ),
          reputation: state.reputation + 1,
        };
      },
    },
    optionB: {
      label: 'Step away from the auction',
      impact: 'Cash is conserved, but rates rise and confidence weakens.',
      effect: (state) => {
        const br = state.countries.find((country) => country.id === 'br')!;
        return {
          portfolio: {
            ...state.portfolio,
            cashTotal: state.portfolio.cashTotal + 0.8,
          },
          countries: state.countries.map((country) =>
            country.id === 'br'
              ? {
                  ...country,
                  interestRate: clamp(br.interestRate + 0.35, 0, 20),
                  stability: clamp(br.stability - 3, 0, 100),
                  sentiment: clamp(br.sentiment - 4, -100, 100),
                }
              : country,
          ),
          reputation: state.reputation - 1,
        };
      },
    },
  },
  {
    id: 'inflation_relief_program',
    headline: 'US Relief Facility Proposal',
    why: 'Household financing strain is rising as inflation stays above comfort levels.',
    weight: 0.9,
    trigger: (state) => {
      const us = state.countries.find((country) => country.id === 'us');
      return Boolean(us && us.inflation > 3 && us.growth < 2.5);
    },
    optionA: {
      label: 'Fund targeted relief lines',
      impact: 'Stability and reputation improve, but cash falls and inflation nudges higher.',
      effect: (state) => {
        const us = state.countries.find((country) => country.id === 'us')!;
        return {
          portfolio: {
            ...state.portfolio,
            cashTotal: state.portfolio.cashTotal - 2,
          },
          countries: state.countries.map((country) =>
            country.id === 'us'
              ? {
                  ...country,
                  stability: clamp(us.stability + 3, 0, 100),
                  sentiment: clamp(us.sentiment + 2, -100, 100),
                  inflation: clamp(us.inflation + 0.2, -2, 30),
                }
              : country,
          ),
          reputation: state.reputation + 2,
        };
      },
    },
    optionB: {
      label: 'Hold line on support',
      impact: 'Cash improves, but social strain and reputation worsen.',
      effect: (state) => {
        const us = state.countries.find((country) => country.id === 'us')!;
        return {
          portfolio: {
            ...state.portfolio,
            cashTotal: state.portfolio.cashTotal + 1.2,
          },
          countries: state.countries.map((country) =>
            country.id === 'us'
              ? {
                  ...country,
                  stability: clamp(us.stability - 2, 0, 100),
                  sentiment: clamp(us.sentiment - 3, -100, 100),
                  inflation: clamp(us.inflation + 0.1, -2, 30),
                }
              : country,
          ),
          reputation: state.reputation - 2,
        };
      },
    },
  },
  {
    id: 'risk_committee_vote',
    headline: 'Board Risk Committee Vote',
    why: 'Internal governance is split on whether current positioning is too aggressive.',
    weight: 1.0,
    trigger: (state) => state.portfolio.riskScore > 45 || state.portfolio.leverage > 2,
    optionA: {
      label: 'Cut gross risk now',
      impact: 'Leverage and risk pressure ease, but return capacity is reduced.',
      effect: (state) => ({
        portfolio: {
          ...state.portfolio,
          leverage: clamp(state.portfolio.leverage - 0.4, 1, 5),
          cashLocked: Math.max(0, state.portfolio.cashLocked - 1),
        },
        reputation: state.reputation + 1,
      }),
    },
    optionB: {
      label: 'Keep risk budget open',
      impact: 'Upside capacity stays high, but risk optics and funding pressure worsen.',
      effect: (state) => ({
        portfolio: {
          ...state.portfolio,
          leverage: clamp(state.portfolio.leverage + 0.3, 1, 5),
          cashLocked: state.portfolio.cashLocked + 1.2,
        },
        reputation: state.reputation - 1,
      }),
    },
  },
];

export function pickChoiceEventForTurn(state: GameState): ActiveChoiceEvent | null {
  const eligible = choiceEvents.filter((choiceEvent) => choiceEvent.trigger(state));
  if (eligible.length === 0) {
    return null;
  }

  const rng = createRng(state.seed + state.turn * 4679 + 131);
  if (rng.next() >= CHOICE_EVENT_CHANCE) {
    return null;
  }

  const picked = rng.weightedPick(eligible);
  return toActiveChoiceEvent(picked);
}

export function applyChoiceEvent(
  state: GameState,
  eventId: string,
  choice: ChoiceOptionId,
): GameState {
  const eventDefinition = choiceEvents.find((choiceEvent) => choiceEvent.id === eventId);
  if (!eventDefinition) {
    return state;
  }

  const selectedOption = choice === 'A' ? eventDefinition.optionA : eventDefinition.optionB;
  const patchedState = applyStatePatch(state, selectedOption.effect(state));
  const logText = `${eventDefinition.headline}: ${selectedOption.label}. ${selectedOption.impact}`;

  return {
    ...patchedState,
    log: [
      ...patchedState.log,
      { turn: state.turn + 1, text: logText, type: 'event' },
    ],
    actionHistory: [
      ...patchedState.actionHistory,
      { turn: state.turn + 1, actionId: `EVENT_CHOICE:${eventDefinition.id}`, choice },
    ],
  };
}

export function hasChoiceEventDefinition(eventId: string): boolean {
  return choiceEvents.some((choiceEvent) => choiceEvent.id === eventId);
}
