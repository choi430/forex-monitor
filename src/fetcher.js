// ─── Twelve Data — USD/KRW ───────────────────────────────────────────────────

/**
 * Fetch the current USD/KRW mid-price from Twelve Data.
 * Returns { price, prevClose } on success, throws on failure.
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
 * Returns { price, prevClose, changePercent } on success, throws on failure.
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

  return { price, prevClose, changePercent };
}

// ─── Fetch All Data ───────────────────────────────────────────────────────────

/**
 * Fetch USD/KRW + all three indices.
 * Falls back to cached values on per-source failure.
 * Returns { usdkrw, usdkrw_prev, kospi, nasdaq, sp500, errors, ts }
 *   where each index is { price, prevClose, changePercent } | null.
 */
export async function fetchAllData(env, cached) {
  const errors = [];
  const ts     = Date.now();

  // ── USD/KRW ──────────────────────────────────────────────────────────────
  let usdkrw      = cached?.usdkrw      ?? null;
  let usdkrw_prev = cached?.usdkrw_prev ?? null;

  try {
    const r    = await fetchUSDKRW(env.TWELVE_DATA_KEY);
    usdkrw      = r.price;
    usdkrw_prev = r.prevClose;
  } catch (e) {
    errors.push(`Twelve Data (USD/KRW): ${e.message}`);
  }

  // ── Indices ───────────────────────────────────────────────────────────────
  const indexDefs = [
    { key: 'kospi',  symbol: '^KS11'  },
    { key: 'nasdaq', symbol: '^IXIC'  },
    { key: 'sp500',  symbol: '^GSPC'  },
  ];

  const indices = {};
  for (const { key, symbol } of indexDefs) {
    const fallback = cached ? {
      price:         cached[`${key}_price`] ?? null,
      prevClose:     cached[`${key}_prev`]  ?? null,
      changePercent: null,
    } : null;
    try {
      indices[key] = await fetchYahooIndex(symbol);
    } catch (e) {
      errors.push(`Yahoo Finance (${symbol}): ${e.message}`);
      indices[key] = fallback;
    }
  }

  return { usdkrw, usdkrw_prev, ...indices, errors, ts };
}
