import { TIME_SEGMENTS, toCSTMinutes, tradingDate, isUSDST, fmtPrice, fmtChg, cstTimeStr } from './config.js';
import { loadState, saveState, loadConfig, ensureDailyReset, pushChartPoint, saveHistory } from './kv.js';
import { fetchAllData } from './fetcher.js';
import { evaluateRules } from './rules.js';
import {
  sendCard,
  buildAlertCard,
  buildErrorCard,
} from './feishu.js';

// ─── Time Segment Detection ───────────────────────────────────────────────────

/**
 * Returns 'HIGH' | 'MID' | 'LOW' | 'INACTIVE' for a given timestamp.
 */
function isInTradingWindow(ts) {
  const isDST   = isUSDST(ts);
  const openMin = isDST ? 300 : 360; // 05:00 或 06:00 CST（分钟数）
  const d       = new Date(ts + 8 * 3600_000);
  const dow     = d.getUTCDay(); // 0=周日, 6=周六
  const cstMin  = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (dow === 0) return false;                      // 周日
  if (dow === 6 && cstMin >= openMin) return false; // 周六收盘后
  if (dow === 1 && cstMin < openMin) return false;  // 周一开盘前
  return true;
}

function getSegment(ts) {
  if (!isInTradingWindow(ts)) return 'INACTIVE';
  const mins = toCSTMinutes(ts);
  for (const seg of TIME_SEGMENTS) {
    if (mins >= seg.start && mins < seg.end) return seg.type;
  }
  return 'LOW';
}

/**
 * Returns true if we should actually fetch data this cron tick.
 * Uses epoch-minute modulo to distribute fetches evenly.
 */
function shouldFetch(segment, config) {
  const intervals = {
    HIGH: config.interval_high,
    MID:  config.interval_mid,
    LOW:  config.interval_low,
  };
  const interval = intervals[segment];
  if (!interval) return false; // INACTIVE
  if (interval === 1) return true;
  const epochMinute = Math.floor(Date.now() / 60_000);
  return epochMinute % interval === 0;
}

// ─── Main Cron Handler ────────────────────────────────────────────────────────

