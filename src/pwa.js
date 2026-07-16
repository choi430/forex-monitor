export function getPWAHtml() {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="汇率监控">
<title>汇率监控</title>
<style>
  :root {
    --bg:     #0f0f0f; --card:   #1a1a1a; --border: #2a2a2a;
    --text:   #f0f0f0; --muted:  #888;
    --up:     #f87171; --down:   #34d399; --accent: #60a5fa;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px; min-height: 100dvh;
    padding: env(safe-area-inset-top) env(safe-area-inset-right)
             env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  .header {
    display:flex; justify-content:space-between; align-items:center;
    padding:14px 16px 10px; border-bottom:1px solid var(--border);
  }
  .header-title { font-size:16px; font-weight:600; }
  .header-sub   { font-size:11px; color:var(--muted); text-align:right; line-height:1.6; }
  .dot-live { display:inline-block; width:7px; height:7px; border-radius:50%;
              background:var(--down); animation:pulse 2s infinite; margin-right:4px; }
  .dot-live.paused { background:var(--muted); animation:none; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  .seg-label { color:var(--accent); font-weight:500; }
  /* Date nav */
  .date-nav {
    display:flex; align-items:center; gap:8px;
    padding:8px 16px; border-bottom:1px solid var(--border);
  }
  .nav-btn {
    background:var(--card); border:1px solid var(--border); color:var(--text);
    border-radius:6px; padding:4px 14px; font-size:18px; cursor:pointer; line-height:1;
  }
  .nav-btn:disabled { opacity:.25; cursor:not-allowed; }
  .date-display { flex:1; text-align:center; font-size:13px; font-weight:500; }
  .live-btn {
    background:var(--accent); color:#000; border:none;
    border-radius:6px; padding:4px 10px; font-size:12px; font-weight:600; cursor:pointer;
    display:none;
  }
  /* Main card */
  .main-card {
    margin:12px 12px 6px; background:var(--card);
    border:1px solid var(--border); border-radius:14px; padding:16px;
  }
  .main-label { font-size:11px; color:var(--muted); letter-spacing:.06em;
                text-transform:uppercase; margin-bottom:4px; }
  .main-price { font-size:36px; font-weight:700; letter-spacing:-.5px; line-height:1; }
  .badges { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; }
  .badge { font-size:12px; font-weight:600; padding:3px 9px; border-radius:6px; }
  .badge.up   { background:#2d0d0d; color:var(--up); }
  .badge.down { background:#052e1c; color:var(--down); }
  .badge.neu  { background:#1e2a3a; color:var(--accent); }
  .range-row { display:flex; align-items:center; gap:8px; margin-top:12px;
               font-size:11px; color:var(--muted); }
  .range-bar { flex:1; height:5px; background:var(--border); border-radius:3px; position:relative; }
  .range-fill { position:absolute; height:100%; background:var(--accent); border-radius:3px; }
  .range-dot  { position:absolute; width:10px; height:10px; background:#fff;
                border-radius:50%; top:-2.5px; transform:translateX(-50%);
                box-shadow:0 0 0 2px var(--accent); }
  .chart-wrap { position:relative; margin-top:12px; }
  canvas { width:100% !important; }
  .tooltip-box {
    display:none; position:absolute; top:4px; background:#222;
    border:1px solid var(--border); border-radius:8px; padding:7px 10px;
    font-size:12px; z-index:5; pointer-events:none; white-space:nowrap;
  }
  .tooltip-box.show { display:block; }
  .tt-time  { color:var(--muted); font-size:11px; margin-bottom:4px; }
  .tt-row   { display:flex; justify-content:space-between; gap:14px; }
  .tt-label { color:var(--muted); }
  .tt-val   { font-weight:600; }
  .delay-label {
    position:absolute; right:8px; top:6px; font-size:10px; color:var(--muted);
    background:rgba(15,15,15,.7); padding:2px 6px; border-radius:5px; pointer-events:none;
  }
  .section-label {
    font-size:11px; color:var(--muted); letter-spacing:.06em;
    text-transform:uppercase; margin:12px 12px 6px;
  }
  .idx-card {
    margin:0 12px 10px; background:var(--card);
    border:1px solid var(--border); border-radius:12px; padding:14px;
  }
  .idx-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px; }
  .idx-left   { display:flex; align-items:baseline; gap:10px; }
  .idx-name   { font-size:11px; color:var(--muted); text-transform:uppercase;
                letter-spacing:.06em; margin-right:4px; }
  .idx-val    { font-size:20px; font-weight:600; }
  .idx-chg    { font-size:12px; font-weight:600; }
  .idx-chg.up   { color:var(--up); }
  .idx-chg.down { color:var(--down); }
  .idx-hl { font-size:10px; color:var(--muted); text-align:right; line-height:1.6; }
  .err-banner {
    margin:0 12px 8px; background:#2d0d0d; border:1px solid #5a1a1a;
    border-radius:10px; padding:8px 12px; font-size:12px; color:#f87171; display:none;
  }
  .footer {
    font-size:11px; color:var(--muted); text-align:center;
    padding:8px 16px 16px; border-top:1px solid var(--border); margin-top:4px;
  }
</style>
</head>
<body>

<div class="header">
  <span class="header-title">💱 汇率监控</span>
  <span class="header-sub">
    <span class="dot-live" id="dot-live"></span><span id="upd-time">加载中…</span><br>
    <span class="seg-label" id="cur-segment">—</span>
  </span>
</div>

<div class="date-nav">
  <button class="nav-btn" id="btn-prev" onclick="navDate(-1)" title="更早">‹</button>
  <span class="date-display" id="date-display">实时数据</span>
  <button class="nav-btn" id="btn-next" onclick="navDate(1)" disabled title="更新">›</button>
  <button class="live-btn" id="btn-live" onclick="goLive()">↑ 实时</button>
</div>

<div class="err-banner" id="err-banner"></div>

<div class="main-card">
  <div class="main-label">USD / KRW</div>
  <div class="main-price" id="main-price">—</div>
  <div class="badges">
    <span class="badge neu" id="badge-day">较上日 —</span>
    <span class="badge neu" id="badge-pos">区间 —</span>
  </div>
  <div class="range-row">
    <span id="range-low">—</span>
    <div class="range-bar">
      <div class="range-fill" id="range-fill" style="width:0%"></div>
      <div class="range-dot"  id="range-dot"  style="left:0%"></div>
    </div>
    <span id="range-high">—</span>
  </div>
  <div class="chart-wrap" style="height:240px">
    <canvas id="main-chart" role="img" aria-label="USD/KRW日内走势"></canvas>
    <div class="delay-label" id="delay-main"></div>
    <div class="tooltip-box" id="tt">
      <div class="tt-time" id="tt-time">—</div>
      <div class="tt-row"><span class="tt-label">汇率</span><span class="tt-val" id="tt-val">—</span></div>
      <div class="tt-row"><span class="tt-label">变化率/分</span><span class="tt-val" id="tt-cr">—</span></div>
      <div class="tt-row"><span class="tt-label">延迟</span><span class="tt-val" id="tt-delay">—</span></div>
    </div>
  </div>
</div>

<div class="section-label">主要指数</div>
<div id="idx-container">
  <div class="idx-card" id="card-kospi">
    <div class="idx-header">
      <div class="idx-left">
        <span class="idx-name">KOSPI</span>
        <span class="idx-val" id="kospi-val">—</span>
        <span class="idx-chg" id="kospi-chg">—</span>
      </div>
      <div class="idx-hl" id="kospi-hl">—</div>
    </div>
    <div class="chart-wrap" style="height:240px">
      <canvas id="c-kospi" role="img" aria-label="KOSPI走势"></canvas>
      <div class="delay-label" id="delay-kospi"></div>
      <div class="tooltip-box" id="tt-kospi">
        <div class="tt-time" id="tt-kospi-time">—</div>
        <div class="tt-row"><span class="tt-label">KOSPI</span><span class="tt-val" id="tt-kospi-val">—</span></div>
        <div class="tt-row"><span class="tt-label">变化率/分</span><span class="tt-val" id="tt-kospi-cr">—</span></div>
        <div class="tt-row"><span class="tt-label">延迟</span><span class="tt-val" id="tt-kospi-delay">—</span></div>
      </div>
    </div>
  </div>
  <div class="idx-card" id="card-nasdaq">
    <div class="idx-header">
      <div class="idx-left">
        <span class="idx-name">NASDAQ</span>
        <span class="idx-val" id="nasdaq-val">—</span>
        <span class="idx-chg" id="nasdaq-chg">—</span>
      </div>
      <div class="idx-hl" id="nasdaq-hl">—</div>
    </div>
    <div class="chart-wrap" style="height:240px">
      <canvas id="c-nasdaq" role="img" aria-label="NASDAQ走势"></canvas>
      <div class="delay-label" id="delay-nasdaq"></div>
      <div class="tooltip-box" id="tt-nasdaq">
        <div class="tt-time" id="tt-nasdaq-time">—</div>
        <div class="tt-row"><span class="tt-label">NASDAQ</span><span class="tt-val" id="tt-nasdaq-val">—</span></div>
        <div class="tt-row"><span class="tt-label">变化率/分</span><span class="tt-val" id="tt-nasdaq-cr">—</span></div>
        <div class="tt-row"><span class="tt-label">延迟</span><span class="tt-val" id="tt-nasdaq-delay">—</span></div>
      </div>
    </div>
  </div>
  <div class="idx-card" id="card-sp500">
    <div class="idx-header">
      <div class="idx-left">
        <span class="idx-name">S&amp;P 500</span>
        <span class="idx-val" id="sp500-val">—</span>
        <span class="idx-chg" id="sp500-chg">—</span>
      </div>
      <div class="idx-hl" id="sp500-hl">—</div>
    </div>
    <div class="chart-wrap" style="height:240px">
      <canvas id="c-sp500" role="img" aria-label="S&P 500走势"></canvas>
      <div class="delay-label" id="delay-sp500"></div>
      <div class="tooltip-box" id="tt-sp500">
        <div class="tt-time" id="tt-sp500-time">—</div>
        <div class="tt-row"><span class="tt-label">S&amp;P 500</span><span class="tt-val" id="tt-sp500-val">—</span></div>
        <div class="tt-row"><span class="tt-label">变化率/分</span><span class="tt-val" id="tt-sp500-cr">—</span></div>
        <div class="tt-row"><span class="tt-label">延迟</span><span class="tt-val" id="tt-sp500-delay">—</span></div>
      </div>
    </div>
  </div>
</div>

<div class="footer">Forex Monitor · Powered by Cloudflare Workers</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
// ── Constants ────────────────────────────────────────────────────────────────
const UP = '#f87171', DOWN = '#34d399', ACCENT = '#60a5fa', GRID = '#333';

function fmtDelay(sec) {
  if (sec < 60) return sec + '秒';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + '分' + s + '秒';
}
function fmtDelayLabel(sec) {
  return '延迟 ' + (sec == null ? '/' : fmtDelay(sec));
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n, d=2) => n == null ? '—'
  : n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtChg = pct => pct == null ? '—'
  : (pct >= 0 ? '▲ +' : '▼ ') + Math.abs(pct).toFixed(2) + '%';
const chgCls = pct => pct == null ? 'neu' : pct >= 0 ? 'up' : 'down';

function cstLabel(ts) {
  const d = new Date(ts + 8 * 3600_000);
  return String(d.getUTCHours()).padStart(2,'0')
       + ':' + String(d.getUTCMinutes()).padStart(2,'0');
}

function isUSDSTBrowser(refTs = Date.now()) {
  const d    = new Date(refTs);
  const year = d.getUTCFullYear();
  const mar1 = new Date(Date.UTC(year, 2, 1));
  const dstS = new Date(Date.UTC(year, 2, 1 + (7 - mar1.getUTCDay()) % 7 + 7, 7));
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const dstE = new Date(Date.UTC(year, 10, 1 + (7 - nov1.getUTCDay()) % 7, 6));
  return refTs >= dstS.getTime() && refTs < dstE.getTime();
}

// 指定日期（refTs 所在的 CST 日历日）的开盘时间戳（夏令时 5:00 CST / 冬令时 6:00 CST）。
// refTs 默认取当前时间，但查看历史数据时必须传入该天的实际时间戳，
// 否则历史数据全部早于"今天"的开盘时间，会被 x 轴 min 裁掉导致折线消失。
function marketOpenTs(refTs = Date.now()) {
  const isDST    = isUSDSTBrowser(refTs);
  const openMin  = isDST ? 300 : 360; // 分钟数：5:00 或 6:00
  const cstRef   = new Date(refTs + 8 * 3600_000);
  const y = cstRef.getUTCFullYear(), m = cstRef.getUTCMonth(), d = cstRef.getUTCDate();
  const midnightCstInUtcMs = Date.UTC(y, m, d) - 8 * 3600_000; // 当天 00:00 CST 对应的 UTC 时间戳
  return midnightCstInUtcMs + openMin * 60_000;
}

function getMarketSessionTs(key, refTs) {
  const isDST  = isUSDSTBrowser(refTs);
  const cstRef = new Date(refTs + 8 * 3600_000);
  const y = cstRef.getUTCFullYear(), mo = cstRef.getUTCMonth(), d = cstRef.getUTCDate();
  const midUtc = Date.UTC(y, mo, d) - 8 * 3600_000; // 当天 00:00 CST 对应的 UTC 时间戳

  if (key === 'kospi') {
    return {
      open:  midUtc + 8    * 3600_000,  // 08:00 CST
      close: midUtc + 14.5 * 3600_000,  // 14:30 CST
    };
  }
  // NASDAQ / S&P 500
  const openH  = isDST ? 21.5 : 22.5;  // EDT 21:30 / EST 22:30 CST
  const closeH = isDST ? 28   : 29;    // EDT 04:00 次日 / EST 05:00 次日 CST
  return {
    open:  midUtc + openH  * 3600_000,
    close: midUtc + closeH * 3600_000,
  };
}

// 参考线右端点：如果最后一条数据就是"今天"（实时数据），延伸到当前时间；
// 如果是历史数据（最后一条数据不是今天），就用当天最后一条数据的时间作为右边界，
function chartRightBound(sorted, isHistorical) {
  const last = sorted[sorted.length - 1]?.ts;
  if (last == null) return Date.now();
  return isHistorical ? last : Math.max(last, Date.now());
}

function currentSegment() {
  const now     = new Date();
  const cstH    = (now.getUTCHours() + 8) % 24;
  const cstM    = cstH * 60 + now.getUTCMinutes();
  const dow     = new Date(Date.now() + 8 * 3600_000).getUTCDay();
  const isDST   = isUSDSTBrowser();
  const openMin = isDST ? 300 : 360;

  if (dow === 0) return '休市中';
  if (dow === 6 && cstM >= openMin) return '休市中';
  if (dow === 1 && cstM < openMin) return '休市中';

  const ext  = cstM < 240 ? cstM + 1440 : cstM;
  const segs = [
    [240,  420,  '低频时段'],  // 新增：04:00–07:00
    [420,  450,  '中频时段'],
    [450,  540,  '高频时段'],
    [540,  810,  '中频时段'],
    [810,  930,  '高频时段'],
    [930,  1200, '低频时段'],
    [1200, 1350, '高频时段'],
    [1350, 1470, '中频时段'],
    [1470, 1680, '低频时段'],
  ];
  const s = segs.find(([a, b]) => ext >= a && ext < b);
  return s ? s[2] : '低频时段';
}

function computeCR(sorted, key) {
  return sorted.map((p, i) => {
    if (i === 0) return null;
    const prev = sorted[i-1];
    const v = p[key], pv = prev[key];
    if (v == null || pv == null || pv === 0) return null;
    const dt = (p.ts - prev.ts) / 60_000;
    return dt > 0 ? ((v - pv) / pv / dt) * 100 : null;
  });
}

// ── Chart instances ───────────────────────────────────────────────────────────
let mainChart = null;
const idxCharts = {};

// ── Chart options factory ─────────────────────────────────────────────────────
function chartOptions(ttId, ttTimeId, ttValId, ttCrId, ttDelayId, canvas, valFmt, crArr, points, maxX, session, localTz) {
  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend:{ display:false }, tooltip:{ enabled:false } },
    scales: {
      x: {
        type: 'linear',
        min: marketOpenTs(points[0]?.x),
        max: maxX ?? points[points.length - 1]?.x,
        bounds: 'data', // 禁止 Chart.js 为了凑"整齐刻度"把轴往外扩到超出真实数据范围
        grid: { color: GRID },
        ticks: {
          color:'#666', font:{ size:10 }, maxTicksLimit:6,
          callback: v => {
            const d = new Date(v + 8 * 3600_000);
            const cst = String(d.getUTCHours()).padStart(2,'0')
                 + ':' + String(d.getUTCMinutes()).padStart(2,'0');
            if (!localTz) return cst;
            const dl = new Date(v + localTz.offsetMs);
            const local = String(dl.getUTCHours()).padStart(2,'0')
                        + ':' + String(dl.getUTCMinutes()).padStart(2,'0');
            return [cst, local + ' ' + localTz.abbr];
          },
        },
      },
      y: {
        grid: { color: GRID },
        ticks: {
          color:'#666', font:{ size:10 },
          callback: v => v.toLocaleString('en-US', { maximumFractionDigits:0 }),
        },
        afterFit: axis => { axis.width = 42; },
      },
    },
    interaction: { mode:'index', intersect:false },
    onHover: (evt, els, chart) => {
      const tt = document.getElementById(ttId);
      if (!evt?.native || !points.length) { tt.classList.remove('show'); return; }
      // 不依赖 Chart.js 的 index/nearest 自动匹配（参考线、异动点等数据集点数不同，
      // 会导致匹配到错误的数组下标）。改为自己按鼠标位置在真实数据里找最近点。
      const xScale  = chart.scales.x;
      const cursorX = evt.native.offsetX;
      const t       = xScale.getValueForPixel(cursorX);
      let lo = 0, hi = points.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (points[mid].x < t) lo = mid + 1; else hi = mid;
      }
      if (lo > 0 && Math.abs(points[lo-1].x - t) < Math.abs(points[lo].x - t)) lo -= 1;
      const nearest  = points[lo];
      const pointPx  = xScale.getPixelForValue(nearest.x);
      if (Math.abs(pointPx - cursorX) > 15) { tt.classList.remove('show'); return; }
      const cr = crArr[lo];
      document.getElementById(ttTimeId).textContent = cstLabel(nearest.x);
      document.getElementById(ttValId).textContent  = valFmt(nearest.y);
      document.getElementById(ttCrId).textContent   =
        cr == null ? '—' : (cr >= 0 ? '+' : '') + cr.toFixed(4) + '%';
      if (ttDelayId) {
        // 延迟显示"/"的情况：这条数据是缓存旧值(stale)、没有真实数据时间、
        // 跟上一个点数值完全相同、或者这个点的时间根本不在该指数的交易时段内
        const prev = points[lo - 1];
        const isFlat  = session && prev != null && prev.y === nearest.y;
        const outside = session && (nearest.x < session.open || nearest.x >= session.close);
        document.getElementById(ttDelayId).textContent =
          (nearest.stale || nearest.dataTs == null || isFlat || outside)
            ? '/' : fmtDelay(Math.max(0, Math.round((nearest.x - nearest.dataTs) / 1000)));
      }
      tt.classList.add('show');
      const wrapRect = canvas.parentElement.getBoundingClientRect();
      let lx = evt.native.clientX - wrapRect.left + 10;
      if (lx > wrapRect.width - 150) lx -= 160;
      tt.style.left = lx + 'px';
    },
  };
}

// ── Make main chart ───────────────────────────────────────────────────────────
function makeMainChart(crArr, sorted, daily, thresholds, isHistorical) {
  const ctx = document.getElementById('main-chart');
  if (mainChart) mainChart.destroy();

  const n = sorted.length;
  const xyData = sorted.map(p => ({ x: p.ts, y: p.r ?? null, dataTs: p.r_ts ?? null, stale: !!p.r_stale }));
  const overlays = [];

  const rightBound = chartRightBound(sorted, isHistorical);
  const tsRange = (v) => [{ x: marketOpenTs(sorted[0]?.ts), y: v }, { x: rightBound, y: v }];

  // 条件3：日内高低线（虚线）
  if (daily?.high != null) overlays.push({
    data: tsRange(daily.high),
    borderColor: UP, borderWidth:1, borderDash:[5,3],
    pointRadius:0, fill:false, tension:0, order:5,
  });
  if (daily?.low != null) overlays.push({
    data: tsRange(daily.low),
    borderColor: DOWN, borderWidth:1, borderDash:[5,3],
    pointRadius:0, fill:false, tension:0, order:5,
  });

  // 条件4：阈值线（点线）
  if (thresholds?.high != null) overlays.push({
    data: tsRange(thresholds.high),
    borderColor:'#fbbf24', borderWidth:1, borderDash:[2,3],
    pointRadius:0, fill:false, tension:0, order:4,
  });
  if (thresholds?.low != null) overlays.push({
    data: tsRange(thresholds.low),
    borderColor:'#a78bfa', borderWidth:1, borderDash:[2,3],
    pointRadius:0, fill:false, tension:0, order:4,
  });

  // 条件2：异动点（橙色三角）
  const anomalyData = [];
  for (const pt of daily?.anomaly_points || []) {
    const idx = sorted.findIndex(p => Math.abs(p.ts - pt.ts) < 90_000);
    if (idx >= 0) anomalyData.push({ x: sorted[idx].ts, y: sorted[idx].r });
  }
  if (anomalyData.length) overlays.push({
    data: anomalyData,
    borderColor:'#fb923c', backgroundColor:'#fb923c',
    pointStyle:'triangle', pointRadius:4, pointHoverRadius:6,
    showLine:false, fill:false, order:2,
  });

  // 条件4：突破点（菱形），当天可能有多个
  const addBreachPoints = (points, color) => {
    if (!points?.length) return;
    const data = [];
    for (const pt of points) {
      const idx = sorted.findIndex(p => Math.abs(p.ts - pt.ts) < 90_000);
      if (idx >= 0) data.push({ x: sorted[idx].ts, y: sorted[idx].r });
    }
    if (data.length) overlays.push({
      data,
      borderColor: color, backgroundColor: color,
      pointStyle:'rectRot', pointRadius:5, pointHoverRadius:7,
      showLine:false, fill:false, order:2,
    });
  };
  addBreachPoints(daily?.th_high_points, '#fbbf24');
  addBreachPoints(daily?.th_low_points,  '#a78bfa');

  // 红点：这一条数据抓取失败、用了缓存旧值
  const staleData = sorted.filter(p => p.r_stale).map(p => ({ x: p.ts, y: p.r }));
  if (staleData.length) overlays.push({
    data: staleData,
    borderColor:'#ef4444', backgroundColor:'#ef4444',
    pointStyle:'circle', pointRadius:3, pointHoverRadius:5,
    showLine:false, fill:false, order:1,
  });

  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          data: xyData, borderColor: ACCENT, borderWidth:2,
          pointRadius:0, pointHoverRadius:4, pointHoverBackgroundColor: ACCENT,
          fill: true,
          backgroundColor: ctx2 => {
            const g = ctx2.chart.ctx.createLinearGradient(0,0,0,100);
            g.addColorStop(0,'rgba(96,165,250,.22)');
            g.addColorStop(1,'rgba(96,165,250,.02)');
            return g;
          },
          tension:0.35, spanGaps:true, order:10,
        },
        ...overlays,
      ],
    },
    options: chartOptions('tt','tt-time','tt-val','tt-cr','tt-delay', ctx,
      v => fmt(v,2), crArr, xyData, rightBound),
  });
}

