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
    display: flex; justify-content: space-between; align-items: center;
    padding: 14px 16px 10px; border-bottom: 1px solid var(--border);
  }
  .header-title { font-size: 16px; font-weight: 600; }
  .header-sub   { font-size: 11px; color: var(--muted); text-align: right; line-height: 1.6; }
  .dot-live { display: inline-block; width: 7px; height: 7px;
              border-radius: 50%; background: var(--down);
              animation: pulse 2s infinite; margin-right: 4px; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  .seg-label { color: var(--accent); font-weight: 500; }
  .main-card {
    margin: 12px 12px 6px; background: var(--card);
    border: 1px solid var(--border); border-radius: 14px; padding: 16px;
  }
  .main-label { font-size: 11px; color: var(--muted); letter-spacing:.06em;
                text-transform: uppercase; margin-bottom: 4px; }
  .main-price { font-size: 36px; font-weight: 700; letter-spacing:-.5px; line-height:1; }
  .badges { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; }
  .badge { font-size:12px; font-weight:600; padding:3px 9px; border-radius:6px; }
  .badge.up  { background:#2d0d0d; color:var(--up); }
  .badge.down { background:#052e1c; color:var(--down); }
  .badge.neu { background:#1e2a3a; color:var(--accent); }
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
  .section-label {
    font-size:11px; color:var(--muted); letter-spacing:.06em;
    text-transform:uppercase; margin:12px 12px 6px;
  }
  .idx-card {
    margin: 0 12px 10px; background:var(--card);
    border:1px solid var(--border); border-radius:12px; padding:14px;
  }
  .idx-header {
    display:flex; justify-content:space-between; align-items:flex-start;
    margin-bottom:4px;
  }
  .idx-left { display:flex; align-items:baseline; gap:10px; }
  .idx-name { font-size:11px; color:var(--muted); text-transform:uppercase;
              letter-spacing:.06em; margin-right:4px; }
  .idx-val  { font-size:20px; font-weight:600; }
  .idx-chg  { font-size:12px; font-weight:600; }
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
    <span class="dot-live"></span><span id="upd-time">加载中…</span><br>
    <span class="seg-label" id="cur-segment">—</span>
  </span>
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
  <div class="chart-wrap" style="height:100px">
    <canvas id="main-chart" role="img" aria-label="USD/KRW日内走势"></canvas>
    <div class="tooltip-box" id="tt">
      <div class="tt-time" id="tt-time">—</div>
      <div class="tt-row"><span class="tt-label">汇率</span><span class="tt-val" id="tt-val">—</span></div>
      <div class="tt-row"><span class="tt-label">变化率/分</span><span class="tt-val" id="tt-cr">—</span></div>
    </div>
  </div>
</div>

<div class="section-label">主要指数</div>
<div id="idx-container">
  <div class="idx-card" id="card-kospi"> ... </div>
  <div class="idx-card" id="card-nasdaq"> ... </div>
  <div class="idx-card" id="card-sp500"> ... </div>
</div>

<div class="idx-card" id="card-kospi">
  <div class="idx-header">
    <div class="idx-left">
      <span class="idx-name">KOSPI</span>
      <span class="idx-val" id="kospi-val">—</span>
      <span class="idx-chg" id="kospi-chg">—</span>
    </div>
    <div class="idx-hl" id="kospi-hl">—</div>
  </div>
  <div class="chart-wrap" style="height:120px">
    <canvas id="c-kospi" role="img" aria-label="KOSPI走势"></canvas>
    <div class="tooltip-box" id="tt-kospi">
      <div class="tt-time" id="tt-kospi-time">—</div>
      <div class="tt-row"><span class="tt-label">KOSPI</span><span class="tt-val" id="tt-kospi-val">—</span></div>
      <div class="tt-row"><span class="tt-label">变化率/分</span><span class="tt-val" id="tt-kospi-cr">—</span></div>
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
  <div class="chart-wrap" style="height:120px">
    <canvas id="c-nasdaq" role="img" aria-label="NASDAQ走势"></canvas>
    <div class="tooltip-box" id="tt-nasdaq">
      <div class="tt-time" id="tt-nasdaq-time">—</div>
      <div class="tt-row"><span class="tt-label">NASDAQ</span><span class="tt-val" id="tt-nasdaq-val">—</span></div>
      <div class="tt-row"><span class="tt-label">变化率/分</span><span class="tt-val" id="tt-nasdaq-cr">—</span></div>
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
  <div class="chart-wrap" style="height:120px">
    <canvas id="c-sp500" role="img" aria-label="S&P 500走势"></canvas>
    <div class="tooltip-box" id="tt-sp500">
      <div class="tt-time" id="tt-sp500-time">—</div>
      <div class="tt-row"><span class="tt-label">S&amp;P 500</span><span class="tt-val" id="tt-sp500-val">—</span></div>
      <div class="tt-row"><span class="tt-label">变化率/分</span><span class="tt-val" id="tt-sp500-cr">—</span></div>
    </div>
  </div>
</div>

<div class="footer">Forex Monitor · Powered by Cloudflare Workers</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
// ── Constants ────────────────────────────────────────────────────────────────
const UP = '#f87171', DOWN = '#34d399', ACCENT = '#60a5fa', GRID = '#333';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n, d=2) => n == null ? '—'
  : n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtChg = pct => pct == null ? '—'
  : (pct >= 0 ? '▲ +' : '▼ ') + Math.abs(pct).toFixed(2) + '%';
const chgCls = pct => pct == null ? 'neu' : pct >= 0 ? 'up' : 'down';

function cstLabel(ts) {
  const d = new Date(ts + 8 * 3600_000);
  return String(d.getUTCHours()).padStart(2,'0')
       + ':' + String(d.getUTCMinutes()).padStart(2,'0');
}

function currentSegment() {
  const now  = new Date();
  const cstM = ((now.getUTCHours() + 8) % 24) * 60 + now.getUTCMinutes();
  const ext  = cstM < 240 ? cstM + 1440 : cstM;
  const segs = [
    [420,450,'中频时段'],[450,540,'高频时段'],[540,810,'中频时段'],
    [810,930,'高频时段'],[930,1200,'低频时段'],[1200,1350,'高频时段'],
    [1350,1470,'中频时段'],[1470,1680,'低频时段'],
  ];
  const s = segs.find(([a,b]) => ext >= a && ext < b);
  return s ? s[2] : '休市中';
}

// ── Change rate computation ───────────────────────────────────────────────────
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

// Per-chart hover state
const hoverState = { main: [], kospi: [], nasdaq: [], sp500: [] };

// ── Make main chart ───────────────────────────────────────────────────────────
function makeMainChart(labels, data, crArr, sorted, daily, thresholds) {
  hoverState.main = crArr;
  const ctx = document.getElementById('main-chart');
  if (mainChart) mainChart.destroy();
  const n = sorted.length;

  // 叠加数据集
  const overlays = [];

  // 条件3：日内最高线（红色虚线）
  if (daily?.high != null) overlays.push({
    data: new Array(n).fill(daily.high),
    borderColor: UP, borderWidth: 1,
    borderDash: [5, 3], pointRadius: 0,
    fill: false, tension: 0, order: 5,
  });

  // 条件3：日内最低线（绿色虚线）
  if (daily?.low != null) overlays.push({
    data: new Array(n).fill(daily.low),
    borderColor: DOWN, borderWidth: 1,
    borderDash: [5, 3], pointRadius: 0,
    fill: false, tension: 0, order: 5,
  });

  // 条件4：高位阈值线（琥珀色点线）
  if (thresholds?.high != null) overlays.push({
    data: new Array(n).fill(thresholds.high),
    borderColor: '#fbbf24', borderWidth: 1,
    borderDash: [2, 3], pointRadius: 0,
    fill: false, tension: 0, order: 4,
  });

  // 条件4：低位阈值线（紫色点线）
  if (thresholds?.low != null) overlays.push({
    data: new Array(n).fill(thresholds.low),
    borderColor: '#a78bfa', borderWidth: 1,
    borderDash: [2, 3], pointRadius: 0,
    fill: false, tension: 0, order: 4,
  });

  // 条件2：异动点（橙色三角形）
  const anomalyData = new Array(n).fill(null);
  for (const pt of daily?.anomaly_points || []) {
    const idx = sorted.findIndex(p => Math.abs(p.ts - pt.ts) < 90_000);
    if (idx >= 0) anomalyData[idx] = sorted[idx].r;
  }
  if (anomalyData.some(v => v !== null)) overlays.push({
    data: anomalyData,
    borderColor: '#fb923c', backgroundColor: '#fb923c',
    pointStyle: 'triangle', pointRadius: 6, pointHoverRadius: 8,
    showLine: false, fill: false, order: 1,
  });

  // 条件4：高位阈值突破点（琥珀色菱形）
  if (daily?.th_high_ts) {
    const breachData = new Array(n).fill(null);
    const idx = sorted.findIndex(p => Math.abs(p.ts - daily.th_high_ts) < 90_000);
    if (idx >= 0) { breachData[idx] = sorted[idx].r; overlays.push({
      data: breachData,
      borderColor: '#fbbf24', backgroundColor: '#fbbf24',
      pointStyle: 'rectRot', pointRadius: 7, pointHoverRadius: 9,
      showLine: false, fill: false, order: 1,
    }); }
  }

  // 条件4：低位阈值突破点（紫色菱形）
  if (daily?.th_low_ts) {
    const breachData = new Array(n).fill(null);
    const idx = sorted.findIndex(p => Math.abs(p.ts - daily.th_low_ts) < 90_000);
    if (idx >= 0) { breachData[idx] = sorted[idx].r; overlays.push({
      data: breachData,
      borderColor: '#a78bfa', backgroundColor: '#a78bfa',
      pointStyle: 'rectRot', pointRadius: 7, pointHoverRadius: 9,
      showLine: false, fill: false, order: 1,
    }); }
  }

  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data, borderColor: ACCENT, borderWidth: 2,
          pointRadius: 0, pointHoverRadius: 5,
          pointHoverBackgroundColor: ACCENT,
          fill: true,
          backgroundColor: ctx2 => {
            const g = ctx2.chart.ctx.createLinearGradient(0,0,0,100);
            g.addColorStop(0,'rgba(96,165,250,.22)');
            g.addColorStop(1,'rgba(96,165,250,.02)');
            return g;
          },
          tension: 0.35, spanGaps: true, order: 10,
        },
        ...overlays,
      ],
    },
    options: chartOptions('tt', 'tt-time', 'tt-val', 'tt-cr', ctx,
      v => fmt(v, 2), crArr, labels),
  });
}

