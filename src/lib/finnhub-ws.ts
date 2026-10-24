import WebSocket from "ws";

/**
 * Finnhub's free-tier REST `/quote` snapshot lags real trades by 20-30s — it refreshes
 * on its own internal cadence, not on every print. The trade websocket pushes each
 * print as it happens, so a single shared connection here (one per server process,
 * fine for a single-user tool) lets the quote routes hand back a price that's actually
 * fresher than what the REST call alone would give, without spending extra REST quota.
 *
 * State lives on `globalThis` rather than in module scope because Next bundles each
 * route separately: importing this file from both `/api/quote` and
 * `/api/watchlist/quotes` otherwise evaluates it twice and opens two sockets. Finnhub's
 * free plan allows one websocket connection, so the second one is rejected with 429.
 * A process-wide singleton also survives dev hot reloads, which would otherwise leak a
 * connection on every edit.
 */

type Tick = { price: number; time: number };

interface WsState {
  ticks: Map<string, Tick>;
  subscribed: Set<string>;
  /** Last time each subscribed symbol was requested by a UI poll, used for LRU eviction. */
  lastTouched: Map<string, number>;
  waiters: Map<string, Set<(tick: Tick) => void>>;
  /** When a wait for a first tick last timed out empty; optional so a hot-reloaded old state still works. */
  tickMisses?: Map<string, number>;
  socket: WebSocket | null;
  connecting: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  watchdog: ReturnType<typeof setInterval> | null;
  lastActivity: number;
}

/**
 * Finnhub's free plan streams at most 50 symbols on one connection. Watchlist and
 * dashboard symbols accumulate as the owner browses; keep a little headroom and evict
 * the least recently requested symbol so the newest view is never the one that gets
 * dropped.
 */
const MAX_STREAMED_SYMBOLS = 45;

const globalForWs = globalThis as typeof globalThis & { __finnhubWs?: WsState };

function state(): WsState {
  if (!globalForWs.__finnhubWs) {
    globalForWs.__finnhubWs = {
      ticks: new Map(),
      subscribed: new Set(),
      lastTouched: new Map(),
      waiters: new Map(),
      socket: null,
      connecting: false,
      reconnectTimer: null,
      watchdog: null,
      lastActivity: Date.now(),
    };
  }
  return globalForWs.__finnhubWs;
}

/**
 * Idle TCP connections behind NATs/load balancers can die without ever firing `close`
 * or `error` — the socket just stops delivering trades while `readyState` still reports
 * OPEN. Left unchecked that reads as "the market went quiet" for however long the owner
 * has the tab open, which is a much worse failure mode than a normal reconnect. This
 * watchdog force-closes a connection that's gone silent so `close` fires and the normal
 * reconnect path picks it back up.
 */
const STALE_AFTER_MS = 45_000;

function ensureWatchdog() {
  const s = state();
  if (s.watchdog) return;
  s.watchdog = setInterval(() => {
    if (s.socket && Date.now() - s.lastActivity > STALE_AFTER_MS) {
      console.warn(
        "[finnhub-ws] no messages in",
        STALE_AFTER_MS,
        "ms — terminating stale connection"
      );
      s.socket.terminate();
    }
  }, 15_000);
  s.watchdog.unref();
}

function notifyWaiters(symbol: string, tick: Tick) {
  const s = state();
  const set = s.waiters.get(symbol);
  if (!set) return;
  s.waiters.delete(symbol);
  for (const resolve of set) resolve(tick);
}

function primaryKey(): string | undefined {
  return process.env.FINNHUB_API_KEY;
}

function scheduleReconnect() {
  const s = state();
  if (s.reconnectTimer) return;
  s.reconnectTimer = setTimeout(() => {
    s.reconnectTimer = null;
    connect();
  }, 3_000);
}

