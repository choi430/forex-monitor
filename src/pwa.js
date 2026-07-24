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
  .main-card-head { display:flex; justify-content:space-between; align-items:center; }
  .main-label { font-size:11px; color:var(--muted); letter-spacing:.06em;
                text-transform:uppercase; margin-bottom:4px; }
  .collapse-btn {
    background:none; border:1px solid var(--border); color:var(--muted);
    border-radius:6px; width:26px; height:26px; font-size:13px; line-height:1;
    cursor:pointer; flex-shrink:0; transition:transform .15s;
  }
  .collapse-btn.collapsed { transform:rotate(-90deg); }
  .chart-wrap.hidden { display:none; }
  .reset-zoom-btn {
    display:none; position:absolute; left:8px; top:6px; z-index:6;
    background:rgba(96,165,250,.15); border:1px solid var(--accent); color:var(--accent);
    font-size:10px; padding:3px 8px; border-radius:6px; cursor:pointer;
  }
  .reset-zoom-btn.show { display:block; }
  .zoom-hint {
    font-size:10px; color:var(--muted); text-align:center; margin-top:4px;
  }
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
  .idx-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px; gap:8px; }
  .idx-right  { display:flex; align-items:center; gap:8px; flex-shrink:0; }
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
  <div class="main-card-head">
    <div class="main-label">USD / KRW</div>
    <button class="collapse-btn" id="collapse-main" onclick="toggleCollapse('main')" aria-label="收起/展开图表">⌄</button>
  </div>
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
  <div class="chart-wrap" id="wrap-main" style="height:240px">
    <canvas id="main-chart" role="img" aria-label="USD/KRW日内走势"></canvas>
    <button class="reset-zoom-btn" id="reset-main" onclick="resetZoom('main')">↺ 重置缩放</button>
    <div class="delay-label" id="delay-main"></div>
    <div class="tooltip-box" id="tt">
      <div class="tt-time" id="tt-time">—</div>
      <div class="tt-row"><span class="tt-label">汇率</span><span class="tt-val" id="tt-val">—</span></div>
      <div class="tt-row"><span class="tt-label">变化率/分</span><span class="tt-val" id="tt-cr">—</span></div>
      <div class="tt-row"><span class="tt-label">延迟</span><span class="tt-val" id="tt-delay">—</span></div>
    </div>
  </div>
  <div class="zoom-hint" id="zoom-hint-main">双指或滚轮缩放 · 拖动平移 · 双击重置</div>
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
      <div class="idx-right">
        <div class="idx-hl" id="kospi-hl">—</div>
        <button class="collapse-btn" id="collapse-kospi" onclick="toggleCollapse('kospi')" aria-label="收起/展开图表">⌄</button>
      </div>
    </div>
    <div class="chart-wrap" id="wrap-kospi" style="height:240px">
      <canvas id="c-kospi" role="img" aria-label="KOSPI走势"></canvas>
      <button class="reset-zoom-btn" id="reset-kospi" onclick="resetZoom('kospi')">↺ 重置缩放</button>
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
      <div class="idx-right">
        <div class="idx-hl" id="nasdaq-hl">—</div>
        <button class="collapse-btn" id="collapse-nasdaq" onclick="toggleCollapse('nasdaq')" aria-label="收起/展开图表">⌄</button>
      </div>
    </div>
    <div class="chart-wrap" id="wrap-nasdaq" style="height:240px">
      <canvas id="c-nasdaq" role="img" aria-label="NASDAQ走势"></canvas>
      <button class="reset-zoom-btn" id="reset-nasdaq" onclick="resetZoom('nasdaq')">↺ 重置缩放</button>
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
      <div class="idx-right">
        <div class="idx-hl" id="sp500-hl">—</div>
        <button class="collapse-btn" id="collapse-sp500" onclick="toggleCollapse('sp500')" aria-label="收起/展开图表">⌄</button>
      </div>
    </div>
    <div class="chart-wrap" id="wrap-sp500" style="height:240px">
      <canvas id="c-sp500" role="img" aria-label="S&P 500走势"></canvas>
      <button class="reset-zoom-btn" id="reset-sp500" onclick="resetZoom('sp500')">↺ 重置缩放</button>
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
<script src="https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-zoom/2.0.1/chartjs-plugin-zoom.min.js"></script>
<script>
  // UMD 全局变量名在不同打包版本里不完全一致，逐个尝试，找到就注册
  (function registerZoomPlugin() {
    const candidate = window.ChartZoom || window['chartjs-plugin-zoom'] || window.chartjsPluginZoom;
    if (candidate && window.Chart) {
      window.Chart.register(candidate);
    } else {
      console.warn('[forex-monitor] chartjs-plugin-zoom 未能注册，缩放/平移功能将不可用');
    }
  })();
</script>
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

