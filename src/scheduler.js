import { TIME_SEGMENTS, toCSTMinutes, tradingDate, isUSDST, getMarketSessionTs, fmtPrice, fmtChg, cstTimeStr } from './config.js';
import { loadState, saveState, loadConfig, ensureDailyReset, pushChartPoint, saveHistory, loadHistory } from './kv.js';
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
  
  // ── 互斥锁：防止两个触发源（Cloudflare Cron + 外部 cron-job.org）在同一
  //    分钟内重复调用，导致重复播报、chart 出现两条数据 ──────────────────
  const epochMinute = Math.floor(nowTs / 60_000);
  const lockKey      = `cron_lock:${epochMinute}`;
  const alreadyRan    = await env.FOREX_KV.get(lockKey);
  if (alreadyRan) {
    console.log('[forex-monitor] duplicate trigger skipped for minute', epochMinute);
    return;
  }
  // 2 分钟后自动过期，避免这个 key 无限堆积；不需要精确原子性，
  // 只是尽量降低两边"撞车"的概率（Cloudflare KV 本身不是强一致，极端情况下
  // 两个请求几乎同时读到都还没写入的状态，仍有极小概率同时通过，但已经能
  // 挡掉绝大多数场景）。
  await env.FOREX_KV.put(lockKey, String(nowTs), { expirationTtl: 120 });

  const segment = getSegment(nowTs);

