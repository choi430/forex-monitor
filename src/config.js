// ─── KV Keys ────────────────────────────────────────────────────────────────
export const KV = {
  STATE:        'state',         // main state: daily data + anomaly buffer + chart history
  CONFIG:       'config',        // user-configurable parameters
  FEISHU_TOKEN: 'feishu_token',  // cached Feishu tenant access token
};

// ─── Default User-Configurable Parameters ───────────────────────────────────
export const DEFAULT_CONFIG = {
  // Fetch intervals per time segment (minutes)
  interval_high: 1,
  interval_mid:  3,
  interval_low:  15,

  // Regular broadcast interval (minutes)
  broadcast_interval: 60,

  // Condition 2 — anomaly detection
  n_value:        2.0,   // standard deviation multiplier
  rolling_window: 30,    // number of data points in rolling buffer

  // Condition 3 — daily high/low cooldown (minutes)
  cooldown_3: 30,

  // Condition 4 — absolute price thresholds (null = disabled)
  threshold_high: null,
  threshold_low:  null,

  // Notification toggles
  notify_all: true,  // master switch
  notify_1:   true,  // regular broadcast
  notify_2:   true,  // anomaly detection
  notify_3:   true,  // daily high/low touch
  notify_4:   true,  // absolute threshold

  us_session_start: 20,  // 美股时段起始小时（CST），之后 KOSPI 排到最后
};

// ─── Time Segments ──────────────────────────────────────────────────────────
// All times in "extended CST minutes":
//   00:00–04:00 CST is stored as 1440–1680 so the forex window
//   (07:00 → 04:00 next day) is a single continuous range [420, 1680].
//
//  07:00–07:30  MID   420–450
//  07:30–09:00  HIGH  450–540   KOSPI open window
//  09:00–13:30  MID   540–810   KOSPI mid-session
//  13:30–15:30  HIGH  810–930   KOSPI close window
//  15:30–20:00  LOW   930–1200  gap between markets
//  20:00–22:30  HIGH  1200–1350 US open window
//  22:30–00:30  MID   1350–1470 US mid-session
//  00:30–04:00  LOW   1470–1680 US late / after-hours
//  04:00–07:00  INACTIVE        outside forex window
export const TIME_SEGMENTS = [
  { start: 420,  end: 450,  type: 'MID'  },
  { start: 450,  end: 540,  type: 'HIGH' },
  { start: 540,  end: 810,  type: 'MID'  },
  { start: 810,  end: 930,  type: 'HIGH' },
  { start: 930,  end: 1200, type: 'LOW'  },
  { start: 1200, end: 1350, type: 'HIGH' },
  { start: 1350, end: 1470, type: 'MID'  },
  { start: 1470, end: 1680, type: 'LOW'  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert a Unix timestamp to "extended CST minutes".
 * 00:00–04:00 CST → 1440–1680 so the overnight window is continuous.
 */
export function toCSTMinutes(ts) {
  const cstDate = new Date(ts + 8 * 3600_000);
  const m = cstDate.getUTCHours() * 60 + cstDate.getUTCMinutes();
  return m < 4 * 60 ? m + 1440 : m;
}

/**
 * Return the "trading date" string (yyyy-mm-dd, CST) for a timestamp.
 * The trading window resets at 07:00 CST, so 00:00–07:00 belongs to
 * the previous calendar day's session.
 */
export function tradingDate(ts) {
  const cstDate = new Date(ts + 8 * 3600_000);
  if (cstDate.getUTCHours() < 7) {
    cstDate.setUTCDate(cstDate.getUTCDate() - 1);
  }
  return cstDate.toISOString().slice(0, 10);
}

/** Current time formatted as HH:MM CST */
export function cstTimeStr(ts) {
  const d = new Date(ts + 8 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} CST`;
}

/** Format a number as a price string with commas */
export function fmtPrice(n, decimals = 2) {
  return n == null ? 'N/A' : n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format a change percentage with sign and arrow */
export function fmtChg(pct) {
  if (pct == null) return 'N/A';
  const arrow = pct >= 0 ? '▲' : '▼';
  return `${arrow} ${Math.abs(pct).toFixed(3)}%`;
}
