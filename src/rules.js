import { pushAnomalyBuf } from './kv.js';
import { toCSTMinutes, isUSDST } from './config.js';

/**
 * Evaluate all push conditions against current data.
 *
 * Returns { state, notifications[] }
 *   state      — updated state object (caller must save to KV)
 *   notifications — array of triggered notification descriptors
 *
 * Notification shape:
 *   { type, reason, data }
 *   type: 'broadcast' | 'anomaly' | 'high' | 'low' | 'th_high' | 'th_low'
 */
export function evaluateRules(state, config, fetchResult, nowTs, segment = 'UNKNOWN') {
  const notifications = [];

  const { usdkrw } = fetchResult;
  if (usdkrw == null) return { state, notifications }; // no rate → skip

  // Work on a shallow-cloned daily object so mutations are explicit
  const daily = { ...state.daily };

  // ── Update session high / low ─────────────────────────────────────────────
  let newHigh = false;
  let newLow  = false;

  if (usdkrw > daily.high) { daily.high = usdkrw; newHigh = true; }
  if (usdkrw < daily.low)  { daily.low  = usdkrw; newLow  = true; }

  // ── Update anomaly rolling buffer ─────────────────────────────────────────
  // Compute per-minute change rate from the most recent buffer entry
  let changeRatePerMin = 0;
  if (state.anomaly_buf.length > 0) {
    const prev     = state.anomaly_buf[0];
    const diffMin  = (nowTs - prev.ts) / 60_000;
    if (diffMin > 0) {
      changeRatePerMin = ((usdkrw - prev.rate) / prev.rate / diffMin) * 100;
    }
  }

  const newEntry  = { ts: nowTs, rate: usdkrw, cr: changeRatePerMin };
  const anomalyBuf = pushAnomalyBuf(
    state.anomaly_buf,
    newEntry,
    config.rolling_window,
  );

  // ── Condition 1: Regular Broadcast (24h clock-aligned from market open) ───
  if (config.notify_all && config.notify_1) {
    const MARKET_OPEN = isUSDST(nowTs) ? 300 : 360;
    const interval    = config.broadcast_interval;

    // 使用普通CST分钟（非extended），对24h窗口做模运算连续编号
    const _d          = new Date(nowTs + 8 * 3600_000);
    const cstMinNow   = _d.getUTCHours() * 60 + _d.getUTCMinutes();
    const tradingNow  = (cstMinNow - MARKET_OPEN + 1440) % 1440;
    const currentSlot = Math.floor(tradingNow / interval);

    const lastTs = daily.last_broadcast_ts ?? 0;
    let lastSlot = -1;
    if (lastTs > 0) {
      const _dl        = new Date(lastTs + 8 * 3600_000);
      const cstMinLast = _dl.getUTCHours() * 60 + _dl.getUTCMinutes();
      lastSlot = Math.floor(((cstMinLast - MARKET_OPEN + 1440) % 1440) / interval);
    }

    if (currentSlot > lastSlot) {
      const segmentLabel = { HIGH: '高频时段', MID: '中频时段', LOW: '低频时段' }[segment] ?? segment;
      const lastCstMinExt = lastTs > 0 ? toCSTMinutes(lastTs) : -9999;
      const lastSegLabel  = lastTs > 0
        ? ({ HIGH: '高频时段', MID: '中频时段', LOW: '低频时段' }[
            lastCstMinExt < 420  ? 'LOW'
            : lastCstMinExt < 450  ? 'MID'
            : lastCstMinExt < 540  ? 'HIGH'
            : lastCstMinExt < 810  ? 'MID'
            : lastCstMinExt < 930  ? 'HIGH'
            : lastCstMinExt < 1200 ? 'LOW'
            : lastCstMinExt < 1350 ? 'HIGH'
            : lastCstMinExt < 1470 ? 'MID' : 'LOW'
          ] ?? segmentLabel)
        : segmentLabel;

      const label = lastSegLabel === segmentLabel
        ? segmentLabel
        : `${lastSegLabel} → ${segmentLabel}`;

      notifications.push({ type: 'broadcast', reason: `定期播报 · ${label}` });
      daily.last_broadcast_ts = nowTs;
    }
  }

  // ── Condition 2: Anomaly Detection (no cooldown) ─────────────────────────
  // 检测和记录（供图表画异动三角）不受通知开关影响，只有"要不要推送"才判断开关
  if (state.anomaly_buf.length >= Math.min(10, config.rolling_window)) {
    const rates = state.anomaly_buf.map(p => Math.abs(p.cr));
    const mean  = rates.reduce((a, b) => a + b, 0) / rates.length;
    const std   = Math.sqrt(
      rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length,
    );

    // Only trigger if std is meaningful (avoid division-by-zero noise)
    if (std > 0.0001 && Math.abs(changeRatePerMin) > mean + config.n_value * std) {
      // 记录异动点，最多保留50个（图表标记，始终记录）
      daily.anomaly_points = [...(daily.anomaly_points ?? [])];
      daily.anomaly_points.push({ ts: nowTs, rate: usdkrw, dir: changeRatePerMin > 0 ? 'up' : 'down' });
      if (daily.anomaly_points.length > 50) daily.anomaly_points.splice(0, daily.anomaly_points.length - 50);

      if (config.notify_all && config.notify_2) {
        const dir = changeRatePerMin > 0 ? '快速上涨 ▲' : '快速下跌 ▼';
        notifications.push({
          type:   'anomaly',
          reason: `汇率异动：${dir}`,
          extra:  {
            changeRatePerMin,
            mean:      mean.toFixed(4),
            std:       std.toFixed(4),
            threshold: (Math.abs(mean) + config.n_value * std).toFixed(4),
          },
        });
      }
    }
  }

  // ── Condition 3: Session High / Low Touch (30-min cooldown) ──────────────
  if (config.notify_all && config.notify_3) {
    const cooldownMs = config.cooldown_3 * 60_000;

    if (newHigh) {
      const lastTs   = daily.c3_high_ts ?? 0;
      if (nowTs - lastTs >= cooldownMs) {
        notifications.push({ type: 'high', reason: '触及日内最高点' });
        daily.c3_high_ts = nowTs;
      }
    }

    if (newLow) {
      const lastTs = daily.c3_low_ts ?? 0;
      if (nowTs - lastTs >= cooldownMs) {
        notifications.push({ type: 'low', reason: '触及日内最低点' });
        daily.c3_low_ts = nowTs;
      }
    }
  }

  // ── Condition 4: Absolute Threshold（每次抓取只要触及阈值就记录+推送，不限次数）
  // 检测和记录（供图表画突破菱形）不受通知开关影响，只有"要不要推送"才判断开关
  let configPatch = null;

  if (config.threshold_high != null && usdkrw >= config.threshold_high) {
    daily.th_high_points = [...(daily.th_high_points ?? [])];
    daily.th_high_points.push({ ts: nowTs, rate: usdkrw });
    if (daily.th_high_points.length > 50) daily.th_high_points.splice(0, daily.th_high_points.length - 50);

    const newThreshold = config.threshold_high + 5;
    configPatch = { ...(configPatch ?? {}), threshold_high: newThreshold };

    if (config.notify_all && config.notify_4) {
      notifications.push({
        type:   'th_high',
        reason: `突破高位阈值 ${config.threshold_high}（已自动上调至 ${newThreshold}）`,
      });
    }
  }

  if (config.threshold_low != null && usdkrw <= config.threshold_low) {
    daily.th_low_points = [...(daily.th_low_points ?? [])];
    daily.th_low_points.push({ ts: nowTs, rate: usdkrw });
    if (daily.th_low_points.length > 50) daily.th_low_points.splice(0, daily.th_low_points.length - 50);

    const newThreshold = config.threshold_low - 5;
    configPatch = { ...(configPatch ?? {}), threshold_low: newThreshold };

    if (config.notify_all && config.notify_4) {
      notifications.push({
        type:   'th_low',
        reason: `跌破低位阈值 ${config.threshold_low}（已自动下调至 ${newThreshold}）`,
      });
    }
  }

  // ── Return updated state ──────────────────────────────────────────────────
  return {
    state: { ...state, daily, anomaly_buf: anomalyBuf },
    notifications,
    configPatch, // 触碰阈值后要写回配置的变更，没有触碰就是 null
  };
}