// ── 每日交易日边界：归档前一日数据（先于状态重置）────────────────────────
  const _d          = new Date(nowTs + 8 * 3600_000);
  const _cstMin     = _d.getUTCHours() * 60 + _d.getUTCMinutes();
  const _marketOpen = isUSDST(nowTs) ? 300 : 360; // 05:00 或 06:00 CST

  if (_cstMin >= _marketOpen && _cstMin < _marketOpen + 5) {  // 给 5 分钟容错窗口
    const prevState = await loadState(env.FOREX_KV);
    const todayDate  = tradingDate(nowTs);
    if (prevState?.chart?.length && prevState.daily.trade_date
        && prevState.daily.trade_date !== todayDate   // 必须确实是"前一天"，不能是今天自己
        && !prevState.daily.archived) {   // 避免窗口内重复归档
      const prevConfig = await loadConfig(env.FOREX_KV);
      await sendClosingSummary(env, nowTs, prevState);
      await archiveDay(env, prevState.daily.trade_date, prevState, prevConfig);
      prevState.daily.archived = true;
      await saveState(env.FOREX_KV, prevState);
    }
  }

  const isMarketOpen = (_cstMin === _marketOpen);
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
      ? { ...rawState, latest: buildLatest(fetchResult, rawState?.latest), last_error_notify_ts: nowTs }
      : null;
    if (partialState) await saveState(env.FOREX_KV, partialState);
    return;
  }

  // ── Reset daily state if needed ──────────────────────────────────────────
  const tDate     = tradingDate(nowTs);
  let state       = ensureDailyReset(rawState, tDate, fetchResult.usdkrw);
  const isNewDay  = !rawState || rawState.daily.trade_date !== tDate;
  if (isNewDay || isMarketOpen) {
    // 开盘时预设 last_broadcast_ts，使第一次整点播报延迟至开盘后1小时
    state = { ...state, daily: { ...state.daily, last_broadcast_ts: nowTs } };
  }
  
  // 如果这一条正好是新交易日的第一条数据（开盘时刻），把它也补写进
  // 前一天归档数据的末尾，让前一天收盘图和当天开盘图能在这个点上连起来
  if (isNewDay && rawState) {
    try {
      const prevDate     = rawState.daily.trade_date;
      const prevHistory  = await loadHistory(env.FOREX_KV, prevDate);
      if (prevHistory?.chart?.length) {
        const boundaryPoint = {
          ts: nowTs,
          r:  fetchResult.usdkrw,
          k:  fetchResult.kospi?.price  ?? null,
          n:  fetchResult.nasdaq?.price ?? null,
          s:  fetchResult.sp500?.price  ?? null,
          r_stale: fetchResult.usdkrw_stale,
          k_stale: fetchResult.kospi?.stale  ?? true,
          n_stale: fetchResult.nasdaq?.stale ?? true,
          s_stale: fetchResult.sp500?.stale  ?? true,
          r_ts: fetchResult.usdkrw_ts     ?? null,
          k_ts: fetchResult.kospi?.dataTs  ?? null,
          n_ts: fetchResult.nasdaq?.dataTs ?? null,
          s_ts: fetchResult.sp500?.dataTs  ?? null,
        };
        // chart 是倒序（最新在前），前一天最新的一条应插在数组最前面
        prevHistory.chart = [boundaryPoint, ...prevHistory.chart];
        await saveHistory(env.FOREX_KV, prevDate, prevHistory);
      }
    } catch (e) {
      console.error('[forex-monitor] append boundary point to previous day failed:', e);
    }
  }

  // ── Evaluate push conditions ─────────────────────────────────────────────
  const { state: updatedState, notifications } = evaluateRules(
    state, config, fetchResult, nowTs, segment,
  );

  // ── Update latest snapshot ────────────────────────────────────────────────
  updatedState.latest = buildLatest(fetchResult, rawState?.latest);

  // ── Update intraday chart history ─────────────────────────────────────────
  updatedState.chart = pushChartPoint(updatedState.chart ?? [], {
    ts: nowTs,
    r:  fetchResult.usdkrw,
    k:  fetchResult.kospi?.price   ?? null,
    n:  fetchResult.nasdaq?.price  ?? null,
    s:  fetchResult.sp500?.price   ?? null,
    r_stale: fetchResult.usdkrw_stale,
    k_stale: fetchResult.kospi?.stale  ?? true,
    n_stale: fetchResult.nasdaq?.stale ?? true,
    s_stale: fetchResult.sp500?.stale  ?? true,
    r_ts: fetchResult.usdkrw_ts     ?? null,
    k_ts: fetchResult.kospi?.dataTs  ?? null,
    n_ts: fetchResult.nasdaq?.dataTs ?? null,
    s_ts: fetchResult.sp500?.dataTs  ?? null,
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

function buildLatest(f, cachedLatest) {
  const nowTs = f.ts;

  // 延迟(秒)计算规则：
  //  - stale(这次抓取失败、用了旧值) → null（前端显示"/"，红点已经能说明问题，不重复用延迟栏提示错误）
  //  - 没有真实数据时间戳 → null
  //  - 跟上一次抓到的值完全相同 → 判定为盘前/盘后不再更新 → null（前端显示"/"）
  //  - 不在该指数的交易时段内 → null（前端显示"/"）——汇率不做这个限制，传 key=null 跳过
  //  - 否则 → 抓取时间 - 真实数据时间，秒
  const delay = (price, dataTs, stale, prevPrice, key) => {
    if (stale || dataTs == null) return null;
    if (key && prevPrice != null && price === prevPrice) return null;
    if (key) {
      const { open, close } = getMarketSessionTs(key, nowTs);
      if (nowTs < open || nowTs >= close) return null;
    }
    return Math.max(0, Math.round((nowTs - dataTs) / 1000));
  };

  return {
    usdkrw:           f.usdkrw,
    usdkrw_prev:      f.usdkrw_prev,
    usdkrw_data_ts:   f.usdkrw_ts,
    usdkrw_stale:     f.usdkrw_stale,
    usdkrw_delay_sec: delay(f.usdkrw, f.usdkrw_ts, f.usdkrw_stale, cachedLatest?.usdkrw, null),

    kospi_price:      f.kospi?.price        ?? null,
    kospi_prev:       f.kospi?.prevClose    ?? null,
    kospi_data_ts:    f.kospi?.dataTs       ?? null,
    kospi_stale:      f.kospi?.stale        ?? true,
    kospi_delay_sec:  delay(f.kospi?.price, f.kospi?.dataTs, f.kospi?.stale, cachedLatest?.kospi_price, 'kospi'),

    nasdaq_price:     f.nasdaq?.price       ?? null,
    nasdaq_prev:      f.nasdaq?.prevClose   ?? null,
    nasdaq_data_ts:   f.nasdaq?.dataTs      ?? null,
    nasdaq_stale:     f.nasdaq?.stale       ?? true,
    nasdaq_delay_sec: delay(f.nasdaq?.price, f.nasdaq?.dataTs, f.nasdaq?.stale, cachedLatest?.nasdaq_price, 'nasdaq'),

    sp500_price:      f.sp500?.price        ?? null,
    sp500_prev:       f.sp500?.prevClose    ?? null,
    sp500_data_ts:    f.sp500?.dataTs       ?? null,
    sp500_stale:      f.sp500?.stale        ?? true,
    sp500_delay_sec:  delay(f.sp500?.price, f.sp500?.dataTs, f.sp500?.stale, cachedLatest?.sp500_price, 'sp500'),

    errors:           f.errors,
    ts:               f.ts,
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

async function archiveDay(env, date, state = null, config = null) {
  try {
    if (!state) state = await loadState(env.FOREX_KV);
    if (!state?.chart?.length) return;
    if (!config) config = await loadConfig(env.FOREX_KV);

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
