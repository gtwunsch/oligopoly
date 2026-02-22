import type { Portfolio } from './types';

const BASE_LIQUIDITY_RESERVE_RATIO = 0.05;
const LEVERAGE_MARGIN_RATIO = 0.08;
const MAX_CONCENTRATION_BUFFER_RATIO = 0.18;
const LOCK_RELEASE_RATE = 0.35;
const LOCK_RELEASE_FLOOR = 0.25; // $B per turn

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function computeConcentrationScore(portfolio: Portfolio): number {
  const active = portfolio.allocations.filter((allocation) => allocation.weight > 0.0001);
  if (active.length === 0) return 0;

  const totalWeight = active.reduce((sum, allocation) => sum + allocation.weight, 0);
  if (totalWeight <= 0) return 0;

  const normalizedWeights = active.map((allocation) => allocation.weight / totalWeight);
  const hhi = normalizedWeights.reduce((sum, weight) => sum + weight * weight, 0);
  const minHhi = 1 / normalizedWeights.length;
  const structureScore = normalizedWeights.length === 1
    ? 1
    : (hhi - minHhi) / (1 - minHhi);
  const exposureScore = clamp(totalWeight, 0, 1);

  return clamp(structureScore * exposureScore, 0, 1);
}

export interface CashLockDrivers {
  liquidityReserve: number;
  leverageMargin: number;
  concentrationBuffer: number;
  concentrationScore: number; // 0-1
  targetLocked: number;
}

export function computeCashLockDrivers(portfolio: Portfolio): CashLockDrivers {
  const cashTotal = Math.max(0, portfolio.cashTotal);
  const concentrationScore = computeConcentrationScore(portfolio);

  const liquidityReserve = cashTotal * BASE_LIQUIDITY_RESERVE_RATIO;
  const leverageMargin = cashTotal * Math.max(0, portfolio.leverage - 1) * LEVERAGE_MARGIN_RATIO;
  const concentrationBuffer = cashTotal * concentrationScore * MAX_CONCENTRATION_BUFFER_RATIO;
  const targetLocked = clamp(
    liquidityReserve + leverageMargin + concentrationBuffer,
    0,
    cashTotal,
  );

  return {
    liquidityReserve,
    leverageMargin,
    concentrationBuffer,
    concentrationScore,
    targetLocked,
  };
}

export function normalizeCashBuckets(portfolio: Portfolio): Portfolio {
  const cashTotal = Math.max(0, portfolio.cashTotal);
  const cashLocked = clamp(portfolio.cashLocked, 0, cashTotal);

  return {
    ...portfolio,
    cashTotal,
    cashLocked,
    cashAvailable: Math.max(0, cashTotal - cashLocked),
  };
}

export function rebalanceCashBuckets(portfolio: Portfolio): Portfolio {
  const normalized = normalizeCashBuckets(portfolio);
  const drivers = computeCashLockDrivers(normalized);

  let cashLocked = drivers.targetLocked;
  if (drivers.targetLocked < normalized.cashLocked) {
    const gap = normalized.cashLocked - drivers.targetLocked;
    const releaseAmount = Math.max(LOCK_RELEASE_FLOOR, gap * LOCK_RELEASE_RATE);
    cashLocked = Math.max(drivers.targetLocked, normalized.cashLocked - releaseAmount);
  }

  return normalizeCashBuckets({
    ...normalized,
    cashLocked,
  });
}
