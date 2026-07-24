import { getAdminHtml } from './admin.js';
import { handleCron, getSegment } from './scheduler.js';
import { loadState, loadConfig, saveConfig, loadHistory, listHistoryDates } from './kv.js';
import { getPWAHtml }              from './pwa.js';
import { getSessionInfo }          from './config.js';

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
      const nowTs  = Date.now();
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
          session: { segment: getSegment(nowTs), ...getSessionInfo(nowTs) },
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // ── 外部触发器（cron-job.org）─────────────────────────────────────────
    if (pathname === '/trigger' && request.method === 'POST') {
      if (request.headers.get('X-Trigger-Token') !== env.TRIGGER_TOKEN) {
        return new Response('Forbidden', { status: 403 });
      }
      ctx.waitUntil(handleCron(env));
      return new Response('OK');
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
    
    // ── History: list available dates ─────────────────────────────────────────
    if (pathname === '/api/history/dates') {
      const dates = await listHistoryDates(env.FOREX_KV);
      return Response.json(dates, { headers: { 'Cache-Control': 'no-store' } });
    }

    // ── History: get one day's data ───────────────────────────────────────────
    if (pathname === '/api/history') {
      const date = url.searchParams.get('date');
      if (!date) return Response.json({ error: 'date required' }, { status: 400 });
      const data = await loadHistory(env.FOREX_KV, date);
      if (!data) return Response.json({ error: 'not found' }, { status: 404 });
      // chart 是倒序（最新在前），最后一个元素是当天最早的数据点，
      // 用它作为参考时间戳算这一天的 DST/开收盘时段，而不是用现在的时间
      const refTs = data.chart?.length ? data.chart[data.chart.length - 1].ts : Date.now();
      return Response.json(
        { ...data, session: getSessionInfo(refTs) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return new Response('Not Found', { status: 404 });
  },
};