// ── Make index chart ──────────────────────────────────────────────────────────
function makeIdxChart(key, canvasId, ttId, labels, data, crArr, color) {
  hoverState[key] = crArr;
  const ctx = document.getElementById(canvasId);
  if (idxCharts[key]) idxCharts[key].destroy();
  idxCharts[key] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data, borderColor: color, borderWidth: 1.8,
        pointRadius: 0, pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        fill: true,
        backgroundColor: color + '18',
        tension: 0.35, spanGaps: true,
      }],
    },
    options: chartOptions(ttId, ttId+'-time', ttId+'-val', ttId+'-cr', ctx,
      v => fmt(v, 1), crArr, labels),
  });
}

// ── Shared chart options factory ──────────────────────────────────────────────
function chartOptions(ttId, ttTimeId, ttValId, ttCrId, canvas, valFmt, crArr, labels) {
  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: {
        grid: { color: GRID },
        ticks: { color: '#666', font: { size: 10 }, maxTicksLimit: 6 },
      },
      y: {
        grid: { color: GRID },
        ticks: {
          color: '#666', font: { size: 10 },
          callback: v => v.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        },
        afterFit: (axis) => { axis.width = 42; },
      },
    },
    interaction: { mode: 'index', intersect: false },
    onHover: (evt, els) => {
      const tt = document.getElementById(ttId);
      if (!els.length) { tt.classList.remove('show'); return; }
      const i  = els[0].index;
      const cr = crArr[i];
      document.getElementById(ttTimeId).textContent = labels[i];
      const mainEl = els.find(e => e.datasetIndex === 0);
      if (!mainEl) { document.getElementById(ttId).classList.remove('show'); return; }
      document.getElementById(ttValId).textContent = valFmt(mainEl.element.$context.parsed.y);
      document.getElementById(ttCrId).textContent   =
        cr == null ? '—' : (cr >= 0 ? '+' : '') + cr.toFixed(4) + '%';
      tt.classList.add('show');
      const rect = canvas.getBoundingClientRect();
      let lx = evt.native.clientX - rect.left + 10;
      if (lx > rect.width - 150) lx -= 160;
      tt.style.left = lx + 'px';
    },
  };
}

