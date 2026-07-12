export function getPWAHtml() {
  return /* html */`<!DOCTYPE html>
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
    --bg:      #0f0f0f;
    --card:    #1a1a1a;
    --border:  #2a2a2a;
    --text:    #f0f0f0;
    --muted:   #888;
    --down:      #34d399;
    --up:    #f87171;
    --accent:  #60a5fa;
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
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--border);
  }
  .header-title { font-size: 16px; font-weight: 600; }
  .header-sub   { font-size: 11px; color: var(--muted); text-align: right; }
  .dot-live     { display: inline-block; width: 7px; height: 7px;
                  border-radius: 50%; background: var(--up);
                  animation: pulse 2s infinite; margin-right: 5px; }
  @keyframes pulse {
    0%,100% { opacity: 1; } 50% { opacity: .3; }
  }
  .main-card {
    margin: 12px 12px 6px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 14px; padding: 16px;
  }
  .main-label { font-size: 11px; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; margin-bottom: 4px; }
  .main-price { font-size: 36px; font-weight: 700; letter-spacing: -.5px; line-height: 1; }
  .badges     { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  .badge {
    font-size: 12px; font-weight: 600; padding: 3px 9px;
    border-radius: 6px;
  }
  .badge.up   { background: #052e1c; color: var(--up); }
  .badge.down { background: #2d0d0d; color: var(--down); }
  .badge.neu  { background: #1e2a3a; color: var(--accent); }
  /* Range bar */
  .range-row  { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 11px; color: var(--muted); }
  .range-bar  { flex: 1; height: 5px; background: var(--border); border-radius: 3px; position: relative; }
  .range-fill { position: absolute; height: 100%; background: var(--accent); border-radius: 3px; }
  .range-dot  {
    position: absolute; width: 10px; height: 10px;
    background: #fff; border-radius: 50%; top: -2.5px;
    transform: translateX(-50%); box-shadow: 0 0 0 2px var(--accent);
  }
  /* Main chart */
  .chart-wrap { position: relative; margin-top: 12px; height: 100px; }
  canvas      { width: 100% !important; }
  .tooltip-box {
    display: none; position: absolute; top: 4px;
    background: #222; border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 10px; font-size: 12px; z-index: 5;
    pointer-events: none; white-space: nowrap;
  }
  .tooltip-box.show { display: block; }
  .tt-time  { color: var(--muted); font-size: 11px; margin-bottom: 4px; }
  .tt-row   { display: flex; justify-content: space-between; gap: 14px; }
  .tt-label { color: var(--muted); }
  .tt-val   { font-weight: 600; }
  /* Prev-close note */
  .prev-note { font-size: 11px; color: var(--muted); text-align: right; margin-top: 6px; }
  /* Index grid */
  .section-label { font-size: 11px; color: var(--muted); letter-spacing: .06em;
                   text-transform: uppercase; margin: 12px 12px 6px; }
  .idx-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0 12px 12px; }
  .idx-card  {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; padding: 12px; cursor: pointer;
    transition: border-color .15s;
  }
  .idx-card:active { border-color: var(--accent); }
  .idx-name  { font-size: 11px; color: var(--muted); margin-bottom: 3px; }
  .idx-val   { font-size: 18px; font-weight: 600; }
  .idx-chg   { font-size: 11px; margin-top: 3px; font-weight: 600; }
  .idx-chg.up   { color: var(--up); }
  .idx-chg.down { color: var(--down); }
  .mini-chart   { margin-top: 8px; height: 36px; }
  /* Footer */
  .footer {
    font-size: 11px; color: var(--muted);
    text-align: center; padding: 8px 16px 16px;
    border-top: 1px solid var(--border);
  }
  .err-banner {
    margin: 0 12px 8px; background: #2d0d0d;
    border: 1px solid #5a1a1a; border-radius: 10px;
    padding: 8px 12px; font-size: 12px; color: #f87171; display: none;
  }
</style>
</head>
<body>

<div class="header">
  <span class="header-title">💱 汇率监控</span>
  <span class="header-sub">
    <span class="dot-live"></span>
    <span id="upd-time">加载中…</span><br>60秒自动刷新
  </span>
</div>

<!-- Error banner -->
<div class="err-banner" id="err-banner"></div>

<!-- Main USD/KRW card -->
<div class="main-card">
  <div class="main-label">USD / KRW</div>
  <div class="main-price" id="main-price">—</div>
  <div class="badges">
    <span class="badge neu" id="badge-day">较上日 —</span>
    <span class="badge neu" id="badge-pos">区间位置 —</span>
  </div>

  <div class="range-row">
    <span id="range-low">—</span>
    <div class="range-bar">
      <div class="range-fill" id="range-fill" style="width:0%"></div>
      <div class="range-dot"  id="range-dot"  style="left:0%"></div>
    </div>
    <span id="range-high">—</span>
  </div>

  <div class="chart-wrap">
    <canvas id="main-chart" role="img" aria-label="USD/KRW日内走势"></canvas>
    <div class="tooltip-box" id="tt">
      <div class="tt-time" id="tt-time">—</div>
      <div class="tt-row"><span class="tt-label">汇率</span><span class="tt-val" id="tt-val">—</span></div>
      <div class="tt-row"><span class="tt-label">变化率/分</span><span class="tt-val" id="tt-cr">—</span></div>
    </div>
  </div>
  <div class="prev-note">较上日收盘&nbsp;<span id="prev-chg">—</span></div>
</div>

<!-- Index cards -->
<div class="section-label">主要指数</div>
<div class="idx-grid">
  <div class="idx-card" id="card-kospi">
    <div class="idx-name">KOSPI</div>
    <div class="idx-val"  id="kospi-val">—</div>
    <div class="idx-chg"  id="kospi-chg">—</div>
    <div class="mini-chart"><canvas id="c-kospi" role="img" aria-label="KOSPI走势"></canvas></div>
  </div>
  <div class="idx-card" id="card-nasdaq">
    <div class="idx-name">NASDAQ</div>
    <div class="idx-val"  id="nasdaq-val">—</div>
    <div class="idx-chg"  id="nasdaq-chg">—</div>
    <div class="mini-chart"><canvas id="c-nasdaq" role="img" aria-label="NASDAQ走势"></canvas></div>
  </div>
  <div class="idx-card" id="card-sp500">
    <div class="idx-name">S&amp;P 500</div>
    <div class="idx-val"  id="sp500-val">—</div>
    <div class="idx-chg"  id="sp500-chg">—</div>
    <div class="mini-chart"><canvas id="c-sp500" role="img" aria-label="S&P 500走势"></canvas></div>
  </div>
  <div class="idx-card" style="display:flex;flex-direction:column;
       justify-content:center;align-items:center;gap:6px;cursor:default">
    <div class="idx-name">当前时段</div>
    <div id="next-broadcast" style="font-size:15px;font-weight:600;color:var(--accent)">—</div>
    <div class="idx-name" style="margin-top:4px">数据来源</div>
    <div style="font-size:10px;color:var(--muted);text-align:center">
      Twelve Data<br>Yahoo Finance
    </div>
  </div>
</div>

<div class="footer" id="footer">Forex Monitor · Powered by Cloudflare Workers</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
const DOWN = '#34d399', UP = '#f87171', ACCENT = '#60a5fa', MUTED = '#333';

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n, d=2) => n == null ? '—' : n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtChg = pct => pct == null ? '—' : (pct>=0?'▲ +':'▼ ')+Math.abs(pct).toFixed(2)+'%';
const chgColor = pct => pct == null ? 'neu' : pct >= 0 ? 'up' : 'down';

function setBadge(el, text, cls) {
  el.textContent = text;
  el.className = 'badge ' + cls;
}

// ── Chart instances ──────────────────────────────────────────────────────────
let mainChart = null;
const miniCharts = {};

function makeMainChart(labels, data) {
  const ctx = document.getElementById('main-chart');
  if (mainChart) mainChart.destroy();
  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets:[{
        data, borderColor: ACCENT, borderWidth: 2,
        pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: ACCENT,
        fill: true,
        backgroundColor: ctx => {
          const g = ctx.chart.ctx.createLinearGradient(0,0,0,100);
          g.addColorStop(0,'rgba(96,165,250,.25)');
          g.addColorStop(1,'rgba(96,165,250,.02)');
          return g;
        },
        tension: 0.35,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend:{display:false}, tooltip:{enabled:false} },
      scales: {
        x: { grid:{color:MUTED}, ticks:{color:'#666',font:{size:10},maxTicksLimit:6} },
        y: { grid:{color:MUTED}, ticks:{
          color:'#666', font:{size:10},
          callback: v => v.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}),
        }},
      },
      interaction: { mode:'index', intersect:false },
      onHover: (evt, els) => {
        const tt = document.getElementById('tt');
        if (!els.length) { tt.classList.remove('show'); return; }
        const i  = els[0].index;
        const v  = data[i];
        const cr = changeRates[i];
        document.getElementById('tt-time').textContent = labels[i];
        document.getElementById('tt-val').textContent  = fmt(v);
        document.getElementById('tt-cr').textContent   =
          cr == null ? '—' : (cr>=0?'+':'')+cr.toFixed(4)+'%';
        tt.classList.add('show');
        // position tooltip
        const rect = ctx.getBoundingClientRect();
        let lx = evt.native.clientX - rect.left + 10;
        if (lx > rect.width - 140) lx -= 150;
        tt.style.left = lx + 'px';
      },
    },
  });
}

function makeMini(id, data, color) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (miniCharts[id]) miniCharts[id].destroy();
  miniCharts[id] = new Chart(ctx, {
    type:'line',
    data:{ labels:data.map((_,i)=>i), datasets:[{
      data, borderColor:color, borderWidth:1.5,
      pointRadius:0, fill:true,
      backgroundColor: color+'22', tension:0.4,
    }]},
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      plugins:{legend:{display:false},tooltip:{enabled:false}},
      scales:{x:{display:false},y:{display:false}},
    },
  });
}

// ── Change rates for tooltip ─────────────────────────────────────────────────
let changeRates = [];

// ── Render ───────────────────────────────────────────────────────────────────
function render(d) {
  const { latest, daily, chart } = d;

  // --- Header time ---
  const ts = new Date(latest.ts);
  const cstH = (ts.getUTCHours()+8)%24;
  const cstM = ts.getUTCMinutes();
  document.getElementById('upd-time').textContent =
    String(cstH).padStart(2,'0')+':'+String(cstM).padStart(2,'0')+' CST';

  // --- Main price ---
  document.getElementById('main-price').textContent = fmt(latest.usdkrw);

  // --- Day change badge ---
  const dayChg = latest.usdkrw_prev
    ? ((latest.usdkrw - latest.usdkrw_prev) / latest.usdkrw_prev) * 100
    : null;
  setBadge(
    document.getElementById('badge-day'),
    '较上日 ' + fmtChg(dayChg),
    chgColor(dayChg),
  );
  document.getElementById('prev-chg').textContent = fmtChg(dayChg);
  document.getElementById('prev-chg').style.color =
    dayChg == null ? '' : dayChg >= 0 ? UP : DOWN;

  // --- Range bar ---
  const rng = daily.high - daily.low;
  const pos = rng > 0 ? ((latest.usdkrw - daily.low) / rng) * 100 : 50;
  document.getElementById('range-low').textContent  = fmt(daily.low);
  document.getElementById('range-high').textContent = fmt(daily.high);
  document.getElementById('range-fill').style.width = pos.toFixed(1) + '%';
  document.getElementById('range-dot').style.left   = pos.toFixed(1) + '%';
  setBadge(
    document.getElementById('badge-pos'),
    '区间 ' + pos.toFixed(0) + '%',
    pos > 70 ? 'down' : pos < 30 ? 'up' : 'neu',
  );

  // --- Main chart (oldest → newest) ---
  const sorted = [...chart].reverse();
  const labels = sorted.map(p => {
    const d2 = new Date(p.ts + 8*3600_000);
    return String((d2.getUTCHours())%24).padStart(2,'0')
         + ':' + String(d2.getUTCMinutes()).padStart(2,'0');
  });
  const rateData = sorted.map(p => p.r);

  // Compute per-minute change rate for tooltip
  changeRates = sorted.map((p,i) => {
    if (i === 0) return null;
    const prev    = sorted[i-1];
    const diffMin = (p.ts - prev.ts) / 60_000;
    return diffMin > 0 ? ((p.r - prev.r) / prev.r / diffMin) * 100 : null;
  });

  makeMainChart(labels, rateData);

  // --- Index cards ---
  const indices = [
    { id:'kospi',  label:'KOSPI',   price: latest.kospi_price,  prev: latest.kospi_prev,  key:'k' },
    { id:'nasdaq', label:'NASDAQ',  price: latest.nasdaq_price, prev: latest.nasdaq_prev, key:'n' },
    { id:'sp500',  label:'S&P 500', price: latest.sp500_price,  prev: latest.sp500_prev,  key:'s' },
  ];

  for (const idx of indices) {
    const chg = (idx.price != null && idx.prev != null)
      ? ((idx.price - idx.prev) / idx.prev) * 100
      : null;
    document.getElementById(idx.id+'-val').textContent = fmt(idx.price, 1);
    const chgEl = document.getElementById(idx.id+'-chg');
    chgEl.textContent = fmtChg(chg);
    chgEl.className = 'idx-chg ' + chgColor(chg);

    // Mini sparkline
    const miniData = sorted.map(p => p[idx.key]).filter(v => v != null);
    if (miniData.length > 1) {
      const color = chg == null ? ACCENT : chg >= 0 ? UP : DOWN;
      makeMini('c-'+idx.id, miniData, color);
    }
  }

  // --- Current time segment ---
  const cstMin = ((new Date().getUTCHours() + 8) % 24) * 60 + new Date().getUTCMinutes();
  const extMin = cstMin < 4 * 60 ? cstMin + 1440 : cstMin;
  const segMap = [
    [420,  450,  '中频时段'],
    [450,  540,  '高频时段'],
    [540,  810,  '中频时段'],
    [810,  930,  '高频时段'],
    [930,  1200, '低频时段'],
    [1200, 1350, '高频时段'],
    [1350, 1470, '中频时段'],
    [1470, 1680, '低频时段'],
  ];
  const seg = segMap.find(([s, e]) => extMin >= s && extMin < e);
  document.getElementById('next-broadcast').textContent = seg ? seg[2] : '休市中';

  // --- Errors ---
  const banner = document.getElementById('err-banner');
  if (latest.errors && latest.errors.length > 0) {
    banner.style.display = 'block';
    banner.textContent   = '⚠️ ' + latest.errors.join(' | ');
  } else {
    banner.style.display = 'none';
  }
}

// ── Fetch & refresh ──────────────────────────────────────────────────────────
async function refresh() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.latest && data.chart) render(data);
  } catch(e) {
    document.getElementById('footer').textContent = '数据加载失败：' + e.message;
  }
}

refresh();
setInterval(refresh, 60_000);
</script>
</body>
</html>`;
}
