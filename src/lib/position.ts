export interface PositionLot {
  id: string;
  purchaseDate: number;
  shares: number;
  pricePerShare: number;
  createdAt: number;
}

export interface AggregatePosition {
  avgCost: number;
  totalShares: number;
  earliestDate: number | null;
}

export interface PositionMetrics {
  value: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  daysHeld: number | null;
}

export function computeAggregatePosition(lots: PositionLot[]): AggregatePosition | null {
  if (lots.length === 0) return null;
  const totalShares = lots.reduce((sum, l) => sum + l.shares, 0);
  const totalCost = lots.reduce((sum, l) => sum + l.shares * l.pricePerShare, 0);
  const earliestDate = lots.reduce(
    (min, l) => (min === null || l.purchaseDate < min ? l.purchaseDate : min),
    null as number | null
  );
  return {
    avgCost: totalCost / totalShares,
    totalShares,
    earliestDate,
  };
}

export function computePositionMetrics(
  aggregate: AggregatePosition,
  currentPrice: number
): PositionMetrics {
  const value = aggregate.totalShares * currentPrice;
  const costBasis = aggregate.totalShares * aggregate.avgCost;
  const unrealizedPnl = value - costBasis;
  const unrealizedPnlPercent = costBasis === 0 ? 0 : (unrealizedPnl / costBasis) * 100;
  const daysHeld =
    aggregate.earliestDate === null
      ? null
      : Math.floor((Date.now() - aggregate.earliestDate) / (1000 * 60 * 60 * 24));
  return { value, costBasis, unrealizedPnl, unrealizedPnlPercent, daysHeld };
}