// ── Make index chart ──────────────────────────────────────────────────────────
function makeIdxChart(key, xyData, crArr, color, session = null, staleData = [], localTz = null) {
  const ctx = document.getElementById('c-'+key);
  if (idxCharts[key]) idxCharts[key].destroy();

  const vlinePlugin = {
    id: 'vlines_' + key,
    afterDraw(chart) {
      if (!session) return;
      const xs = chart.scales.x;
      const ys = chart.scales.y;
      const c  = chart.ctx;
      const lc = 'rgba(200,200,200,0.35)';
      [{ ts: session.open, label: '开' }, { ts: session.close, label: '收' }].forEach(({ ts, label }) => {
        const px = xs.getPixelForValue(ts);
        if (px < xs.left || px > xs.right) return;
        c.save();
        c.beginPath();
        c.strokeStyle = lc;
        c.lineWidth   = 1;
        c.setLineDash([4, 3]);
        c.moveTo(px, ys.top);
        c.lineTo(px, ys.bottom);
        c.stroke();
        c.fillStyle = lc;
        c.font      = '10px -apple-system, sans-serif';
        c.textAlign = 'center';
        c.fillText(label, px, ys.top + 11);
        c.restore();
      });
    },
  };

  idxCharts[key] = new Chart(ctx, {
    type: 'line',
    data: {
      datasets:[
        {
          data: xyData,
          borderColor:color, borderWidth:1.8,
          pointRadius:0, pointHoverRadius:4, pointHoverBackgroundColor:color,
          fill:true, backgroundColor: color+'18', tension:0.35, spanGaps:true,
        },
        ...(staleData.length ? [{
          data: staleData,
          borderColor:'#ef4444', backgroundColor:'#ef4444',
          pointStyle:'circle', pointRadius:3, pointHoverRadius:5,
          showLine:false, fill:false, order:1,
        }] : []),
      ],
    },
    options: chartOptions(
      'tt-'+key, 'tt-'+key+'-time', 'tt-'+key+'-val', 'tt-'+key+'-cr', 'tt-'+key+'-delay',
      ctx, v => fmt(v,1), crArr, xyData, undefined, session, localTz
    ),
    plugins: [vlinePlugin],
  });
}

