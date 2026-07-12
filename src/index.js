import { getAdminHtml } from './admin.js';
import { handleCron }         from './scheduler.js';
import { handleCommand, sendCard } from './feishu.js';
import { loadState, loadConfig, saveConfig }   from './kv.js';
import { getPWAHtml }              from './pwa.js';

export default {

  // ── Cron Trigger ───────────────────────────────────────────────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  },

  // ── HTTP Requests ──────────────────────────────────────────────────────────
  async fetch(request, env, ctx) {
    const url      = new URL(request.url);
    const pathname = url.pathname;

    // ── PWA Dashboard ───────────────────────────────────────────────────────
    if (pathname === '/' || pathname === '/index.html') {
      return new Response(getPWAHtml(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    // ── PWA Manifest ────────────────────────────────────────────────────────
    if (pathname === '/manifest.json') {
      return Response.json({
        name:             '汇率监控',
        short_name:       '汇率',
        start_url:        '/',
        display:          'standalone',
        background_color: '#0f0f0f',
        theme_color:      '#0f0f0f',
        icons: [
          { src: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💱</text></svg>', sizes: '512x512', type: 'image/svg+xml' },
        ],
      });
    }

    // ── Data API for PWA ────────────────────────────────────────────────────
    if (pathname === '/api/data') {
      const state = await loadState(env.FOREX_KV);
      if (!state) {
        return Response.json({ error: 'no data yet' }, { status: 503 });
      }
      const config = await loadConfig(env.FOREX_KV);
      return Response.json(
        {
          latest:     state.latest,
          daily:      state.daily,
          chart:      state.chart,
          thresholds: {
            high: config.threshold_high,
            low:  config.threshold_low,
          },
          us_session_start: config.us_session_start ?? 20,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // ── Feishu Event Webhook ─────────────────────────────────────────────────
    if (pathname === '/feishu/webhook' && request.method === 'POST') {
      return handleFeishuWebhook(request, env, ctx);
    }

    // ── Admin 设置页面 ────────────────────────────────────────────────────────
    if (pathname === '/admin') {
      return new Response(getAdminHtml(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    // ── 读取当前 config ───────────────────────────────────────────────────────
    if (pathname === '/api/config' && request.method === 'GET') {
      if (request.headers.get('X-Admin-Token') !== env.ADMIN_TOKEN) {
        return new Response('Forbidden', { status: 403 });
      }
      const config = await loadConfig(env.FOREX_KV);
      return Response.json(config);
    }

    // ── 保存 config ───────────────────────────────────────────────────────────
    if (pathname === '/api/config' && request.method === 'POST') {
      if (request.headers.get('X-Admin-Token') !== env.ADMIN_TOKEN) {
        return new Response('Forbidden', { status: 403 });
      }
      const body = await request.json();
      await saveConfig(env.FOREX_KV, body);
      return Response.json({ ok: true });
    }
    
    return new Response('Not Found', { status: 404 });
  },
};

// ─── Feishu Webhook Handler ───────────────────────────────────────────────────

async function handleFeishuWebhook(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // 1. URL verification challenge (Feishu sends this when first configuring the callback)
  if (body.type === 'url_verification') {
    if (body.token !== env.FEISHU_VERIFY_TOKEN) {
      return new Response('Forbidden', { status: 403 });
    }
    return Response.json({ challenge: body.challenge });
  }

  // 2. Verify event token
  const token = body?.header?.token ?? body?.token;
  if (token !== env.FEISHU_VERIFY_TOKEN) {
    return new Response('Forbidden', { status: 403 });
  }

  // 3. Only handle message receive events
  const eventType = body?.header?.event_type;
  if (eventType !== 'im.message.receive_v1') {
    return new Response('OK');
  }

  // 4. Ignore messages not in our monitored chat (safety check)
  const chatId = body?.event?.message?.chat_id;
  if (chatId && chatId !== env.FEISHU_CHAT_ID) {
    return new Response('OK');
  }

  // 5. Extract text content
  const msgType = body?.event?.message?.msg_type;
  if (msgType !== 'text') return new Response('OK');

  let text = '';
  try {
    const content = JSON.parse(body.event.message.content);
    text = content.text?.trim() ?? '';
    // Strip @mentions (Feishu includes them in the text)
    text = text.replace(/@\S+/g, '').trim();
  } catch {
    return new Response('OK');
  }

  if (!text.startsWith('/')) return new Response('OK'); // not a command

  // 6. Handle command asynchronously (don't block the response to Feishu)
  ctx.waitUntil(
    (async () => {
      try {
        const replyCard = await handleCommand(env, text);
        if (replyCard) await sendCard(env, replyCard);
      } catch (e) {
        console.error('[forex-monitor] command handler error:', e);
      }
    })(),
  );

  return new Response('OK');
}
