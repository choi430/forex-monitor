export function getAdminHtml() {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>参数设置</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0f0f0f; color: #f0f0f0;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px; padding: 20px;
  }
  h2 { font-size: 18px; margin-bottom: 20px; color: #60a5fa; }
  h3 { font-size: 13px; color: #888; text-transform: uppercase;
       letter-spacing: .06em; margin: 20px 0 10px; }
  .card {
    background: #1a1a1a; border: 1px solid #2a2a2a;
    border-radius: 12px; padding: 16px; margin-bottom: 12px;
  }
  .row { display: flex; align-items: center; justify-content: space-between;
         margin-bottom: 12px; }
  .row:last-child { margin-bottom: 0; }
  label { color: #ccc; flex: 1; }
  .hint { font-size: 11px; color: #666; margin-top: 2px; }
  input[type=number], input[type=password] {
    width: 130px; background: #111; border: 1px solid #333;
    color: #f0f0f0; border-radius: 8px; padding: 7px 10px;
    font-size: 14px; text-align: right;
  }
  input[type=number]:focus, input[type=password]:focus {
    outline: none; border-color: #60a5fa;
  }
  .toggle {
    display: flex; align-items: center; gap: 8px; cursor: pointer;
  }
  input[type=checkbox] { width: 18px; height: 18px; cursor: pointer; accent-color: #60a5fa; }
  .btn {
    width: 100%; padding: 13px; border: none; border-radius: 10px;
    font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 16px;
  }
  .btn-save { background: #60a5fa; color: #000; }
  .btn-save:disabled { background: #333; color: #666; cursor: not-allowed; }
  .msg {
    margin-top: 12px; padding: 10px 14px; border-radius: 8px;
    font-size: 13px; display: none;
  }
  .msg.ok  { background: #052e1c; color: #34d399; display: block; }
  .msg.err { background: #2d0d0d; color: #f87171; display: block; }
  #login-box { max-width: 340px; margin: 60px auto; }
  #main-box  { max-width: 480px; margin: 0 auto; display: none; }
  .pw-row { display: flex; gap: 8px; margin-top: 10px; }
  .pw-row input { flex: 1; width: auto; text-align: left; }
  .pw-row button {
    padding: 7px 16px; background: #60a5fa; color: #000;
    border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
  }
</style>
</head>
<body>

<!-- 登录框 -->
<div id="login-box">
  <div class="card">
    <h2>⚙️ 参数设置</h2>
    <label>访问密码</label>
    <div class="pw-row">
      <input type="password" id="pw-input" placeholder="输入 ADMIN_TOKEN">
      <button onclick="login()">进入</button>
    </div>
    <div class="msg" id="login-msg"></div>
  </div>
</div>

<!-- 主界面 -->
<div id="main-box">
  <h2>⚙️ 参数设置</h2>

  <h3>异动检测</h3>
  <div class="card">
    <div class="row">
      <div><div class="label">N 值（标准差倍数）</div>
           <div class="hint">越大越不敏感，默认 2</div></div>
      <input type="number" id="n_value" step="0.1" min="0.5" max="5">
    </div>
    <div class="row">
      <div><div class="label">滚动窗口（数据点数）</div>
           <div class="hint">统计基准样本量，默认 30</div></div>
      <input type="number" id="rolling_window" step="1" min="5" max="100">
    </div>
  </div>

  <h3>播报与冷却</h3>
  <div class="card">
    <div class="row">
      <div><div class="label">定期播报间隔（分钟）</div>
           <div class="hint">默认 60 分钟</div></div>
      <input type="number" id="broadcast_interval" step="5" min="15">
    </div>
    <div class="row">
      <div><div class="label">条件3冷却时间（分钟）</div>
           <div class="hint">触及高低点后多久可再次推送，默认 30</div></div>
      <input type="number" id="cooldown_3" step="5" min="0">
    </div>
    <div class="row">
      <div><div class="label">美股时段起始（CST 小时）</div>
          <div class="hint">此时间后 KOSPI 排到最后，默认 20（即 20:00）</div></div>
      <input type="number" id="us_session_start" step="1" min="0" max="23">
    </div>
  </div>

  <h3>绝对阈值（条件4）</h3>
  <div class="card">
    <div class="row">
      <div><div class="label">高位阈值</div>
           <div class="hint">汇率高于此值触发，触发后会自动上调 +5</div></div>
      <input type="number" id="threshold_high" step="0.1" placeholder="不设置">
    </div>
    <div class="row">
      <div><div class="label">低位阈值</div>
           <div class="hint">汇率低于此值触发，触发后会自动下调 -5</div></div>
      <input type="number" id="threshold_low" step="0.1" placeholder="不设置">
    </div>
  </div>

  <h3>抓取频率（分钟）</h3>
  <div class="card">
    <div class="row">
      <div><div class="label">高频间隔（360）</div>
           <div class="hint">默认 1 分钟 · 07:30–09:00 / 13:30–15:30 / 20:00–22:30</div></div>
      <input type="number" id="interval_high" step="1" min="1">
    </div>
    <div class="row">
      <div><div class="label">中频间隔（420）</div>
           <div class="hint">默认 3 分钟 · 07:00–07:30 / 09:00–13:30 / 22:30–00:30</div></div>
      <input type="number" id="interval_mid" step="1" min="1">
    </div>
    <div class="row">
      <div><div class="label">低频间隔（660）</div>
           <div class="hint">默认 15 分钟 · 15:30–20:00 / 00:30–07:00</div></div>
      <input type="number" id="interval_low" step="1" min="1">
    </div>
  </div>

  <h3>通知开关</h3>
  <div class="card">
    <div class="row">
      <label class="toggle">
        <input type="checkbox" id="notify_all">全局开关（关闭后所有通知停止）
      </label>
    </div>
    <div class="row">
      <label class="toggle"><input type="checkbox" id="notify_1">条件1：定期播报</label>
    </div>
    <div class="row">
      <label class="toggle"><input type="checkbox" id="notify_2">条件2：异动检测</label>
    </div>
    <div class="row">
      <label class="toggle"><input type="checkbox" id="notify_3">条件3：日内高低点</label>
    </div>
    <div class="row">
      <label class="toggle"><input type="checkbox" id="notify_4">条件4：绝对阈值</label>
    </div>
  </div>

  <button class="btn btn-save" id="save-btn" onclick="save()">保存参数</button>
  <div class="msg" id="save-msg"></div>
</div>

<script>
let TOKEN = '';

async function login() {
  TOKEN = document.getElementById('pw-input').value.trim();
  const msg = document.getElementById('login-msg');
  try {
    const res = await fetch('/api/config', {
      headers: { 'X-Admin-Token': TOKEN }
    });
    if (res.status === 403) {
      msg.textContent = '密码错误'; msg.className = 'msg err'; return;
    }
    const cfg = await res.json();
    fillForm(cfg);
    document.getElementById('login-box').style.display = 'none';
    document.getElementById('main-box').style.display  = 'block';
  } catch(e) {
    msg.textContent = '连接失败：' + e.message; msg.className = 'msg err';
  }
}

function fillForm(cfg) {
  const num = (id, val) => {
    document.getElementById(id).value = val ?? '';
  };
  const chk = (id, val) => {
    document.getElementById(id).checked = val !== false;
  };
  num('n_value',            cfg.n_value ?? 2);
  num('rolling_window',     cfg.rolling_window ?? 30);
  num('broadcast_interval', cfg.broadcast_interval ?? 60);
  num('cooldown_3',         cfg.cooldown_3 ?? 30);
  document.getElementById('threshold_high').value = cfg.threshold_high != null ? cfg.threshold_high : '';
  document.getElementById('threshold_low').value  = cfg.threshold_low  != null ? cfg.threshold_low  : '';
  num('interval_high',      cfg.interval_high ?? 1);
  num('interval_mid',       cfg.interval_mid ?? 3);
  num('interval_low',       cfg.interval_low ?? 15);
  chk('notify_all', cfg.notify_all);
  chk('notify_1',   cfg.notify_1);
  chk('notify_2',   cfg.notify_2);
  chk('notify_3',   cfg.notify_3);
  chk('notify_4',   cfg.notify_4);
  num('us_session_start', cfg.us_session_start ?? 20);
}

function readForm() {
  const num = id => {
    const v = document.getElementById(id).value;
    return v === '' ? null : parseFloat(v);
  };
  const chk = id => document.getElementById(id).checked;
  return {
    n_value:            num('n_value'),
    rolling_window:     num('rolling_window'),
    broadcast_interval: num('broadcast_interval'),
    cooldown_3:         num('cooldown_3'),
    threshold_high:     num('threshold_high'),
    threshold_low:      num('threshold_low'),
    interval_high:      num('interval_high'),
    interval_mid:       num('interval_mid'),
    interval_low:       num('interval_low'),
    notify_all: chk('notify_all'),
    notify_1:   chk('notify_1'),
    notify_2:   chk('notify_2'),
    notify_3:   chk('notify_3'),
    notify_4:   chk('notify_4'),
    us_session_start: num('us_session_start'),
  };
}

async function save() {
  const btn = document.getElementById('save-btn');
  const msg = document.getElementById('save-msg');
  btn.disabled = true; btn.textContent = '保存中…';
  try {
    const form = readForm();
    if (form.threshold_high === null && form.threshold_low === null) {
      const confirmed = confirm('高低位阈值均为空，确认保存吗？（将清除已有阈值设置）');
      if (!confirmed) {
        btn.disabled = false; btn.textContent = '保存参数';
        return;
      }
    }
    const res = await fetch('/api/config', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': TOKEN },
      body: JSON.stringify(form),
    });
    if (res.status === 403) {
      msg.textContent = '认证失败，请刷新页面重新登录';
      msg.className = 'msg err';
    } else {
      msg.textContent = '✅ 参数已保存，下一次 Cron 触发时生效';
      msg.className = 'msg ok';
    }
  } catch(e) {
    msg.textContent = '保存失败：' + e.message; msg.className = 'msg err';
  }
  btn.disabled = false; btn.textContent = '保存参数';
}

// 回车键登录
document.getElementById('pw-input')
  .addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
</script>
</body>
</html>`;
}