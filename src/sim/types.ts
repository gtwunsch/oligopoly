// ── Core simulation types ──

export interface CountryState {
  id: string;
  name: string;
  flag: string;
  region: 'americas' | 'europe' | 'asia' | 'emerging';
  interestRate: number;   // 0–20 %
  inflation: number;      // -2–30 %
  growth: number;         // -10–15 %
  stability: number;      // 0–100
  debtToGdp: number;      // 0–300 %
  fxRate: number;         // vs USD, base=1
  fxPrevious: number;
  sentiment: number;      // -100 … +100  (bear … bull)
  equityIndex: number;    // rebased to 100 at start
}

export interface PortfolioAllocation {
  countryId: string;
  asset: AssetClass;
  weight: number; // fraction of AUM
}

export type AssetClass =
  | 'sovereign_bonds'
  | 'equities'
  | 'gold'
  | 'cash'
  | 'fx_short'
  | 'irs'; // interest-rate swap

export interface Portfolio {
  aum: number;              // assets under management ($B)
  cash: number;             // unallocated ($B)
  leverage: number;         // 1x–5x
  allocations: PortfolioAllocation[];
  pnlHistory: number[];    // cumulative PnL each turn
  riskScore: number;        // 0–100 simple VaR-ish
  liquidity: number;        // 0–100
}

export interface Decision {
  id: string;
  name: string;
  description: string;
  cost: number;             // $B cost to execute
  tags: string[];
  unlockTurn?: number;
  reputationDelta?: number;
  effect: (state: GameState) => Partial<GameState>;
}

export interface GameEvent {
  id: string;
  name: string;
  description: string;
  weight: number;           // relative probability
  trigger?: (state: GameState) => boolean;
  reputationDelta?: number;
  effect: (state: GameState) => Partial<GameState>;
}

export interface LogEntry {
  turn: number;
  text: string;
  type: 'action' | 'event' | 'market' | 'info';
}

export interface GameState {
  turn: number;
  year: number;
  quarter: number;          // 1-4
  countries: CountryState[];
  portfolio: Portfolio;
  reputation: number;       // 0-100
  log: LogEntry[];
  pendingDecisions: string[];  // decision IDs queued this turn
  phase: 'start' | 'playing' | 'summary' | 'gameover';
  seed: number;
  score: number;
}