// ── Render ────────────────────────────────────────────────────────────────────
function render(d, isHistorical = false) {
  const { latest, daily, chart, thresholds } = d;

  // Header
  if (isHistorical) {
    document.getElementById('upd-time').textContent  = d.date + ' (历史)';
    document.getElementById('cur-segment').textContent = '历史数据';
    document.getElementById('dot-live').classList.add('paused');
  } else {
    document.getElementById('upd-time').textContent  = cstLabel(latest.ts) + ' CST';
    document.getElementById('cur-segment').textContent = currentSegment();
    document.getElementById('dot-live').classList.remove('paused');
  }

  // Main price
  document.getElementById('main-price').textContent = fmt(latest.usdkrw);
  document.getElementById('delay-main').textContent = fmtDelayLabel(latest.usdkrw_delay_sec ?? null);

  // Day change badge
  const dayChg = latest.usdkrw_prev
    ? ((latest.usdkrw - latest.usdkrw_prev) / latest.usdkrw_prev) * 100
    : null;
  const bdDay = document.getElementById('badge-day');
  bdDay.textContent = '较上日 ' + fmtChg(dayChg);
  bdDay.className   = 'badge ' + chgCls(dayChg);

  // Range bar
  const rng = daily.high - daily.low;
  const pos = rng > 0 ? ((latest.usdkrw - daily.low) / rng) * 100 : 50;
  document.getElementById('range-low').textContent  = fmt(daily.low);
  document.getElementById('range-high').textContent = fmt(daily.high);
  document.getElementById('range-fill').style.width = pos.toFixed(1) + '%';
  document.getElementById('range-dot').style.left   = pos.toFixed(1) + '%';
  const bdPos = document.getElementById('badge-pos');
  bdPos.textContent = '区间 ' + pos.toFixed(0) + '%';
  bdPos.className   = 'badge ' + (pos > 70 ? 'up' : pos < 30 ? 'down' : 'neu');

  // Sort chart oldest → newest
  const sorted = [...chart].reverse();

  // Main chart
  makeMainChart(computeCR(sorted,'r'), sorted, daily, thresholds, isHistorical);

  // Index cards
  const indices = [
    { key:'kospi',  field:'k', priceKey:'kospi_price',  prevKey:'kospi_prev'  },
    { key:'nasdaq', field:'n', priceKey:'nasdaq_price',  prevKey:'nasdaq_prev' },
    { key:'sp500',  field:'s', priceKey:'sp500_price',   prevKey:'sp500_prev'  },
  ];

  for (const idx of indices) {
    const price = latest[idx.priceKey];
    const prev  = latest[idx.prevKey];
    const chg   = price != null && prev != null ? ((price - prev) / prev) * 100 : null;

    document.getElementById(idx.key+'-val').textContent = fmt(price, 1);
    const chgEl = document.getElementById(idx.key+'-chg');
    chgEl.textContent = fmtChg(chg);
    chgEl.className   = 'idx-chg ' + chgCls(chg);
    document.getElementById('delay-'+idx.key).textContent = fmtDelayLabel(latest[idx.key+'_delay_sec'] ?? null);

    // Daily high/low from chart history
    const vals = sorted.map(p => p[idx.field]).filter(v => v != null);
    const hlEl = document.getElementById(idx.key+'-hl');
    if (vals.length > 1) {
      const lo = Math.min(...vals), hi = Math.max(...vals);
      hlEl.innerHTML = '最低 ' + fmt(lo,1) + '<br>最高 ' + fmt(hi,1);
    } else {
      hlEl.textContent = '—';
    }

    const color   = chg == null ? ACCENT : chg >= 0 ? UP : DOWN;
    const tsField    = idx.field + '_ts';
    const staleField = idx.field + '_stale';
    const xyData  = sorted.map(p => ({
      x: p.ts, y: p[idx.field] ?? null,
      dataTs: p[tsField] ?? null, stale: !!p[staleField],
    }));
    const session = getMarketSessionTs(idx.key, sorted[0]?.ts ?? Date.now());
    const staleData = sorted.filter(p => p[staleField]).map(p => ({ x: p.ts, y: p[idx.field] }));
        const localTz = idx.key === 'kospi'
      ? { offsetMs: 9 * 3600_000, abbr: 'KST' }  // 韩国时间，无夏令时
      : (isUSDSTBrowser(sorted[0]?.ts ?? Date.now())
          ? { offsetMs: -4 * 3600_000, abbr: 'EDT' }  // 美东夏令时
          : { offsetMs: -5 * 3600_000, abbr: 'EST' }); // 美东冬令时
    makeIdxChart(idx.key, xyData, computeCR(sorted, idx.field), color, session, staleData, localTz);
  }

  // Index order: US session after 20:00 CST → NASDAQ, S&P, KOSPI
  const refTs   = isHistorical ? (sorted[sorted.length - 1]?.ts ?? Date.now()) : Date.now();
  const cstHour = (new Date(refTs).getUTCHours() + 8) % 24;
  const isUS    = cstHour >= (d.us_session_start ?? 20);
  const order   = isUS ? ['nasdaq','sp500','kospi'] : ['kospi','nasdaq','sp500'];
  const cont    = document.getElementById('idx-container');
  order.forEach(k => cont.appendChild(document.getElementById('card-'+k)));

  // Errors (live only)
  const banner = document.getElementById('err-banner');
  if (!isHistorical && latest.errors?.length) {
    banner.style.display = 'block';
    banner.textContent   = '⚠️ ' + latest.errors.join(' | ');
  } else {
    banner.style.display = 'none';
  }
}