// ── Render ────────────────────────────────────────────────────────────────────
function render(d) {
  const { latest, daily, chart, thresholds, us_session_start } = d;

  // Header
  const ts = new Date(latest.ts);
  document.getElementById('upd-time').textContent  = cstLabel(latest.ts) + ' CST';
  document.getElementById('cur-segment').textContent = currentSegment();

  // Main price
  document.getElementById('main-price').textContent = fmt(latest.usdkrw);

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

  // Build sorted chart data (oldest → newest)
  const sorted = [...chart].reverse();
  const labels = sorted.map(p => cstLabel(p.ts));

  // Main chart
  const mainData = sorted.map(p => p.r);
  const mainCR   = computeCR(sorted, 'r');
  makeMainChart(labels, mainData, mainCR, sorted, daily, thresholds);

  // Index definitions
  const indices = [
    { key:'kospi',  label:'KOSPI',   field:'k', priceId:'kospi-val',  chgId:'kospi-chg',  hlId:'kospi-hl',  prev: latest.kospi_prev  },
    { key:'nasdaq', label:'NASDAQ',  field:'n', priceId:'nasdaq-val', chgId:'nasdaq-chg', hlId:'nasdaq-hl', prev: latest.nasdaq_prev },
    { key:'sp500',  label:'S&P 500', field:'s', priceId:'sp500-val',  chgId:'sp500-chg',  hlId:'sp500-hl',  prev: latest.sp500_prev  },
  ];

  const priceMap = {
    kospi:  latest.kospi_price,
    nasdaq: latest.nasdaq_price,
    sp500:  latest.sp500_price,
  };

  for (const idx of indices) {
    const price = priceMap[idx.key];
    const chg   = (price != null && idx.prev != null)
      ? ((price - idx.prev) / idx.prev) * 100
      : null;

    // Current value + change
    document.getElementById(idx.priceId).textContent = fmt(price, 1);
    const chgEl = document.getElementById(idx.chgId);
    chgEl.textContent = fmtChg(chg);
    chgEl.className   = 'idx-chg ' + chgCls(chg);

    // Daily high/low from chart history
    const vals = sorted.map(p => p[idx.field]).filter(v => v != null);
    const hlEl = document.getElementById(idx.hlId);
    if (vals.length > 1) {
      const lo = Math.min(...vals), hi = Math.max(...vals);
      hlEl.innerHTML = '最低 ' + fmt(lo, 1) + '<br>最高 ' + fmt(hi, 1);
    } else {
      hlEl.textContent = '—';
    }

    // Chart
    const idxData = sorted.map(p => p[idx.field]);
    const idxCR   = computeCR(sorted, idx.field);
    const color   = chg == null ? ACCENT : chg >= 0 ? UP : DOWN;
    makeIdxChart(idx.key, 'c-'+idx.key, 'tt-'+idx.key,
                 labels, idxData, idxCR, color);
  }

  // 排序：20:00 CST 后 KOSPI 移到最后
  const cstHour = (new Date().getUTCHours() + 8) % 24;
  const isUS    = cstHour >= (d.us_session_start ?? 20);
  const order   = isUS
    ? ['nasdaq', 'sp500', 'kospi']
    : ['kospi', 'nasdaq', 'sp500'];
  const container = document.getElementById('idx-container');
  order.forEach(key => container.appendChild(document.getElementById('card-' + key)));

  // Errors
  const banner = document.getElementById('err-banner');
  if (latest.errors?.length) {
    banner.style.display = 'block';
    banner.textContent   = '⚠️ ' + latest.errors.join(' | ');
  } else {
    banner.style.display = 'none';
  }
}

// ── Fetch & refresh ───────────────────────────────────────────────────────────
async function refresh() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.latest && data.chart) render(data);
  } catch (e) {
    document.getElementById('upd-time').textContent = '加载失败：' + e.message;
  }
  // Always update segment label even if data fetch fails
  document.getElementById('cur-segment').textContent = currentSegment();
}

refresh();
setInterval(refresh, 60_000);
</script>
</body>
</html>`;
}