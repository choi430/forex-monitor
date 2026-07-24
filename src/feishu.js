import { loadFeishuToken, saveFeishuToken } from './kv.js';
import { fmtPrice, fmtChg, cstTimeStr } from './config.js';

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
