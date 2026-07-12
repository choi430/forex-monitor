import { TIME_SEGMENTS, toCSTMinutes, tradingDate } from './config.js';
import { loadState, saveState, loadConfig, ensureDailyReset, pushChartPoint } from './kv.js';
import { fetchAllData } from './fetcher.js';
import { evaluateRules } from './rules.js';
import {
  sendCard,
  buildAlertCard,
  buildErrorCard,
} from './feishu.js';
import { fmtPrice, fmtChg, cstTimeStr } from './config.js';

// ─── Time Segment Detection ───────────────────────────────────────────────────

/**
 * Returns 'HIGH' | 'MID' | 'LOW' | 'INACTIVE' for a given timestamp.
 */
function getSegment(ts) {
  const mins = toCSTMinutes(ts);
  for (const seg of TIME_SEGMENTS) {
    if (mins >= seg.start && mins < seg.end) return seg.type;
  }
  return 'INACTIVE';
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

  // Outside forex window → only send closing summary at exactly 04:00 CST
  if (segment === 'INACTIVE') {
    const cstMin = toCSTMinutes(nowTs);
    if (cstMin === 4 * 60) { // 04:00 CST
      await sendClosingSummary(env, nowTs);
    }
    return;
  }

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

async function sendClosingSummary(env, nowTs) {
  const state = await loadState(env.FOREX_KV);
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