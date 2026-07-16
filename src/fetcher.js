// ─── Twelve Data — USD/KRW ───────────────────────────────────────────────────

/**
 * Fetch the current USD/KRW mid-price from Twelve Data.
 * Returns { price, prevClose, dataTs } on success, throws on failure.
 * dataTs — 报价的真实时间（来自 last_quote_at，非请求时间），unix ms
 */
export async function fetchUSDKRW(apiKey) {
  const url = `https://api.twelvedata.com/quote?symbol=USD/KRW&apikey=${apiKey}`;
  const res = await fetch(url, { cf: { cacheTtl: 0 } });

  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);

  const data = await res.json();
  if (data.status === 'error') throw new Error(`Twelve Data: ${data.message}`);

  return {
    price:     parseFloat(data.close),      // latest price
    prevClose: parseFloat(data.previous_close ?? data.close),
    dataTs:    data.last_quote_at ? data.last_quote_at * 1000 : null,
  };
}

// ─── Yahoo Finance — Stock Indices ───────────────────────────────────────────

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

/**
 * Fetch current price + previous close for a Yahoo Finance symbol.
 * Symbols: '^KS11' (KOSPI), '^IXIC' (NASDAQ), '^GSPC' (S&P 500)
 * Returns { price, prevClose, changePercent, dataTs } on success, throws on failure.
 * dataTs — 该报价的真实时间（来自 regularMarketTime，非请求时间），unix ms
 */
export async function fetchYahooIndex(symbol) {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1m&range=1d`;

  const res = await fetch(url, { headers: YAHOO_HEADERS, cf: { cacheTtl: 0 } });
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status} for ${symbol}`);

  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`Yahoo Finance: no data for ${symbol}`);

  const price     = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const changePercent = ((price - prevClose) / prevClose) * 100;
  const dataTs    = meta.regularMarketTime ? meta.regularMarketTime * 1000 : null;

  return { price, prevClose, changePercent, dataTs };
}

// ─── Fetch All Data ───────────────────────────────────────────────────────────

/**
 * Fetch USD/KRW + all three indices.
 * Falls back to cached values on per-source failure.
 * Returns { usdkrw, usdkrw_prev, usdkrw_ts, usdkrw_stale, kospi, nasdaq, sp500, errors, ts }
 *   where each index is { price, prevClose, changePercent, dataTs, stale } | null.
 *   stale=true 表示这次抓取失败、用的是缓存旧值（用于标红点/延迟显示"/"）。
 */
export async function fetchAllData(env, cached) {
  const errors = [];
  const ts     = Date.now();

  // ── USD/KRW ──────────────────────────────────────────────────────────────
  let usdkrw       = cached?.usdkrw        ?? null;
  let usdkrw_prev  = cached?.usdkrw_prev   ?? null;
  let usdkrw_ts    = cached?.usdkrw_data_ts ?? null;
  let usdkrw_stale = true;

  // ── Indices ───────────────────────────────────────────────────────────────
  const indexDefs = [
    { key: 'kospi',  symbol: '^KS11'  },
    { key: 'nasdaq', symbol: '^IXIC'  },
    { key: 'sp500',  symbol: '^GSPC'  },
  ];
  const indices = {};

  // 汇率 + 三个指数一起并行请求，缩短整体延迟
  await Promise.all([
    // USD/KRW
    fetchUSDKRW(env.TWELVE_DATA_KEY).then(r => {
      usdkrw       = r.price;
      usdkrw_prev  = r.prevClose;
      usdkrw_ts    = r.dataTs;
      usdkrw_stale = false;
    }).catch(e => {
      errors.push(`Twelve Data (USD/KRW): ${e.message}`);
    }),
    // 三个股指
    ...indexDefs.map(async ({ key, symbol }) => {
      const fallback = {
        price:         cached?.[`${key}_price`]   ?? null,
        prevClose:     cached?.[`${key}_prev`]    ?? null,
        changePercent: null,
        dataTs:        cached?.[`${key}_data_ts`] ?? null,
        stale:         true,
      };
      try {
        const r = await fetchYahooIndex(symbol);
        indices[key] = { ...r, stale: false };
      } catch (e) {
        errors.push(`Yahoo Finance (${symbol}): ${e.message}`);
        indices[key] = fallback;
      }
    }),
  ]);

  return { usdkrw, usdkrw_prev, usdkrw_ts, usdkrw_stale, ...indices, errors, ts };
}
