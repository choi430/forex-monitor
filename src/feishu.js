import { loadConfig, saveConfig, loadFeishuToken, saveFeishuToken } from './kv.js';
import { DEFAULT_CONFIG, fmtPrice, fmtChg, cstTimeStr } from './config.js';

const API = 'https://open.feishu.cn/open-apis';

// ─── Access Token ─────────────────────────────────────────────────────────────

export async function getAccessToken(env) {
  const cached = await loadFeishuToken(env.FOREX_KV);
  if (cached && Date.now() < cached.expires_at) return cached.token;

  const res = await fetch(`${API}/auth/v3/tenant_access_token/internal`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      app_id:     env.FEISHU_APP_ID,
      app_secret: env.FEISHU_APP_SECRET,
    }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Feishu token error: ${data.msg}`);

  await saveFeishuToken(env.FOREX_KV, data.tenant_access_token, data.expire);
  return data.tenant_access_token;
}

// ─── Send Message Card ────────────────────────────────────────────────────────

export async function sendCard(env, card) {
  const token = await getAccessToken(env);
  const res   = await fetch(
    `${API}/im/v1/messages?receive_id_type=chat_id`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        receive_id: env.FEISHU_CHAT_ID,
        msg_type:   'interactive',
        content:    JSON.stringify(card),
      }),
    },
  );
  const data = await res.json();
  if (data.code !== 0) console.error('Feishu sendCard error:', data.msg);
  return data;
}

// ─── Card Builders ────────────────────────────────────────────────────────────

const CARD_COLORS = {
  broadcast: 'blue',
  anomaly:   'orange',
  high:      'carmine',
  low:       'green',
  th_high:   'red',
  th_low:    'violet',
  error:     'red',
  info:      'wathet',
};

const CARD_TITLES = {
  broadcast: '📊 定期播报',
  anomaly:   '⚡ 汇率异动',
  high:      '🔺 日内新高',
  low:       '🔻 日内新低',
  th_high:   '🚨 突破高位阈值',
  th_low:    '🚨 跌破低位阈值',
  error:     '⚠️ 数据异常',
  info:      'ℹ️ 系统通知',
};

/**
 * Build a Feishu interactive card for a price alert notification.
 *
 * @param {string}  type         Notification type key
 * @param {object}  fetchResult  Latest fetched data
 * @param {object}  daily        Daily state (high, low)
 * @param {number}  nowTs        Timestamp
 * @param {string}  reason       Trigger description
 * @param {object}  [extra]      Extra anomaly detail
 */
export function buildAlertCard(type, fetchResult, daily, nowTs, reason, extra) {
  const { usdkrw, usdkrw_prev, kospi, nasdaq, sp500 } = fetchResult;

  const usdkrwChg = usdkrw_prev
    ? ((usdkrw - usdkrw_prev) / usdkrw_prev) * 100
    : null;

  // Position within today's session range (0–100%)
  const range      = daily.high - daily.low;
  const position   = range > 0
    ? (((usdkrw - daily.low) / range) * 100).toFixed(1)
    : '50.0';

  // Main USD/KRW block
  const mainFields = [
    {
      is_short: true,
      text: {
        tag:     'lark_md',
        content: `**💱 USD/KRW**\n**${fmtPrice(usdkrw)}**`,
      },
    },
    {
      is_short: true,
      text: {
        tag:     'lark_md',
        content: `**较上日收盘**\n${fmtChg(usdkrwChg)}`,
      },
    },
  ];

  // Session range block
  const rangeFields = [
    {
      is_short: true,
      text: {
        tag:     'lark_md',
        content: `**日内最低**\n${fmtPrice(daily.low)}`,
      },
    },
    {
      is_short: true,
      text: {
        tag:     'lark_md',
        content: `**日内最高**\n${fmtPrice(daily.high)}`,
      },
    },
  ];

  // Index block
  const idxLines = [
    kospi  ? `**KOSPI**  ${fmtPrice(kospi.price, 1)}  ${fmtChg(kospi.changePercent)}`  : null,
    nasdaq ? `**NASDAQ**  ${fmtPrice(nasdaq.price, 1)}  ${fmtChg(nasdaq.changePercent)}` : null,
    sp500  ? `**S&P 500**  ${fmtPrice(sp500.price, 1)}  ${fmtChg(sp500.changePercent)}`  : null,
  ].filter(Boolean);

  // Anomaly extra note
  const noteText = extra
    ? `变化率/分：${extra.changeRatePerMin >= 0 ? '+' : ''}${Number(extra.changeRatePerMin).toFixed(4)}%`
      + `  |  均值 ${extra.mean}%  标准差 ${extra.std}%  阈值 ±${extra.threshold}%`
    : `当前位于今日区间 ${position}% 处`;

  return {
    config: { wide_screen_mode: false, enable_forward: false },
    header: {
      title:    { tag: 'plain_text', content: CARD_TITLES[type] ?? type },
      template: CARD_COLORS[type] ?? 'blue',
    },
    elements: [
      { tag: 'div', fields: mainFields },
      { tag: 'hr' },
      { tag: 'div', fields: rangeFields },
      { tag: 'hr' },
      {
        tag:  'div',
        text: { tag: 'lark_md', content: idxLines.join('\n') },
      },
      { tag: 'hr' },
      {
        tag:      'note',
        elements: [
          { tag: 'plain_text', content: `触发：${reason}` },
          { tag: 'plain_text', content: noteText },
          { tag: 'plain_text', content: `时间：${cstTimeStr(nowTs)}` },
        ],
      },
    ],
  };
}

/** Simple text card for command replies and system notices */
export function buildInfoCard(title, lines) {
  return {
    config:  { wide_screen_mode: false },
    header:  { title: { tag: 'plain_text', content: title }, template: 'wathet' },
    elements: [
      {
        tag:  'div',
        text: { tag: 'lark_md', content: lines.join('\n') },
      },
    ],
  };
}

/** Error alert card */
export function buildErrorCard(errors, nowTs) {
  return {
    config:  { wide_screen_mode: false },
    header:  { title: { tag: 'plain_text', content: '⚠️ 数据拉取异常' }, template: 'red' },
    elements: [
      {
        tag:  'div',
        text: { tag: 'lark_md', content: errors.map(e => `- ${e}`).join('\n') },
      },
      {
        tag:      'note',
        elements: [{ tag: 'plain_text', content: `时间：${cstTimeStr(nowTs)}  |  已使用缓存数据` }],
      },
    ],
  };
}

// ─── Command Handler ──────────────────────────────────────────────────────────

const PARAM_MAP = {
  n:                 'n_value',
  n_value:           'n_value',
  window:            'rolling_window',
  rolling_window:    'rolling_window',
  broadcast:         'broadcast_interval',
  broadcast_interval:'broadcast_interval',
  cooldown_3:        'cooldown_3',
  th_high:           'threshold_high',
  threshold_high:    'threshold_high',
  th_low:            'threshold_low',
  threshold_low:     'threshold_low',
  interval_high:     'interval_high',
  interval_mid:      'interval_mid',
  interval_low:      'interval_low',
  us_session_start:  'us_session_start',
};

const NUMERIC_PARAMS = new Set([
  'n_value', 'rolling_window', 'broadcast_interval',
  'cooldown_3', 'threshold_high', 'threshold_low',
  'interval_high', 'interval_mid', 'interval_low',
  'us_session_start',
]);

const CONDITION_FLAGS = {
  '1': 'notify_1', '2': 'notify_2', '3': 'notify_3', '4': 'notify_4',
};

export async function handleCommand(env, text) {
  const t = text.trim();

  // /help
  if (t === '/help') {
    return buildInfoCard('📖 指令列表', [
      '**参数设置**',
      '`/set <参数> <值>` — 修改参数',
      '`/clear th_high` 或 `/clear th_low` — 清除阈值',
      '',
      '**可设置参数**',
      '`n` / `n_value` — 异动检测倍数（默认 2）',
      '`window` — 滚动窗口点数（默认 30）',
      '`broadcast` — 定期播报间隔分钟（默认 60）',
      '`cooldown_3` — 条件3冷却分钟（默认 30）',
      '`th_high` / `th_low` — 高/低位绝对阈值',
      '`interval_high/mid/low` — 各频次抓取间隔（分钟）',
      '',
      '**开关控制**',
      '`/pause` — 暂停所有通知',
      '`/resume` — 恢复所有通知',
      '`/pause 2` — 单独暂停条件2',
      '`/resume 2` — 单独恢复条件2',
      '',
      '**查看状态**',
      '`/status` — 显示所有当前参数',
    ]);
  }

  // /status
  if (t === '/status') {
    const config = await loadConfig(env.FOREX_KV);
    return buildInfoCard('📋 当前参数', [
      `**N值（异动倍数）**：${config.n_value}`,
      `**滚动窗口**：${config.rolling_window} 个点`,
      `**定期播报**：每 ${config.broadcast_interval} 分钟`,
      `**条件3冷却**：${config.cooldown_3} 分钟`,
      `**高位阈值**：${config.threshold_high ?? '未设置'}`,
      `**低位阈值**：${config.threshold_low ?? '未设置'}`,
      `**抓取频次**：高频 ${config.interval_high}min / 中频 ${config.interval_mid}min / 低频 ${config.interval_low}min`,
      '',
      `**全局通知**：${config.notify_all ? '✅ 开' : '❌ 关'}`,
      `条件1（播报）：${config.notify_1 ? '✅' : '❌'}`
        + `  条件2（异动）：${config.notify_2 ? '✅' : '❌'}`,
      `条件3（高低点）：${config.notify_3 ? '✅' : '❌'}`
        + `  条件4（阈值）：${config.notify_4 ? '✅' : '❌'}`,
    ]);
  }

  // /pause and /resume
  const pauseMatch  = t.match(/^\/(pause|resume)(?: (\d))?$/);
  if (pauseMatch) {
    const isPause = pauseMatch[1] === 'pause';
    const target  = pauseMatch[2];
    const config  = await loadConfig(env.FOREX_KV);

    if (target) {
      const flag = CONDITION_FLAGS[target];
      if (!flag) return buildInfoCard('❌ 错误', [`条件 ${target} 不存在，有效值为 1-4`]);
      config[flag] = !isPause;
      await saveConfig(env.FOREX_KV, config);
      return buildInfoCard('✅ 已更新', [
        `条件 ${target} 通知已${isPause ? '暂停' : '恢复'}`,
      ]);
    } else {
      config.notify_all = !isPause;
      await saveConfig(env.FOREX_KV, config);
      return buildInfoCard('✅ 已更新', [
        `所有通知已${isPause ? '暂停' : '恢复'}`,
      ]);
    }
  }

  // /set <key> <value>
  const setMatch = t.match(/^\/set (\S+) (.+)$/);
  if (setMatch) {
    const rawKey    = setMatch[1].toLowerCase();
    const rawValue  = setMatch[2].trim();
    const configKey = PARAM_MAP[rawKey];

    if (!configKey) {
      return buildInfoCard('❌ 错误', [
        `未知参数：${rawKey}`,
        '发送 /help 查看可设置参数列表',
      ]);
    }

    const config = await loadConfig(env.FOREX_KV);

    if (NUMERIC_PARAMS.has(configKey)) {
      const num = parseFloat(rawValue);
      if (isNaN(num)) {
        return buildInfoCard('❌ 错误', [`"${rawValue}" 不是有效数字`]);
      }
      config[configKey] = num;
    } else {
      config[configKey] = rawValue;
    }

    await saveConfig(env.FOREX_KV, config);
    return buildInfoCard('✅ 已更新', [`${configKey} = ${config[configKey]}`]);
  }

  // /clear th_high | th_low
  const clearMatch = t.match(/^\/clear (th_high|th_low|threshold_high|threshold_low)$/);
  if (clearMatch) {
    const config = await loadConfig(env.FOREX_KV);
    const key    = clearMatch[1].startsWith('th_high') || clearMatch[1] === 'threshold_high'
      ? 'threshold_high'
      : 'threshold_low';
    config[key]  = null;
    await saveConfig(env.FOREX_KV, config);
    return buildInfoCard('✅ 已清除', [`${key} 已清除，条件4该方向不再触发`]);
  }

  // Unknown command
  if (t.startsWith('/')) {
    return buildInfoCard('❓ 未识别指令', ['发送 /help 查看所有可用指令']);
  }

  return null; // not a command, ignore
}
