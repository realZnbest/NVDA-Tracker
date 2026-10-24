import type { MarketSession } from "./types";

/**
 * A board's session is the most "live" state among its symbols. A single stale symbol
 * must not make the whole wall look closed, and a single pre-market print must not hide
 * a regular session that is already trading elsewhere on the board.
 */
export function pickMarketSession(sessions: MarketSession[]): MarketSession {
  if (sessions.includes("regular")) return "regular";
  if (sessions.includes("pre")) return "pre";
  if (sessions.includes("post")) return "post";
  return "closed";
}
