export interface Position {
  avgCost: number;
  shares: number;
  startDate: number;
  updatedAt: number;
}

export interface PositionMetrics {
  value: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  daysHeld: number;
}

export function computePositionMetrics(position: Position, currentPrice: number): PositionMetrics {
  const value = position.shares * currentPrice;
  const costBasis = position.shares * position.avgCost;
  const unrealizedPnl = value - costBasis;
  const unrealizedPnlPercent =
    position.avgCost > 0 ? ((currentPrice - position.avgCost) / position.avgCost) * 100 : 0;
  const daysHeld = Math.max(0, Math.floor((Date.now() - position.startDate) / 86_400_000));
  return { value, costBasis, unrealizedPnl, unrealizedPnlPercent, daysHeld };
}