// 参考线右端点：如果最后一条数据就是"今天"（实时数据），延伸到当前时间；
// 如果是历史数据（最后一条数据不是今天），就用当天最后一条数据的时间作为右边界，
function chartRightBound(sorted, isHistorical) {
  const last = sorted[sorted.length - 1]?.ts;
  if (last == null) return Date.now();
  return isHistorical ? last : Math.max(last, Date.now());
}

// segment 字符串本身由后端 getSegment() 算出（跟 scheduler.js 的抓取节奏共用同一份逻辑），
// 这里只是把 key 映射成中文展示文案，不涉及任何时段/DST 计算。
const SEGMENT_LABELS = {
  HIGH: '高频时段', MID: '中频时段', LOW: '低频时段', INACTIVE: '休市中',
};
function segmentLabel(segment) {
  return SEGMENT_LABELS[segment] ?? '低频时段';
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

// ── Zoom/pan state ─────────────────────────────────────────────────────────
// 记录每个图表当前的自定义可视区间（用户手动缩放/平移后写入）。
// 为 null 表示"未缩放，跟随最新数据的完整区间"。跨每分钟刷新持久化，
// 这样用户放大观察某段时间后，下一次刷新不会把视图弹回全览。
const zoomRanges = { main: null, kospi: null, nasdaq: null, sp500: null };
// 每个图表当前渲染用的数据点数组（供缩放后"吸附"到真实数据点，避免 y 轴和第一个点之间出现空白）
const chartPoints = { main: null, kospi: null, nasdaq: null, sp500: null };

/** 在已按 x 升序排列的 points 里，找到 <= target 的最后一个点的 x；找不到就用第一个点的 x */
function snapMinToData(target, points) {
  if (!points || !points.length) return target;
  let lo = 0, hi = points.length - 1, ans = points[0].x;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].x <= target) { ans = points[mid].x; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

function onZoomOrPan(key, chart, naturalMin, naturalMax) {
  const xs = chart.scales.x;
  let min = xs.min, max = xs.max;
  const zoomed = min > naturalMin + 1000 || max < naturalMax - 1000;
  if (zoomed) {
    // 缩放/平移后可能停在两个数据点之间，导致最左侧数据点和 y 轴之间露出一截空白。
    // 把 min 吸附到 <= min 的那个真实数据点上，让第一个点正好贴在 y 轴上。
    const snapped = snapMinToData(min, chartPoints[key]);
    if (snapped !== min) {
      min = snapped;
      chart.options.scales.x.min = min;
      chart.update('none');
    }
  }
  zoomRanges[key] = zoomed ? { min, max } : null;
  showResetBtn(key, zoomed);
}

function showResetBtn(key, show) {
  const btn = document.getElementById('reset-' + key);
  if (btn) btn.classList.toggle('show', show);
}

function resetZoom(key) {
  zoomRanges[key] = null;
  showResetBtn(key, false);
  const chart = key === 'main' ? mainChart : idxCharts[key];
  if (!chart) return;
  // chart.resetZoom() 会回到"图表创建时的初始状态"，但我们为了让缩放跨刷新保持，
  // 创建时就是把上次的缩放区间当成初始状态传进去的 —— 所以不能用它，
  // 否则"重置"等于回到刚才那个缩放状态，看起来毫无反应。
  // limits.x.min/max 才是真正一直没变过的完整数据区间，重置就用这个。
  const limits = chart.options.plugins?.zoom?.limits?.x;
  if (limits) {
    chart.options.scales.x.min = limits.min;
    chart.options.scales.x.max = limits.max;
    chart.update('none');
  } else {
    chart.resetZoom();
  }
}

function resetAllZoomRanges() {
  ['main', 'kospi', 'nasdaq', 'sp500'].forEach(k => {
    zoomRanges[k] = null;
    showResetBtn(k, false);
  });
}

// ── Collapse/expand chart panels ──────────────────────────────────────────
// 折叠状态存 localStorage，跨会话记住用户偏好（这是真实部署到浏览器的页面，
// 不是 Claude Artifact 沙箱，localStorage 可以正常用）。
function toggleCollapse(key) {
  const wrap = document.getElementById('wrap-' + key);
  const btn  = document.getElementById('collapse-' + key);
  const collapsed = wrap.classList.toggle('hidden');
  btn.classList.toggle('collapsed', collapsed);
  btn.textContent = collapsed ? '›' : '⌄';
  try { localStorage.setItem('chart-collapsed:' + key, collapsed ? '1' : '0'); } catch {}
  if (!collapsed) {
    // 图表在隐藏（display:none）状态下创建/更新时尺寸会是 0，
    // 展开后需要手动 resize 一次才能正确显示
    const chart = key === 'main' ? mainChart : idxCharts[key];
    if (chart) requestAnimationFrame(() => chart.resize());
  }
}

function restoreCollapseState() {
  ['main', 'kospi', 'nasdaq', 'sp500'].forEach(key => {
    let collapsed = false;
    try { collapsed = localStorage.getItem('chart-collapsed:' + key) === '1'; } catch {}
    if (!collapsed) return;
    document.getElementById('wrap-' + key)?.classList.add('hidden');
    const btn = document.getElementById('collapse-' + key);
    if (btn) { btn.classList.add('collapsed'); btn.textContent = '›'; }
  });
}

// ── Chart options factory ─────────────────────────────────────────────────────
function chartOptions(ttId, ttTimeId, ttValId, ttCrId, ttDelayId, canvas, valFmt, crArr, points, maxX, session, localTz, marketOpen, chartKey) {
  // marketOpen 是理论开盘时间；如果实际数据比这晚才开始（比如当天刚部署、
  // 刚开始记录），axis 起点应该跟着真实数据走，而不是画一大截没有数据的空白。
  const naturalMin = points.length ? Math.max(marketOpen, points[0].x) : marketOpen;
  const naturalMax = maxX ?? points[points.length - 1]?.x;
  const zr = chartKey ? zoomRanges[chartKey] : null;
  if (chartKey) chartPoints[chartKey] = points;

  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: {
      legend:{ display:false }, tooltip:{ enabled:false },
      // chartKey 为空（暂不会发生，但保留兜底）时不启用缩放，避免报错
      zoom: chartKey ? {
        limits: { x: { min: naturalMin, max: naturalMax } }, // 不能缩小/平移到真实数据范围以外
        pan: {
          enabled: true, mode: 'x',
          onPanComplete: ({ chart }) => onZoomOrPan(chartKey, chart, naturalMin, naturalMax),
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x',
          onZoomComplete: ({ chart }) => onZoomOrPan(chartKey, chart, naturalMin, naturalMax),
        },
      } : undefined,
    },
    scales: {
      x: {
        type: 'linear',
        min: zr?.min ?? naturalMin,
        max: zr?.max ?? naturalMax,
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
function makeMainChart(crArr, sorted, daily, thresholds, isHistorical, marketOpen) {
  const ctx = document.getElementById('main-chart');
  if (mainChart) mainChart.destroy();

  const n = sorted.length;
  const xyData = sorted.map(p => ({ x: p.ts, y: p.r ?? null, dataTs: p.r_ts ?? null, stale: !!p.r_stale }));
  const overlays = [];

  const rightBound = chartRightBound(sorted, isHistorical);
  const tsRange = (v) => [{ x: marketOpen, y: v }, { x: rightBound, y: v }];

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
      v => fmt(v,2), crArr, xyData, rightBound, undefined, undefined, marketOpen, 'main'),
  });
  ctx.ondblclick = () => resetZoom('main');
  showResetBtn('main', !!zoomRanges.main);
}

// ── Make index chart ──────────────────────────────────────────────────────────
function makeIdxChart(key, xyData, crArr, color, session = null, staleData = [], localTz = null, marketOpen) {
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
      ctx, v => fmt(v,1), crArr, xyData, undefined, session, localTz, marketOpen, key
    ),
    plugins: [vlinePlugin],
  });
  ctx.ondblclick = () => resetZoom(key);
  showResetBtn(key, !!zoomRanges[key]);
}