export async function handleCron(env) {
  const nowTs   = Date.now();
  const segment = getSegment(nowTs);

// ── 每日交易日边界：归档前一日数据（先于状态重置）────────────────────────
  const _d          = new Date(nowTs + 8 * 3600_000);
  const _cstMin     = _d.getUTCHours() * 60 + _d.getUTCMinutes();
  const _marketOpen = isUSDST(nowTs) ? 300 : 360; // 05:00 或 06:00 CST

  if (_cstMin >= _marketOpen && _cstMin < _marketOpen + 5) {  // 给 5 分钟容错窗口
    const prevState = await loadState(env.FOREX_KV);
    const expectedDate = tradingDate(nowTs - 60_000);
    if (prevState?.chart?.length && prevState.daily.trade_date === expectedDate
        && !prevState.daily.archived) {   // 新增标记，避免窗口内重复归档
      const prevConfig = await loadConfig(env.FOREX_KV);
      await sendClosingSummary(env, nowTs, prevState);
      await archiveDay(env, nowTs, prevState, prevConfig);
      prevState.daily.archived = true;
      await saveState(env.FOREX_KV, prevState);
    }
  }

  if (segment === 'INACTIVE') return;

  // Load config first to check fetch interval
  const config = await loadConfig(env.FOREX_KV);

  if (!shouldFetch(segment, config)) return;

  // ── Load state ──────────────────────────────────────────────────────────────
  const rawState = await loadState(env.FOREX_KV);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const cached      = rawState?.latest ?? null;
  const fetchResult = await fetchAllData(env, cached);

  // Notify about data errors (but only when errors are new / change)
  if (fetchResult.errors.length > 0) {
    console.warn('[forex-monitor] fetch errors:', fetchResult.errors);
    // Send error notification at most once per broadcast interval to avoid spam
    const lastErrTs  = rawState?.last_error_notify_ts ?? 0;
    const errorGapMs = config.broadcast_interval * 60_000;
    if (nowTs - lastErrTs >= errorGapMs) {
      try {
        await sendCard(env, buildErrorCard(fetchResult.errors, nowTs));
      } catch (e) {
        console.error('[forex-monitor] feishu error card failed:', e);
      }
    }
  }

  // If USD/KRW unavailable we can't run rules — save fetch data and exit
  if (fetchResult.usdkrw == null) {
    const partialState = rawState
      ? { ...rawState, latest: buildLatest(fetchResult), last_error_notify_ts: nowTs }
      : null;
    if (partialState) await saveState(env.FOREX_KV, partialState);
    return;
  }

  // ── Reset daily state if needed ──────────────────────────────────────────
  const tDate = tradingDate(nowTs);
  let state   = ensureDailyReset(rawState, tDate, fetchResult.usdkrw);

  // ── Evaluate push conditions ─────────────────────────────────────────────
  const { state: updatedState, notifications } = evaluateRules(
    state, config, fetchResult, nowTs, segment,
  );

  // ── Update latest snapshot ────────────────────────────────────────────────
  updatedState.latest = buildLatest(fetchResult);

  // ── Update intraday chart history ─────────────────────────────────────────
  updatedState.chart = pushChartPoint(updatedState.chart ?? [], {
    ts: nowTs,
    r:  fetchResult.usdkrw,
    k:  fetchResult.kospi?.price   ?? null,
    n:  fetchResult.nasdaq?.price  ?? null,
    s:  fetchResult.sp500?.price   ?? null,
  });

  // Carry forward error notify timestamp if no new errors
  if (fetchResult.errors.length === 0 && rawState?.last_error_notify_ts) {
    updatedState.last_error_notify_ts = rawState.last_error_notify_ts;
  } else if (fetchResult.errors.length > 0) {
    updatedState.last_error_notify_ts = nowTs;
  }

  // ── Persist state ─────────────────────────────────────────────────────────
  await saveState(env.FOREX_KV, updatedState);

  // ── Send notifications ────────────────────────────────────────────────────
  for (const notif of notifications) {
    try {
      const card = buildAlertCard(
        notif.type,
        fetchResult,
        updatedState.daily,
        nowTs,
        notif.reason,
        notif.extra ?? null,
      );
      await sendCard(env, card);
    } catch (e) {
      console.error('[forex-monitor] send notification failed:', notif.type, e);
    }
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildLatest(f) {
  return {
    usdkrw:       f.usdkrw,
    usdkrw_prev:  f.usdkrw_prev,
    kospi_price:  f.kospi?.price        ?? null,
    kospi_prev:   f.kospi?.prevClose    ?? null,
    nasdaq_price: f.nasdaq?.price       ?? null,
    nasdaq_prev:  f.nasdaq?.prevClose   ?? null,
    sp500_price:  f.sp500?.price        ?? null,
    sp500_prev:   f.sp500?.prevClose    ?? null,
    errors:       f.errors,
    ts:           f.ts,
  };
}

async function sendClosingSummary(env, nowTs, state = null) {
  if (!state) state = await loadState(env.FOREX_KV);
  if (!state?.latest || !state?.daily) return;
  const { latest, daily } = state;

  const usdkrwChg = latest.usdkrw_prev
    ? ((latest.usdkrw - latest.usdkrw_prev) / latest.usdkrw_prev) * 100
    : null;
  const range = daily.high - daily.low;

  const card = {
    config: { wide_screen_mode: false },
    header: {
      title:    { tag: 'plain_text', content: '🔔 今日交易窗口收盘总结' },
      template: 'indigo',
    },
    elements: [
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**💱 收盘价**\n**${fmtPrice(latest.usdkrw)}**` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**较上日**\n${fmtChg(usdkrwChg)}` },
          },
        ],
      },
      { tag: 'hr' },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**日内最高**\n${fmtPrice(daily.high)}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**日内最低**\n${fmtPrice(daily.low)}` },
          },
        ],
      },
      {
        tag: 'div',
        text: { tag: 'lark_md', content: `**日内振幅**：${fmtPrice(range, 2)} 点（${range > 0 ? ((range / daily.low) * 100).toFixed(3) : '0.000'}%）` },
      },
      { tag: 'hr' },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**KOSPI**\n${fmtPrice(latest.kospi_price, 1)}  ${fmtChg(latest.kospi_price && latest.kospi_prev ? (latest.kospi_price - latest.kospi_prev) / latest.kospi_prev * 100 : null)}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**NASDAQ**\n${fmtPrice(latest.nasdaq_price, 1)}  ${fmtChg(latest.nasdaq_price && latest.nasdaq_prev ? (latest.nasdaq_price - latest.nasdaq_prev) / latest.nasdaq_prev * 100 : null)}` },
          },
        ],
      },
      {
        tag: 'div',
        text: { tag: 'lark_md', content: `**S&P 500**  ${fmtPrice(latest.sp500_price, 1)}  ${fmtChg(latest.sp500_price && latest.sp500_prev ? (latest.sp500_price - latest.sp500_prev) / latest.sp500_prev * 100 : null)}` },
      },
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: `交易窗口结束 · ${cstTimeStr(nowTs)}` },
        ],
      },
    ],
  };

  try {
    await sendCard(env, card);
  } catch (e) {
    console.error('[forex-monitor] closing summary failed:', e);
  }
}

// ─── Archive Day ──────────────────────────────────────────────────────────────

async function archiveDay(env, nowTs, state = null, config = null) {
  try {
    if (!state) state = await loadState(env.FOREX_KV);
    if (!state?.chart?.length) return;
    if (!config) config = await loadConfig(env.FOREX_KV);

    // At 04:00, tradingDate still points to "today's" session
    const date   = tradingDate(nowTs - 60_000);

    await saveHistory(env.FOREX_KV, date, {
      date,
      chart:    state.chart,
      daily:    state.daily,
      latest:   state.latest,   // includes prev-close values for accurate % display
      thresholds: {
        high: config.threshold_high,
        low:  config.threshold_low,
      },
    });
    console.log('[forex-monitor] archived day:', date);
  } catch (e) {
    console.error('[forex-monitor] archiveDay failed:', e);
  }
}