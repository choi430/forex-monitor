import { pushAnomalyBuf } from './kv.js';
import { toCSTMinutes } from './config.js';

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

  if (!config.notify_all) return { state, notifications };

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

  // ── Condition 1: Regular Broadcast (clock-aligned) ────────────────────────
  if (config.notify_1) {
    const FOREX_START_MIN = 420; // 07:00 CST
    const cstMin     = toCSTMinutes(nowTs);
    const interval   = config.broadcast_interval;

    // Which broadcast slot are we currently in?
    const currentSlot = Math.floor((cstMin - FOREX_START_MIN) / interval);

    // Which slot did the last broadcast belong to?
    const lastTs    = daily.last_broadcast_ts ?? 0;
    const lastCstMin = lastTs > 0 ? toCSTMinutes(lastTs) : -9999;
    const lastSlot  = lastTs > 0
      ? Math.floor((lastCstMin - FOREX_START_MIN) / interval)
      : -1;

    if (currentSlot > lastSlot) {
      const segmentLabel = { HIGH: '高频时段', MID: '中频时段', LOW: '低频时段' }[segment] ?? segment;
      const lastSegLabel = lastTs > 0
        ? ({ HIGH: '高频时段', MID: '中频时段', LOW: '低频时段' }[toCSTMinutes(lastTs) < 450 ? 'HIGH'
            : toCSTMinutes(lastTs) < 810 ? 'MID'
            : toCSTMinutes(lastTs) < 930 ? 'HIGH'
            : toCSTMinutes(lastTs) < 1200 ? 'LOW'
            : toCSTMinutes(lastTs) < 1350 ? 'HIGH'
            : toCSTMinutes(lastTs) < 1470 ? 'MID' : 'LOW'] ?? segmentLabel)
        : segmentLabel;

      const label = lastSegLabel === segmentLabel
        ? segmentLabel
        : `${lastSegLabel} → ${segmentLabel}`;

      notifications.push({ type: 'broadcast', reason: `定期播报 · ${label}` });
      daily.last_broadcast_ts = nowTs;
    }
  }

  // ── Condition 2: Anomaly Detection (no cooldown) ─────────────────────────
  if (config.notify_2 && anomalyBuf.length >= 10) {
    const rates = anomalyBuf.map(p => Math.abs(p.cr));  // 取绝对值
    const mean  = rates.reduce((a, b) => a + b, 0) / rates.length;
    const std   = Math.sqrt(
      rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length,
    );

    // Only trigger if std is meaningful (avoid division-by-zero noise)
    if (std > 0.0001 && Math.abs(changeRatePerMin) > mean + config.n_value * std) {
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

  // ── Condition 3: Session High / Low Touch (30-min cooldown) ──────────────
  if (config.notify_3) {
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

  // ── Condition 4: Absolute Threshold (once per threshold per day) ──────────
  if (config.notify_4) {
    if (
      config.threshold_high != null &&
      !daily.th_high_triggered &&
      usdkrw >= config.threshold_high
    ) {
      notifications.push({
        type:   'th_high',
        reason: `突破高位阈值 ${config.threshold_high}`,
      });
      daily.th_high_triggered = true;
    }

    if (
      config.threshold_low != null &&
      !daily.th_low_triggered &&
      usdkrw <= config.threshold_low
    ) {
      notifications.push({
        type:   'th_low',
        reason: `跌破低位阈值 ${config.threshold_low}`,
      });
      daily.th_low_triggered = true;
    }
  }

  // ── Return updated state ──────────────────────────────────────────────────
  return {
    state: { ...state, daily, anomaly_buf: anomalyBuf },
    notifications,
  };
}