// ── Date navigation ───────────────────────────────────────────────────────────
let viewDate       = null;   // null = live
let availableDates = [];
let refreshTimer   = null;

async function loadDates() {
  try {
    const res = await fetch('/api/history/dates');
    availableDates = await res.json();
  } catch(e) {
    availableDates = [];
  }
  updateDateNav();
}

function updateDateNav() {
  const isLive = viewDate === null;
  document.getElementById('date-display').textContent = isLive ? '实时数据' : viewDate;
  document.getElementById('btn-live').style.display   = isLive ? 'none' : 'inline-block';

  // prev = older date; disable if on oldest available
  const idx = viewDate ? availableDates.indexOf(viewDate) : -1;
  document.getElementById('btn-prev').disabled =
    availableDates.length === 0 ||
    (!isLive && idx >= availableDates.length - 1);

  // next = newer date; disable in live mode
  document.getElementById('btn-next').disabled = isLive;
}

function navDate(dir) {
  // dir: -1 = go older, +1 = go newer
  if (dir === 1) {
    // newer
    if (viewDate === null) return;
    const idx = availableDates.indexOf(viewDate);
    if (idx <= 0) { goLive(); return; }
    viewHistory(availableDates[idx - 1]);
  } else {
    // older
    if (viewDate === null) {
      // go to most recent historical
      if (availableDates.length > 0) viewHistory(availableDates[0]);
    } else {
      const idx = availableDates.indexOf(viewDate);
      if (idx < availableDates.length - 1) viewHistory(availableDates[idx + 1]);
    }
  }
}

