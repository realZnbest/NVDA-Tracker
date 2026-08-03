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
const waiters = new Map<string, Set<(tick: Tick) => void>>();
let socket: WebSocket | null = null;
let connecting = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let lastActivity = Date.now();

/**
 * Idle TCP connections behind NATs/load balancers can die without ever firing `close`
 * or `error` — the socket just stops delivering trades while `readyState` still reports
 * OPEN. Left unchecked that reads as "the market went quiet" for however long the owner
 * has the tab open, which is a much worse failure mode than a normal reconnect. This
 * watchdog force-closes a connection that's gone silent so `close` fires and the normal
 * reconnect path picks it back up.
 */
const STALE_AFTER_MS = 45_000;
setInterval(() => {
  if (socket && Date.now() - lastActivity > STALE_AFTER_MS) {
    console.warn("[finnhub-ws] no messages in", STALE_AFTER_MS, "ms — terminating stale connection");
    socket.terminate();
  }
}, 15_000).unref();

function notifyWaiters(symbol: string, tick: Tick) {
  const set = waiters.get(symbol);
  if (!set) return;
  waiters.delete(symbol);
  for (const resolve of set) resolve(tick);
}

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
    lastActivity = Date.now();
    for (const symbol of subscribed) {
      ws.send(JSON.stringify({ type: "subscribe", symbol }));
    }
  });

  ws.on("ping", () => {
    lastActivity = Date.now();
  });

  ws.on("message", (raw) => {
    lastActivity = Date.now();
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
        const tick = { price: trade.p, time: trade.t };
        ticks.set(trade.s, tick);
        notifyWaiters(trade.s, tick);
      }
    }
  });

  const onDown = (reason: string) => {
    console.warn(`[finnhub-ws] connection down (${reason}), reconnecting in 3s`);
    connecting = false;
    socket = null;
    scheduleReconnect();
  };
  ws.on("close", (code) => onDown(`close ${code}`));
  ws.on("error", (err) => onDown(`error ${err.message}`));
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

/**
 * Resolves with a live tick for `symbol`, waiting up to `timeoutMs` for one to arrive if
 * none has yet — covers the first request right after opening the site (or the first
 * request for a symbol nobody's viewed this process), where without this the page would
 * show whatever stale value the REST snapshot happened to have instead of a fresh print.
 * Every request after that already has a cached tick and returns immediately.
 */
export function waitForLiveTick(symbol: string, timeoutMs: number): Promise<Tick | null> {
  const existing = ticks.get(symbol);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const onTick = (tick: Tick) => {
      clearTimeout(timer);
      resolve(tick);
    };
    const set = waiters.get(symbol) ?? new Set();
    set.add(onTick);
    waiters.set(symbol, set);

    const timer = setTimeout(() => {
      waiters.get(symbol)?.delete(onTick);
      resolve(ticks.get(symbol) ?? null);
    }, timeoutMs);
  });
}
