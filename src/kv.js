import { KV, DEFAULT_CONFIG } from './config.js';

// ─── State Schema ────────────────────────────────────────────────────────────
//
// KV["state"] = {
//   daily: {
//     trade_date:        string,   // trading date (resets at market open: 05:00 CST summer / 06:00 CST winter)
//     high:              number,   // session high USD/KRW
//     low:               number,   // session low  USD/KRW
//     th_high_triggered: boolean,  // condition4 high threshold hit today
//     th_low_triggered:  boolean,  // condition4 low  threshold hit today
//     c3_high_ts:        number|null,  // last condition3 high trigger timestamp
//     c3_low_ts:         number|null,  // last condition3 low  trigger timestamp
//     last_broadcast_ts: number|null,  // last condition1 broadcast timestamp
//   },
//   anomaly_buf: Array<{ ts, rate, cr }>,  // rolling window, newest first
//   latest: {                              // most recent data snapshot
//     usdkrw:       number,
//     usdkrw_prev:  number|null,   // previous session close (from Twelve Data)
//     kospi_price:  number|null,
//     kospi_prev:   number|null,
//     nasdaq_price: number|null,
//     nasdaq_prev:  number|null,
//     sp500_price:  number|null,
//     sp500_prev:   number|null,
//     ts:           number,        // Unix ms
//     errors:       string[],
//   },
//   chart: Array<{ ts, r, k, n, s }>,  // intraday history, newest first
// }
//
// KV["config"] = DEFAULT_CONFIG shape (user-modified subset)
// KV["feishu_token"] = { token: string, expires_at: number }

// ─── Defaults ────────────────────────────────────────────────────────────────

function emptyState(tradeDate, rate) {
  return {
    daily: {
      trade_date:        tradeDate,
      high:              rate,
      low:               rate,
      th_high_triggered: false,
      th_low_triggered:  false,
      c3_high_ts:        null,
      c3_low_ts:         null,
      last_broadcast_ts: null,
      anomaly_points:    [],
      th_high_ts:        null,
      th_low_ts:         null,
    },
    anomaly_buf: [],
    latest:      null,
    chart:       [],
  };
}

// ─── State ───────────────────────────────────────────────────────────────────

export async function loadState(kv) {
  return (await kv.get(KV.STATE, 'json')) ?? null;
}

export async function saveState(kv, state) {
  await kv.put(KV.STATE, JSON.stringify(state));
}

/**
 * Ensure state exists and belongs to the current trading date.
 * Resets daily counters if the date has rolled over.
 */
export function ensureDailyReset(state, tradeDate, currentRate) {
  if (!state || state.daily.trade_date !== tradeDate) {
    return emptyState(tradeDate, currentRate);
  }
  return state;
}

// ─── Anomaly Buffer ──────────────────────────────────────────────────────────

/**
 * Push a new data point into the rolling buffer (newest first).
 * Trims to maxPoints.
 */
export function pushAnomalyBuf(buf, entry, maxPoints) {
  const next = [entry, ...buf];
  return next.length > maxPoints ? next.slice(0, maxPoints) : next;
}

// ─── Chart History ───────────────────────────────────────────────────────────

const MAX_CHART_POINTS = 700; // ~24 h at 1-min intervals

export function pushChartPoint(chart, point) {
  const next = [point, ...chart];
  return next.length > MAX_CHART_POINTS ? next.slice(0, MAX_CHART_POINTS) : next;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export async function loadConfig(kv) {
  const stored = await kv.get(KV.CONFIG, 'json');
  return { ...DEFAULT_CONFIG, ...(stored ?? {}) };
}

export async function saveConfig(kv, config) {
  await kv.put(KV.CONFIG, JSON.stringify(config));
}

// ─── Feishu Token Cache ──────────────────────────────────────────────────────

export async function loadFeishuToken(kv) {
  return (await kv.get(KV.FEISHU_TOKEN, 'json')) ?? null;
}

export async function saveFeishuToken(kv, token, expiresIn) {
  await kv.put(KV.FEISHU_TOKEN, JSON.stringify({
    token,
    expires_at: Date.now() + (expiresIn - 300) * 1000, // 5-min safety buffer
  }));
}

// ─── History (31-day rolling archive) ────────────────────────────────────────

const TTL_31_DAYS = 31 * 24 * 3600; // seconds

/** Archive one trading day. key: history:YYYY-MM-DD, TTL 31 days */
export async function saveHistory(kv, date, data) {
  await kv.put(`history:${date}`, JSON.stringify(data), {
    expirationTtl: TTL_31_DAYS,
  });
}

/** Load one day's archive. Returns null if not found. */
export async function loadHistory(kv, date) {
  return (await kv.get(`history:${date}`, 'json')) ?? null;
}

/** List all available history dates, newest first. */
export async function listHistoryDates(kv) {
  const result = await kv.list({ prefix: 'history:' });
  return result.keys
    .map(k => k.name.replace('history:', ''))
    .sort()
    .reverse();
}