async function viewHistory(date) {
  // Stop live refresh
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  viewDate = date;
  updateDateNav();

  try {
    const res = await fetch('/api/history?date=' + date);
    if (!res.ok) { document.getElementById('upd-time').textContent = '该日数据不存在'; return; }
    const data = await res.json();
    // Use archived latest snapshot for accurate prev-close %
    render({ ...data, latest: data.latest ?? buildFakeLatest(data) }, true);
  } catch(e) {
    document.getElementById('upd-time').textContent = '加载失败：' + e.message;
  }
}

function buildFakeLatest(data) {
  // Fallback: build latest from last chart point if archived latest is missing
  const last = data.chart?.[0];
  if (!last) return {};
  return {
    usdkrw: last.r, usdkrw_prev: null,
    kospi_price: last.k, kospi_prev: null,
    nasdaq_price: last.n, nasdaq_prev: null,
    sp500_price: last.s, sp500_prev: null,
    errors: [], ts: last.ts,
  };
}

function goLive() {
  viewDate = null;
  updateDateNav();
  if (refreshTimer) clearInterval(refreshTimer);
  refresh();
  refreshTimer = setInterval(refresh, 60_000);
}

// ── Live data refresh ─────────────────────────────────────────────────────────
async function refresh() {
  if (viewDate !== null) return; // in history mode, don't refresh
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.latest && data.chart) render(data, false);
  } catch(e) {
    document.getElementById('upd-time').textContent = '加载失败：' + e.message;
  }
  document.getElementById('cur-segment').textContent = currentSegment();
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadDates();
refresh();
refreshTimer = setInterval(refresh, 60_000);
</script>
</body>
</html>`;
}
