import { NextResponse } from "next/server";
import { getQuote, FinnhubError } from "@/lib/finnhub";
import { getYahooCandles } from "@/lib/yahoo";
import { evaluateAlerts, type SymbolMarketSnapshot } from "@/lib/evaluate-alerts";
import { requireOwnerOrCron } from "@/lib/alerts-auth";
import { listAlerts } from "@/lib/alerts-store";
import { listLots } from "@/lib/position-store";
import { computeAggregatePositionsBySymbol } from "@/lib/position";

export const maxDuration = 60;

export async function POST() {
  // The owner's open tab can call this via the signed cookie; a scheduled job calls it
  // with `Authorization: Bearer $CRON_SECRET` instead, so alerts keep evaluating even when
  // no browser tab is open.
  const unauth = await requireOwnerOrCron();
  if (unauth) return unauth;
  try {
    const [allAlerts, lots] = await Promise.all([listAlerts(), listLots()]);
    const positionsBySymbol = computeAggregatePositionsBySymbol(lots);
    const alertSymbols = allAlerts
      .filter((a) => a.symbol !== null)
      .map((a) => a.symbol as string);
    const symbols = Array.from(new Set([...alertSymbols, ...positionsBySymbol.keys()]));

    if (symbols.length === 0) {
      return NextResponse.json({ fired: [] });
    }

    const snapshots = await Promise.all(
      symbols.map(async (symbol): Promise<SymbolMarketSnapshot | null> => {
        const [candles, quote] = await Promise.all([
          getYahooCandles(symbol, "2y", "1d"),
          getQuote(symbol),
        ]);
        if (candles.s !== "ok" || candles.c.length < 30) return null;
        return {
          symbol,
          price: quote.c,
          closes: candles.c,
          position: positionsBySymbol.get(symbol) ?? null,
        };
      })
    );
    const validSnapshots = snapshots.filter((s): s is SymbolMarketSnapshot => s !== null);

    let portfolio = null;
    if (positionsBySymbol.size > 0) {
      let totalValue = 0;
      let totalCost = 0;
      for (const snap of validSnapshots) {
        if (snap.position) {
          totalValue += snap.position.totalShares * snap.price;
          totalCost += snap.position.totalShares * snap.position.avgCost;
        }
      }
      portfolio = { totalValue, totalCost };
    }

    const fired = await evaluateAlerts(validSnapshots, portfolio);
    return NextResponse.json({ fired });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