// ── Render ────────────────────────────────────────────────────────────────────
function render(d, isHistorical = false) {
  const { latest, daily, chart, thresholds, session } = d;

  // Header
  if (isHistorical) {
    document.getElementById('upd-time').textContent  = d.date + ' (历史)';
    document.getElementById('cur-segment').textContent = '历史数据';
    document.getElementById('dot-live').classList.add('paused');
  } else {
    document.getElementById('upd-time').textContent  = cstLabel(latest.ts) + ' CST';
    document.getElementById('cur-segment').textContent = segmentLabel(session?.segment);
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
  makeMainChart(computeCR(sorted,'r'), sorted, daily, thresholds, isHistorical, session?.marketOpenTs);

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
    const idxSession = session?.[idx.key] ?? null;
    const staleData = sorted.filter(p => p[staleField]).map(p => ({ x: p.ts, y: p[idx.field] }));
    const localTz = idx.key === 'kospi'
      ? { offsetMs: 9 * 3600_000, abbr: 'KST' }  // 韩国时间，无夏令时
      : (session?.isUSDST
          ? { offsetMs: -4 * 3600_000, abbr: 'EDT' }  // 美东夏令时
          : { offsetMs: -5 * 3600_000, abbr: 'EST' }); // 美东冬令时
    makeIdxChart(idx.key, xyData, computeCR(sorted, idx.field), color, idxSession, staleData, localTz, session?.marketOpenTs);
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
  resetAllZoomRanges(); // 切换到别的交易日时，旧的缩放区间没有意义，清掉

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
  resetAllZoomRanges();
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
}

// ── Init ──────────────────────────────────────────────────────────────────────
restoreCollapseState();
loadDates();
refresh();
refreshTimer = setInterval(refresh, 60_000);
</script>
</body>
</html>`;
}