function connect() {
  const s = state();
  if (s.socket || s.connecting) return;
  const key = primaryKey();
  if (!key) return;

  s.connecting = true;
  const ws = new WebSocket(`wss://ws.finnhub.io?token=${key}`);

  ws.on("open", () => {
    s.connecting = false;
    s.socket = ws;
    s.lastActivity = Date.now();
    for (const symbol of s.subscribed) {
      ws.send(JSON.stringify({ type: "subscribe", symbol }));
    }
  });

  ws.on("ping", () => {
    s.lastActivity = Date.now();
  });

  ws.on("message", (raw) => {
    s.lastActivity = Date.now();
    let msg: { type?: string; data?: Array<{ s: string; p: number; t: number }> };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type !== "trade" || !Array.isArray(msg.data)) return;
    for (const trade of msg.data) {
      const prev = s.ticks.get(trade.s);
      if (!prev || trade.t > prev.time) {
        const tick = { price: trade.p, time: trade.t };
        s.ticks.set(trade.s, tick);
        notifyWaiters(trade.s, tick);
      }
    }
  });

  const onDown = (reason: string) => {
    console.warn(`[finnhub-ws] connection down (${reason}), reconnecting in 3s`);
    s.connecting = false;
    s.socket = null;
    scheduleReconnect();
  };
  ws.on("close", (code) => onDown(`close ${code}`));
  ws.on("error", (err) => onDown(`error ${err.message}`));
}

function dropSubscription(symbol: string) {
  const s = state();
  s.subscribed.delete(symbol);
  s.lastTouched.delete(symbol);
  s.ticks.delete(symbol);
  if (s.socket && s.socket.readyState === WebSocket.OPEN) {
    try {
      s.socket.send(JSON.stringify({ type: "unsubscribe", symbol }));
    } catch {
      // The reconnect path re-subscribes the remaining set; a send race is harmless.
    }
  }
}

/** Idempotent — safe to call on every request for a symbol the UI is showing. Also
 *  refreshes the connection intent after a hot reload, where the socket may be gone. */
export function subscribeSymbol(symbol: string) {
  const s = state();
  ensureWatchdog();
  const isNew = !s.subscribed.has(symbol);
  s.subscribed.add(symbol);
  s.lastTouched.set(symbol, Date.now());
  if (isNew && s.socket && s.socket.readyState === WebSocket.OPEN) {
    try {
      s.socket.send(JSON.stringify({ type: "subscribe", symbol }));
    } catch {
      // The reconnect path re-subscribes `s.subscribed`; don't fail the quote route.
    }
  }

  while (s.subscribed.size > MAX_STREAMED_SYMBOLS) {
    let oldest: string | null = null;
    let oldestAt = Infinity;
    for (const candidate of s.subscribed) {
      if (candidate === symbol) continue;
      const touchedAt = s.lastTouched.get(candidate) ?? 0;
      if (touchedAt < oldestAt) {
        oldestAt = touchedAt;
        oldest = candidate;
      }
    }
    if (!oldest) break;
    dropSubscription(oldest);
  }

  connect();
}

/** Most recent trade print for `symbol`, or null if none has arrived yet this process. */
export function getLiveTick(symbol: string): Tick | null {
  return state().ticks.get(symbol) ?? null;
}

/**
 * Resolves with a live tick for `symbol`, waiting up to `timeoutMs` for one to arrive if
 * none has yet — covers the first request right after opening the site (or the first
 * request for a symbol nobody's viewed this process), where without this the page would
 * show whatever stale value the REST snapshot happened to have instead of a fresh print.
 * Every request after that already has a cached tick and returns immediately.
 */
export function waitForLiveTick(symbol: string, timeoutMs: number): Promise<Tick | null> {
  const s = state();
  const existing = s.ticks.get(symbol);
  if (existing) return Promise.resolve(existing);

  // A symbol with no tick after a full wait is shut (or illiquid). Waiting out the
  // timeout again on every 3s poll made /api/quote take 1.5s each time while the market
  // was closed, so only retry once a minute.
  const misses = (s.tickMisses ??= new Map());
  const lastMiss = misses.get(symbol);
  if (lastMiss !== undefined && Date.now() - lastMiss < 60_000) return Promise.resolve(null);

  return new Promise((resolve) => {
    const onTick = (tick: Tick) => {
      clearTimeout(timer);
      resolve(tick);
    };
    const set = s.waiters.get(symbol) ?? new Set();
    set.add(onTick);
    s.waiters.set(symbol, set);

    const timer = setTimeout(() => {
      s.waiters.get(symbol)?.delete(onTick);
      const late = s.ticks.get(symbol) ?? null;
      if (!late) misses.set(symbol, Date.now());
      resolve(late);
    }, timeoutMs);
  });
}
