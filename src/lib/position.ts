export interface PositionLot {
  id: string;
  symbol: string;
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

/** Groups lots by symbol and computes each symbol's aggregate independently. */
export function computeAggregatePositionsBySymbol(
  lots: PositionLot[]
): Map<string, AggregatePosition> {
  const bySymbol = new Map<string, PositionLot[]>();
  for (const lot of lots) {
    const group = bySymbol.get(lot.symbol);
    if (group) group.push(lot);
    else bySymbol.set(lot.symbol, [lot]);
  }
  const result = new Map<string, AggregatePosition>();
  for (const [symbol, symbolLots] of bySymbol) {
    const aggregate = computeAggregatePosition(symbolLots);
    if (aggregate) result.set(symbol, aggregate);
  }
  return result;
}

/**
 * The target prices a position starts with before you edit them. Lives here rather than
 * in the projection panel because the daily email summary needs the same list: saved
 * targets are browser-local (localStorage), so the server can only reason about these
 * defaults — both surfaces must at least agree on what "default" means.
 */
export function defaultTargets(price: number): number[] {
  return [Math.round(price * 1.1), Math.round(price * 1.25), Math.round(price * 1.5)];
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
