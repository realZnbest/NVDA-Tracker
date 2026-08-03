import WebSocket from "ws";

/**
 * Finnhub's free-tier REST `/quote` snapshot lags real trades by 20-30s — it refreshes
 * on its own internal cadence, not on every print. The trade websocket pushes each
 * print as it happens, so a single shared connection here (one per server process,
 * fine for a single-user tool) lets `/api/quote` hand back a price that's actually
 * fresher than what the REST call alone would give, without spending extra REST quota.
 */

type Tick = { price: number; time: number };

const ticks = new Map<string, Tick>();
const subscribed = new Set<string>();
let socket: WebSocket | null = null;
let connecting = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function primaryKey(): string | undefined {
  return process.env.FINNHUB_API_KEY;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3_000);
}

function connect() {
  if (socket || connecting) return;
  const key = primaryKey();
  if (!key) return;

  connecting = true;
  const ws = new WebSocket(`wss://ws.finnhub.io?token=${key}`);

  ws.on("open", () => {
    connecting = false;
    socket = ws;
    for (const symbol of subscribed) {
      ws.send(JSON.stringify({ type: "subscribe", symbol }));
    }
  });

  ws.on("message", (raw) => {
    let msg: { type?: string; data?: Array<{ s: string; p: number; t: number }> };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type !== "trade" || !Array.isArray(msg.data)) return;
    for (const trade of msg.data) {
      const prev = ticks.get(trade.s);
      if (!prev || trade.t > prev.time) {
        ticks.set(trade.s, { price: trade.p, time: trade.t });
      }
    }
  });

  const onDown = () => {
    connecting = false;
    socket = null;
    scheduleReconnect();
  };
  ws.on("close", onDown);
  ws.on("error", onDown);
}

/** Idempotent — safe to call on every request for a symbol the dashboard is showing. */
export function subscribeSymbol(symbol: string) {
  if (subscribed.has(symbol)) return;
  subscribed.add(symbol);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "subscribe", symbol }));
  }
  connect();
}

/** Most recent trade print for `symbol`, or null if none has arrived yet this process. */
export function getLiveTick(symbol: string): Tick | null {
  return ticks.get(symbol) ?? null;
}
